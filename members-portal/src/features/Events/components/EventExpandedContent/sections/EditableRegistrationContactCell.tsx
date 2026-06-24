import { useEffect, useState } from 'react';
import { Check, Pencil, X } from 'lucide-react';
import { eventsAPI } from '@/services/api';
import type { EventRegistrationRef, Id } from '@/types/backend-contracts';

type ContactField = 'fullName' | 'email' | 'phoneNumber';

const FIELD_LABELS: Record<ContactField, string> = {
    fullName: 'name',
    email: 'email',
    phoneNumber: 'phone',
};

interface EditableRegistrationContactCellProps {
    eventId: Id | string;
    registration: EventRegistrationRef;
    field: ContactField;
    editable?: boolean;
    className?: string;
    onUpdated: (updated: EventRegistrationRef) => void;
}

function truncateDisplay(value: string, max: number): string {
    if (value.length <= max) return value;
    return `${value.slice(0, max)}...`;
}

const DISPLAY_LIMITS: Record<ContactField, number> = {
    fullName: 20,
    email: 20,
    phoneNumber: 15,
};

function readFieldValue(registration: EventRegistrationRef, field: ContactField): string {
    if (field === 'phoneNumber') return registration.phoneNumber || '';
    return registration[field] || '';
}

function validateField(field: ContactField, value: string): string | null {
    const trimmed = value.trim();
    if (field === 'fullName' && !trimmed) return 'Name is required.';
    if (field === 'email') {
        if (!trimmed) return 'Email is required.';
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed)) return 'Enter a valid email.';
    }
    return null;
}

export default function EditableRegistrationContactCell({
    eventId,
    registration,
    field,
    editable = true,
    className,
    onUpdated,
}: EditableRegistrationContactCellProps) {
    const storedValue = readFieldValue(registration, field);
    const [editing, setEditing] = useState(false);
    const [draft, setDraft] = useState(storedValue);
    const [error, setError] = useState('');
    const [saving, setSaving] = useState(false);

    useEffect(() => {
        if (!editing) setDraft(storedValue);
    }, [editing, storedValue]);

    const displayValue = storedValue ? truncateDisplay(storedValue, DISPLAY_LIMITS[field]) : '—';
    const label = FIELD_LABELS[field];
    const cellClass = [
        className,
        error ? 'event-registrations-cell--error' : '',
        saving ? 'event-registrations-cell--saving' : '',
    ].filter(Boolean).join(' ') || undefined;

    if (!editable) {
        return (
            <td className={className} title={storedValue || undefined}>
                {displayValue}
            </td>
        );
    }

    const startEdit = () => {
        setDraft(storedValue);
        setError('');
        setEditing(true);
    };

    const cancelEdit = () => {
        setDraft(storedValue);
        setError('');
        setEditing(false);
    };

    const saveEdit = async () => {
        const validationError = validateField(field, draft);
        if (validationError) {
            setError(validationError);
            return;
        }

        const trimmed = draft.trim();
        const payload = field === 'phoneNumber'
            ? { phoneNumber: trimmed || null }
            : { [field]: trimmed };

        const normalizedCurrent = field === 'phoneNumber'
            ? (storedValue || null)
            : storedValue;
        const normalizedNext = field === 'phoneNumber'
            ? (trimmed || null)
            : trimmed;

        if (normalizedCurrent === normalizedNext) {
            setEditing(false);
            return;
        }

        setSaving(true);
        setError('');
        try {
            const updated = await eventsAPI.updateRegistration(eventId, registration.id, payload);
            onUpdated(updated);
            setEditing(false);
        } catch (saveError) {
            setError(saveError instanceof Error ? saveError.message : 'Failed to save.');
        } finally {
            setSaving(false);
        }
    };

    if (editing) {
        return (
            <td className={cellClass}>
                <div className="event-registrations-contact-cell event-registrations-contact-cell--editing">
                    <input
                        type={field === 'email' ? 'email' : 'text'}
                        value={draft}
                        disabled={saving}
                        onChange={(event) => {
                            setDraft(event.target.value);
                            if (error) setError('');
                        }}
                        onKeyDown={(event) => {
                            if (event.key === 'Enter') void saveEdit();
                            if (event.key === 'Escape') cancelEdit();
                        }}
                        className="event-registrations-table-input form-input"
                        aria-label={label}
                        autoFocus
                    />
                    <div className="event-registrations-contact-cell__actions">
                        <button
                            type="button"
                            className="table-action-btn event-registrations-contact-cell__save"
                            onClick={() => void saveEdit()}
                            disabled={saving}
                            aria-label={`Save ${label}`}
                        >
                            <Check size={12} />
                        </button>
                        <button
                            type="button"
                            className="table-action-btn event-registrations-contact-cell__cancel"
                            onClick={cancelEdit}
                            disabled={saving}
                            aria-label={`Cancel editing ${label}`}
                        >
                            <X size={12} />
                        </button>
                    </div>
                </div>
            </td>
        );
    }

    return (
        <td className={cellClass} title={storedValue || undefined}>
            <div className="event-registrations-contact-cell">
                <span className="event-registrations-contact-cell__value">{displayValue}</span>
                <button
                    type="button"
                    className="table-action-btn edit-btn event-registrations-contact-cell__edit"
                    onClick={startEdit}
                    aria-label={`Edit ${label}`}
                >
                    <Pencil size={12} />
                </button>
            </div>
        </td>
    );
}
