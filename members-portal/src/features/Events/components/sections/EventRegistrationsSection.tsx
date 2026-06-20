import { useEffect, useState } from 'react';
import { eventsAPI } from '@/services/api';
import type { EventRegistrationRef, EventTierRef, Id } from '@/types/backend-contracts';

interface EventRegistrationsSectionProps {
    eventId: Id | string;
    tiers: EventTierRef[];
}

export default function EventRegistrationsSection({ eventId, tiers }: EventRegistrationsSectionProps) {
    const [registrations, setRegistrations] = useState<EventRegistrationRef[]>([]);
    const [registrationSearch, setRegistrationSearch] = useState('');
    const [registrationTier, setRegistrationTier] = useState('');
    const [registrationCheckIn, setRegistrationCheckIn] = useState('');
    const [registrationWalkIn, setRegistrationWalkIn] = useState('');
    const [walkInFormOpen, setWalkInFormOpen] = useState(false);
    const [walkInName, setWalkInName] = useState('');
    const [walkInEmail, setWalkInEmail] = useState('');
    const [walkInPhone, setWalkInPhone] = useState('');
    const [walkInTier, setWalkInTier] = useState('');

    useEffect(() => {
        let active = true;

        const loadRegistrations = async () => {
            try {
                const result = await eventsAPI.getRegistrations(eventId, {
                    tierId: registrationTier || undefined,
                    checkInStatus: registrationCheckIn === 'CHECKED_IN' || registrationCheckIn === 'NOT_CHECKED_IN' ? registrationCheckIn : undefined,
                    walkIn: registrationWalkIn === 'true' ? true : registrationWalkIn === 'false' ? false : undefined,
                });
                if (active) setRegistrations(result);
            } catch {
                if (active) setRegistrations([]);
            }
        };

        void loadRegistrations();
        return () => { active = false; };
    }, [eventId, registrationCheckIn, registrationTier, registrationWalkIn]);

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

    const filtered = registrations.filter((registration) => {
        const query = registrationSearch.trim().toLowerCase();
        if (!query) return true;
        return [registration.fullName, registration.email, registration.confirmationCode].some((value) => String(value || '').toLowerCase().includes(query));
    });

    return (
        <section className="event-expanded-panel">
            <div className="event-expanded-header event-expanded-header--compact">
                <div>
                    <h2 className="expanded-section-title">Registrations</h2>
                    <p className="event-expanded-muted">Search, filter, and manage event attendees.</p>
                </div>
                <button type="button" onClick={() => setWalkInFormOpen((current) => !current)} className="btn btn-primary">
                    {walkInFormOpen ? 'Close walk-in form' : 'Add walk-in'}
                </button>
            </div>
            <div className="event-expanded-form-grid">
                <input value={registrationSearch} onChange={(e) => setRegistrationSearch(e.target.value)} placeholder="Search by name, email, or code" className="form-input" />
                <select aria-label="Filter by tier" value={registrationTier} onChange={(e) => setRegistrationTier(e.target.value)} className="form-input">
                    <option value="">All tiers</option>
                    {tiers.map((tier) => <option key={tier.id} value={tier.id}>{tier.name}</option>)}
                </select>
                <select aria-label="Filter by check-in status" value={registrationCheckIn} onChange={(e) => setRegistrationCheckIn(e.target.value)} className="form-input">
                    <option value="">Check-in status</option>
                    <option value="CHECKED_IN">Checked in</option>
                    <option value="NOT_CHECKED_IN">Not checked in</option>
                </select>
                <select aria-label="Registration source" value={registrationWalkIn} onChange={(e) => setRegistrationWalkIn(e.target.value)} className="form-input">
                    <option value="">All source</option>
                    <option value="true">Walk-ins</option>
                    <option value="false">Pre-registered</option>
                </select>
            </div>
            {walkInFormOpen && (
                <div className="event-expanded-walkin-panel">
                    <h3 className="expanded-section-title expanded-section-title--sm">Walk-in Registration</h3>
                    <div className="event-expanded-form-grid">
                        <input value={walkInName} onChange={(e) => setWalkInName(e.target.value)} placeholder="Full name" className="form-input" />
                        <input value={walkInEmail} onChange={(e) => setWalkInEmail(e.target.value)} placeholder="Email" className="form-input" />
                        <input value={walkInPhone} onChange={(e) => setWalkInPhone(e.target.value)} placeholder="Phone" className="form-input" />
                        <select aria-label="Walk-in tier" value={walkInTier} onChange={(e) => setWalkInTier(e.target.value)} className="form-input">
                            <option value="">No tier</option>
                            {tiers.map((tier) => <option key={tier.id} value={tier.id}>{tier.name}</option>)}
                        </select>
                    </div>
                    <button type="button" onClick={() => void handleWalkInSubmit()} className="btn btn-primary">Save walk-in</button>
                </div>
            )}
            <div className="event-expanded-table-wrap">
                <table className="event-expanded-table">
                    <thead>
                        <tr>
                            <th className="event-expanded-th">Name</th>
                            <th className="event-expanded-th">Email</th>
                            <th className="event-expanded-th">Phone</th>
                            <th className="event-expanded-th">Tier</th>
                            <th className="event-expanded-th">Code</th>
                            <th className="event-expanded-th">Status</th>
                            <th className="event-expanded-th">Source</th>
                        </tr>
                    </thead>
                    <tbody>
                        {filtered.map((registration) => (
                            <tr key={registration.id}>
                                <td className="event-expanded-td">{registration.fullName}</td>
                                <td className="event-expanded-td">{registration.email}</td>
                                <td className="event-expanded-td">{registration.phoneNumber || '—'}</td>
                                <td className="event-expanded-td">{registration.tier?.name || '—'}</td>
                                <td className="event-expanded-td"><code>{registration.confirmationCode}</code></td>
                                <td className="event-expanded-td">{registration.status.replaceAll('_', ' ')}</td>
                                <td className="event-expanded-td">{registration.source}</td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </section>
    );
}
