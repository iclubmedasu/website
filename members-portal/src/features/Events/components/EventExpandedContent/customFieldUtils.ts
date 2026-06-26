import type { EventCustomFieldRef, EventRegistrationRef } from '@/types/backend-contracts';

export interface AttendeeDraft {
    fullName: string;
    email: string;
    phoneNumber: string;
    tierId: string;
    customFieldValues: Record<string, unknown>;
}

export const emptyAttendeeDraft = (): AttendeeDraft => ({
    fullName: '',
    email: '',
    phoneNumber: '',
    tierId: '',
    customFieldValues: {},
});

export function getCustomFieldValue(registration: EventRegistrationRef, field: EventCustomFieldRef): unknown {
    const values = registration.customFieldValues;
    if (!values || typeof values !== 'object') return undefined;
    const record = values as Record<string, unknown>;
    return record[String(field.id)] ?? record[field.label];
}

export function getCustomFieldValueFromRecord(
    customFieldValues: Record<string, unknown> | null | undefined,
    field: EventCustomFieldRef,
): unknown {
    if (!customFieldValues || typeof customFieldValues !== 'object') return undefined;
    return customFieldValues[String(field.id)] ?? customFieldValues[field.label];
}

export function formatCustomFieldValue(field: EventCustomFieldRef, value: unknown): string {
    if (value === null || value === undefined || value === '') return '—';
    if (field.type === 'checkbox') {
        return value === true || value === 'true' ? 'Yes' : 'No';
    }
    return String(value);
}

export function dropdownOptions(field: EventCustomFieldRef): string[] {
    if (!Array.isArray(field.options)) return [];
    return field.options.map((option) => String(option));
}

export function isCustomFieldValueEmpty(field: EventCustomFieldRef, value: unknown): boolean {
    if (field.type === 'checkbox') {
        return value !== true && value !== 'true';
    }
    if (value === null || value === undefined || value === '') return true;
    return false;
}

export function getMissingRequiredCustomFields(
    registration: EventRegistrationRef,
    fields: EventCustomFieldRef[],
): EventCustomFieldRef[] {
    return fields.filter((field) => {
        if (field.isActive === false || !field.required) return false;
        const value = getCustomFieldValue(registration, field);
        return isCustomFieldValueEmpty(field, value);
    });
}

export function validateRequiredCustomFields(
    customFieldValues: Record<string, unknown>,
    fields: EventCustomFieldRef[],
    options?: { publicOnly?: boolean },
): Record<string, string> {
    const errors: Record<string, string> = {};

    for (const field of fields) {
        if (field.isActive === false || !field.required) continue;
        if (options?.publicOnly && !field.showOnPublic) continue;

        const fieldKey = String(field.id);
        const value = getCustomFieldValueFromRecord(customFieldValues, field);
        if (isCustomFieldValueEmpty(field, value)) {
            errors[fieldKey] = `${field.label} is required.`;
        }
    }

    return errors;
}

export function validateAttendeeDraft(
    draft: AttendeeDraft,
    fields: EventCustomFieldRef[],
): Record<string, string> {
    const errors: Record<string, string> = {};

    if (!draft.fullName.trim()) {
        errors.fullName = 'Name is required.';
    }
    if (!draft.email.trim()) {
        errors.email = 'Email is required.';
    }

    const customErrors = validateRequiredCustomFields(draft.customFieldValues, fields);
    return { ...errors, ...customErrors };
}

export function mergeCustomFieldValues(
    existing: Record<string, unknown> | null | undefined,
    incoming: Record<string, unknown>,
): Record<string, unknown> {
    return { ...(existing ?? {}), ...incoming };
}

export function formatRegistrationSource(registration: EventRegistrationRef): string {
    if (registration.source === 'IMPORT') return 'Imported';
    if (registration.isWalkIn || registration.source === 'WALK_IN') return 'Walk-in';
    return 'Pre-registered';
}

export const REGISTRATION_SOURCE_GROUP_OPTIONS = [
    { value: '', label: 'All sources' },
    { value: 'PRE_REGISTERED', label: 'Pre-registered' },
    { value: 'WALK_IN', label: 'Walk-in' },
    { value: 'IMPORT', label: 'Imported' },
] as const;

export function isImportPlaceholderEmail(email: string | null | undefined): boolean {
    return String(email || '').trim().toLowerCase().endsWith('@event-import.local');
}

export function formatTicketEmailStatus(registration: EventRegistrationRef): { label: string; sent: boolean; sentAt?: string | null } {
    if (registration.ticketEmailSentAt) {
        return { label: 'Sent', sent: true, sentAt: registration.ticketEmailSentAt };
    }
    return { label: 'Not sent', sent: false };
}

export function formatReminderEmailStatus(registration: EventRegistrationRef): { label: string; sent: boolean; sentAt?: string | null } {
    if (registration.reminderEmailSentAt) {
        return { label: 'Sent', sent: true, sentAt: registration.reminderEmailSentAt };
    }
    return { label: 'Not sent', sent: false };
}

export function getSendableRegistrations(registrations: EventRegistrationRef[]): EventRegistrationRef[] {
    return registrations.filter(
        (registration) => registration.status !== 'CANCELLED'
            && Boolean(registration.email?.trim())
            && !isImportPlaceholderEmail(registration.email),
    );
}

export function formatRegistrationStatus(registration: EventRegistrationRef): string {
    if (registration.status === 'CANCELLED') return 'Cancelled';
    if (registration.status === 'CHECKED_IN') return 'Checked in';
    return 'Registered';
}

export const REGISTRATION_NAME_DISPLAY_LIMIT = 20;
export const REGISTRATION_PHONE_DISPLAY_LIMIT = 15;

export function truncateRegistrationCell(value: string, maxLength: number): string {
    if (value.length <= maxLength) return value;
    return `${value.slice(0, maxLength)}......`;
}

export function parseCustomFieldInputValue(
    field: EventCustomFieldRef,
    raw: string,
): unknown {
    if (field.type === 'number') {
        return raw === '' ? null : Number(raw);
    }
    return raw;
}
