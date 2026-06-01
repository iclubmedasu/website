'use client';

import Link from 'next/link';
import type { ComponentType } from 'react';
import { useEffect, useRef, useState } from 'react';
import { CheckCircle2, ChevronDown, ChevronUp, ClipboardList, Layers3, ListFilter, RefreshCw, Users } from 'lucide-react';
import { eventsAPI } from '@/services/api';
import type {
    CreateEventCustomFieldPayload,
    CreateEventTierPayload,
    EventCustomFieldRef,
    EventDetail,
    EventRegistrationRef,
    EventStatistics,
    EventTierRef,
    ReorderEventCustomFieldsPayload,
    UpdateEventCustomFieldPayload,
    UpdateEventTierPayload,
} from '@/types/backend-contracts';
import './EventDetailHub.css';

interface EventDetailHubProps {
    eventId: string;
}

type TabKey = 'overview' | 'tiers' | 'builder' | 'registrations' | 'checkin' | 'statistics';

const TABS: Array<{ key: TabKey; label: string; icon: ComponentType<{ size?: number }> }> = [
    { key: 'overview', label: 'Overview', icon: ListFilter },
    { key: 'tiers', label: 'Tiers', icon: Layers3 },
    { key: 'builder', label: 'Form Builder', icon: ClipboardList },
    { key: 'registrations', label: 'Registrations', icon: Users },
    { key: 'checkin', label: 'Check-in', icon: CheckCircle2 },
    { key: 'statistics', label: 'Statistics', icon: RefreshCw },
];

const EMPTY_FIELD_TYPES = ['text', 'dropdown', 'checkbox', 'number'] as const;

