"use client";

import type { PublicIncidentReportField, PublicIncidentReportForm } from "@iclub/shared";
import { useMemo, useState } from "react";
import type { FormEvent } from "react";
import { Button } from "@/components/ui";
import { YesNoField } from "@/components/ui/YesNoToggle";
import { ApiRequestError, publicAPI } from "@/lib/api";
import {
    dropdownOptions,
    parseCustomFieldInputValue,
    validateRequiredCustomFields,
} from "@/lib/customFieldUtils";

interface IncidentReportFormProps {
    forms?: PublicIncidentReportForm[];
}

function renderExtraField(
    field: PublicIncidentReportField,
    values: Record<string, unknown>,
    errors: Record<string, string>,
    onChange: (fieldKey: string, value: unknown) => void,
) {
    const fieldKey = String(field.id);
    const value = values[fieldKey];
    const errorClass = errors[fieldKey] ? " border-red-400" : "";

    if (field.type === "checkbox") {
        return (
            <div key={field.id}>
                <YesNoField
                    id={`support-extra-${field.id}`}
                    label={field.label}
                    required={field.required}
                    checked={Boolean(value)}
                    onChange={(next) => onChange(fieldKey, next)}
                    error={errors[fieldKey]}
                />
            </div>
        );
    }

    if (field.type === "dropdown") {
        return (
            <label key={field.id} className="block text-sm font-medium text-slate-700">
                {field.label}
                {field.required ? " *" : ""}
                <select
                    className={`mt-2 w-full rounded-lg border border-purple-200 px-3 py-2 text-sm outline-none focus:border-purple-500${errorClass}`}
                    value={value == null ? "" : String(value)}
                    onChange={(event) => onChange(fieldKey, event.target.value || null)}
                >
                    <option value="">Select an option</option>
                    {dropdownOptions(field).map((option) => (
                        <option key={option} value={option}>
                            {option}
                        </option>
                    ))}
                </select>
                {errors[fieldKey] ? <p className="field-error mt-1 text-sm text-red-600">{errors[fieldKey]}</p> : null}
            </label>
        );
    }

    const inputType = field.type === "number" ? "number" : "text";

    return (
        <label key={field.id} className="block text-sm font-medium text-slate-700">
            {field.label}
            {field.required ? " *" : ""}
            <input
                type={inputType}
                className={`mt-2 w-full rounded-lg border border-purple-200 px-3 py-2 text-sm outline-none focus:border-purple-500${errorClass}`}
                value={value == null ? "" : String(value)}
                onChange={(event) =>
                    onChange(fieldKey, parseCustomFieldInputValue(field, event.target.value))
                }
            />
            {errors[fieldKey] ? <p className="field-error mt-1 text-sm text-red-600">{errors[fieldKey]}</p> : null}
        </label>
    );
}

