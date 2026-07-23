'use client';

import { useEffect, useRef, useState, type ChangeEvent, type FormEvent } from 'react';
import { X } from 'lucide-react';
import { parseTemplateLayoutWording, type TemplateLayoutWording } from '@iclub/shared/utils';
import {
    certificatesAPI,
    type CertificateTemplate,
    type CertificateType,
    type CreateCustomCertificatePayload,
} from '@/services/certificatesAPI';
import type { Id } from '@/types/backend-contracts';
import './NewCustomCertificateModal.css';

interface NewCustomCertificateModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSuccess: () => void | Promise<void>;
    eventId?: Id | string | null;
    projectId?: Id | string | null;
    defaultTitle?: string;
}

interface FormState {
    recipientName: string;
    recipientEmail: string;
    templateId: string;
    type: CertificateType;
    title: string;
    description: string;
    issuerName: string;
    /** Per static-element overrides keyed by element id. */
    staticTexts: Record<string, string>;
}

interface FormErrors {
    recipientName?: string;
    recipientEmail?: string;
    templateId?: string;
    type?: string;
    title?: string;
    submit?: string;
}

const CERTIFICATE_TYPES: CertificateType[] = [
    'ATTENDANCE',
    'ORGANIZATION',
    'CONTRIBUTION',
    'LEADERSHIP',
    'ADMINISTRATION',
    'SUPERVISION',
    'PARTICIPATION',
    'CUSTOM',
];

const EMPTY_WORDING: TemplateLayoutWording = {
    description: '',
    issuerName: '',
    titleText: '',
    hasDescription: false,
    hasIssuer: false,
    hasTitle: false,
    staticTexts: [],
};

function getErrorMessage(error: unknown, fallback: string): string {
    if (error instanceof Error && error.message) {
        return error.message;
    }
    return fallback;
}

function buildEmptyForm(defaultTitle = ''): FormState {
    return {
        recipientName: '',
        recipientEmail: '',
        templateId: '',
        type: 'CUSTOM',
        title: defaultTitle,
        description: '',
        issuerName: '',
        staticTexts: {},
    };
}

function applyWordingToForm(
    prev: FormState,
    wording: TemplateLayoutWording,
    defaultTitle: string,
    isLinked: boolean,
): FormState {
    const staticTexts: Record<string, string> = {};
    for (const entry of wording.staticTexts) {
        staticTexts[entry.id] = entry.text;
    }

    let title = prev.title;
    if (isLinked && defaultTitle) {
        title = defaultTitle;
    } else if (!isLinked) {
        title = wording.titleText || '';
    }

    return {
        ...prev,
        title,
        description: wording.hasDescription ? wording.description : '',
        issuerName: wording.hasIssuer ? wording.issuerName : '',
        staticTexts,
    };
}

function sameTemplateId(a: Id | string | number, b: string): boolean {
    return String(a) === b;
}

