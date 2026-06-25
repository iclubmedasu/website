'use client';

import type { PublicIncidentReportField, PublicIncidentReportForm } from '@iclub/shared';
import { useEffect, useMemo, useState } from 'react';
import { YesNoField } from '@/components/YesNoField/YesNoField';
import { useAuth } from '@/context/AuthContext';
import { supportContentAPI, teamsAPI } from '@/services/api';

function dropdownOptions(field: PublicIncidentReportField): string[] {
    if (!Array.isArray(field.options)) return [];
    return field.options.map((option) => String(option));
}

function isExtraValueEmpty(field: PublicIncidentReportField, value: unknown): boolean {
    if (field.type === 'checkbox') return value !== true;
    return value === null || value === undefined || value === '';
}

interface PortalIncidentReportFormProps {
    forms: PublicIncidentReportForm[];
    onSubmitted?: () => void;
}

export function PortalIncidentReportForm({ forms, onSubmitted }: PortalIncidentReportFormProps) {
    const { user } = useAuth();
    const [formId, setFormId] = useState('');
    const [name, setName] = useState('');
    const [email, setEmail] = useState('');
    const [phone, setPhone] = useState('');
    const [team, setTeam] = useState('');
    const [description, setDescription] = useState('');
    const [extraValues, setExtraValues] = useState<Record<string, unknown>>({});
    const [errors, setErrors] = useState<Record<string, string>>({});
    const [busy, setBusy] = useState(false);
    const [success, setSuccess] = useState(false);
    const [submitError, setSubmitError] = useState('');

    const selectedForm = useMemo(
        () => forms.find((form) => String(form.id) === formId),
        [forms, formId],
    );
    const formFields = selectedForm?.fields ?? [];
    const requiresName = selectedForm?.slug === 'personal';

    useEffect(() => {
        if (!user) return;
        setName(user.fullName ?? '');
        setEmail(user.email ?? '');
        setPhone(user.phoneNumber ?? '');
    }, [user]);

    useEffect(() => {
        if (!user?.teamIds?.length) return;
        void teamsAPI
            .getAll(true)
            .then((teams: Array<{ id: number; name: string }>) => {
                const names = teams
                    .filter((teamRow) => user.teamIds.includes(teamRow.id))
                    .map((teamRow) => teamRow.name);
                setTeam(names.join(', '));
            })
            .catch(() => {
                // Team label is optional for display; backend resolves on submit.
            });
    }, [user]);

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
        if (!formId) nextErrors.formId = 'Form is required.';
        if (requiresName && !name.trim()) nextErrors.name = 'Name is required for personal reports.';
        if (!email.trim()) nextErrors.email = 'Email is required.';
        else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) nextErrors.email = 'A valid email is required.';
        if (!description.trim()) nextErrors.description = 'Description is required.';

        for (const field of formFields) {
            if (!field.required) continue;
            const key = String(field.id);
            if (isExtraValueEmpty(field, extraValues[key])) {
                nextErrors[key] = `${field.label} is required.`;
            }
        }
        return nextErrors;
    };

    const submit = async () => {
        const nextErrors = validate();
        if (Object.keys(nextErrors).length > 0) {
            setErrors(nextErrors);
            return;
        }

        setBusy(true);
        setSubmitError('');
        try {
            await supportContentAPI.submitIncidentReport({
                formId: Number(formId),
                name: name.trim() || undefined,
                email: email.trim(),
                phone: phone.trim() || undefined,
                description: description.trim(),
                team: team.trim() || undefined,
                fieldValues: extraValues,
            });
            setSuccess(true);
            setDescription('');
            setExtraValues({});
            setErrors({});
            onSubmitted?.();
        } catch (err) {
            setSubmitError(err instanceof Error ? err.message : 'Failed to submit report.');
        } finally {
            setBusy(false);
        }
    };

    if (!forms.length) {
        return <p className="help-support-empty-form">The incident report form is not available yet.</p>;
    }

    if (success) {
        return (
            <div className="help-support-success">
                <p>Your incident report has been submitted. Thank you.</p>
                <button type="button" className="btn btn-secondary" onClick={() => setSuccess(false)}>
                    Submit another report
                </button>
            </div>
        );
    }

    return (
        <form
            className="help-support-form"
            onSubmit={(event) => {
                event.preventDefault();
                void submit();
            }}
        >
            <div className="form-group">
                <label htmlFor="portal-report-form" className="form-label">
                    Form *
                </label>
                <select
                    id="portal-report-form"
                    className={`form-input${errors.formId ? ' form-input--error' : ''}`}
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
                {errors.formId ? <p className="field-error">{errors.formId}</p> : null}
            </div>

            <div className="form-group">
                <label htmlFor="portal-reporter-name" className="form-label">
                    Name{requiresName ? ' *' : ''}
                </label>
                <input
                    id="portal-reporter-name"
                    className={`form-input${errors.name ? ' form-input--error' : ''}`}
                    value={name}
                    onChange={(event) => setName(event.target.value)}
                />
                {errors.name ? <p className="field-error">{errors.name}</p> : null}
            </div>

            <div className="form-group">
                <label htmlFor="portal-reporter-email" className="form-label">
                    Email *
                </label>
                <input
                    id="portal-reporter-email"
                    type="email"
                    className={`form-input${errors.email ? ' form-input--error' : ''}`}
                    value={email}
                    onChange={(event) => setEmail(event.target.value)}
                />
                {errors.email ? <p className="field-error">{errors.email}</p> : null}
            </div>

            <div className="form-group">
                <label htmlFor="portal-reporter-phone" className="form-label">
                    Phone
                </label>
                <input
                    id="portal-reporter-phone"
                    className="form-input"
                    value={phone}
                    onChange={(event) => setPhone(event.target.value)}
                />
            </div>

            <div className="form-group">
                <label htmlFor="portal-reporter-team" className="form-label">
                    Team
                </label>
                <input id="portal-reporter-team" className="form-input" value={team} readOnly />
            </div>

            <div className="form-group">
                <label htmlFor="portal-report-description" className="form-label">
                    Description of incident or request *
                </label>
                <textarea
                    id="portal-report-description"
                    className={`form-input form-textarea${errors.description ? ' form-input--error' : ''}`}
                    rows={5}
                    value={description}
                    onChange={(event) => setDescription(event.target.value)}
                />
                {errors.description ? <p className="field-error">{errors.description}</p> : null}
            </div>

            {formFields.map((field) => {
                const fieldKey = String(field.id);
                const value = extraValues[fieldKey];
                const error = errors[fieldKey];

                if (field.type === 'checkbox') {
                    return (
                        <div key={field.id} className="form-group">
                            <YesNoField
                                id={`portal-extra-${field.id}`}
                                label={field.label}
                                required={field.required}
                                checked={Boolean(value)}
                                onChange={(next) => updateExtraValue(fieldKey, next)}
                                error={error}
                                variant="stacked"
                            />
                        </div>
                    );
                }

                if (field.type === 'dropdown') {
                    return (
                        <div key={field.id} className="form-group">
                            <label className="form-label" htmlFor={`portal-extra-${field.id}`}>
                                {field.label}
                                {field.required ? ' *' : ''}
                            </label>
                            <select
                                id={`portal-extra-${field.id}`}
                                className={`form-input${error ? ' form-input--error' : ''}`}
                                value={value == null ? '' : String(value)}
                                onChange={(event) => updateExtraValue(fieldKey, event.target.value || null)}
                            >
                                <option value="">Select an option</option>
                                {dropdownOptions(field).map((option) => (
                                    <option key={option} value={option}>
                                        {option}
                                    </option>
                                ))}
                            </select>
                            {error ? <p className="field-error">{error}</p> : null}
                        </div>
                    );
                }

                const inputType = field.type === 'number' ? 'number' : 'text';
                return (
                    <div key={field.id} className="form-group">
                        <label className="form-label" htmlFor={`portal-extra-${field.id}`}>
                            {field.label}
                            {field.required ? ' *' : ''}
                        </label>
                        <input
                            id={`portal-extra-${field.id}`}
                            type={inputType}
                            className={`form-input${error ? ' form-input--error' : ''}`}
                            value={value == null ? '' : String(value)}
                            onChange={(event) =>
                                updateExtraValue(
                                    fieldKey,
                                    field.type === 'number'
                                        ? event.target.value === ''
                                            ? null
                                            : Number(event.target.value)
                                        : event.target.value,
                                )
                            }
                        />
                        {error ? <p className="field-error">{error}</p> : null}
                    </div>
                );
            })}

            {submitError ? <p className="site-content-error">{submitError}</p> : null}

            <button type="submit" className="btn btn-primary" disabled={busy}>
                {busy ? 'Submitting…' : 'Submit incident report'}
            </button>
        </form>
    );
}
