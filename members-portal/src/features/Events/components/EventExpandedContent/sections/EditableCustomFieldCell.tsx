import { useEffect, useState } from 'react';
import { YesNoField } from '@/components/YesNoField/YesNoField';
import { eventsAPI } from '@/services/api';
import type { EventCustomFieldRef, EventRegistrationRef, Id } from '@/types/backend-contracts';
import {
    dropdownOptions,
    formatCustomFieldValue,
    getCustomFieldValue,
    parseCustomFieldInputValue,
} from '../customFieldUtils';
import { handleRegistrationConflict } from '../registrationConflictUtils';

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
    const [error, setError] = useState('');

    useEffect(() => {
        if (field.type === 'checkbox') return;
        setLocalValue(storedValue != null && storedValue !== '' ? String(storedValue) : '');
    }, [field.type, storedValue]);

    const saveValue = async (nextValue: unknown) => {
        setSaving(true);
        setError('');
        try {
            const updated = await eventsAPI.updateRegistration(eventId, registration.id, {
                customFieldValues: { [fieldKey]: nextValue },
                version: registration.version,
            });
            onUpdated(updated);
        } catch (saveError) {
            if (!handleRegistrationConflict(saveError, onUpdated, setError)) {
                if (field.type !== 'checkbox') {
                    setLocalValue(storedValue != null && storedValue !== '' ? String(storedValue) : '');
                }
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
    const errorClass = error ? ' event-registrations-cell--error' : '';

    if (field.type === 'checkbox') {
        return (
            <td className={`${savingClass}${errorClass}`.trim() || undefined} title={error || undefined}>
                <YesNoField
                    label={field.label}
                    checked={Boolean(storedValue)}
                    onChange={(next) => void saveValue(next)}
                    disabled={saving}
                    variant="inline"
                />
            </td>
        );
    }

    if (field.type === 'dropdown') {
        return (
            <td className={`${savingClass}${errorClass}`.trim() || undefined} title={error || undefined}>
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
