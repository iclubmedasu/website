'use client';

import {
    useEffect,
    useRef,
    useState,
    type ChangeEvent,
    type FormEvent,
    type KeyboardEvent,
} from 'react';
import { X } from 'lucide-react';
import { parseTemplateLayoutWording, type TemplateLayoutWording } from '@iclub/shared/utils';
import {
    certificatesAPI,
    type CertificateTemplate,
    type CertificateType,
    type CreateCustomCertificatePayload,
} from '@/services/certificatesAPI';
import { eventsAPI } from '@/services/api';
import type { EventRegistrationRef, Id } from '@/types/backend-contracts';
import './NewCustomCertificateModal.css';
import { FormSelect } from '@/components/input/FormSelect';

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

interface RecipientOption {
    registrationId: Id;
    fullName: string;
    email: string;
    memberId: Id | null;
    /** Display label; duplicate names use `Name (email)`. */
    label: string;
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

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const AMBIGUOUS_NAME_ERROR =
    'Multiple people share that name. Pick one from the list.';

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
        // Match editor preview when the layout has a title element but empty text.
        title =
            wording.titleText ||
            (wording.hasTitle ? 'Certificate of Participation' : '');
    }

    return {
        ...prev,
        title,
        description: wording.description,
        issuerName: wording.hasIssuer ? wording.issuerName : '',
        staticTexts,
    };
}

function sameTemplateId(a: Id | string | number, b: string): boolean {
    return String(a) === b;
}

function buildRecipientOptions(registrations: EventRegistrationRef[]): RecipientOption[] {
    const active = registrations.filter((reg) => reg.status !== 'CANCELLED');
    const nameCounts = new Map<string, number>();
    for (const reg of active) {
        const key = reg.fullName.trim().toLowerCase();
        nameCounts.set(key, (nameCounts.get(key) ?? 0) + 1);
    }

    return active.map((reg) => {
        const fullName = reg.fullName.trim();
        const email = reg.email.trim();
        const nameKey = fullName.toLowerCase();
        const isDuplicate = (nameCounts.get(nameKey) ?? 0) > 1;
        return {
            registrationId: reg.id,
            fullName,
            email,
            memberId: reg.memberId != null && Number(reg.memberId) > 0 ? reg.memberId : null,
            label: isDuplicate ? `${fullName} (${email})` : fullName,
        };
    });
}

function findByExactEmail(
    options: RecipientOption[],
    email: string,
): RecipientOption | undefined {
    const needle = email.trim().toLowerCase();
    if (!needle) return undefined;
    return options.find((opt) => opt.email.toLowerCase() === needle);
}