export default function EventDetailHub({ eventId }: EventDetailHubProps) {
    const [event, setEvent] = useState<EventDetail | null>(null);
    const [stats, setStats] = useState<EventStatistics | null>(null);
    const [tiers, setTiers] = useState<EventTierRef[]>([]);
    const [fields, setFields] = useState<EventCustomFieldRef[]>([]);
    const [registrations, setRegistrations] = useState<EventRegistrationRef[]>([]);
    const [activeTab, setActiveTab] = useState<TabKey>('overview');
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');

    const [tierName, setTierName] = useState('');
    const [tierDescription, setTierDescription] = useState('');
    const [tierCapacity, setTierCapacity] = useState('');
    const [tierPrice, setTierPrice] = useState('');

    const [fieldLabel, setFieldLabel] = useState('');
    const [fieldType, setFieldType] = useState<(typeof EMPTY_FIELD_TYPES)[number]>('text');
    const [fieldOptions, setFieldOptions] = useState('');
    const [fieldRequired, setFieldRequired] = useState(false);

    const [registrationSearch, setRegistrationSearch] = useState('');
    const [registrationTier, setRegistrationTier] = useState('');
    const [registrationCheckIn, setRegistrationCheckIn] = useState('');
    const [registrationWalkIn, setRegistrationWalkIn] = useState('');
    const [walkInFormOpen, setWalkInFormOpen] = useState(false);
    const [walkInName, setWalkInName] = useState('');
    const [walkInEmail, setWalkInEmail] = useState('');
    const [walkInPhone, setWalkInPhone] = useState('');
    const [walkInTier, setWalkInTier] = useState('');

    const dragFieldId = useRef<number | null>(null);

    useEffect(() => {
        let active = true;

        const load = async () => {
            setLoading(true);
            setError('');
            try {
                const [eventResult, tiersResult, fieldsResult, statsResult] = await Promise.all([
                    eventsAPI.getById(eventId),
                    eventsAPI.getTiers(eventId),
                    eventsAPI.getCustomFields(eventId),
                    eventsAPI.getStatistics(eventId),
                ]);

                if (!active) return;

                setEvent(eventResult);
                setTiers(tiersResult);
                setFields(fieldsResult);
                setStats(statsResult);
            } catch (loadError) {
                if (active) {
                    setError(loadError instanceof Error ? loadError.message : 'Failed to load event');
                }
            } finally {
                if (active) {
                    setLoading(false);
                }
            }
        };

        void load();

        return () => {
            active = false;
        };
    }, [eventId]);

    useEffect(() => {
        if (activeTab !== 'registrations') return;

        let active = true;
        const loadRegistrations = async () => {
            try {
                const result = await eventsAPI.getRegistrations(eventId, {
                    tierId: registrationTier || undefined,
                    checkInStatus: registrationCheckIn === 'CHECKED_IN' || registrationCheckIn === 'NOT_CHECKED_IN' ? registrationCheckIn : undefined,
                    walkIn: registrationWalkIn === 'true' ? true : registrationWalkIn === 'false' ? false : undefined,
                });
                if (active) {
                    setRegistrations(result);
                }
            } catch {
                if (active) {
                    setRegistrations([]);
                }
            }
        };

        void loadRegistrations();

        return () => {
            active = false;
        };
    }, [activeTab, eventId, registrationCheckIn, registrationTier, registrationWalkIn]);

    const reloadAll = async () => {
        const [eventResult, tiersResult, fieldsResult, statsResult] = await Promise.all([
            eventsAPI.getById(eventId),
            eventsAPI.getTiers(eventId),
            eventsAPI.getCustomFields(eventId),
            eventsAPI.getStatistics(eventId),
        ]);
        setEvent(eventResult);
        setTiers(tiersResult);
        setFields(fieldsResult);
        setStats(statsResult);
    };

    const handleCreateTier = async () => {
        const payload: CreateEventTierPayload = {
            name: tierName.trim(),
            description: tierDescription.trim() || null,
            maxCapacity: tierCapacity ? Number.parseInt(tierCapacity, 10) : null,
            price: tierPrice ? Number.parseFloat(tierPrice) : null,
        };
        const created = await eventsAPI.createTier(eventId, payload);
        setTiers((current) => [...current, created]);
        setTierName('');
        setTierDescription('');
        setTierCapacity('');
        setTierPrice('');
    };

    const handleCreateField = async () => {
        const payload: CreateEventCustomFieldPayload = {
            label: fieldLabel.trim(),
            type: fieldType,
            options: fieldType === 'dropdown' ? fieldOptions.split('\n').map((option) => option.trim()).filter(Boolean) : undefined,
            required: fieldRequired,
        };
        const created = await eventsAPI.createCustomField(eventId, payload);
        setFields((current) => [...current, created]);
        setFieldLabel('');
        setFieldType('text');
        setFieldOptions('');
        setFieldRequired(false);
    };

    const handleUpdateTier = async (tier: EventTierRef, patch: UpdateEventTierPayload) => {
        const updated = await eventsAPI.updateTier(eventId, tier.id, patch);
        setTiers((current) => current.map((item) => (item.id === updated.id ? updated : item)));
    };

    const handleRemoveTier = async (tierId: number) => {
        await eventsAPI.removeTier(eventId, tierId);
        setTiers((current) => current.filter((item) => item.id !== tierId));
    };

    const handleUpdateField = async (field: EventCustomFieldRef, patch: UpdateEventCustomFieldPayload) => {
        const updated = await eventsAPI.updateCustomField(eventId, field.id, patch);
        setFields((current) => current.map((item) => (item.id === updated.id ? updated : item)));
    };

    const handleRemoveField = async (fieldId: number) => {
        await eventsAPI.removeCustomField(eventId, fieldId);
        setFields((current) => current.filter((item) => item.id !== fieldId));
    };

    const moveField = async (fromIndex: number, toIndex: number) => {
        if (toIndex < 0 || toIndex >= fields.length || fromIndex === toIndex) return;
        const next = [...fields];
        const [moved] = next.splice(fromIndex, 1);
        next.splice(toIndex, 0, moved);
        setFields(next.map((field, index) => ({ ...field, order: index })));
        const payload: ReorderEventCustomFieldsPayload = {
            order: next.map((field, index) => ({ id: field.id, order: index })),
        };
        await eventsAPI.reorderCustomFields(eventId, payload);
    };

    const handleWalkInSubmit = async () => {
        const created = await eventsAPI.createWalkInRegistration(eventId, {
            fullName: walkInName.trim(),
            email: walkInEmail.trim(),
            phoneNumber: walkInPhone.trim() || null,
            tierId: walkInTier || null,
            isWalkIn: true,
        });
        setRegistrations((current) => [created, ...current]);
        setWalkInFormOpen(false);
        setWalkInName('');
        setWalkInEmail('');
        setWalkInPhone('');
        setWalkInTier('');
    };

    const checkedInCount = stats?.totalCheckedIn ?? 0;
    const totalRegistered = stats?.totalRegistered ?? 0;

    if (loading) {
        return <main className="event-detail-shell event-detail-shell--loading">Loading event…</main>;
    }

    if (error || !event) {
        return (
            <main className="event-detail-shell event-detail-shell--error">
                <div className="event-detail-error">{error || 'Event not found'}</div>
                <Link href="/events" className="event-detail-back-link">Back to events</Link>
            </main>
        );
    }

    return (
        <main className="event-detail-shell">
            <header className="event-detail-header">
                <div>
                    <p className="event-detail-eyebrow">Event Detail</p>
                    <h1 className="event-detail-title">{event.title}</h1>
                    <p className="event-detail-subtitle">{event.description || 'No description yet'}</p>
                </div>
                <button type="button" onClick={() => void reloadAll()} className="event-detail-button event-detail-button--ghost">Reload</button>
            </header>

            <section className="event-detail-summary-grid">
                <SummaryCard label="Status" value={event.status.replaceAll('_', ' ')} />
                <SummaryCard label="Date" value={formatDate(event.eventDate)} />
                <SummaryCard label="Venue" value={event.venue || 'TBD'} />
                <SummaryCard label="Registration" value={formatCapacity(stats?.totalRegistered ?? 0, event.capacity)} />
            </section>

            <nav className="event-detail-tab-nav" aria-label="Event tabs">
                {TABS.map((tab) => {
                    const Icon = tab.icon;
                    return (
                        <button
                            key={tab.key}
                            type="button"
                            onClick={() => setActiveTab(tab.key)}
                            className={activeTab === tab.key ? 'event-detail-tab-button event-detail-tab-button--active' : 'event-detail-tab-button'}
                        >
                            <Icon size={16} />
                            {tab.label}
                        </button>
                    );
                })}
            </nav>

            {activeTab === 'overview' && (
                <section className="event-detail-panel">
                    <div className="event-detail-two-column">
                        <div>
                            <h2 className="event-detail-section-title">Overview</h2>
                            <p className="event-detail-paragraph"><strong>Linked project:</strong> {event.project?.title || 'None'}</p>
                            <p className="event-detail-paragraph"><strong>Walk-ins:</strong> {event.allowWalkIns ? 'Enabled' : 'Disabled'}</p>
                            <p className="event-detail-paragraph"><strong>Certifiable:</strong> {event.isCertifiable ? 'Yes' : 'No'}</p>
                            <p className="event-detail-paragraph"><strong>Capacity:</strong> {event.capacity ?? 'Unlimited'}</p>
                            <p className="event-detail-paragraph"><strong>Registration deadline:</strong> {formatDate(event.registrationDeadline)}</p>
                        </div>
                        <div>
                            <h2 className="event-detail-section-title">Quick Stats</h2>
                            <ProgressBar label="Registered" value={totalRegistered} total={event.capacity ?? Math.max(totalRegistered, 1)} />
                            <ProgressBar label="Checked in" value={checkedInCount} total={Math.max(totalRegistered, 1)} />
                            <p className="event-detail-paragraph event-detail-paragraph--spaced"><strong>Walk-ins:</strong> {stats?.walkInCount ?? 0}</p>
                            <p className="event-detail-paragraph"><strong>No-shows:</strong> {stats?.noShowCount ?? 0}</p>
                        </div>
                    </div>
                </section>
            )}

            {activeTab === 'tiers' && (
                <section className="event-detail-panel">
                    <h2 className="event-detail-section-title">Tiers</h2>
                    <div className="event-detail-form-grid">
                        <input value={tierName} onChange={(event) => setTierName(event.target.value)} placeholder="Tier name" className="event-detail-input" />
                        <input value={tierDescription} onChange={(event) => setTierDescription(event.target.value)} placeholder="Description" className="event-detail-input" />
                        <input value={tierCapacity} onChange={(event) => setTierCapacity(event.target.value)} placeholder="Max capacity" type="number" min="0" className="event-detail-input" />
                        <input value={tierPrice} onChange={(event) => setTierPrice(event.target.value)} placeholder="Price" type="number" min="0" step="0.01" className="event-detail-input" />
                        <button type="button" onClick={() => void handleCreateTier()} className="event-detail-button event-detail-button--primary">Add tier</button>
                    </div>
                    <div className="event-detail-stack event-detail-stack--spaced">
                        {tiers.map((tier) => (
                            <div key={tier.id} className="event-detail-list-item">
                                <div>
                                    <strong>{tier.name}</strong>
                                    <p className="event-detail-muted">{tier.description || 'No description'}</p>
                                    <p className="event-detail-muted">Capacity: {tier.maxCapacity ?? 'Unlimited'} · Registrations: {tier._count?.registrations ?? tier.registrationCount ?? 0}</p>
                                </div>
                                <div className="event-detail-inline-actions">
                                    <button type="button" onClick={() => void handleUpdateTier(tier, { isActive: !tier.isActive })} className="event-detail-button event-detail-button--secondary">{tier.isActive === false ? 'Enable' : 'Disable'}</button>
                                    <button type="button" onClick={() => void handleRemoveTier(Number(tier.id))} className="event-detail-button event-detail-button--danger">Delete</button>
                                </div>
                            </div>
                        ))}
                    </div>
                </section>
            )}

            {activeTab === 'builder' && (
                <section className="event-detail-panel">
                    <h2 className="event-detail-section-title">Registration Form Builder</h2>
                    <div className="event-detail-stack event-detail-stack--small">
                        {['Name', 'Email', 'Phone'].map((label) => (
                            <div key={label} className="event-detail-list-item event-detail-list-item--muted">
                                <strong>{label}</strong>
                                <span className="event-detail-muted">Locked default field</span>
                            </div>
                        ))}
                    </div>
                    <div className="event-detail-stack event-detail-stack--spaced">
                        {fields.map((field, index) => (
                            <div
                                key={field.id}
                                draggable
                                onDragStart={() => {
                                    dragFieldId.current = Number(field.id);
                                }}
                                onDragOver={(event) => event.preventDefault()}
                                onDrop={async () => {
                                    const fromIndex = fields.findIndex((item) => Number(item.id) === dragFieldId.current);
                                    dragFieldId.current = null;
                                    if (fromIndex >= 0) {
                                        await moveField(fromIndex, index);
                                    }
                                }}
                                className="event-detail-list-item"
                            >
                                <div>
                                    <strong>{field.label}</strong>
                                    <p className="event-detail-muted">{field.type}{field.required ? ' · Required' : ''}</p>
                                </div>
                                <div className="event-detail-inline-actions">
                                    <button type="button" onClick={() => void moveField(index, Math.max(0, index - 1))} className="event-detail-button event-detail-button--secondary" aria-label="Move field up"><ChevronUp size={16} /></button>
                                    <button type="button" onClick={() => void moveField(index, Math.min(fields.length - 1, index + 1))} className="event-detail-button event-detail-button--secondary" aria-label="Move field down"><ChevronDown size={16} /></button>
                                    <button type="button" onClick={() => void handleUpdateField(field, { required: !field.required })} className="event-detail-button event-detail-button--secondary">{field.required ? 'Unset required' : 'Required'}</button>
                                    <button type="button" onClick={() => void handleRemoveField(Number(field.id))} className="event-detail-button event-detail-button--danger">Delete</button>
                                </div>
                            </div>
                        ))}
                    </div>
                    <div className="event-detail-stack event-detail-stack--spaced">
                        <input value={fieldLabel} onChange={(event) => setFieldLabel(event.target.value)} placeholder="Field label" className="event-detail-input" />
                        <select aria-label="Field type" value={fieldType} onChange={(event) => setFieldType(event.target.value as typeof fieldType)} className="event-detail-input">
                            {EMPTY_FIELD_TYPES.map((type) => <option key={type} value={type}>{type}</option>)}
                        </select>
                        {fieldType === 'dropdown' && <textarea value={fieldOptions} onChange={(event) => setFieldOptions(event.target.value)} placeholder="One option per line" className="event-detail-input event-detail-input--textarea" />}
                        <label className="event-detail-checkbox-row">
                            <input type="checkbox" checked={fieldRequired} onChange={(event) => setFieldRequired(event.target.checked)} />
                            Required
                        </label>
                        <button type="button" onClick={() => void handleCreateField()} className="event-detail-button event-detail-button--primary">Add field</button>
                    </div>
                </section>
            )}

            {activeTab === 'registrations' && (
                <section className="event-detail-panel">
                    <div className="event-detail-header event-detail-header--compact">
                        <div>
                            <h2 className="event-detail-section-title">Registrations</h2>
                            <p className="event-detail-muted">Search, filter, and manage event attendees.</p>
                        </div>
                        <button type="button" onClick={() => setWalkInFormOpen((current) => !current)} className="event-detail-button event-detail-button--primary">
                            {walkInFormOpen ? 'Close walk-in form' : 'Add walk-in'}
                        </button>
                    </div>
                    <div className="event-detail-form-grid">
                        <input value={registrationSearch} onChange={(event) => setRegistrationSearch(event.target.value)} placeholder="Search by name, email, or code" className="event-detail-input" />
                        <select aria-label="Filter by tier" value={registrationTier} onChange={(event) => setRegistrationTier(event.target.value)} className="event-detail-input">
                            <option value="">All tiers</option>
                            {tiers.map((tier) => <option key={tier.id} value={tier.id}>{tier.name}</option>)}
                        </select>
                        <select aria-label="Filter by check-in status" value={registrationCheckIn} onChange={(event) => setRegistrationCheckIn(event.target.value)} className="event-detail-input">
                            <option value="">Check-in status</option>
                            <option value="CHECKED_IN">Checked in</option>
                            <option value="NOT_CHECKED_IN">Not checked in</option>
                        </select>
                        <select aria-label="Registration source" value={registrationWalkIn} onChange={(event) => setRegistrationWalkIn(event.target.value)} className="event-detail-input">
                            <option value="">All source</option>
                            <option value="true">Walk-ins</option>
                            <option value="false">Pre-registered</option>
                        </select>
                    </div>
                    {walkInFormOpen && (
                        <div className="event-detail-walkin-panel">
                            <h3 className="event-detail-section-title event-detail-section-title--sm">Walk-in Registration</h3>
                            <div className="event-detail-form-grid">
                                <input value={walkInName} onChange={(event) => setWalkInName(event.target.value)} placeholder="Full name" className="event-detail-input" />
                                <input value={walkInEmail} onChange={(event) => setWalkInEmail(event.target.value)} placeholder="Email" className="event-detail-input" />
                                <input value={walkInPhone} onChange={(event) => setWalkInPhone(event.target.value)} placeholder="Phone" className="event-detail-input" />
                                <select aria-label="Walk-in tier" value={walkInTier} onChange={(event) => setWalkInTier(event.target.value)} className="event-detail-input">
                                    <option value="">No tier</option>
                                    {tiers.map((tier) => <option key={tier.id} value={tier.id}>{tier.name}</option>)}
                                </select>
                            </div>
                            <button type="button" onClick={() => void handleWalkInSubmit()} className="event-detail-button event-detail-button--primary">Save walk-in</button>
                        </div>
                    )}
                    <div className="event-detail-table-wrap">
                        <table className="event-detail-table">
                            <thead>
                                <tr>
                                    <th className="event-detail-th">Name</th>
                                    <th className="event-detail-th">Email</th>
                                    <th className="event-detail-th">Phone</th>
                                    <th className="event-detail-th">Tier</th>
                                    <th className="event-detail-th">Code</th>
                                    <th className="event-detail-th">Status</th>
                                    <th className="event-detail-th">Source</th>
                                </tr>
                            </thead>
                            <tbody>
                                {registrations.filter((registration) => {
                                    const query = registrationSearch.trim().toLowerCase();
                                    if (!query) return true;
                                    return [registration.fullName, registration.email, registration.confirmationCode].some((value) => String(value || '').toLowerCase().includes(query));
                                }).map((registration) => (
                                    <tr key={registration.id}>
                                        <td className="event-detail-td">{registration.fullName}</td>
                                        <td className="event-detail-td">{registration.email}</td>
                                        <td className="event-detail-td">{registration.phoneNumber || '—'}</td>
                                        <td className="event-detail-td">{registration.tier?.name || '—'}</td>
                                        <td className="event-detail-td"><code>{registration.confirmationCode}</code></td>
                                        <td className="event-detail-td">{registration.status.replaceAll('_', ' ')}</td>
                                        <td className="event-detail-td">{registration.source}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </section>
            )}

            {activeTab === 'checkin' && (
                <section className="event-detail-panel">
                    <h2 className="event-detail-section-title">Check-in</h2>
                    <p className="event-detail-muted">This pass currently supports manual code lookup and walk-ins. Camera scanning can be added on top of the same endpoint.</p>
                    <CheckInPanel eventId={eventId} tiers={tiers} onCheckIn={() => void reloadAll()} />
                </section>
            )}

            {activeTab === 'statistics' && (
                <section className="event-detail-panel">
                    <h2 className="event-detail-section-title">Statistics</h2>
                    <div className="event-detail-summary-grid">
                        <SummaryCard label="Total registered" value={String(stats?.totalRegistered ?? 0)} />
                        <SummaryCard label="Checked in" value={String(stats?.totalCheckedIn ?? 0)} />
                        <SummaryCard label="Walk-ins" value={String(stats?.walkInCount ?? 0)} />
                        <SummaryCard label="No-shows" value={String(stats?.noShowCount ?? 0)} />
                    </div>
                    <div className="event-detail-stack event-detail-stack--spaced">
                        {(stats?.byTier ?? []).map((entry) => (
                            <div key={entry.tierId}>
                                <div className="event-detail-progress-row-header">
                                    <strong>{entry.name}</strong>
                                    <span>{entry.registrations}</span>
                                </div>
                                <ProgressBar value={entry.registrations} total={Math.max(stats?.totalRegistered ?? 0, 1)} />
                            </div>
                        ))}
                    </div>
                    <div className="event-detail-stack event-detail-stack--spaced event-detail-stack--top">
                        <h3 className="event-detail-section-title event-detail-section-title--sm">Registrations over time</h3>
                        <div className="event-detail-stack event-detail-stack--tiny">
                            {(stats?.registrationsOverTime ?? []).map((entry) => (
                                <div key={entry.date} className="event-detail-timeline-row">
                                    <span>{entry.date}</span>
                                    <ProgressBar value={entry.count} total={Math.max(stats?.totalRegistered ?? 0, 1)} />
                                    <strong>{entry.count}</strong>
                                </div>
                            ))}
                        </div>
                    </div>
                </section>
            )}
        </main>
    );
}

function SummaryCard({ label, value }: { label: string; value: string }) {
    return (
        <div className="event-detail-summary-card">
            <span className="event-detail-summary-label">{label}</span>
            <strong className="event-detail-summary-value">{value}</strong>
        </div>
    );
}

function CheckInPanel({ eventId, tiers, onCheckIn }: { eventId: string; tiers: EventTierRef[]; onCheckIn: () => void }) {
    const [code, setCode] = useState('');
    const [fullName, setFullName] = useState('');
    const [email, setEmail] = useState('');
    const [phone, setPhone] = useState('');
    const [tierId, setTierId] = useState('');
    const [result, setResult] = useState('');

    const handleManualCheckIn = async () => {
        try {
            const registration = await eventsAPI.checkInRegistration(eventId, '', code.trim().toUpperCase());
            setResult(`Checked in ${registration.fullName} (${registration.confirmationCode})`);
            setCode('');
            onCheckIn();
        } catch (error) {
            setResult(error instanceof Error ? error.message : 'Check-in failed');
        }
    };

    const handleWalkIn = async () => {
        try {
            await eventsAPI.createWalkInRegistration(eventId, {
                fullName: fullName.trim(),
                email: email.trim(),
                phoneNumber: phone.trim() || null,
                tierId: tierId || null,
                isWalkIn: true,
            });
            setResult('Walk-in saved');
            setFullName('');
            setEmail('');
            setPhone('');
            setTierId('');
            onCheckIn();
        } catch (error) {
            setResult(error instanceof Error ? error.message : 'Walk-in failed');
        }
    };

    return (
        <div className="event-detail-stack event-detail-stack--spaced">
            <div className="event-detail-two-column">
                <div className="event-detail-panel event-detail-panel--nested">
                    <h3 className="event-detail-section-title event-detail-section-title--sm">Scan mode</h3>
                    <p className="event-detail-muted">Camera scanning will reuse the same confirmation-code endpoint. For now, use the manual code field below.</p>
                    <div className="event-detail-scan-placeholder">Camera scanner placeholder</div>
                </div>
                <div className="event-detail-panel event-detail-panel--nested">
                    <h3 className="event-detail-section-title event-detail-section-title--sm">Manual mode</h3>
                    <input value={code} onChange={(event) => setCode(event.target.value)} placeholder="6-character code" className="event-detail-input" />
                    <button type="button" onClick={() => void handleManualCheckIn()} className="event-detail-button event-detail-button--primary event-detail-button--block">Check in</button>
                </div>
            </div>
            <div className="event-detail-panel event-detail-panel--nested">
                <h3 className="event-detail-section-title event-detail-section-title--sm">Walk-in mode</h3>
                <div className="event-detail-form-grid">
                    <input value={fullName} onChange={(event) => setFullName(event.target.value)} placeholder="Full name" className="event-detail-input" />
                    <input value={email} onChange={(event) => setEmail(event.target.value)} placeholder="Email" className="event-detail-input" />
                    <input value={phone} onChange={(event) => setPhone(event.target.value)} placeholder="Phone" className="event-detail-input" />
                    <select aria-label="Tier" value={tierId} onChange={(event) => setTierId(event.target.value)} className="event-detail-input">
                        <option value="">No tier</option>
                        {tiers.map((tier) => <option key={tier.id} value={tier.id}>{tier.name}</option>)}
                    </select>
                </div>
                <button type="button" onClick={() => void handleWalkIn()} className="event-detail-button event-detail-button--primary event-detail-button--block">Save walk-in</button>
            </div>
            {result ? <div className="event-detail-result">{result}</div> : null}
        </div>
    );
}

function ProgressBar({ value, total, label }: { value: number; total: number; label?: string }) {
    const safeTotal = total > 0 ? total : 1;
    const safeValue = Math.min(value, safeTotal);

    return (
        <progress className="event-detail-progress" value={safeValue} max={safeTotal} aria-label={label} />
    );
}

function formatDate(value?: string | null) {
    if (!value) return 'TBD';
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return 'TBD';
    return date.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
}

function formatCapacity(registered: number, capacity?: number | null) {
    return capacity == null ? `${registered} registered` : `${registered} / ${capacity}`;
}/*

import Link from 'next/link';
import type { ComponentType } from 'react';
import { useEffect, useRef, useState } from 'react';
import { CheckCircle2, ChevronDown, ChevronUp, ClipboardList, Layers3, ListFilter, RefreshCw, Users } from 'lucide-react';
import { eventsAPI } from '@/services/api';
import type {
    EventCustomFieldRef,
    EventDetail,
    EventStatistics,
    EventTierRef,
    EventRegistrationRef,
    CreateEventTierPayload,
    CreateEventCustomFieldPayload,
    UpdateEventTierPayload,
    UpdateEventCustomFieldPayload,
    ReorderEventCustomFieldsPayload,
} from '@/types/backend-contracts';
import './EventDetailHub.css';

interface EventDetailHubProps {
    eventId: string;
}

type TabKey = 'overview' | 'tiers' | 'builder' | 'registrations' | 'checkin' | 'statistics';

const TABS: Array<{ key: TabKey; label: string; icon: ComponentType<{ size?: number }> }> = [
    { key: 'overview', label: 'Overview', icon: ListFilter },
    { key: 'tiers', label: 'Tiers', icon: Layers3 },
    { key: 'builder', label: 'Form Builder', icon: ClipboardList },
    { key: 'registrations', label: 'Registrations', icon: Users },
    { key: 'checkin', label: 'Check-in', icon: CheckCircle2 },
    { key: 'statistics', label: 'Statistics', icon: RefreshCw },
];

const EMPTY_FIELD_TYPES = ['text', 'dropdown', 'checkbox', 'number'] as const;

export default function EventDetailHub({ eventId }: EventDetailHubProps) {
    const [event, setEvent] = useState<EventDetail | null>(null);
    const [stats, setStats] = useState<EventStatistics | null>(null);
    const [tiers, setTiers] = useState<EventTierRef[]>([]);
    const [fields, setFields] = useState<EventCustomFieldRef[]>([]);
    const [registrations, setRegistrations] = useState<EventRegistrationRef[]>([]);
    const [activeTab, setActiveTab] = useState<TabKey>('overview');
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');

    const [tierName, setTierName] = useState('');
    const [tierDescription, setTierDescription] = useState('');
    const [tierCapacity, setTierCapacity] = useState('');
    const [tierPrice, setTierPrice] = useState('');

    const [fieldLabel, setFieldLabel] = useState('');
    const [fieldType, setFieldType] = useState<(typeof EMPTY_FIELD_TYPES)[number]>('text');
    const [fieldOptions, setFieldOptions] = useState('');
    const [fieldRequired, setFieldRequired] = useState(false);

    const [registrationSearch, setRegistrationSearch] = useState('');
    const [registrationTier, setRegistrationTier] = useState('');
    const [registrationCheckIn, setRegistrationCheckIn] = useState('');
    const [registrationWalkIn, setRegistrationWalkIn] = useState('');
    const [walkInFormOpen, setWalkInFormOpen] = useState(false);
    const [walkInName, setWalkInName] = useState('');
    const [walkInEmail, setWalkInEmail] = useState('');
    const [walkInPhone, setWalkInPhone] = useState('');
    const [walkInTier, setWalkInTier] = useState('');

    const dragFieldId = useRef<number | null>(null);

    useEffect(() => {
        let active = true;

        const load = async () => {
            setLoading(true);
            setError('');
            try {
                const [eventResult, tiersResult, fieldsResult, statsResult] = await Promise.all([
                    eventsAPI.getById(eventId),
                    eventsAPI.getTiers(eventId),
                    eventsAPI.getCustomFields(eventId),
                    eventsAPI.getStatistics(eventId),
                ]);

                if (!active) return;

                setEvent(eventResult);
                setTiers(tiersResult);
                setFields(fieldsResult);
                setStats(statsResult);
            } catch (loadError) {
                if (active) {
                    setError(loadError instanceof Error ? loadError.message : 'Failed to load event');
                }
            } finally {
                if (active) {
                    setLoading(false);
                }
            }
        };

        void load();

        return () => {
            active = false;
        };
    }, [eventId]);

    useEffect(() => {
        if (activeTab !== 'registrations') return;

        let active = true;
        const loadRegistrations = async () => {
            try {
                const result = await eventsAPI.getRegistrations(eventId, {
                    tierId: registrationTier || undefined,
                    checkInStatus: registrationCheckIn === 'CHECKED_IN' || registrationCheckIn === 'NOT_CHECKED_IN' ? registrationCheckIn : undefined,
                    walkIn: registrationWalkIn === 'true' ? true : registrationWalkIn === 'false' ? false : undefined,
                });
                if (active) {
                    setRegistrations(result);
                }
            } catch {
                if (active) {
                    setRegistrations([]);
                }
            }
        };

        void loadRegistrations();

        return () => {
            active = false;
        };
    }, [activeTab, eventId, registrationCheckIn, registrationTier, registrationWalkIn]);

    const reloadAll = async () => {
        const [eventResult, tiersResult, fieldsResult, statsResult] = await Promise.all([
            eventsAPI.getById(eventId),
            eventsAPI.getTiers(eventId),
            eventsAPI.getCustomFields(eventId),
            eventsAPI.getStatistics(eventId),
        ]);
        setEvent(eventResult);
        setTiers(tiersResult);
        setFields(fieldsResult);
        setStats(statsResult);
    };

    const handleCreateTier = async () => {
        const payload: CreateEventTierPayload = {
            name: tierName.trim(),
            description: tierDescription.trim() || null,
            maxCapacity: tierCapacity ? Number.parseInt(tierCapacity, 10) : null,
            price: tierPrice ? Number.parseFloat(tierPrice) : null,
        };
        const created = await eventsAPI.createTier(eventId, payload);
        setTiers((current) => [...current, created]);
        setTierName('');
        setTierDescription('');
        setTierCapacity('');
        setTierPrice('');
    };

    const handleCreateField = async () => {
        const payload: CreateEventCustomFieldPayload = {
            label: fieldLabel.trim(),
            type: fieldType,
            options: fieldType === 'dropdown' ? fieldOptions.split('\n').map((option) => option.trim()).filter(Boolean) : undefined,
            required: fieldRequired,
        };
        const created = await eventsAPI.createCustomField(eventId, payload);
        setFields((current) => [...current, created]);
        setFieldLabel('');
        setFieldType('text');
        setFieldOptions('');
        setFieldRequired(false);
    };

    const handleUpdateTier = async (tier: EventTierRef, patch: UpdateEventTierPayload) => {
        const updated = await eventsAPI.updateTier(eventId, tier.id, patch);
        setTiers((current) => current.map((item) => (item.id === updated.id ? updated : item)));
    };

    const handleRemoveTier = async (tierId: number) => {
        await eventsAPI.removeTier(eventId, tierId);
        setTiers((current) => current.filter((item) => item.id !== tierId));
    };

    const handleUpdateField = async (field: EventCustomFieldRef, patch: UpdateEventCustomFieldPayload) => {
        const updated = await eventsAPI.updateCustomField(eventId, field.id, patch);
        setFields((current) => current.map((item) => (item.id === updated.id ? updated : item)));
    };

    const handleRemoveField = async (fieldId: number) => {
        await eventsAPI.removeCustomField(eventId, fieldId);
        setFields((current) => current.filter((item) => item.id !== fieldId));
    };

    const moveField = async (fromIndex: number, toIndex: number) => {
        if (toIndex < 0 || toIndex >= fields.length || fromIndex === toIndex) return;
        const next = [...fields];
        const [moved] = next.splice(fromIndex, 1);
        next.splice(toIndex, 0, moved);
        setFields(next.map((field, index) => ({ ...field, order: index })));
        const payload: ReorderEventCustomFieldsPayload = {
            order: next.map((field, index) => ({ id: field.id, order: index })),
        };
        await eventsAPI.reorderCustomFields(eventId, payload);
    };

    const handleWalkInSubmit = async () => {
        const created = await eventsAPI.createWalkInRegistration(eventId, {
            fullName: walkInName.trim(),
            email: walkInEmail.trim(),
            phoneNumber: walkInPhone.trim() || null,
            tierId: walkInTier || null,
            isWalkIn: true,
        });
        setRegistrations((current) => [created, ...current]);
        setWalkInFormOpen(false);
        setWalkInName('');
        setWalkInEmail('');
        setWalkInPhone('');
        setWalkInTier('');
    };

    const checkedInCount = stats?.totalCheckedIn ?? 0;
    const totalRegistered = stats?.totalRegistered ?? 0;

    if (loading) {
        return <main className="event-detail-page event-detail-page--loading"><div className="event-detail-loading">Loading event…</div></main>;
    }

    if (error || !event) {
        return (
            <main className="event-detail-page">
                <div className="event-detail-error">{error || 'Event not found'}</div>
                <Link className="event-detail-back-link" href="/events">Back to events</Link>
            </main>
        );
    }

    return (
        <main className="event-detail-page">
            <div className="event-detail-hero">
                <div>
                    <p className="event-detail-eyebrow">Event Detail</p>
                    <h1 className="event-detail-title">{event.title}</h1>
                    <p className="event-detail-subtitle">{event.description || 'No description yet'}</p>
                </div>
                <button type="button" onClick={() => void reloadAll()} className="event-detail-button event-detail-button--ghost">Reload</button>
            </div>

            <section className="event-detail-summary-grid">
                <SummaryCard label="Status" value={event.status.replaceAll('_', ' ')} />
                <SummaryCard label="Date" value={formatDate(event.eventDate)} />
                <SummaryCard label="Venue" value={event.venue || 'TBD'} />
                <SummaryCard label="Registration" value={formatCapacity(stats?.totalRegistered ?? 0, event.capacity)} />
            </section>

            <nav className="event-detail-tabs">
                {TABS.map((tab) => {
                    const Icon = tab.icon;
                    return (
                        <button
                            key={tab.key}
                            type="button"
                            onClick={() => setActiveTab(tab.key)}
                            className={`event-detail-tab-button${activeTab === tab.key ? ' event-detail-tab-button--active' : ''}`}
                            aria-pressed={activeTab === tab.key}
                        >
                            <Icon size={16} />
                            {tab.label}
                        </button>
                    );
                })}
            </nav>

            {activeTab === 'overview' && (
                <section className="event-detail-panel">
                    <div className="event-detail-two-column">
                        <div>
                            <h2 className="event-detail-section-title">Overview</h2>
                            <p><strong>Linked project:</strong> {event.project?.title || 'None'}</p>
                            <p><strong>Walk-ins:</strong> {event.allowWalkIns ? 'Enabled' : 'Disabled'}</p>
                            <p><strong>Certifiable:</strong> {event.isCertifiable ? 'Yes' : 'No'}</p>
                            <p><strong>Capacity:</strong> {event.capacity ?? 'Unlimited'}</p>
                            <p><strong>Registration deadline:</strong> {formatDate(event.registrationDeadline)}</p>
                        </div>
                        <div>
                            <h2 className="event-detail-section-title">Quick Stats</h2>
                            <ProgressRow label="Registered" value={totalRegistered} total={event.capacity ?? Math.max(totalRegistered, 1)} />
                            <ProgressRow label="Checked in" value={checkedInCount} total={Math.max(totalRegistered, 1)} />
                            <p className="event-detail-paragraph"><strong>Walk-ins:</strong> {stats?.walkInCount ?? 0}</p>
                            <p className="event-detail-paragraph"><strong>No-shows:</strong> {stats?.noShowCount ?? 0}</p>
                        </div>
                    </div>
                </section>
            )}

            {activeTab === 'tiers' && (
                <section className="event-detail-panel">
                    <h2 className="event-detail-section-title">Tiers</h2>
                    <div className="event-detail-form-grid">
                        <input value={tierName} onChange={(event) => setTierName(event.target.value)} placeholder="Tier name" className="event-detail-input" />
                        <input value={tierDescription} onChange={(event) => setTierDescription(event.target.value)} placeholder="Description" className="event-detail-input" />
                        <input value={tierCapacity} onChange={(event) => setTierCapacity(event.target.value)} placeholder="Max capacity" type="number" min="0" className="event-detail-input" />
                        <input value={tierPrice} onChange={(event) => setTierPrice(event.target.value)} placeholder="Price" type="number" min="0" step="0.01" className="event-detail-input" />
                        <button type="button" onClick={() => void handleCreateTier()} className="event-detail-button">Add tier</button>
                    </div>
                    <div className="event-detail-list">
                        {tiers.map((tier) => (
                            <div key={tier.id} className="event-detail-list-item">
                                <div>
                                    <strong>{tier.name}</strong>
                                    <p className="event-detail-list-text">{tier.description || 'No description'}</p>
                                    <p className="event-detail-list-text">Capacity: {tier.maxCapacity ?? 'Unlimited'} · Registrations: {tier._count?.registrations ?? tier.registrationCount ?? 0}</p>
                                </div>
                                <div className="event-detail-list-actions">
                                    <button type="button" onClick={() => void handleUpdateTier(tier, { isActive: !tier.isActive })} className="event-detail-button event-detail-button--secondary">{tier.isActive === false ? 'Enable' : 'Disable'}</button>
                                    <button type="button" onClick={() => void handleRemoveTier(Number(tier.id))} className="event-detail-button event-detail-button--danger">Delete</button>
                                </div>
                            </div>
                        ))}
                    </div>
                </section>
            )}

            {activeTab === 'builder' && (
                <section className="event-detail-panel">
                    <h2 className="event-detail-section-title">Registration Form Builder</h2>
                    <div className="event-detail-list">
                        {['Name', 'Email', 'Phone'].map((label) => (
                            <div key={label} className="event-detail-list-item event-detail-list-item--muted">
                                <strong>{label}</strong>
                                <span className="event-detail-muted">Locked default field</span>
                            </div>
                        ))}
                    </div>
                    <div className="event-detail-list">
                        {fields.map((field, index) => (
                            <div
                                key={field.id}
                                draggable
                                onDragStart={() => { dragFieldId.current = Number(field.id); }}
                                onDragOver={(event) => event.preventDefault()}
                                onDrop={async () => {
                                    const fromIndex = fields.findIndex((item) => Number(item.id) === dragFieldId.current);
                                    dragFieldId.current = null;
                                    if (fromIndex >= 0) {
                                        await moveField(fromIndex, index);
                                    }
                                }}
                                className="event-detail-list-item"
                            >
                                <div>
                                    <strong>{field.label}</strong>
                                    <p className="event-detail-list-text">{field.type}{field.required ? ' · Required' : ''}</p>
                                </div>
                                <div className="event-detail-list-actions">
                                    <button type="button" onClick={() => void moveField(index, Math.max(0, index - 1))} className="event-detail-button event-detail-button--secondary event-detail-button--icon"><ChevronUp size={16} /></button>
                                    <button type="button" onClick={() => void moveField(index, Math.min(fields.length - 1, index + 1))} className="event-detail-button event-detail-button--secondary event-detail-button--icon"><ChevronDown size={16} /></button>
                                    <button type="button" onClick={() => void handleUpdateField(field, { required: !field.required })} className="event-detail-button event-detail-button--secondary">{field.required ? 'Unset required' : 'Required'}</button>
                                    <button type="button" onClick={() => void handleRemoveField(Number(field.id))} className="event-detail-button event-detail-button--danger">Delete</button>
                                </div>
                            </div>
                        ))}
                    </div>
                    <div className="event-detail-stack event-detail-stack--top">
                        <input value={fieldLabel} onChange={(event) => setFieldLabel(event.target.value)} placeholder="Field label" className="event-detail-input" />
                        <select value={fieldType} onChange={(event) => setFieldType(event.target.value as typeof fieldType)} className="event-detail-input">
                            {EMPTY_FIELD_TYPES.map((type) => <option key={type} value={type}>{type}</option>)}
                        </select>
                        {fieldType === 'dropdown' && <textarea value={fieldOptions} onChange={(event) => setFieldOptions(event.target.value)} placeholder="One option per line" className="event-detail-input event-detail-input--textarea" />}
                        <label className="event-detail-toggle">
                            <input type="checkbox" checked={fieldRequired} onChange={(event) => setFieldRequired(event.target.checked)} />
                            <span>Required</span>
                        </label>
                        <button type="button" onClick={() => void handleCreateField()} className="event-detail-button">Add field</button>
                    </div>
                </section>
            )}

            {activeTab === 'registrations' && (
                <section className="event-detail-panel">
                    <div className="event-detail-header-row">
                        <div>
                            <h2 className="event-detail-section-title">Registrations</h2>
                            <p className="event-detail-muted">Search, filter, and manage event attendees.</p>
                        </div>
                        <button type="button" onClick={() => setWalkInFormOpen((current) => !current)} className="event-detail-button">{walkInFormOpen ? 'Close walk-in form' : 'Add walk-in'}</button>
                    </div>
                    <div className="event-detail-form-grid">
                        <input value={registrationSearch} onChange={(event) => setRegistrationSearch(event.target.value)} placeholder="Search by name, email, or code" className="event-detail-input" />
                        <select value={registrationTier} onChange={(event) => setRegistrationTier(event.target.value)} className="event-detail-input">
                            <option value="">All tiers</option>
                            {tiers.map((tier) => <option key={tier.id} value={tier.id}>{tier.name}</option>)}
                        </select>
                        <select value={registrationCheckIn} onChange={(event) => setRegistrationCheckIn(event.target.value)} className="event-detail-input">
                            <option value="">Check-in status</option>
                            <option value="CHECKED_IN">Checked in</option>
                            <option value="NOT_CHECKED_IN">Not checked in</option>
                        </select>
                        <select value={registrationWalkIn} onChange={(event) => setRegistrationWalkIn(event.target.value)} className="event-detail-input">
                            <option value="">All source</option>
                            <option value="true">Walk-ins</option>
                            <option value="false">Pre-registered</option>
                        </select>
                    </div>
                    {walkInFormOpen && (
                        <div className="event-detail-panel event-detail-panel--nested">
                            <h3 className="event-detail-section-title">Walk-in Registration</h3>
                            <div className="event-detail-form-grid">
                                <input value={walkInName} onChange={(event) => setWalkInName(event.target.value)} placeholder="Full name" className="event-detail-input" />
                                <input value={walkInEmail} onChange={(event) => setWalkInEmail(event.target.value)} placeholder="Email" className="event-detail-input" />
                                <input value={walkInPhone} onChange={(event) => setWalkInPhone(event.target.value)} placeholder="Phone" className="event-detail-input" />
                                <select value={walkInTier} onChange={(event) => setWalkInTier(event.target.value)} className="event-detail-input">
                                    <option value="">No tier</option>
                                    {tiers.map((tier) => <option key={tier.id} value={tier.id}>{tier.name}</option>)}
                                </select>
                            </div>
                            <button type="button" onClick={() => void handleWalkInSubmit()} className="event-detail-button event-detail-button--spaced">Save walk-in</button>
                        </div>
                    )}
                    <div className="event-detail-table-wrap">
                        <table className="event-detail-table">
                            <thead>
                                <tr>
                                    <th className="event-detail-th">Name</th>
                                    <th className="event-detail-th">Email</th>
                                    <th className="event-detail-th">Phone</th>
                                    <th className="event-detail-th">Tier</th>
                                    <th className="event-detail-th">Code</th>
                                    <th className="event-detail-th">Status</th>
                                    <th className="event-detail-th">Source</th>
                                </tr>
                            </thead>
                            <tbody>
                                {registrations.filter((registration) => {
                                    const query = registrationSearch.trim().toLowerCase();
                                    if (!query) return true;
                                    return [registration.fullName, registration.email, registration.confirmationCode].some((value) => String(value || '').toLowerCase().includes(query));
                                }).map((registration) => (
                                    <tr key={registration.id}>
                                        <td className="event-detail-td">{registration.fullName}</td>
                                        <td className="event-detail-td">{registration.email}</td>
                                        <td className="event-detail-td">{registration.phoneNumber || '—'}</td>
                                        <td className="event-detail-td">{registration.tier?.name || '—'}</td>
                                        <td className="event-detail-td"><code>{registration.confirmationCode}</code></td>
                                        <td className="event-detail-td">{registration.status.replaceAll('_', ' ')}</td>
                                        <td className="event-detail-td">{registration.source}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </section>
            )}

            {activeTab === 'checkin' && (
                <section className="event-detail-panel">
                    <h2 className="event-detail-section-title">Check-in</h2>
                    <p className="event-detail-muted">This pass currently supports manual code lookup and walk-ins. Camera scanning can be added on top of the same endpoint.</p>
                    <CheckInPanel eventId={eventId} tiers={tiers} onCheckIn={() => void reloadAll()} />
                </section>
            )}

            {activeTab === 'statistics' && (
                <section className="event-detail-panel">
                    <h2 className="event-detail-section-title">Statistics</h2>
                    <div className="event-detail-summary-grid">
                        <SummaryCard label="Total registered" value={String(stats?.totalRegistered ?? 0)} />
                        <SummaryCard label="Checked in" value={String(stats?.totalCheckedIn ?? 0)} />
                        <SummaryCard label="Walk-ins" value={String(stats?.walkInCount ?? 0)} />
                        <SummaryCard label="No-shows" value={String(stats?.noShowCount ?? 0)} />
                    </div>
                    <div className="event-detail-list">
                        {(stats?.byTier ?? []).map((entry) => (
                            <div key={entry.tierId}>
                                <div className="event-detail-progress-row">
                                    <strong>{entry.name}</strong>
                                    <span>{entry.registrations}</span>
                                </div>
                                <progress className="event-detail-progress" value={Math.min(100, entry.registrations * 10)} max={100} />
                            </div>
                        ))}
                    </div>
                    <div className="event-detail-stack event-detail-stack--top">
                        <h3 className="event-detail-section-title">Registrations over time</h3>
                        <div className="event-detail-list event-detail-list--compact">
                            {(stats?.registrationsOverTime ?? []).map((entry) => (
                                <div key={entry.date} className="event-detail-registration-row">
                                    <span>{entry.date}</span>
                                    <progress className="event-detail-progress" value={Math.min(100, entry.count * 12)} max={100} />
                                    <strong>{entry.count}</strong>
                                </div>
                            ))}
                        </div>
                    </div>
                </section>
            )}
        </main>
    );
}

function SummaryCard({ label, value }: { label: string; value: string }) {
    return (
        <div className="event-detail-summary-card">
            <span className="event-detail-summary-label">{label}</span>
            <strong className="event-detail-summary-value">{value}</strong>
        </div>
    );
}

function CheckInPanel({ eventId, tiers, onCheckIn }: { eventId: string; tiers: EventTierRef[]; onCheckIn: () => void }) {
    const [code, setCode] = useState('');
    const [fullName, setFullName] = useState('');
    const [email, setEmail] = useState('');
    const [phone, setPhone] = useState('');
    const [tierId, setTierId] = useState('');
    const [result, setResult] = useState('');
    const [resultTone, setResultTone] = useState<'success' | 'error' | ''>('');

    const handleManualCheckIn = async () => {
        try {
            const registration = await eventsAPI.checkInRegistration(eventId, '', code.trim().toUpperCase());
            setResult(`Checked in ${registration.fullName} (${registration.confirmationCode})`);
            setResultTone('success');
            setCode('');
            onCheckIn();
        } catch (error) {
            setResult(error instanceof Error ? error.message : 'Check-in failed');
            setResultTone('error');
        }
    };

    const handleWalkIn = async () => {
        try {
            await eventsAPI.createWalkInRegistration(eventId, {
                fullName: fullName.trim(),
                email: email.trim(),
                phoneNumber: phone.trim() || null,
                tierId: tierId || null,
                isWalkIn: true,
            });
            setResult('Walk-in saved');
            setResultTone('success');
            setFullName('');
            setEmail('');
            setPhone('');
            setTierId('');
            onCheckIn();
        } catch (error) {
            setResult(error instanceof Error ? error.message : 'Walk-in failed');
            setResultTone('error');
        }
    };

    return (
        <div className="event-detail-stack">
            <div className="event-detail-two-column">
                <div className="event-detail-panel">
                    <h3 className="event-detail-section-title">Scan mode</h3>
                    <p className="event-detail-muted">Camera scanning will reuse the same confirmation-code endpoint. For now, use the manual code field below.</p>
                    <div className="event-detail-scan-placeholder">Camera scanner placeholder</div>
                </div>
                <div className="event-detail-panel">
                    <h3 className="event-detail-section-title">Manual mode</h3>
                    <input value={code} onChange={(event) => setCode(event.target.value)} placeholder="6-character code" className="event-detail-input" />
                    <button type="button" onClick={() => void handleManualCheckIn()} className="event-detail-button event-detail-button--spaced">Check in</button>
                </div>
            </div>
            <div className="event-detail-panel">
                <h3 className="event-detail-section-title">Walk-in mode</h3>
                <div className="event-detail-form-grid">
                    <input value={fullName} onChange={(event) => setFullName(event.target.value)} placeholder="Full name" className="event-detail-input" />
                    <input value={email} onChange={(event) => setEmail(event.target.value)} placeholder="Email" className="event-detail-input" />
                    <input value={phone} onChange={(event) => setPhone(event.target.value)} placeholder="Phone" className="event-detail-input" />
                    <select value={tierId} onChange={(event) => setTierId(event.target.value)} className="event-detail-input">
                        <option value="">No tier</option>
                        {tiers.map((tier) => <option key={tier.id} value={tier.id}>{tier.name}</option>)}
                    </select>
                </div>
                <button type="button" onClick={() => void handleWalkIn()} className="event-detail-button event-detail-button--spaced">Save walk-in</button>
            </div>
            {result ? <div className={`event-detail-result${resultTone === 'success' ? ' event-detail-result--success' : ''}`}>{result}</div> : null}
        </div>
    );
}

function ProgressRow({ label, value, total }: { label: string; value: number; total: number }) {
    const percent = total > 0 ? Math.min(100, Math.round((value / total) * 100)) : 0;
    return (
        <div className="event-detail-progress-group">
            <div className="event-detail-progress-row">
                <span>{label}</span>
                <strong>{value} / {total}</strong>
            </div>
            <progress className="event-detail-progress" value={percent} max={100} />
        </div>
    );
}

function formatDate(value?: string | null) {
    if (!value) return 'TBD';
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return 'TBD';
    return date.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
}

function formatCapacity(registered: number, capacity?: number | null) {
    return capacity == null ? `${registered} registered` : `${registered} / ${capacity}`;
}
*/