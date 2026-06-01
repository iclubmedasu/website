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
        <main className="erp-main">
            <div className="erp-header">
                <div>
                    <h2 style={{ margin: 0 }}>Registrations</h2>
                </div>
                <button type="button" className="erp-button" onClick={() => setWalkIn(walkIn === 'true' ? '' : 'true')}>Add walk-in</button>
            </div>

            <div className="erp-filters">
                <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search name, email, or code" className="erp-input" />
                <select title="Tier" value={tierId} onChange={(event) => setTierId(event.target.value)} className="erp-input">
                    <option value="">All tiers</option>
                    {tiers.map((tier) => <option key={tier.id} value={tier.id}>{tier.name}</option>)}
                </select>
                <select title="Check-in status" value={checkInStatus} onChange={(event) => setCheckInStatus(event.target.value)} className="erp-input">
                    <option value="">All check-in states</option>
                    <option value="CHECKED_IN">Checked in</option>
                    <option value="NOT_CHECKED_IN">Not checked in</option>
                </select>
                <select title="Source" value={walkIn} onChange={(event) => setWalkIn(event.target.value)} className="erp-input">
                    <option value="">All source</option>
                    <option value="true">Walk-ins</option>
                    <option value="false">Pre-registered</option>
                </select>
            </div>

            <div className="erp-table-wrap">
                <table className="erp-table">
                    <thead>
                        <tr>
                            <th className="erp-th">Name</th>
                            <th className="erp-th">Email</th>
                            <th className="erp-th">Phone</th>
                            <th className="erp-th">Tier</th>
                            <th className="erp-th">Code</th>
                            <th className="erp-th">Check-in</th>
                            <th className="erp-th">Source</th>
                        </tr>
                    </thead>
                    <tbody>
                        {filtered.map((registration) => (
                            <tr key={registration.id}>
                                <td className="erp-td">{registration.fullName}</td>
                                <td className="erp-td">{registration.email}</td>
                                <td className="erp-td">{registration.phoneNumber || '—'}</td>
                                <td className="erp-td">{registration.tier?.name || '—'}</td>
                                <td className="erp-td"><code>{registration.confirmationCode}</code></td>
                                <td className="erp-td">{registration.status.replaceAll('_', ' ')}</td>
                                <td className="erp-td">{registration.source}</td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </main>
    );
}

// Note: styles moved to CSS classes. Add corresponding rules in your stylesheet.