export default function NewCustomCertificateModal({
    isOpen,
    onClose,
    onSuccess,
    eventId = null,
    projectId = null,
    defaultTitle = '',
}: NewCustomCertificateModalProps) {
    const isLinked = eventId != null || projectId != null;
    const [formData, setFormData] = useState<FormState>(() => buildEmptyForm(defaultTitle));
    const [errors, setErrors] = useState<FormErrors>({});
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [templates, setTemplates] = useState<CertificateTemplate[]>([]);
    const [templatesLoading, setTemplatesLoading] = useState(false);
    const [templateLoading, setTemplateLoading] = useState(false);
    const [wording, setWording] = useState<TemplateLayoutWording>(EMPTY_WORDING);
    const wasOpenRef = useRef(false);
    const defaultTitleRef = useRef(defaultTitle);
    const templatesRef = useRef(templates);
    templatesRef.current = templates;

    // Reset only when the modal opens — not when defaultTitle changes mid-edit
    // (event/project eligible refresh used to wipe template selection + wording).
    useEffect(() => {
        if (isOpen && !wasOpenRef.current) {
            defaultTitleRef.current = defaultTitle;
            setFormData(buildEmptyForm(defaultTitle));
            setWording(EMPTY_WORDING);
            setErrors({});
            setIsSubmitting(false);
            setTemplateLoading(false);
        }
        wasOpenRef.current = isOpen;
    }, [isOpen, defaultTitle]);

    useEffect(() => {
        if (!isOpen) return;

        let cancelled = false;
        const loadTemplates = async () => {
            setTemplatesLoading(true);
            try {
                const data = await certificatesAPI.getTemplates({ isActive: true });
                if (!cancelled) {
                    setTemplates(Array.isArray(data) ? data.filter((t) => t.isActive) : []);
                }
            } catch {
                if (!cancelled) {
                    setTemplates([]);
                }
            } finally {
                if (!cancelled) {
                    setTemplatesLoading(false);
                }
            }
        };

        void loadTemplates();
        return () => {
            cancelled = true;
        };
    }, [isOpen]);

    // Prefill wording whenever the selected template changes.
    useEffect(() => {
        if (!isOpen) return;

        const templateId = formData.templateId.trim();
        if (!templateId) {
            setWording(EMPTY_WORDING);
            setFormData((prev) => ({
                ...prev,
                description: '',
                issuerName: '',
                staticTexts: {},
                title: isLinked ? defaultTitleRef.current : prev.title,
            }));
            setTemplateLoading(false);
            return;
        }

        let cancelled = false;

        const applyLayout = (layout: unknown) => {
            const nextWording = parseTemplateLayoutWording(layout);
            if (cancelled) return;
            setWording(nextWording);
            setFormData((prev) => {
                if (prev.templateId.trim() !== templateId) return prev;
                return applyWordingToForm(
                    prev,
                    nextWording,
                    defaultTitleRef.current,
                    isLinked,
                );
            });
        };

        // Immediate prefill from the already-fetched list (includes layout).
        const cached = templatesRef.current.find((t) => sameTemplateId(t.id, templateId));
        if (cached) {
            applyLayout(cached.layout);
        }

        const loadTemplate = async () => {
            setTemplateLoading(true);
            try {
                const template = await certificatesAPI.getTemplate(templateId);
                if (cancelled) return;
                applyLayout(template.layout);
            } catch (error: unknown) {
                if (!cancelled) {
                    // Keep cached wording if list prefill already succeeded.
                    if (!cached) {
                        setWording(EMPTY_WORDING);
                        setErrors((prev) => ({
                            ...prev,
                            submit: getErrorMessage(error, 'Failed to load template wording'),
                        }));
                    }
                }
            } finally {
                if (!cancelled) {
                    setTemplateLoading(false);
                }
            }
        };

        void loadTemplate();
        return () => {
            cancelled = true;
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps -- intentional: templateId-driven prefill
    }, [isOpen, formData.templateId, isLinked]);

    // Linked title: update from parent when it arrives, without wiping other fields.
    useEffect(() => {
        if (!isOpen || !isLinked) return;
        const previousDefault = defaultTitleRef.current;
        const nextTitle = defaultTitle.trim();
        if (nextTitle === previousDefault.trim()) return;

        setFormData((prev) => {
            if (prev.title.trim() === '' || prev.title === previousDefault) {
                return { ...prev, title: nextTitle };
            }
            return prev;
        });
        defaultTitleRef.current = defaultTitle;
    }, [isOpen, isLinked, defaultTitle]);

    const handleChange = (
        e: ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>,
    ) => {
        const { name, value } = e.target;
        setFormData((prev) => ({ ...prev, [name]: value }));
        const key = name as keyof FormErrors;
        if (errors[key]) {
            setErrors((prev) => ({ ...prev, [key]: undefined }));
        }
        if (name === 'templateId' && errors.submit) {
            setErrors((prev) => ({ ...prev, submit: undefined }));
        }
    };

    const handleStaticTextChange = (elementId: string, value: string) => {
        setFormData((prev) => ({
            ...prev,
            staticTexts: { ...prev.staticTexts, [elementId]: value },
        }));
    };

    const hasTemplate = Boolean(formData.templateId.trim());
    const showDescription = hasTemplate && wording.hasDescription;
    const showIssuer = hasTemplate && wording.hasIssuer;
    const showStaticTexts = hasTemplate && wording.staticTexts.length > 0;
    const hasWordingFields = showDescription || showIssuer || showStaticTexts;

    const validate = (): boolean => {
        const next: FormErrors = {};
        if (!formData.recipientName.trim()) next.recipientName = 'Recipient name is required';
        if (!formData.recipientEmail.trim()) {
            next.recipientEmail = 'Recipient email is required';
        } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.recipientEmail.trim())) {
            next.recipientEmail = 'Enter a valid email address';
        }
        if (!formData.templateId.trim()) next.templateId = 'Template is required';
        if (!formData.type) next.type = 'Type is required';
        if (!formData.title.trim()) next.title = 'Title is required';
        setErrors(next);
        return Object.keys(next).length === 0;
    };

    const handleClose = () => {
        setFormData(buildEmptyForm());
        setWording(EMPTY_WORDING);
        setErrors({});
        setIsSubmitting(false);
        onClose();
    };

    const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
        e.preventDefault();
        if (!validate()) return;

        setIsSubmitting(true);
        setErrors({});

        try {
            const fieldValues: Record<string, unknown> = {};
            if (showIssuer) {
                fieldValues.issuerName = formData.issuerName;
            }
            if (showStaticTexts) {
                fieldValues.staticTexts = { ...formData.staticTexts };
            }

            const payload: CreateCustomCertificatePayload = {
                recipientName: formData.recipientName.trim(),
                recipientEmail: formData.recipientEmail.trim(),
                type: isLinked ? 'CUSTOM' : formData.type,
                title: formData.title.trim(),
                description: showDescription ? formData.description.trim() : '',
                templateId: Number(formData.templateId),
                fieldValues,
            };
            if (eventId != null) payload.eventId = Number(eventId) as Id;
            if (projectId != null) payload.projectId = Number(projectId) as Id;

            await certificatesAPI.createCustom(payload);
            await onSuccess();
            handleClose();
        } catch (error: unknown) {
            setErrors({ submit: getErrorMessage(error, 'Failed to create certificate') });
        } finally {
            setIsSubmitting(false);
        }
    };

    if (!isOpen) return null;

    const fieldsDisabled = isSubmitting || templateLoading;

    return (
        <div className="new-custom-certificate-modal">
            <div className="modal-backdrop" onClick={handleClose} />
            <div className="modal-container">
                <div className="modal-header">
                    <h2 className="modal-title">
                        {isLinked ? 'Add Custom Certificate' : 'New Custom Certificate'}
                    </h2>
                    <button className="modal-close-btn" onClick={handleClose} type="button">
                        <X />
                    </button>
                </div>

                <form onSubmit={handleSubmit}>
                    <div className="modal-body">
                        {errors.submit && <div className="error-message">{errors.submit}</div>}
                        {isLinked ? (
                            <p className="form-hint">
                                Creates a CUSTOM certificate linked to this{' '}
                                {eventId != null ? 'event' : 'project'} for external speakers or
                                guests. Edits apply only to this certificate — the template is not
                                changed.
                            </p>
                        ) : (
                            <p className="form-hint">
                                Select a template to prefill wording fields. Changes apply only to
                                this certificate.
                            </p>
                        )}

                        <div className="form-group">
                            <label htmlFor="recipientName" className="form-label">
                                Recipient Name *
                            </label>
                            <input
                                type="text"
                                id="recipientName"
                                name="recipientName"
                                className={`form-input ${errors.recipientName ? 'error' : ''}`}
                                value={formData.recipientName}
                                onChange={handleChange}
                                disabled={fieldsDisabled}
                            />
                            {errors.recipientName && (
                                <span className="field-error">{errors.recipientName}</span>
                            )}
                        </div>

                        <div className="form-group">
                            <label htmlFor="recipientEmail" className="form-label">
                                Recipient Email *
                            </label>
                            <input
                                type="email"
                                id="recipientEmail"
                                name="recipientEmail"
                                className={`form-input ${errors.recipientEmail ? 'error' : ''}`}
                                value={formData.recipientEmail}
                                onChange={handleChange}
                                disabled={fieldsDisabled}
                            />
                            {errors.recipientEmail && (
                                <span className="field-error">{errors.recipientEmail}</span>
                            )}
                        </div>

                        <div className="form-group">
                            <label htmlFor="templateId" className="form-label">
                                Template *
                            </label>
                            <select
                                id="templateId"
                                name="templateId"
                                className={`form-input ${errors.templateId ? 'error' : ''}`}
                                value={formData.templateId}
                                onChange={handleChange}
                                disabled={isSubmitting || templatesLoading}
                            >
                                <option value="">Select template…</option>
                                {templates.map((template) => (
                                    <option key={template.id} value={String(template.id)}>
                                        {template.name}
                                    </option>
                                ))}
                            </select>
                            {errors.templateId && (
                                <span className="field-error">{errors.templateId}</span>
                            )}
                            {templateLoading ? (
                                <span className="form-hint">Loading template wording…</span>
                            ) : null}
                        </div>

                        {!isLinked ? (
                            <div className="form-group">
                                <label htmlFor="type" className="form-label">
                                    Type *
                                </label>
                                <select
                                    id="type"
                                    name="type"
                                    className={`form-input ${errors.type ? 'error' : ''}`}
                                    value={formData.type}
                                    onChange={handleChange}
                                    disabled={fieldsDisabled}
                                >
                                    {CERTIFICATE_TYPES.map((type) => (
                                        <option key={type} value={type}>
                                            {type.charAt(0) + type.slice(1).toLowerCase()}
                                        </option>
                                    ))}
                                </select>
                                {errors.type && <span className="field-error">{errors.type}</span>}
                            </div>
                        ) : null}

                        <div className="form-group">
                            <label htmlFor="title" className="form-label">
                                Title *
                            </label>
                            <input
                                type="text"
                                id="title"
                                name="title"
                                className={`form-input ${errors.title ? 'error' : ''}`}
                                value={formData.title}
                                onChange={handleChange}
                                disabled={fieldsDisabled}
                            />
                            {errors.title && <span className="field-error">{errors.title}</span>}
                        </div>

                        {showDescription ? (
                            <div className="form-group">
                                <label htmlFor="description" className="form-label">
                                    Description
                                </label>
                                <textarea
                                    id="description"
                                    name="description"
                                    className="form-input"
                                    value={formData.description}
                                    onChange={handleChange}
                                    disabled={fieldsDisabled}
                                    rows={3}
                                />
                            </div>
                        ) : null}

                        {showIssuer ? (
                            <div className="form-group">
                                <label htmlFor="issuerName" className="form-label">
                                    Issuer
                                </label>
                                <input
                                    type="text"
                                    id="issuerName"
                                    name="issuerName"
                                    className="form-input"
                                    value={formData.issuerName}
                                    onChange={handleChange}
                                    disabled={fieldsDisabled}
                                />
                            </div>
                        ) : null}

                        {showStaticTexts
                            ? wording.staticTexts.map((entry) => (
                                  <div className="form-group" key={entry.id}>
                                      <label
                                          htmlFor={`staticText-${entry.id}`}
                                          className="form-label"
                                      >
                                          Static Text {entry.ordinal}
                                      </label>
                                      <textarea
                                          id={`staticText-${entry.id}`}
                                          className="form-input"
                                          value={formData.staticTexts[entry.id] ?? ''}
                                          onChange={(e) =>
                                              handleStaticTextChange(entry.id, e.target.value)
                                          }
                                          disabled={fieldsDisabled}
                                          rows={2}
                                      />
                                  </div>
                              ))
                            : null}

                        {hasTemplate && !templateLoading && !hasWordingFields ? (
                            <p className="form-hint">
                                This template has no Description, Issuer, or Static Text elements
                                to tweak. Add them in the template editor to prefill here.
                            </p>
                        ) : null}

                        <p className="form-hint">* Required fields</p>
                    </div>

                    <div className="modal-footer">
                        <button
                            type="button"
                            className="btn btn-secondary"
                            onClick={handleClose}
                            disabled={isSubmitting}
                        >
                            Cancel
                        </button>
                        <button type="submit" className="btn btn-primary" disabled={isSubmitting}>
                            {isSubmitting ? 'Creating…' : 'Create Certificate'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}