export function IncidentReportForm({ forms = [] }: IncidentReportFormProps) {
    const [formId, setFormId] = useState("");
    const [name, setName] = useState("");
    const [email, setEmail] = useState("");
    const [phone, setPhone] = useState("");
    const [description, setDescription] = useState("");
    const [extraValues, setExtraValues] = useState<Record<string, unknown>>({});
    const [errors, setErrors] = useState<Record<string, string>>({});
    const [submitting, setSubmitting] = useState(false);
    const [success, setSuccess] = useState(false);
    const [submitError, setSubmitError] = useState("");

    const selectedForm = useMemo(
        () => forms.find((form) => String(form.id) === formId),
        [forms, formId],
    );
    const formFields = selectedForm?.fields ?? [];
    const requiresName = selectedForm?.slug === "personal";

    const handleFormChange = (nextFormId: string) => {
        setFormId(nextFormId);
        setExtraValues({});
        setErrors((current) => {
            const next = { ...current };
            delete next.formId;
            for (const field of forms.find((form) => String(form.id) === nextFormId)?.fields ?? []) {
                delete next[String(field.id)];
            }
            return next;
        });
    };

    const updateExtraValue = (fieldKey: string, value: unknown) => {
        setExtraValues((current) => ({ ...current, [fieldKey]: value }));
        setErrors((current) => {
            if (!current[fieldKey]) return current;
            const next = { ...current };
            delete next[fieldKey];
            return next;
        });
    };

    const validate = (): Record<string, string> => {
        const nextErrors: Record<string, string> = {};
        if (!formId) nextErrors.formId = "Form is required.";
        if (requiresName && !name.trim()) nextErrors.name = "Name is required for personal reports.";
        if (!email.trim()) nextErrors.email = "Email is required.";
        else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
            nextErrors.email = "A valid email address is required.";
        }
        if (!description.trim()) nextErrors.description = "Description is required.";
        return {
            ...nextErrors,
            ...validateRequiredCustomFields(extraValues, formFields),
        };
    };

    async function handleSubmit(event: FormEvent<HTMLFormElement>) {
        event.preventDefault();
        const nextErrors = validate();
        if (Object.keys(nextErrors).length > 0) {
            setErrors(nextErrors);
            return;
        }

        setSubmitting(true);
        setSubmitError("");
        try {
            const formData = new FormData(event.currentTarget);
            await publicAPI.submitIncidentReport({
                formId: Number(formId),
                name: name.trim() || undefined,
                email: email.trim(),
                phone: phone.trim() || undefined,
                description: description.trim(),
                fieldValues: extraValues,
                website: String(formData.get("website") ?? ""),
            });
            setSuccess(true);
            setFormId("");
            setName("");
            setEmail("");
            setPhone("");
            setDescription("");
            setExtraValues({});
            setErrors({});
            event.currentTarget.reset();
        } catch (error) {
            if (error instanceof ApiRequestError && error.fieldErrors) {
                setErrors(error.fieldErrors);
            }
            setSubmitError(error instanceof Error ? error.message : "Failed to submit incident report.");
        } finally {
            setSubmitting(false);
        }
    }

    if (!forms.length) {
        return (
            <p className="rounded-3xl border border-purple-100 bg-white p-8 text-sm text-slate-600 shadow-sm">
                The incident report form is not available yet.
            </p>
        );
    }

    if (success) {
        return (
            <div className="space-y-4 rounded-3xl border border-purple-100 bg-white p-8 shadow-sm">
                <p className="text-slate-700">Your incident report has been submitted. Thank you.</p>
                <Button type="button" variant="secondary" onClick={() => setSuccess(false)}>
                    Submit another report
                </Button>
            </div>
        );
    }

    return (
        <form
            onSubmit={handleSubmit}
            className="space-y-5 rounded-3xl border border-purple-100 bg-white p-8 shadow-sm"
        >
            <label className="block text-sm font-medium text-slate-700">
                Form *
                <select
                    className={`mt-2 w-full rounded-lg border border-purple-200 px-3 py-2 text-sm outline-none focus:border-purple-500${errors.formId ? " border-red-400" : ""}`}
                    value={formId}
                    onChange={(event) => handleFormChange(event.target.value)}
                >
                    <option value="">Select a form</option>
                    {forms.map((form) => (
                        <option key={form.id} value={form.id}>
                            {form.label}
                        </option>
                    ))}
                </select>
                {errors.formId ? <p className="mt-1 text-sm text-red-600">{errors.formId}</p> : null}
            </label>

            <label className="block text-sm font-medium text-slate-700">
                Name{requiresName ? " *" : ""}
                <input
                    className={`mt-2 w-full rounded-lg border border-purple-200 px-3 py-2 text-sm outline-none focus:border-purple-500${errors.name ? " border-red-400" : ""}`}
                    value={name}
                    onChange={(event) => setName(event.target.value)}
                />
                {errors.name ? <p className="mt-1 text-sm text-red-600">{errors.name}</p> : null}
            </label>

            <label className="block text-sm font-medium text-slate-700">
                Email *
                <input
                    type="email"
                    className={`mt-2 w-full rounded-lg border border-purple-200 px-3 py-2 text-sm outline-none focus:border-purple-500${errors.email ? " border-red-400" : ""}`}
                    value={email}
                    onChange={(event) => setEmail(event.target.value)}
                />
                {errors.email ? <p className="mt-1 text-sm text-red-600">{errors.email}</p> : null}
            </label>

            <label className="block text-sm font-medium text-slate-700">
                Phone
                <input
                    className="mt-2 w-full rounded-lg border border-purple-200 px-3 py-2 text-sm outline-none focus:border-purple-500"
                    value={phone}
                    onChange={(event) => setPhone(event.target.value)}
                />
            </label>

            <label className="block text-sm font-medium text-slate-700">
                Description of incident or request *
                <textarea
                    className={`mt-2 w-full rounded-lg border border-purple-200 px-3 py-2 text-sm outline-none focus:border-purple-500${errors.description ? " border-red-400" : ""}`}
                    rows={5}
                    value={description}
                    onChange={(event) => setDescription(event.target.value)}
                />
                {errors.description ? <p className="mt-1 text-sm text-red-600">{errors.description}</p> : null}
            </label>

            {formFields.map((field) => renderExtraField(field, extraValues, errors, updateExtraValue))}

            <input type="text" name="website" tabIndex={-1} autoComplete="off" className="hidden" aria-hidden />

            {submitError ? <p className="text-sm text-red-600">{submitError}</p> : null}

            <Button type="submit" disabled={submitting}>
                {submitting ? "Submitting…" : "Submit incident report"}
            </Button>
        </form>
    );
}
