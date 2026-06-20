import { useState } from 'react';
import { eventsAPI } from '@/services/api';
import type { CreateEventTierPayload, EventTierRef, Id, UpdateEventTierPayload } from '@/types/backend-contracts';

interface EventTiersSectionProps {
    eventId: Id | string;
    tiers: EventTierRef[];
    onTiersChange: (tiers: EventTierRef[]) => void;
}

export default function EventTiersSection({ eventId, tiers, onTiersChange }: EventTiersSectionProps) {
    const [tierName, setTierName] = useState('');
    const [tierDescription, setTierDescription] = useState('');
    const [tierCapacity, setTierCapacity] = useState('');
    const [tierPrice, setTierPrice] = useState('');

    const handleCreateTier = async () => {
        const payload: CreateEventTierPayload = {
            name: tierName.trim(),
            description: tierDescription.trim() || null,
            maxCapacity: tierCapacity ? Number.parseInt(tierCapacity, 10) : null,
            price: tierPrice ? Number.parseFloat(tierPrice) : null,
        };
        const created = await eventsAPI.createTier(eventId, payload);
        onTiersChange([...tiers, created]);
        setTierName('');
        setTierDescription('');
        setTierCapacity('');
        setTierPrice('');
    };

    const handleUpdateTier = async (tier: EventTierRef, patch: UpdateEventTierPayload) => {
        const updated = await eventsAPI.updateTier(eventId, tier.id, patch);
        onTiersChange(tiers.map((item) => (item.id === updated.id ? updated : item)));
    };

    const handleRemoveTier = async (tierId: number) => {
        await eventsAPI.removeTier(eventId, tierId);
        onTiersChange(tiers.filter((item) => item.id !== tierId));
    };

    return (
        <section className="event-expanded-panel">
            <h2 className="expanded-section-title">Tiers</h2>
            <div className="event-expanded-form-grid">
                <input value={tierName} onChange={(e) => setTierName(e.target.value)} placeholder="Tier name" className="form-input" />
                <input value={tierDescription} onChange={(e) => setTierDescription(e.target.value)} placeholder="Description" className="form-input" />
                <input value={tierCapacity} onChange={(e) => setTierCapacity(e.target.value)} placeholder="Max capacity" type="number" min="0" className="form-input" />
                <input value={tierPrice} onChange={(e) => setTierPrice(e.target.value)} placeholder="Price" type="number" min="0" step="0.01" className="form-input" />
                <button type="button" onClick={() => void handleCreateTier()} className="btn btn-primary">Add tier</button>
            </div>
            <div className="event-expanded-stack event-expanded-stack--spaced">
                {tiers.map((tier) => (
                    <div key={tier.id} className="event-expanded-list-item">
                        <div>
                            <strong>{tier.name}</strong>
                            <p className="event-expanded-muted">{tier.description || 'No description'}</p>
                            <p className="event-expanded-muted">Capacity: {tier.maxCapacity ?? 'Unlimited'} · Registrations: {tier._count?.registrations ?? tier.registrationCount ?? 0}</p>
                        </div>
                        <div className="event-expanded-inline-actions">
                            <button type="button" onClick={() => void handleUpdateTier(tier, { isActive: !tier.isActive })} className="btn btn-secondary">{tier.isActive === false ? 'Enable' : 'Disable'}</button>
                            <button type="button" onClick={() => void handleRemoveTier(Number(tier.id))} className="btn btn-danger">Delete</button>
                        </div>
                    </div>
                ))}
            </div>
        </section>
    );
}
