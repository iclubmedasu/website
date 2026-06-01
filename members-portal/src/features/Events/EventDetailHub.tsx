'use client';

import Link from 'next/link';
import type { ComponentType, CSSProperties } from 'react';
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
        return <main style={{ padding: '1.5rem' }}>Loading event…</main>;
    }

    if (error || !event) {
        return (
            <main style={{ padding: '1.5rem' }}>
                <div style={errorStyle}>{error || 'Event not found'}</div>
                <Link href="/events">Back to events</Link>
            </main>
        );
    }

    return (
        <main style={{ padding: '1.5rem', maxWidth: '1320px', margin: '0 auto' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: '1rem', flexWrap: 'wrap', marginBottom: '1rem' }}>
                <div>
                    <p style={eyebrowStyle}>Event Detail</p>
                    <h1 style={pageTitleStyle}>{event.title}</h1>
                    <p style={pageSubtitleStyle}>{event.description || 'No description yet'}</p>
                </div>
                <button type="button" onClick={() => void reloadAll()} style={ghostButtonStyle}>Reload</button>
            </div>

            <section style={summaryGridStyle}>
                <SummaryCard label="Status" value={event.status.replaceAll('_', ' ')} />
                <SummaryCard label="Date" value={formatDate(event.eventDate)} />
                <SummaryCard label="Venue" value={event.venue || 'TBD'} />
                <SummaryCard label="Registration" value={formatCapacity(stats?.totalRegistered ?? 0, event.capacity)} />
            </section>

            <nav style={tabNavStyle}>
                {TABS.map((tab) => {
                    const Icon = tab.icon;
                    return (
                        <button
                            key={tab.key}
                            type="button"
                            onClick={() => setActiveTab(tab.key)}
                            style={{ ...tabButtonStyle, ...(activeTab === tab.key ? activeTabButtonStyle : {}) }}
                        >
                            <Icon size={16} />
                            {tab.label}
                        </button>
                    );
                })}
            </nav>

            {activeTab === 'overview' && (
                <section style={panelStyle}>
                    <div style={twoColumnStyle}>
                        <div>
                            <h2 style={sectionTitleStyle}>Overview</h2>
                            <p><strong>Linked project:</strong> {event.project?.title || 'None'}</p>
                            <p><strong>Walk-ins:</strong> {event.allowWalkIns ? 'Enabled' : 'Disabled'}</p>
                            <p><strong>Certifiable:</strong> {event.isCertifiable ? 'Yes' : 'No'}</p>
                            <p><strong>Capacity:</strong> {event.capacity ?? 'Unlimited'}</p>
                            <p><strong>Registration deadline:</strong> {formatDate(event.registrationDeadline)}</p>
                        </div>
                        <div>
                            <h2 style={sectionTitleStyle}>Quick Stats</h2>
                            <ProgressRow label="Registered" value={totalRegistered} total={event.capacity ?? Math.max(totalRegistered, 1)} />
                            <ProgressRow label="Checked in" value={checkedInCount} total={Math.max(totalRegistered, 1)} />
                            <p style={{ marginTop: '1rem' }}><strong>Walk-ins:</strong> {stats?.walkInCount ?? 0}</p>
                            <p><strong>No-shows:</strong> {stats?.noShowCount ?? 0}</p>
                        </div>
                    </div>
                </section>
            )}

            {activeTab === 'tiers' && (
                <section style={panelStyle}>
                    <h2 style={sectionTitleStyle}>Tiers</h2>
                    <div style={formGridStyle}>
                        <input value={tierName} onChange={(event) => setTierName(event.target.value)} placeholder="Tier name" style={inputStyle} />
                        <input value={tierDescription} onChange={(event) => setTierDescription(event.target.value)} placeholder="Description" style={inputStyle} />
                        <input value={tierCapacity} onChange={(event) => setTierCapacity(event.target.value)} placeholder="Max capacity" type="number" min="0" style={inputStyle} />
                        <input value={tierPrice} onChange={(event) => setTierPrice(event.target.value)} placeholder="Price" type="number" min="0" step="0.01" style={inputStyle} />
                        <button type="button" onClick={() => void handleCreateTier()} style={primaryButtonStyle}>Add tier</button>
                    </div>
                    <div style={{ display: 'grid', gap: '0.75rem', marginTop: '1rem' }}>
                        {tiers.map((tier) => (
                            <div key={tier.id} style={listItemStyle}>
                                <div>
                                    <strong>{tier.name}</strong>
                                    <p style={mutedTextStyle}>{tier.description || 'No description'}</p>
                                    <p style={mutedTextStyle}>Capacity: {tier.maxCapacity ?? 'Unlimited'} · Registrations: {tier._count?.registrations ?? tier.registrationCount ?? 0}</p>
                                </div>
                                <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                                    <button type="button" onClick={() => void handleUpdateTier(tier, { isActive: !tier.isActive })} style={secondaryButtonStyle}>{tier.isActive === false ? 'Enable' : 'Disable'}</button>
                                    <button type="button" onClick={() => void handleRemoveTier(Number(tier.id))} style={dangerButtonStyle}>Delete</button>
                                </div>
                            </div>
                        ))}
                    </div>
                </section>
            )}

            {activeTab === 'builder' && (
                <section style={panelStyle}>
                    <h2 style={sectionTitleStyle}>Registration Form Builder</h2>
                    <div style={{ display: 'grid', gap: '0.5rem', marginBottom: '1rem' }}>
                        {['Name', 'Email', 'Phone'].map((label) => (
                            <div key={label} style={{ ...listItemStyle, background: '#f8fafc' }}>
                                <strong>{label}</strong>
                                <span style={mutedTextStyle}>Locked default field</span>
                            </div>
                        ))}
                    </div>
                    <div style={{ display: 'grid', gap: '0.75rem' }}>
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
                                style={listItemStyle}
                            >
                                <div>
                                    <strong>{field.label}</strong>
                                    <p style={mutedTextStyle}>{field.type}{field.required ? ' · Required' : ''}</p>
                                </div>
                                <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                                    <button type="button" onClick={() => void moveField(index, Math.max(0, index - 1))} style={secondaryButtonStyle}><ChevronUp size={16} /></button>
                                    <button type="button" onClick={() => void moveField(index, Math.min(fields.length - 1, index + 1))} style={secondaryButtonStyle}><ChevronDown size={16} /></button>
                                    <button type="button" onClick={() => void handleUpdateField(field, { required: !field.required })} style={secondaryButtonStyle}>{field.required ? 'Unset required' : 'Required'}</button>
                                    <button type="button" onClick={() => void handleRemoveField(Number(field.id))} style={dangerButtonStyle}>Delete</button>
                                </div>
                            </div>
                        ))}
                    </div>
                    <div style={{ marginTop: '1rem', display: 'grid', gap: '0.75rem' }}>
                        <input value={fieldLabel} onChange={(event) => setFieldLabel(event.target.value)} placeholder="Field label" style={inputStyle} />
                        <select value={fieldType} onChange={(event) => setFieldType(event.target.value as typeof fieldType)} style={inputStyle}>
                            {EMPTY_FIELD_TYPES.map((type) => <option key={type} value={type}>{type}</option>)}
                        </select>
                        {fieldType === 'dropdown' && <textarea value={fieldOptions} onChange={(event) => setFieldOptions(event.target.value)} placeholder="One option per line" style={{ ...inputStyle, minHeight: '100px' }} />}
                        <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                            <input type="checkbox" checked={fieldRequired} onChange={(event) => setFieldRequired(event.target.checked)} /> Required
                        </label>
                        <button type="button" onClick={() => void handleCreateField()} style={primaryButtonStyle}>Add field</button>
                    </div>
                </section>
            )}

            {activeTab === 'registrations' && (
                <section style={panelStyle}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', gap: '1rem', flexWrap: 'wrap', alignItems: 'start' }}>
                        <div>
                            <h2 style={sectionTitleStyle}>Registrations</h2>
                            <p style={mutedTextStyle}>Search, filter, and manage event attendees.</p>
                        </div>
                        <button type="button" onClick={() => setWalkInFormOpen((current) => !current)} style={primaryButtonStyle}>{walkInFormOpen ? 'Close walk-in form' : 'Add walk-in'}</button>
                    </div>
                    <div style={formGridStyle}>
                        <input value={registrationSearch} onChange={(event) => setRegistrationSearch(event.target.value)} placeholder="Search by name, email, or code" style={inputStyle} />
                        <select value={registrationTier} onChange={(event) => setRegistrationTier(event.target.value)} style={inputStyle}>
                            <option value="">All tiers</option>
                            {tiers.map((tier) => <option key={tier.id} value={tier.id}>{tier.name}</option>)}
                        </select>
                        <select value={registrationCheckIn} onChange={(event) => setRegistrationCheckIn(event.target.value)} style={inputStyle}>
                            <option value="">Check-in status</option>
                            <option value="CHECKED_IN">Checked in</option>
                            <option value="NOT_CHECKED_IN">Not checked in</option>
                        </select>
                        <select value={registrationWalkIn} onChange={(event) => setRegistrationWalkIn(event.target.value)} style={inputStyle}>
                            <option value="">All source</option>
                            <option value="true">Walk-ins</option>
                            <option value="false">Pre-registered</option>
                        </select>
                    </div>
                    {walkInFormOpen && (
                        <div style={{ ...panelStyle, marginTop: '1rem', background: '#f8fafc' }}>
                            <h3 style={sectionTitleStyle}>Walk-in Registration</h3>
                            <div style={formGridStyle}>
                                <input value={walkInName} onChange={(event) => setWalkInName(event.target.value)} placeholder="Full name" style={inputStyle} />
                                <input value={walkInEmail} onChange={(event) => setWalkInEmail(event.target.value)} placeholder="Email" style={inputStyle} />
                                <input value={walkInPhone} onChange={(event) => setWalkInPhone(event.target.value)} placeholder="Phone" style={inputStyle} />
                                <select value={walkInTier} onChange={(event) => setWalkInTier(event.target.value)} style={inputStyle}>
                                    <option value="">No tier</option>
                                    {tiers.map((tier) => <option key={tier.id} value={tier.id}>{tier.name}</option>)}
                                </select>
                            </div>
                            <button type="button" onClick={() => void handleWalkInSubmit()} style={primaryButtonStyle}>Save walk-in</button>
                        </div>
                    )}
                    <div style={{ overflowX: 'auto', marginTop: '1rem' }}>
                        <table style={tableStyle}>
                            <thead>
                                <tr>
                                    <th style={thStyle}>Name</th>
                                    <th style={thStyle}>Email</th>
                                    <th style={thStyle}>Phone</th>
                                    <th style={thStyle}>Tier</th>
                                    <th style={thStyle}>Code</th>
                                    <th style={thStyle}>Status</th>
                                    <th style={thStyle}>Source</th>
                                </tr>
                            </thead>
                            <tbody>
                                {registrations.filter((registration) => {
                                    const query = registrationSearch.trim().toLowerCase();
                                    if (!query) return true;
                                    return [registration.fullName, registration.email, registration.confirmationCode].some((value) => String(value || '').toLowerCase().includes(query));
                                }).map((registration) => (
                                    <tr key={registration.id}>
                                        <td style={tdStyle}>{registration.fullName}</td>
                                        <td style={tdStyle}>{registration.email}</td>
                                        <td style={tdStyle}>{registration.phoneNumber || '—'}</td>
                                        <td style={tdStyle}>{registration.tier?.name || '—'}</td>
                                        <td style={tdStyle}><code>{registration.confirmationCode}</code></td>
                                        <td style={tdStyle}>{registration.status.replaceAll('_', ' ')}</td>
                                        <td style={tdStyle}>{registration.source}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </section>
            )}

            {activeTab === 'checkin' && (
                <section style={panelStyle}>
                    <h2 style={sectionTitleStyle}>Check-in</h2>
                    <p style={mutedTextStyle}>This pass currently supports manual code lookup and walk-ins. Camera scanning can be added on top of the same endpoint.</p>
                    <CheckInPanel eventId={eventId} tiers={tiers} onCheckIn={() => void reloadAll()} />
                </section>
            )}

            {activeTab === 'statistics' && (
                <section style={panelStyle}>
                    <h2 style={sectionTitleStyle}>Statistics</h2>
                    <div style={summaryGridStyle}>
                        <SummaryCard label="Total registered" value={String(stats?.totalRegistered ?? 0)} />
                        <SummaryCard label="Checked in" value={String(stats?.totalCheckedIn ?? 0)} />
                        <SummaryCard label="Walk-ins" value={String(stats?.walkInCount ?? 0)} />
                        <SummaryCard label="No-shows" value={String(stats?.noShowCount ?? 0)} />
                    </div>
                    <div style={{ display: 'grid', gap: '0.75rem', marginTop: '1rem' }}>
                        {(stats?.byTier ?? []).map((entry) => (
                            <div key={entry.tierId}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.35rem' }}>
                                    <strong>{entry.name}</strong>
                                    <span>{entry.registrations}</span>
                                </div>
                                <div style={progressTrackStyle}><div style={{ ...progressFillStyle, width: `${Math.min(100, entry.registrations * 10)}%` }} /></div>
                            </div>
                        ))}
                    </div>
                    <div style={{ marginTop: '1rem' }}>
                        <h3 style={sectionTitleStyle}>Registrations over time</h3>
                        <div style={{ display: 'grid', gap: '0.4rem' }}>
                            {(stats?.registrationsOverTime ?? []).map((entry) => (
                                <div key={entry.date} style={{ display: 'grid', gridTemplateColumns: '120px 1fr 48px', gap: '0.75rem', alignItems: 'center' }}>
                                    <span>{entry.date}</span>
                                    <div style={progressTrackStyle}><div style={{ ...progressFillStyle, width: `${Math.min(100, entry.count * 12)}%` }} /></div>
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
        <div style={summaryCardStyle}>
            <span style={mutedTextStyle}>{label}</span>
            <strong style={{ fontSize: '1.2rem' }}>{value}</strong>
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
        <div style={{ display: 'grid', gap: '1rem' }}>
            <div style={twoColumnStyle}>
                <div style={panelStyle}>
                    <h3 style={sectionTitleStyle}>Scan mode</h3>
                    <p style={mutedTextStyle}>Camera scanning will reuse the same confirmation-code endpoint. For now, use the manual code field below.</p>
                    <div style={scanPlaceholderStyle}>Camera scanner placeholder</div>
                </div>
                <div style={panelStyle}>
                    <h3 style={sectionTitleStyle}>Manual mode</h3>
                    <input value={code} onChange={(event) => setCode(event.target.value)} placeholder="6-character code" style={inputStyle} />
                    <button type="button" onClick={() => void handleManualCheckIn()} style={{ ...primaryButtonStyle, marginTop: '0.75rem' }}>Check in</button>
                </div>
            </div>
            <div style={panelStyle}>
                <h3 style={sectionTitleStyle}>Walk-in mode</h3>
                <div style={formGridStyle}>
                    <input value={fullName} onChange={(event) => setFullName(event.target.value)} placeholder="Full name" style={inputStyle} />
                    <input value={email} onChange={(event) => setEmail(event.target.value)} placeholder="Email" style={inputStyle} />
                    <input value={phone} onChange={(event) => setPhone(event.target.value)} placeholder="Phone" style={inputStyle} />
                    <select value={tierId} onChange={(event) => setTierId(event.target.value)} style={inputStyle}>
                        <option value="">No tier</option>
                        {tiers.map((tier) => <option key={tier.id} value={tier.id}>{tier.name}</option>)}
                    </select>
                </div>
                <button type="button" onClick={() => void handleWalkIn()} style={{ ...primaryButtonStyle, marginTop: '0.75rem' }}>Save walk-in</button>
            </div>
            {result ? <div style={{ ...errorStyle, background: '#ecfeff', color: '#155e75', borderColor: '#a5f3fc' }}>{result}</div> : null}
        </div>
    );
}

function ProgressRow({ label, value, total }: { label: string; value: number; total: number }) {
    const percent = total > 0 ? Math.min(100, Math.round((value / total) * 100)) : 0;
    return (
        <div style={{ marginTop: '0.75rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.35rem' }}>
                <span>{label}</span>
                <strong>{value} / {total}</strong>
            </div>
            <div style={progressTrackStyle}><div style={{ ...progressFillStyle, width: `${percent}%` }} /></div>
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

const eyebrowStyle: CSSProperties = { textTransform: 'uppercase', letterSpacing: '0.12em', fontSize: '0.75rem', color: '#6b7280', marginBottom: '0.35rem' };
const pageTitleStyle: CSSProperties = { fontSize: '2rem', margin: 0 };
const pageSubtitleStyle: CSSProperties = { marginTop: '0.5rem', color: '#475569', maxWidth: '70ch' };
const summaryGridStyle: CSSProperties = { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))', gap: '0.75rem', marginBottom: '1rem' };
const summaryCardStyle: CSSProperties = { display: 'grid', gap: '0.35rem', borderRadius: '1rem', background: '#fff', padding: '1rem', border: '1px solid rgba(15, 23, 42, 0.08)' };
const tabNavStyle: CSSProperties = { display: 'flex', gap: '0.5rem', flexWrap: 'wrap', marginBottom: '1rem' };
const tabButtonStyle: CSSProperties = { minHeight: '44px', borderRadius: '999px', border: '1px solid rgba(15, 23, 42, 0.12)', background: '#fff', padding: '0 0.9rem', display: 'inline-flex', alignItems: 'center', gap: '0.45rem', fontWeight: 600 };
const activeTabButtonStyle: CSSProperties = { background: '#111827', color: '#fff' };
const panelStyle: CSSProperties = { borderRadius: '1rem', background: '#fff', padding: '1rem', border: '1px solid rgba(15, 23, 42, 0.08)', boxShadow: '0 12px 28px rgba(15, 23, 42, 0.05)' };
const twoColumnStyle: CSSProperties = { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '1rem' };
const sectionTitleStyle: CSSProperties = { margin: '0 0 0.75rem' };
const formGridStyle: CSSProperties = { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '0.75rem' };
const inputStyle: CSSProperties = { minHeight: '46px', borderRadius: '0.85rem', border: '1px solid rgba(15, 23, 42, 0.14)', background: '#fff', padding: '0 0.9rem', color: '#0f172a' };
const primaryButtonStyle: CSSProperties = { minHeight: '46px', borderRadius: '999px', border: 'none', background: '#111827', color: '#fff', padding: '0 1rem', fontWeight: 700 };
const secondaryButtonStyle: CSSProperties = { ...primaryButtonStyle, background: '#e2e8f0', color: '#0f172a' };
const dangerButtonStyle: CSSProperties = { ...primaryButtonStyle, background: '#fee2e2', color: '#991b1b' };
const ghostButtonStyle: CSSProperties = { ...primaryButtonStyle, background: '#e2e8f0', color: '#0f172a' };
const listItemStyle: CSSProperties = { display: 'flex', justifyContent: 'space-between', gap: '1rem', alignItems: 'start', borderRadius: '0.95rem', border: '1px solid rgba(15, 23, 42, 0.08)', padding: '0.9rem', background: '#fff' };
const mutedTextStyle: CSSProperties = { color: '#64748b', margin: 0 };
const tableStyle: CSSProperties = { width: '100%', borderCollapse: 'collapse' };
const thStyle: CSSProperties = { textAlign: 'left', padding: '0.75rem', borderBottom: '1px solid #e2e8f0', whiteSpace: 'nowrap' };
const tdStyle: CSSProperties = { padding: '0.75rem', borderBottom: '1px solid #e2e8f0', whiteSpace: 'nowrap' };
const progressTrackStyle: CSSProperties = { height: '10px', borderRadius: '999px', background: '#e2e8f0', overflow: 'hidden' };
const progressFillStyle: CSSProperties = { height: '100%', borderRadius: '999px', background: 'linear-gradient(90deg, #0f766e, #2563eb)' };
const errorStyle: CSSProperties = { borderRadius: '1rem', background: '#fef2f2', color: '#991b1b', padding: '1rem', border: '1px solid #fecaca' };
const scanPlaceholderStyle: CSSProperties = { minHeight: '160px', display: 'grid', placeItems: 'center', borderRadius: '1rem', border: '1px dashed rgba(15, 23, 42, 0.18)', background: '#f8fafc', color: '#64748b' };
