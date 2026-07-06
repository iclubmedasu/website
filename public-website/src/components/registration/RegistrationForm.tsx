"use client";

import type { PublicEventCustomField, PublicEventRegistrationFormConfig, PublicEventSession, PublicEventTier } from "@iclub/shared";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { ApiRequestError, publicAPI } from "@/lib/api";
import { YesNoField } from "@/components/ui/YesNoToggle";
import { saveRegistrationCache } from "@/lib/registrationCache";
import { formatSessionDisplayLabel } from "@/lib/sessionUtils";
import {
    dropdownOptions,
    emptyRegistrationDraft,
    formatTierPrice,
    parseCustomFieldInputValue,
    type RegistrationDraft,
    validateRegistrationDraft,
} from "@/lib/customFieldUtils";

interface RegistrationFormProps {
    eventId: number;
    eventTitle: string;
}

function renderCustomFieldInput(
    field: PublicEventCustomField,
    draft: RegistrationDraft,
    errors: Record<string, string>,
    onCustomFieldChange: (fieldKey: string, value: unknown) => void,
) {
    const fieldKey = String(field.id);
    const value = draft.customFieldValues[fieldKey];
    const errorClass = errors[fieldKey] ? " form-input--error" : "";

    if (field.type === "checkbox") {
        return (
            <div key={field.id} className="form-group">
                <YesNoField
                    id={`field-${field.id}`}
                    label={field.label}
                    required={field.required}
                    checked={Boolean(value)}
                    onChange={(next) => onCustomFieldChange(fieldKey, next)}
                    error={errors[fieldKey]}
                />
            </div>
        );
    }

    if (field.type === "dropdown") {
        return (
            <div key={field.id} className="form-group">
                <label className="form-label" htmlFor={`field-${field.id}`}>
                    {field.label}
                    {field.required ? " *" : ""}
                </label>
                <select
                    id={`field-${field.id}`}
                    className={`form-select${errorClass}`}
                    value={value == null ? "" : String(value)}
                    onChange={(event) => onCustomFieldChange(fieldKey, event.target.value || null)}
                >
                    <option value="">Select an option</option>
                    {dropdownOptions(field).map((option) => (
                        <option key={option} value={option}>
                            {option}
                        </option>
                    ))}
                </select>
                {errors[fieldKey] ? <p className="field-error">{errors[fieldKey]}</p> : null}
            </div>
        );
    }

    const inputType = field.type === "number" ? "number" : "text";

    return (
        <div key={field.id} className="form-group">
            <label className="form-label" htmlFor={`field-${field.id}`}>
                {field.label}
                {field.required ? " *" : ""}
            </label>
            <input
                id={`field-${field.id}`}
                type={inputType}
                className={`form-input${errorClass}`}
                value={value == null ? "" : String(value)}
                onChange={(event) =>
                    onCustomFieldChange(fieldKey, parseCustomFieldInputValue(field, event.target.value))
                }
            />
            {errors[fieldKey] ? <p className="field-error">{errors[fieldKey]}</p> : null}
        </div>
    );
}

