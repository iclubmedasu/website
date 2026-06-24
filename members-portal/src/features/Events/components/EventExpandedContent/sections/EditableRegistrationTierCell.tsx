import { useEffect, useState } from 'react';
import { eventsAPI } from '@/services/api';
import type { EventRegistrationRef, EventTierRef, Id } from '@/types/backend-contracts';

interface EditableRegistrationTierCellProps {
    eventId: Id | string;
    registration: EventRegistrationRef;
    tiers: EventTierRef[];
    editable?: boolean;
    onUpdated: (updated: EventRegistrationRef) => void;
}

function readTierId(registration: EventRegistrationRef): string {
    return registration.tier?.id != null ? String(registration.tier.id) : '';
}

export default function EditableRegistrationTierCell({
    eventId,
    registration,
    tiers,
    editable = true,
    onUpdated,
}: EditableRegistrationTierCellProps) {
    const storedTierId = readTierId(registration);
    const [localTierId, setLocalTierId] = useState(storedTierId);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState('');

    useEffect(() => {
        setLocalTierId(storedTierId);
    }, [storedTierId]);

    if (!editable) {
        return (
            <td>
                {registration.tier?.name || '—'}
            </td>
        );
    }

    const handleChange = async (nextTierId: string) => {
        const normalizedNext = nextTierId || null;
        const normalizedCurrent = storedTierId || null;
        if (normalizedNext === normalizedCurrent) {
            setLocalTierId(nextTierId);
            return;
        }

        setLocalTierId(nextTierId);
        setSaving(true);
        setError('');
        try {
            const updated = await eventsAPI.updateRegistration(eventId, registration.id, {
                tierId: normalizedNext,
            });
            onUpdated(updated);
        } catch (saveError) {
            setLocalTierId(storedTierId);
            setError(saveError instanceof Error ? saveError.message : 'Failed to update tier.');
        } finally {
            setSaving(false);
        }
    };

    const cellClass = [
        error ? 'event-registrations-cell--error' : '',
        saving ? 'event-registrations-cell--saving' : '',
    ].filter(Boolean).join(' ') || undefined;

    return (
        <td className={cellClass} title={error || undefined}>
            <select
                aria-label={`Tier for ${registration.fullName}`}
                value={localTierId}
                disabled={saving}
                onChange={(event) => void handleChange(event.target.value)}
                className="event-registrations-table-input form-input"
            >
                <option value="">No tier</option>
                {tiers.map((tier) => (
                    <option key={tier.id} value={tier.id}>{tier.name}</option>
                ))}
            </select>
        </td>
    );
}
