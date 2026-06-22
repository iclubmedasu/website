import { useEffect, useState } from 'react';
import { eventsAPI } from '@/services/api';
import type { EventCustomFieldRef, EventRegistrationRef, Id } from '@/types/backend-contracts';
import {
    dropdownOptions,
    formatCustomFieldValue,
    getCustomFieldValue,
    mergeCustomFieldValues,
    parseCustomFieldInputValue,
} from '../customFieldUtils';

interface EditableCustomFieldCellProps {
    eventId: Id | string;
    registration: EventRegistrationRef;
    field: EventCustomFieldRef;
    onUpdated: (updated: EventRegistrationRef) => void;
    editable?: boolean;
}

export default function EditableCustomFieldCell({
    eventId,
    registration,
    field,
    onUpdated,
    editable = true,
}: EditableCustomFieldCellProps) {
    const fieldKey = String(field.id);
    const storedValue = getCustomFieldValue(registration, field);
    const [localValue, setLocalValue] = useState<string>(() => (
        storedValue != null && storedValue !== '' ? String(storedValue) : ''
    ));
    const [saving, setSaving] = useState(false);

    useEffect(() => {
        if (field.type === 'checkbox') return;
        setLocalValue(storedValue != null && storedValue !== '' ? String(storedValue) : '');
    }, [field.type, storedValue]);

    const saveValue = async (nextValue: unknown) => {
        const existing = registration.customFieldValues as Record<string, unknown> | null | undefined;
        const merged = mergeCustomFieldValues(existing, { [fieldKey]: nextValue });
        setSaving(true);
        try {
            const updated = await eventsAPI.updateRegistration(eventId, registration.id, {
                customFieldValues: merged,
            });
            onUpdated(updated);
        } catch {
            if (field.type !== 'checkbox') {
                setLocalValue(storedValue != null && storedValue !== '' ? String(storedValue) : '');
            }
        } finally {
            setSaving(false);
        }
    };

    if (!editable) {
        return (
            <td>
                {formatCustomFieldValue(field, storedValue)}
            </td>
        );
    }

    const savingClass = saving ? ' event-registrations-cell--saving' : '';

    if (field.type === 'checkbox') {
        return (
            <td className={savingClass.trim() || undefined}>
                <label className="event-registrations-table-checkbox">
                    <input
                        type="checkbox"
                        checked={Boolean(storedValue)}
                        disabled={saving}
                        onChange={(event) => void saveValue(event.target.checked)}
                        className="event-registrations-table-input"
                        aria-label={field.label}
                    />
                </label>
            </td>
        );
    }

    if (field.type === 'dropdown') {
        return (
            <td className={savingClass.trim() || undefined}>
                <select
                    aria-label={field.label}
                    value={storedValue != null ? String(storedValue) : ''}
                    disabled={saving}
                    onChange={(event) => void saveValue(event.target.value || null)}
                    className="event-registrations-table-input form-input"
                >
                    <option value="">{field.required ? 'Select…' : '—'}</option>
                    {dropdownOptions(field).map((option) => (
                        <option key={option} value={option}>{option}</option>
                    ))}
                </select>
            </td>
        );
    }

    return (
        <td className={savingClass.trim() || undefined}>
            <input
                type={field.type === 'number' ? 'number' : 'text'}
                value={localValue}
                disabled={saving}
                onChange={(event) => setLocalValue(event.target.value)}
                onBlur={() => {
                    const parsed = parseCustomFieldInputValue(field, localValue);
                    const current = storedValue ?? (field.type === 'number' ? null : '');
                    const normalizedCurrent = current === null || current === undefined ? '' : String(current);
                    const normalizedNext = parsed === null || parsed === undefined ? '' : String(parsed);
                    if (normalizedCurrent === normalizedNext) return;
                    void saveValue(parsed);
                }}
                placeholder={field.label}
                className="event-registrations-table-input form-input"
                aria-label={field.label}
            />
        </td>
    );
}
