"use client";

import type { PublicEventCustomField, PublicEventRegistrationFormConfig, PublicEventSession, PublicEventTier } from "@iclub/shared";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { ApiRequestError, publicAPI } from "@/lib/api";
import { YesNoField } from "@/components/ui/YesNoToggle";
import EmailInputWithDomainSuggestions from "@/components/EmailInputWithDomainSuggestions";
import { saveRegistrationCache } from "@/lib/registrationCache";
import { formatSessionDisplayLabelDual, isSessionEnded } from "@/lib/sessionUtils";
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
    eventSlug: string;
    eventTitle: string;
    /** When true, skip full-site confirmation navigation; show in-place success (embed use case). */
    isEmbedded?: boolean;
}

interface EmbedSuccessState {
    confirmationCode: string;
    fullName: string;
    email: string;
}

function fieldWrapperClass(extra = ""): string {
    return ["registration-field", "form-group", extra].filter(Boolean).join(" ");
}

function renderCustomFieldInput(
    field: PublicEventCustomField,
    draft: RegistrationDraft,
    errors: Record<string, string>,
    onCustomFieldChange: (fieldKey: string, value: unknown) => void,
) {
    const fieldKey = String(field.id);
    const dataField = `custom-${fieldKey}`;
    const value = draft.customFieldValues[fieldKey];
    const errorClass = errors[fieldKey] ? " form-input--error" : "";

    if (field.type === "checkbox") {
        return (
            <div
                key={field.id}
                className={fieldWrapperClass()}
                data-field={dataField}
                data-field-type="checkbox"
            >
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
            <div
                key={field.id}
                className={fieldWrapperClass()}
                data-field={dataField}
                data-field-type="dropdown"
            >
                <label className="form-label registration-field-label" htmlFor={`field-${field.id}`}>
                    {field.label}
                    {field.required ? " *" : ""}
                </label>
                <select
                    id={`field-${field.id}`}
                    className={`form-select registration-field-input${errorClass}`}
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
                {errors[fieldKey] ? (
                    <p className="field-error registration-field-error">{errors[fieldKey]}</p>
                ) : null}
            </div>
        );
    }

    const inputType = field.type === "number" ? "number" : "text";

    return (
        <div
            key={field.id}
            className={fieldWrapperClass()}
            data-field={dataField}
            data-field-type={field.type}
        >
            <label className="form-label registration-field-label" htmlFor={`field-${field.id}`}>
                {field.label}
                {field.required ? " *" : ""}
            </label>
            <input
                id={`field-${field.id}`}
                type={inputType}
                className={`form-input registration-field-input${errorClass}`}
                value={value == null ? "" : String(value)}
                onChange={(event) =>
                    onCustomFieldChange(fieldKey, parseCustomFieldInputValue(field, event.target.value))
                }
            />
            {errors[fieldKey] ? (
                <p className="field-error registration-field-error">{errors[fieldKey]}</p>
            ) : null}
        </div>
    );
}

