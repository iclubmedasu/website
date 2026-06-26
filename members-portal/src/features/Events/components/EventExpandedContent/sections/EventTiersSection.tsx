import { useState } from 'react';
import Toggle from '@/components/toggle/Toggle';
import { eventsAPI } from '@/services/api';
import type { CreateEventTierPayload, EventTierCurrency, EventTierRef, Id, UpdateEventTierPayload } from '@/types/backend-contracts';
import {
    DEFAULT_TIER_CURRENCY,
    formatTierPrice,
    normalizeTierCurrency,
    parseTierPrice,
} from '../../tierPriceUtils';
import TierPriceFields from '../TierPriceFields';

interface EventTiersSectionProps {
    eventId: Id | string;
    tiers: EventTierRef[];
    onTiersChange: (tiers: EventTierRef[]) => void;
    canManage?: boolean;
}

export default function EventTiersSection({ eventId, tiers, onTiersChange, canManage = false }: EventTiersSectionProps) {
    const [tierName, setTierName] = useState('');
    const [tierDescription, setTierDescription] = useState('');
    const [tierCapacity, setTierCapacity] = useState('');
    const [tierPrice, setTierPrice] = useState('');
    const [tierCurrency, setTierCurrency] = useState<EventTierCurrency>(DEFAULT_TIER_CURRENCY);
    const [editingTierId, setEditingTierId] = useState<number | null>(null);
    const [editName, setEditName] = useState('');
    const [editDescription, setEditDescription] = useState('');
    const [editCapacity, setEditCapacity] = useState('');
    const [editPrice, setEditPrice] = useState('');
    const [editCurrency, setEditCurrency] = useState<EventTierCurrency>(DEFAULT_TIER_CURRENCY);
    const [formError, setFormError] = useState('');

    const isEditing = editingTierId != null;

    const handleCreateTier = async () => {
        const trimmedName = tierName.trim();
        if (!trimmedName) {
            setFormError('Tier name is required.');
            return;
        }

        setFormError('');
        const payload: CreateEventTierPayload = {
            name: trimmedName,
            description: tierDescription.trim() || null,
            maxCapacity: tierCapacity ? Number.parseInt(tierCapacity, 10) : null,
            price: parseTierPrice(tierPrice),
            currency: tierCurrency,
        };

        try {
            const created = await eventsAPI.createTier(eventId, payload);
            onTiersChange([...tiers, created]);
            setTierName('');
            setTierDescription('');
            setTierCapacity('');
            setTierPrice('');
            setTierCurrency(DEFAULT_TIER_CURRENCY);
        } catch (err) {
            setFormError(err instanceof Error ? err.message : 'Failed to create tier.');
        }
    };

    const handleUpdateTier = async (tier: EventTierRef, patch: UpdateEventTierPayload) => {
        const updated = await eventsAPI.updateTier(eventId, tier.id, patch);
        onTiersChange(tiers.map((item) => (item.id === updated.id ? updated : item)));
    };

    const handleRemoveTier = async (tierId: number) => {
        await eventsAPI.removeTier(eventId, tierId);
        onTiersChange(tiers.filter((item) => item.id !== tierId));
        if (editingTierId === tierId) {
            setEditingTierId(null);
        }
    };

    const startEdit = (tier: EventTierRef) => {
        setEditingTierId(Number(tier.id));
        setEditName(tier.name);
        setEditDescription(tier.description ?? '');
        setEditCapacity(tier.maxCapacity != null ? String(tier.maxCapacity) : '');
        setEditPrice(tier.price != null ? String(tier.price) : '');
        setEditCurrency(normalizeTierCurrency(tier.currency));
    };

    const cancelEdit = () => {
        setEditingTierId(null);
        setEditName('');
        setEditDescription('');
        setEditCapacity('');
        setEditPrice('');
        setEditCurrency(DEFAULT_TIER_CURRENCY);
    };

    const saveEdit = async (tier: EventTierRef) => {
        const trimmedName = editName.trim();
        if (!trimmedName) {
            setFormError('Tier name is required.');
            return;
        }

        setFormError('');
        try {
            await handleUpdateTier(tier, {
                name: trimmedName,
                description: editDescription.trim() || null,
                maxCapacity: editCapacity ? Number.parseInt(editCapacity, 10) : null,
                price: parseTierPrice(editPrice),
                currency: editCurrency,
            });
            cancelEdit();
        } catch (err) {
            setFormError(err instanceof Error ? err.message : 'Failed to update tier.');
        }
    };

    return (
        <section className="event-expanded-panel">
            <h2 className="expanded-section-title">Tiers</h2>
            {formError ? <p className="error-message">{formError}</p> : null}
            {canManage ? (
            <div className="event-expanded-form-grid">
                <input
                    value={tierName}
                    onChange={(e) => {
                        setTierName(e.target.value);
                        if (formError) setFormError('');
                    }}
                    placeholder="Tier name"
                    className="form-input"
                    disabled={isEditing}
                    aria-label="Tier name"
                />
                <input value={tierDescription} onChange={(e) => setTierDescription(e.target.value)} placeholder="Description" className="form-input" disabled={isEditing} />
                <input value={tierCapacity} onChange={(e) => setTierCapacity(e.target.value)} placeholder="Max capacity" type="number" min="0" className="form-input" disabled={isEditing} />
                <TierPriceFields
                    idPrefix="create-tier"
                    price={tierPrice}
                    currency={tierCurrency}
                    onPriceChange={setTierPrice}
                    onCurrencyChange={setTierCurrency}
                    disabled={isEditing}
                />
                <button
                    type="button"
                    onClick={() => void handleCreateTier()}
                    className="btn btn-primary"
                    disabled={isEditing}
                >
                    Add tier
                </button>
            </div>
            ) : null}
            <div className="event-expanded-tiers-list">
                {tiers.map((tier) => {
                    const tierIsEditing = editingTierId === Number(tier.id);
                    const actionsDisabled = isEditing && !tierIsEditing;
                    const priceLabel = formatTierPrice(tier.price, normalizeTierCurrency(tier.currency));

                    if (tierIsEditing) {
                        return (
                            <div key={tier.id} className="event-expanded-list-item event-expanded-list-item--editing">
                                <div className="event-expanded-form-grid" style={{ flex: 1 }}>
                                    <input value={editName} onChange={(e) => setEditName(e.target.value)} placeholder="Tier name" className="form-input" />
                                    <input value={editDescription} onChange={(e) => setEditDescription(e.target.value)} placeholder="Description" className="form-input" />
                                    <input value={editCapacity} onChange={(e) => setEditCapacity(e.target.value)} placeholder="Max capacity" type="number" min="0" className="form-input" />
                                    <TierPriceFields
                                        idPrefix={`edit-tier-${tier.id}`}
                                        price={editPrice}
                                        currency={editCurrency}
                                        onPriceChange={setEditPrice}
                                        onCurrencyChange={setEditCurrency}
                                    />
                                    <div className="event-expanded-tier-actions">
                                        <button type="button" onClick={() => void saveEdit(tier)} className="btn btn-primary">Save</button>
                                        <button type="button" onClick={cancelEdit} className="btn btn-secondary">Cancel</button>
                                    </div>
                                </div>
                            </div>
                        );
                    }

                    return (
                        <div key={tier.id} className="event-expanded-list-item">
                            <div>
                                <strong>{tier.name}</strong>
                                <p className="event-expanded-muted">{tier.description || 'No description'}</p>
                                <p className="event-expanded-muted">
                                    Capacity: {tier.maxCapacity ?? 'Unlimited'}
                                    {priceLabel ? ` · Price: ${priceLabel}` : ''}
                                    {' · '}Registrations: {tier._count?.registrations ?? tier.registrationCount ?? 0}
                                    {tier.showOnPublic ? ' · On public form' : ''}
                                </p>
                            </div>
                            <div className="event-expanded-inline-actions">
                                {canManage ? (
                                    <>
                                        <div className="event-expanded-tier-public-toggle" title="Show on public registration form">
                                            <span className="event-expanded-tier-public-toggle-label">Public form</span>
                                            <Toggle
                                                color="purple"
                                                checked={Boolean(tier.showOnPublic)}
                                                disabled={actionsDisabled || tier.isActive === false}
                                                onChange={() => void handleUpdateTier(tier, { showOnPublic: !tier.showOnPublic })}
                                                aria-label={`Show ${tier.name} on public registration form`}
                                            />
                                        </div>
                                        <button type="button" onClick={() => startEdit(tier)} className="btn btn-secondary" disabled={actionsDisabled}>Edit</button>
                                        <button type="button" onClick={() => void handleUpdateTier(tier, { isActive: !tier.isActive })} className="btn btn-secondary" disabled={actionsDisabled}>{tier.isActive === false ? 'Enable' : 'Disable'}</button>
                                        <button type="button" onClick={() => void handleRemoveTier(Number(tier.id))} className="btn btn-danger" disabled={actionsDisabled}>Delete</button>
                                    </>
                                ) : null}
                            </div>
                        </div>
                    );
                })}
            </div>
        </section>
    );
}
