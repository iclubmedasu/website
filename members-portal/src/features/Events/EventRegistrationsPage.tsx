'use client';

import { useEffect, useState } from 'react';
import { eventsAPI } from '@/services/api';
import type { EventRegistrationRef, EventTierRef } from '@/types/backend-contracts';

interface EventRegistrationsPageProps {
    eventId: string;
}

export default function EventRegistrationsPage({ eventId }: EventRegistrationsPageProps) {
    const [registrations, setRegistrations] = useState<EventRegistrationRef[]>([]);
    const [tiers, setTiers] = useState<EventTierRef[]>([]);
    const [search, setSearch] = useState('');
    const [tierId, setTierId] = useState('');
    const [checkInStatus, setCheckInStatus] = useState('');
    const [walkIn, setWalkIn] = useState('');

    useEffect(() => {
        let active = true;

        const load = async () => {
            const [registrationsResult, tiersResult] = await Promise.all([
                eventsAPI.getRegistrations(eventId, {
                    tierId: tierId || undefined,
                    checkInStatus: checkInStatus === 'CHECKED_IN' || checkInStatus === 'NOT_CHECKED_IN' ? checkInStatus : undefined,
                    walkIn: walkIn === 'true' ? true : walkIn === 'false' ? false : undefined,
                }),
                eventsAPI.getTiers(eventId),
            ]);

            if (active) {
                setRegistrations(registrationsResult);
                setTiers(tiersResult);
            }
        };

        void load().catch(() => undefined);

        return () => { active = false; };
    }, [checkInStatus, eventId, tierId, walkIn]);

    const filtered = registrations.filter((registration) => {
        const query = search.trim().toLowerCase();
        if (!query) return true;
        return [registration.fullName, registration.email, registration.confirmationCode].some((value) => String(value || '').toLowerCase().includes(query));
    });

    return (
        <main style={{ padding: '1.5rem' }}>
            <div style={headerStyle}>
                <div>
                    <h2 style={{ margin: 0 }}>Registrations</h2>
                    <p style={{ color: '#64748b' }}>Filter the attendee list, review confirmation codes, and manage walk-ins.</p>
                </div>
                <button type="button" style={buttonStyle} onClick={() => setWalkIn(walkIn === 'true' ? '' : 'true')}>Add walk-in</button>
            </div>

            <div style={filtersStyle}>
                <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search name, email, or code" style={inputStyle} />
                <select value={tierId} onChange={(event) => setTierId(event.target.value)} style={inputStyle}>
                    <option value="">All tiers</option>
                    {tiers.map((tier) => <option key={tier.id} value={tier.id}>{tier.name}</option>)}
                </select>
                <select value={checkInStatus} onChange={(event) => setCheckInStatus(event.target.value)} style={inputStyle}>
                    <option value="">All check-in states</option>
                    <option value="CHECKED_IN">Checked in</option>
                    <option value="NOT_CHECKED_IN">Not checked in</option>
                </select>
                <select value={walkIn} onChange={(event) => setWalkIn(event.target.value)} style={inputStyle}>
                    <option value="">All source</option>
                    <option value="true">Walk-ins</option>
                    <option value="false">Pre-registered</option>
                </select>
            </div>

            <div style={{ overflowX: 'auto', marginTop: '1rem' }}>
                <table style={tableStyle}>
                    <thead>
                        <tr>
                            <th style={thStyle}>Name</th>
                            <th style={thStyle}>Email</th>
                            <th style={thStyle}>Phone</th>
                            <th style={thStyle}>Tier</th>
                            <th style={thStyle}>Code</th>
                            <th style={thStyle}>Check-in</th>
                            <th style={thStyle}>Source</th>
                        </tr>
                    </thead>
                    <tbody>
                        {filtered.map((registration) => (
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
        </main>
    );
}

const headerStyle: React.CSSProperties = { display: 'flex', justifyContent: 'space-between', gap: '1rem', flexWrap: 'wrap', alignItems: 'start', marginBottom: '1rem' };
const buttonStyle: React.CSSProperties = { minHeight: '46px', borderRadius: '999px', border: 'none', background: '#111827', color: '#fff', padding: '0 1rem', fontWeight: 700 };
const filtersStyle: React.CSSProperties = { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '0.75rem' };
const inputStyle: React.CSSProperties = { minHeight: '46px', borderRadius: '0.85rem', border: '1px solid rgba(15, 23, 42, 0.14)', background: '#fff', padding: '0 0.9rem', color: '#0f172a' };
const tableStyle: React.CSSProperties = { width: '100%', borderCollapse: 'collapse' };
const thStyle: React.CSSProperties = { textAlign: 'left', padding: '0.75rem', borderBottom: '1px solid #e2e8f0', whiteSpace: 'nowrap' };
const tdStyle: React.CSSProperties = { padding: '0.75rem', borderBottom: '1px solid #e2e8f0', whiteSpace: 'nowrap' };