export function RegistrationForm({
    eventId,
    eventSlug,
    eventTitle,
    isEmbedded = false,
}: RegistrationFormProps) {
    const router = useRouter();
    const [draft, setDraft] = useState<RegistrationDraft>(emptyRegistrationDraft);
    const [tiers, setTiers] = useState<PublicEventTier[]>([]);
    const [sessions, setSessions] = useState<PublicEventSession[]>([]);
    const [formConfig, setFormConfig] = useState<PublicEventRegistrationFormConfig>({
        tierFieldShowOnPublic: true,
        tierFieldRequired: true,
        sessionFieldShowOnPublic: false,
        sessionFieldRequired: false,
        phoneFieldRequired: false,
    });
    const [customFields, setCustomFields] = useState<PublicEventCustomField[]>([]);
    const [errors, setErrors] = useState<Record<string, string>>({});
    const [formError, setFormError] = useState("");
    const [loading, setLoading] = useState(true);
    const [submitting, setSubmitting] = useState(false);
    const [eventTimezone, setEventTimezone] = useState<string>("Africa/Cairo");
    const [embedSuccess, setEmbedSuccess] = useState<EmbedSuccessState | null>(null);

    useEffect(() => {
        let cancelled = false;

        async function loadFormData() {
            setLoading(true);
            try {
                const [loadedTiers, loadedFields, loadedSessions, loadedFormConfig, loadedEvent] = await Promise.all([
                    publicAPI.getEventTiers(eventId),
                    publicAPI.getEventCustomFields(eventId),
                    publicAPI.getEventSessions(eventId),
                    publicAPI.getEventRegistrationForm(eventId),
                    publicAPI.getEvent(eventId),
                ]);

                if (cancelled) return;

                const availableTiers = loadedTiers.filter(
                    (tier) => tier.spotsRemaining == null || tier.spotsRemaining > 0,
                );
                setTiers(availableTiers);
                setCustomFields(loadedFields);
                setSessions(loadedSessions);
                setFormConfig(loadedFormConfig);
                setEventTimezone(loadedEvent?.timezone ?? "Africa/Cairo");

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
            requirePhone: formConfig.phoneFieldRequired,
            sessions,
        });
        if (Object.keys(validationErrors).length > 0) {
            setErrors(validationErrors);
            return;
        }

        setSubmitting(true);
        try {
            const result = await publicAPI.registerForEvent(eventSlug, {
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

            if (isEmbedded) {
                setEmbedSuccess({
                    confirmationCode: result.confirmationCode,
                    fullName: draft.fullName.trim(),
                    email: draft.email.trim(),
                });
                if (typeof window !== "undefined" && window.parent !== window) {
                    window.parent.postMessage(
                        {
                            type: "iclub-embed-registered",
                            source: "iclub-registration-embed",
                            confirmationCode: result.confirmationCode,
                            eventId,
                            eventSlug,
                        },
                        "*",
                    );
                }
                return;
            }

            router.push(`/events/${eventSlug}/confirmation?code=${encodeURIComponent(result.confirmationCode)}`);
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
    const registerableSessions = sessions.filter((session) => !session.isFull && !isSessionEnded(session));

    if (loading) {
        return (
            <p className="registration-loading text-sm text-slate-600" data-registration="loading">
                Loading registration form…
            </p>
        );
    }

    if (embedSuccess) {
        return (
            <div className="embed-success registration-success" data-registration="success">
                <h2 className="embed-success-title">Registration confirmed</h2>
                <p className="embed-success-text">
                    Thanks, {embedSuccess.fullName}. You are registered for {eventTitle}. A ticket was sent to{" "}
                    {embedSuccess.email}.
                </p>
                <p className="embed-success-code" data-field="confirmationCode">
                    {embedSuccess.confirmationCode}
                </p>
            </div>
        );
    }

    return (
        <form
            onSubmit={handleSubmit}
            className="registration-panel registration-form space-y-0"
            data-registration="form"
            data-embedded={isEmbedded ? "true" : "false"}
        >
            <div className="registration-header" data-field="header">
                <h2 className="registration-title text-2xl font-semibold text-purple-900">
                    Register for {eventTitle}
                </h2>
                <p className="registration-subtitle mt-2 text-sm text-slate-600">
                    Complete the form below. You will receive a ticket by email after registration.
                </p>
            </div>

            {formConfig.tierFieldShowOnPublic && tiers.length > 0 ? (
                <div className={fieldWrapperClass()} data-field="tierId" data-field-type="select">
                    <label className="form-label registration-field-label" htmlFor="tierId">
                        Registration tier{formConfig.tierFieldRequired ? " *" : ""}
                    </label>
                    <select
                        id="tierId"
                        className={`form-select registration-field-input${errors.tierId ? " form-input--error" : ""}`}
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
                        <p className="form-hint registration-field-hint">
                            Selected tier price: {formatTierPrice(selectedTier.price, selectedTier.currency)}
                        </p>
                    ) : null}
                    {errors.tierId ? (
                        <p className="field-error registration-field-error">{errors.tierId}</p>
                    ) : null}
                </div>
            ) : null}

            {formConfig.sessionFieldShowOnPublic && sessions.length > 0 ? (
                <div className={fieldWrapperClass()} data-field="session" data-field-type="checkbox-group">
                    <fieldset>
                        <legend className="form-label registration-field-label">
                            Sessions{formConfig.sessionFieldRequired ? " *" : ""}
                        </legend>
                        <div className="registration-session-options">
                            {sessions.map((session) => {
                                const sessionId = String(session.id);
                                const checked = draft.sessionIds.includes(sessionId);
                                const ended = isSessionEnded(session);
                                const unavailableAndUnchecked = (Boolean(session.isFull) || ended) && !checked;
                                const capacitySuffix = session.isFull
                                    ? " (Full)"
                                    : ended
                                        ? " (Ended)"
                                        : session.spotsRemaining != null
                                            ? ` (${session.spotsRemaining} left)`
                                            : "";
                                return (
                                    <label
                                        key={sessionId}
                                        className="registration-session-option"
                                        data-session-id={sessionId}
                                    >
                                        <input
                                            type="checkbox"
                                            checked={checked}
                                            disabled={unavailableAndUnchecked}
                                            onChange={(event) => onSessionToggle(sessionId, event.target.checked)}
                                        />
                                        <span>{formatSessionDisplayLabelDual({
                                            label: session.label,
                                            startDateTime: session.startDateTime,
                                            endDateTime: session.endDateTime,
                                            sessionDate: session.sessionDate,
                                            startTime: session.startTime,
                                            endTime: session.endTime,
                                            mode: session.mode,
                                        }, eventTimezone)}{capacitySuffix}</span>
                                    </label>
                                );
                            })}
                        </div>
                        {formConfig.sessionFieldRequired && registerableSessions.length === 0 ? (
                            <p className="form-hint registration-field-hint">
                                No sessions are currently open for registration.
                            </p>
                        ) : null}
                    </fieldset>
                    {errors.sessionIds ? (
                        <p className="field-error registration-field-error">{errors.sessionIds}</p>
                    ) : null}
                </div>
            ) : null}

            <div className={fieldWrapperClass()} data-field="fullName" data-field-type="text">
                <label className="form-label registration-field-label" htmlFor="fullName">
                    Full name *
                </label>
                <input
                    id="fullName"
                    type="text"
                    className={`form-input registration-field-input${errors.fullName ? " form-input--error" : ""}`}
                    value={draft.fullName}
                    onChange={(event) => {
                        clearError("fullName");
                        updateDraft({ fullName: event.target.value });
                    }}
                />
                {errors.fullName ? (
                    <p className="field-error registration-field-error">{errors.fullName}</p>
                ) : null}
            </div>

            <div className={fieldWrapperClass()} data-field="email" data-field-type="email">
                <label className="form-label registration-field-label" htmlFor="email">
                    Email *
                </label>
                <EmailInputWithDomainSuggestions
                    id="email"
                    className={`form-input registration-field-input${errors.email ? " form-input--error" : ""}`}
                    value={draft.email}
                    onChange={(value) => {
                        clearError("email");
                        updateDraft({ email: value });
                    }}
                />
                {errors.email ? (
                    <p className="field-error registration-field-error">{errors.email}</p>
                ) : null}
            </div>

            <div className={fieldWrapperClass()} data-field="phoneNumber" data-field-type="tel">
                <label className="form-label registration-field-label" htmlFor="phoneNumber">
                    Phone number{formConfig.phoneFieldRequired ? " *" : ""}
                </label>
                <input
                    id="phoneNumber"
                    type="tel"
                    className={`form-input registration-field-input${errors.phoneNumber ? " form-input--error" : ""}`}
                    value={draft.phoneNumber}
                    onChange={(event) => {
                        clearError("phoneNumber");
                        updateDraft({ phoneNumber: event.target.value });
                    }}
                />
                {errors.phoneNumber ? (
                    <p className="field-error registration-field-error">{errors.phoneNumber}</p>
                ) : null}
            </div>

            {customFields.map((field) =>
                renderCustomFieldInput(field, draft, errors, onCustomFieldChange),
            )}

            {formError ? (
                <div className="registration-error-banner" data-registration="form-error" role="alert">
                    {formError}
                </div>
            ) : null}

            <button
                type="submit"
                className="btn-primary registration-submit"
                data-registration="submit"
                disabled={submitting}
            >
                {submitting ? "Submitting..." : "Submit registration"}
            </button>
        </form>
    );
}