export function RegistrationForm({ eventId, eventTitle }: RegistrationFormProps) {
    const router = useRouter();
    const [draft, setDraft] = useState<RegistrationDraft>(emptyRegistrationDraft);
    const [tiers, setTiers] = useState<PublicEventTier[]>([]);
    const [sessions, setSessions] = useState<PublicEventSession[]>([]);
    const [formConfig, setFormConfig] = useState<PublicEventRegistrationFormConfig>({
        tierFieldShowOnPublic: true,
        tierFieldRequired: true,
        sessionFieldShowOnPublic: false,
        sessionFieldRequired: false,
    });
    const [customFields, setCustomFields] = useState<PublicEventCustomField[]>([]);
    const [errors, setErrors] = useState<Record<string, string>>({});
    const [formError, setFormError] = useState("");
    const [loading, setLoading] = useState(true);
    const [submitting, setSubmitting] = useState(false);

    useEffect(() => {
        let cancelled = false;

        async function loadFormData() {
            setLoading(true);
            try {
                const [loadedTiers, loadedFields, loadedSessions, loadedFormConfig] = await Promise.all([
                    publicAPI.getEventTiers(eventId),
                    publicAPI.getEventCustomFields(eventId),
                    publicAPI.getEventSessions(eventId),
                    publicAPI.getEventRegistrationForm(eventId),
                ]);

                if (cancelled) return;

                const availableTiers = loadedTiers.filter(
                    (tier) => tier.spotsRemaining == null || tier.spotsRemaining > 0,
                );
                setTiers(availableTiers);
                setCustomFields(loadedFields);
                setSessions(loadedSessions);
                setFormConfig(loadedFormConfig);

                if (availableTiers.length === 1) {
                    setDraft((current) => ({ ...current, tierId: String(availableTiers[0].id) }));
                }
            } finally {
                if (!cancelled) {
                    setLoading(false);
                }
            }
        }

        void loadFormData();

        return () => {
            cancelled = true;
        };
    }, [eventId]);

    function updateDraft(patch: Partial<RegistrationDraft>) {
        setDraft((current) => ({ ...current, ...patch }));
    }

    function clearError(key: string) {
        setErrors((current) => {
            if (!current[key]) return current;
            const next = { ...current };
            delete next[key];
            return next;
        });
    }

    function onCustomFieldChange(fieldKey: string, value: unknown) {
        clearError(fieldKey);
        setDraft((current) => ({
            ...current,
            customFieldValues: {
                ...current.customFieldValues,
                [fieldKey]: value,
            },
        }));
    }

    function onSessionToggle(sessionId: string, checked: boolean) {
        clearError("sessionIds");
        setDraft((current) => {
            const next = new Set(current.sessionIds);
            if (checked) {
                next.add(sessionId);
            } else {
                next.delete(sessionId);
            }
            return { ...current, sessionIds: [...next] };
        });
    }

    async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
        event.preventDefault();
        setFormError("");

        const validationErrors = validateRegistrationDraft(draft, customFields, {
            requireTier: formConfig.tierFieldShowOnPublic && formConfig.tierFieldRequired && tiers.length > 0,
            requireSessions: formConfig.sessionFieldShowOnPublic && formConfig.sessionFieldRequired,
        });
        if (Object.keys(validationErrors).length > 0) {
            setErrors(validationErrors);
            return;
        }

        setSubmitting(true);
        try {
            const result = await publicAPI.registerForEvent(eventId, {
                fullName: draft.fullName.trim(),
                email: draft.email.trim(),
                phoneNumber: draft.phoneNumber.trim() || null,
                tierId: draft.tierId ? Number(draft.tierId) : null,
                sessionIds: draft.sessionIds.map((id) => Number(id)),
                customFieldValues: draft.customFieldValues,
            });

            saveRegistrationCache(eventId, {
                confirmationCode: result.confirmationCode,
                fullName: draft.fullName.trim(),
                email: draft.email.trim(),
            });

            router.push(`/events/${eventId}/confirmation?code=${encodeURIComponent(result.confirmationCode)}`);
        } catch (error) {
            if (error instanceof ApiRequestError) {
                setFormError(error.message);
                if (error.fieldErrors) {
                    setErrors(error.fieldErrors);
                }
            } else {
                setFormError(error instanceof Error ? error.message : "Failed to submit registration.");
            }
        } finally {
            setSubmitting(false);
        }
    }

    const selectedTier = tiers.find((tier) => String(tier.id) === draft.tierId) ?? null;

    if (loading) {
        return <p className="text-sm text-slate-600">Loading registration form…</p>;
    }

    return (
        <form onSubmit={handleSubmit} className="registration-panel space-y-2">
            <div>
                <h2 className="text-2xl font-semibold text-purple-900">Register for {eventTitle}</h2>
                <p className="mt-2 text-sm text-slate-600">
                    Complete the form below. You will receive a ticket by email after registration.
                </p>
            </div>

            {formConfig.tierFieldShowOnPublic && tiers.length > 0 ? (
                <div className="form-group">
                    <label className="form-label" htmlFor="tierId">
                        Registration tier{formConfig.tierFieldRequired ? " *" : ""}
                    </label>
                    <select
                        id="tierId"
                        className={`form-select${errors.tierId ? " form-input--error" : ""}`}
                        value={draft.tierId}
                        onChange={(event) => {
                            clearError("tierId");
                            updateDraft({ tierId: event.target.value });
                        }}
                    >
                        <option value="">Select a tier</option>
                        {tiers.map((tier) => (
                            <option key={tier.id} value={tier.id}>
                                {tier.name}
                                {" · "}
                                {formatTierPrice(tier.price, tier.currency)}
                                {tier.spotsRemaining != null ? ` · ${tier.spotsRemaining} spots left` : ""}
                            </option>
                        ))}
                    </select>
                    {selectedTier ? (
                        <p className="form-hint">
                            Selected tier price: {formatTierPrice(selectedTier.price, selectedTier.currency)}
                        </p>
                    ) : null}
                    {errors.tierId ? <p className="field-error">{errors.tierId}</p> : null}
                </div>
            ) : null}

            {formConfig.sessionFieldShowOnPublic && sessions.length > 0 ? (
                <div className="form-group">
                    <fieldset>
                        <legend className="form-label">
                            Sessions{formConfig.sessionFieldRequired ? " *" : ""}
                        </legend>
                        <div className="registration-session-options">
                            {sessions.map((session) => {
                                const sessionId = String(session.id);
                                const checked = draft.sessionIds.includes(sessionId);
                                return (
                                    <label key={sessionId} className="registration-session-option">
                                        <input
                                            type="checkbox"
                                            checked={checked}
                                            onChange={(event) => onSessionToggle(sessionId, event.target.checked)}
                                        />
                                        <span>{formatSessionDisplayLabel({
                                            label: session.label,
                                            startDateTime: session.startDateTime,
                                            endDateTime: session.endDateTime,
                                            sessionDate: session.sessionDate,
                                            startTime: session.startTime,
                                            endTime: session.endTime,
                                            mode: session.mode,
                                        })}</span>
                                    </label>
                                );
                            })}
                        </div>
                    </fieldset>
                    {errors.sessionIds ? <p className="field-error">{errors.sessionIds}</p> : null}
                </div>
            ) : null}

            <div className="form-row form-row--two">
                <div className="form-group">
                    <label className="form-label" htmlFor="fullName">
                        Full name *
                    </label>
                    <input
                        id="fullName"
                        type="text"
                        className={`form-input${errors.fullName ? " form-input--error" : ""}`}
                        value={draft.fullName}
                        onChange={(event) => {
                            clearError("fullName");
                            updateDraft({ fullName: event.target.value });
                        }}
                    />
                    {errors.fullName ? <p className="field-error">{errors.fullName}</p> : null}
                </div>
                <div className="form-group">
                    <label className="form-label" htmlFor="email">
                        Email *
                    </label>
                    <input
                        id="email"
                        type="email"
                        className={`form-input${errors.email ? " form-input--error" : ""}`}
                        value={draft.email}
                        onChange={(event) => {
                            clearError("email");
                            updateDraft({ email: event.target.value });
                        }}
                    />
                    {errors.email ? <p className="field-error">{errors.email}</p> : null}
                </div>
            </div>

            <div className="form-group">
                <label className="form-label" htmlFor="phoneNumber">
                    Phone number
                </label>
                <input
                    id="phoneNumber"
                    type="tel"
                    className="form-input"
                    value={draft.phoneNumber}
                    onChange={(event) => updateDraft({ phoneNumber: event.target.value })}
                />
            </div>

            {customFields.map((field) =>
                renderCustomFieldInput(field, draft, errors, onCustomFieldChange),
            )}

            {formError ? <div className="registration-error-banner">{formError}</div> : null}

            <button type="submit" className="btn-primary" disabled={submitting}>
                {submitting ? "Submitting..." : "Submit registration"}
            </button>
        </form>
    );
}