function findByExactName(options: RecipientOption[], name: string): RecipientOption[] {
    const needle = name.trim().toLowerCase();
    if (!needle) return [];
    return options.filter((opt) => opt.fullName.toLowerCase() === needle);
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
    const useRecipientCombobox = eventId != null;
    const [formData, setFormData] = useState<FormState>(() => buildEmptyForm(defaultTitle));
    const [errors, setErrors] = useState<FormErrors>({});
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [templates, setTemplates] = useState<CertificateTemplate[]>([]);
    const [templatesLoading, setTemplatesLoading] = useState(false);
    const [templateLoading, setTemplateLoading] = useState(false);
    const [wording, setWording] = useState<TemplateLayoutWording>(EMPTY_WORDING);
    const [recipientOptions, setRecipientOptions] = useState<RecipientOption[]>([]);
    const [registrationsLoading, setRegistrationsLoading] = useState(false);
    const [recipientLocked, setRecipientLocked] = useState(false);
    const [recipientMemberId, setRecipientMemberId] = useState<Id | null>(null);
    const [nameListOpen, setNameListOpen] = useState(false);
    const [emailListOpen, setEmailListOpen] = useState(false);
    const [nameHighlight, setNameHighlight] = useState(0);
    const [emailHighlight, setEmailHighlight] = useState(0);
    const wasOpenRef = useRef(false);
    const defaultTitleRef = useRef(defaultTitle);
    const templatesRef = useRef(templates);
    templatesRef.current = templates;
    const nameComboRef = useRef<HTMLDivElement>(null);
    const emailComboRef = useRef<HTMLDivElement>(null);

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
            setRecipientLocked(false);
            setRecipientMemberId(null);
            setNameListOpen(false);
            setEmailListOpen(false);
            setNameHighlight(0);
            setEmailHighlight(0);
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

    // Load event registrations for paired recipient comboboxes (event-linked only).
    useEffect(() => {
        if (!isOpen || eventId == null) {
            setRecipientOptions([]);
            setRegistrationsLoading(false);
            return;
        }

        let cancelled = false;
        const loadRegistrations = async () => {
            setRegistrationsLoading(true);
            try {
                const data = await eventsAPI.getRegistrations(eventId);
                if (!cancelled) {
                    setRecipientOptions(buildRecipientOptions(Array.isArray(data) ? data : []));
                }
            } catch {
                if (!cancelled) {
                    setRecipientOptions([]);
                }
            } finally {
                if (!cancelled) {
                    setRegistrationsLoading(false);
                }
            }
        };

        void loadRegistrations();
        return () => {
            cancelled = true;
        };
    }, [isOpen, eventId]);

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

    // Close suggestion lists on outside click.
    useEffect(() => {
        if (!nameListOpen && !emailListOpen) return;

        const onPointerDown = (event: MouseEvent) => {
            const target = event.target as Node;
            if (nameListOpen && nameComboRef.current && !nameComboRef.current.contains(target)) {
                setNameListOpen(false);
            }
            if (emailListOpen && emailComboRef.current && !emailComboRef.current.contains(target)) {
                setEmailListOpen(false);
            }
        };

        document.addEventListener('mousedown', onPointerDown);
        return () => document.removeEventListener('mousedown', onPointerDown);
    }, [nameListOpen, emailListOpen]);

    const nameSuggestions = (() => {
        const q = formData.recipientName.trim().toLowerCase();
        if (!q) return recipientOptions.slice(0, 50);
        return recipientOptions
            .filter(
                (opt) =>
                    opt.fullName.toLowerCase().includes(q) ||
                    opt.email.toLowerCase().includes(q) ||
                    opt.label.toLowerCase().includes(q),
            )
            .slice(0, 50);
    })();

    const emailSuggestions = (() => {
        const q = formData.recipientEmail.trim().toLowerCase();
        if (!q) return recipientOptions.slice(0, 50);
        return recipientOptions
            .filter(
                (opt) =>
                    opt.email.toLowerCase().includes(q) ||
                    opt.fullName.toLowerCase().includes(q),
            )
            .slice(0, 50);
    })();

    const selectRecipient = (option: RecipientOption) => {
        setFormData((prev) => ({
            ...prev,
            recipientName: option.fullName,
            recipientEmail: option.email,
        }));
        setRecipientMemberId(option.memberId);
        setRecipientLocked(true);
        setNameListOpen(false);
        setEmailListOpen(false);
        setErrors((prev) => ({
            ...prev,
            recipientName: undefined,
            recipientEmail: undefined,
        }));
    };

    const clearRecipient = () => {
        setFormData((prev) => ({
            ...prev,
            recipientName: '',
            recipientEmail: '',
        }));
        setRecipientMemberId(null);
        setRecipientLocked(false);
        setNameListOpen(false);
        setEmailListOpen(false);
        setNameHighlight(0);
        setEmailHighlight(0);
        setErrors((prev) => ({
            ...prev,
            recipientName: undefined,
            recipientEmail: undefined,
        }));
    };

    /** On blur/enter: exact email or unique name → lock; ambiguous name → error. */
    const resolveNameInput = (rawName: string): boolean => {
        const matches = findByExactName(recipientOptions, rawName);
        if (matches.length === 1) {
            selectRecipient(matches[0]);
            return true;
        }
        if (matches.length > 1) {
            setErrors((prev) => ({ ...prev, recipientName: AMBIGUOUS_NAME_ERROR }));
            setNameListOpen(true);
            return false;
        }
        setRecipientMemberId(null);
        setRecipientLocked(false);
        return true;
    };

    const resolveEmailInput = (rawEmail: string): boolean => {
        const match = findByExactEmail(recipientOptions, rawEmail);
        if (match) {
            selectRecipient(match);
            return true;
        }
        setRecipientMemberId(null);
        setRecipientLocked(false);
        return true;
    };

    const handleChange = (
        e: ChangeEvent<HTMLInputElement | HTMLTextAreaElement> | { target: { value: string; name: string; type?: string } },
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

    const handleNameChange = (e: ChangeEvent<HTMLInputElement>) => {
        const value = e.target.value;
        setFormData((prev) => ({ ...prev, recipientName: value }));
        if (errors.recipientName) {
            setErrors((prev) => ({ ...prev, recipientName: undefined }));
        }
        setNameListOpen(true);
        setNameHighlight(0);
        setEmailListOpen(false);
    };

    const handleEmailChange = (e: ChangeEvent<HTMLInputElement>) => {
        const value = e.target.value;
        setFormData((prev) => ({ ...prev, recipientEmail: value }));
        if (errors.recipientEmail) {
            setErrors((prev) => ({ ...prev, recipientEmail: undefined }));
        }
        setEmailListOpen(true);
        setEmailHighlight(0);
        setNameListOpen(false);
    };

    const handleNameKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
        if (recipientLocked) return;
        if (e.key === 'ArrowDown') {
            e.preventDefault();
            setNameListOpen(true);
            setNameHighlight((i) => Math.min(i + 1, Math.max(nameSuggestions.length - 1, 0)));
            return;
        }
        if (e.key === 'ArrowUp') {
            e.preventDefault();
            setNameHighlight((i) => Math.max(i - 1, 0));
            return;
        }
        if (e.key === 'Enter' && nameListOpen && nameSuggestions.length > 0) {
            e.preventDefault();
            const option = nameSuggestions[nameHighlight] ?? nameSuggestions[0];
            if (option) selectRecipient(option);
            return;
        }
        if (e.key === 'Escape') {
            setNameListOpen(false);
            return;
        }
        if (e.key === 'Enter') {
            e.preventDefault();
            resolveNameInput(formData.recipientName);
        }
    };

    const handleEmailKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
        if (recipientLocked) return;
        if (e.key === 'ArrowDown') {
            e.preventDefault();
            setEmailListOpen(true);
            setEmailHighlight((i) => Math.min(i + 1, Math.max(emailSuggestions.length - 1, 0)));
            return;
        }
        if (e.key === 'ArrowUp') {
            e.preventDefault();
            setEmailHighlight((i) => Math.max(i - 1, 0));
            return;
        }
        if (e.key === 'Enter' && emailListOpen && emailSuggestions.length > 0) {
            e.preventDefault();
            const option = emailSuggestions[emailHighlight] ?? emailSuggestions[0];
            if (option) selectRecipient(option);
            return;
        }
        if (e.key === 'Escape') {
            setEmailListOpen(false);
            return;
        }
        if (e.key === 'Enter') {
            e.preventDefault();
            resolveEmailInput(formData.recipientEmail);
        }
    };

    const handleNameBlur = () => {
        if (recipientLocked) return;
        // Delay so option click can fire first.
        window.setTimeout(() => {
            if (nameComboRef.current?.contains(document.activeElement)) return;
            setNameListOpen(false);
            resolveNameInput(formData.recipientName);
        }, 120);
    };

    const handleEmailBlur = () => {
        if (recipientLocked) return;
        window.setTimeout(() => {
            if (emailComboRef.current?.contains(document.activeElement)) return;
            setEmailListOpen(false);
            resolveEmailInput(formData.recipientEmail);
        }, 120);
    };

    const handleStaticTextChange = (elementId: string, value: string) => {
        setFormData((prev) => ({
            ...prev,
            staticTexts: { ...prev.staticTexts, [elementId]: value },
        }));
    };

    const hasTemplate = Boolean(formData.templateId.trim());
    const showDescription = hasTemplate;
    const showIssuer = hasTemplate && wording.hasIssuer;
    const showStaticTexts = hasTemplate && wording.staticTexts.length > 0;
    const hasWordingFields = showIssuer || showStaticTexts;

    const resolveRecipientPair = (): {
        ok: boolean;
        recipientName: string;
        recipientEmail: string;
        memberId: Id | null;
        errors: FormErrors;
    } => {
        let recipientName = formData.recipientName.trim();
        let recipientEmail = formData.recipientEmail.trim();
        let memberId = recipientMemberId;
        const fieldErrors: FormErrors = {};

        if (useRecipientCombobox && !recipientLocked) {
            const nameMatches = findByExactName(recipientOptions, recipientName);
            if (nameMatches.length > 1) {
                fieldErrors.recipientName = AMBIGUOUS_NAME_ERROR;
            } else if (nameMatches.length === 1) {
                const match = nameMatches[0];
                recipientName = match.fullName;
                recipientEmail = match.email;
                memberId = match.memberId;
                selectRecipient(match);
            } else {
                const emailMatch = findByExactEmail(recipientOptions, recipientEmail);
                if (emailMatch) {
                    recipientName = emailMatch.fullName;
                    recipientEmail = emailMatch.email;
                    memberId = emailMatch.memberId;
                    selectRecipient(emailMatch);
                } else {
                    memberId = null;
                }
            }
        } else if (useRecipientCombobox && recipientLocked) {
            const emailMatch = findByExactEmail(recipientOptions, recipientEmail);
            if (emailMatch) {
                memberId = emailMatch.memberId;
            }
        } else {
            memberId = null;
        }

        if (!recipientName) fieldErrors.recipientName = 'Recipient name is required';
        if (!recipientEmail) {
            fieldErrors.recipientEmail = 'Recipient email is required';
        } else if (!EMAIL_RE.test(recipientEmail)) {
            fieldErrors.recipientEmail = 'Enter a valid email address';
        }

        return {
            ok: Object.keys(fieldErrors).length === 0,
            recipientName,
            recipientEmail,
            memberId,
            errors: fieldErrors,
        };
    };

    const handleClose = () => {
        setFormData(buildEmptyForm());
        setWording(EMPTY_WORDING);
        setErrors({});
        setIsSubmitting(false);
        setRecipientLocked(false);
        setRecipientMemberId(null);
        setRecipientOptions([]);
        setNameListOpen(false);
        setEmailListOpen(false);
        onClose();
    };

    const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
        e.preventDefault();

        const resolved = resolveRecipientPair();
        const next: FormErrors = { ...resolved.errors };
        if (!formData.templateId.trim()) next.templateId = 'Template is required';
        if (!formData.type) next.type = 'Type is required';
        if (!formData.title.trim()) next.title = 'Title is required';
        setErrors(next);
        if (Object.keys(next).length > 0) return;

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
                recipientName: resolved.recipientName,
                recipientEmail: resolved.recipientEmail,
                type: isLinked ? 'CUSTOM' : formData.type,
                title: formData.title.trim(),
                description: formData.description.trim(),
                templateId: Number(formData.templateId),
                fieldValues,
            };
            if (eventId != null) payload.eventId = Number(eventId) as Id;
            if (projectId != null) payload.projectId = Number(projectId) as Id;
            if (useRecipientCombobox && resolved.memberId != null) {
                payload.recipientMemberId = resolved.memberId;
            }

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

    const renderFreeTextRecipientFields = () => (
        <>
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
        </>
    );

    const renderPairedRecipientFields = () => (
        <>
            <p className="form-hint recipient-pair-hint">
                Select a registered attendee, or type a new name and email.
                {registrationsLoading ? ' Loading attendees…' : null}
            </p>

            <div className="form-group">
                <div className="recipient-pair-label-row">
                    <label htmlFor="recipientName" className="form-label">
                        Recipient Name *
                    </label>
                    {recipientLocked ? (
                        <button
                            type="button"
                            className="recipient-pair-clear"
                            onClick={clearRecipient}
                            disabled={fieldsDisabled}
                        >
                            Clear
                        </button>
                    ) : null}
                </div>
                <div className="recipient-combobox" ref={nameComboRef}>
                    <input
                        type="text"
                        id="recipientName"
                        name="recipientName"
                        role="combobox"
                        aria-expanded={nameListOpen}
                        aria-controls="recipientName-listbox"
                        aria-autocomplete="list"
                        autoComplete="off"
                        className={`form-input ${errors.recipientName ? 'error' : ''} ${recipientLocked ? 'recipient-combobox-input--locked' : ''}`}
                        value={formData.recipientName}
                        onChange={handleNameChange}
                        onFocus={() => {
                            if (!recipientLocked) setNameListOpen(true);
                        }}
                        onBlur={handleNameBlur}
                        onKeyDown={handleNameKeyDown}
                        disabled={fieldsDisabled}
                        readOnly={recipientLocked}
                    />
                    {nameListOpen && !recipientLocked && nameSuggestions.length > 0 ? (
                        <ul
                            id="recipientName-listbox"
                            role="listbox"
                            className="form-combobox-list"
                        >
                            {nameSuggestions.map((opt, index) => (
                                <li key={`name-${opt.registrationId}`} role="presentation">
                                    <button
                                        type="button"
                                        role="option"
                                        aria-selected={index === nameHighlight}
                                        className={`form-combobox-option ${index === nameHighlight ? 'form-combobox-option--active' : ''}`}
                                        onMouseDown={(ev) => {
                                            ev.preventDefault();
                                            selectRecipient(opt);
                                        }}
                                        onMouseEnter={() => setNameHighlight(index)}
                                    >
                                        <span className="recipient-combobox-option-name">
                                            {opt.label}
                                        </span>
                                        {!opt.label.includes('(') ? (
                                            <span className="recipient-combobox-option-email">
                                                {opt.email}
                                            </span>
                                        ) : null}
                                    </button>
                                </li>
                            ))}
                        </ul>
                    ) : null}
                </div>
                {errors.recipientName && (
                    <span className="field-error">{errors.recipientName}</span>
                )}
            </div>

            <div className="form-group">
                <label htmlFor="recipientEmail" className="form-label">
                    Recipient Email *
                </label>
                <div className="recipient-combobox" ref={emailComboRef}>
                    <input
                        type="email"
                        id="recipientEmail"
                        name="recipientEmail"
                        role="combobox"
                        aria-expanded={emailListOpen}
                        aria-controls="recipientEmail-listbox"
                        aria-autocomplete="list"
                        autoComplete="off"
                        className={`form-input ${errors.recipientEmail ? 'error' : ''} ${recipientLocked ? 'recipient-combobox-input--locked' : ''}`}
                        value={formData.recipientEmail}
                        onChange={handleEmailChange}
                        onFocus={() => {
                            if (!recipientLocked) setEmailListOpen(true);
                        }}
                        onBlur={handleEmailBlur}
                        onKeyDown={handleEmailKeyDown}
                        disabled={fieldsDisabled}
                        readOnly={recipientLocked}
                    />
                    {emailListOpen && !recipientLocked && emailSuggestions.length > 0 ? (
                        <ul
                            id="recipientEmail-listbox"
                            role="listbox"
                            className="form-combobox-list"
                        >
                            {emailSuggestions.map((opt, index) => (
                                <li key={`email-${opt.registrationId}`} role="presentation">
                                    <button
                                        type="button"
                                        role="option"
                                        aria-selected={index === emailHighlight}
                                        className={`form-combobox-option ${index === emailHighlight ? 'form-combobox-option--active' : ''}`}
                                        onMouseDown={(ev) => {
                                            ev.preventDefault();
                                            selectRecipient(opt);
                                        }}
                                        onMouseEnter={() => setEmailHighlight(index)}
                                    >
                                        <span className="recipient-combobox-option-name">
                                            {opt.fullName}
                                        </span>
                                        <span className="recipient-combobox-option-email">
                                            {opt.email}
                                        </span>
                                    </button>
                                </li>
                            ))}
                        </ul>
                    ) : null}
                </div>
                {errors.recipientEmail && (
                    <span className="field-error">{errors.recipientEmail}</span>
                )}
            </div>
        </>
    );

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

                        {useRecipientCombobox
                            ? renderPairedRecipientFields()
                            : renderFreeTextRecipientFields()}

                        <div className="form-group">
                            <label htmlFor="templateId" className="form-label">
                                Template *
                            </label>
                            <FormSelect
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
                            </FormSelect>
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
                                <FormSelect
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
                                </FormSelect>
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
                                This template has no Issuer or Static Text elements to tweak. Add
                                them in the template editor to prefill here.
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
