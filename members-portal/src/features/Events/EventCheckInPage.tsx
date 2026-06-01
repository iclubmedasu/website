'use client';

import { useState } from 'react';
import { eventsAPI } from '@/services/api';
import type { EventTierRef } from '@/types/backend-contracts';

interface EventCheckInPageProps {
    eventId: string;
    tiers: EventTierRef[];
}

export default function EventCheckInPage({ eventId, tiers }: EventCheckInPageProps) {
    const [mode, setMode] = useState<'scan' | 'manual' | 'walkin'>('manual');
    const [code, setCode] = useState('');
    const [fullName, setFullName] = useState('');
    const [email, setEmail] = useState('');
    const [phoneNumber, setPhoneNumber] = useState('');
    const [tierId, setTierId] = useState('');
    const [status, setStatus] = useState('');

    const handleManualCheckIn = async () => {
        try {
            const updated = await eventsAPI.checkInRegistration(eventId, '', code.trim().toUpperCase());
            setStatus(`Checked in ${updated.fullName}`);
            setCode('');
        } catch (error) {
            setStatus(error instanceof Error ? error.message : 'Check-in failed');
        }
    };

    const handleWalkIn = async () => {
        try {
            const created = await eventsAPI.createWalkInRegistration(eventId, {
                fullName: fullName.trim(),
                email: email.trim(),
                phoneNumber: phoneNumber.trim() || null,
                tierId: tierId || null,
                isWalkIn: true,
            });
            setStatus(`Walk-in saved: ${created.fullName}`);
            setFullName('');
            setEmail('');
            setPhoneNumber('');
            setTierId('');
        } catch (error) {
            setStatus(error instanceof Error ? error.message : 'Walk-in failed');
        }
    };

    return (
        <main className="event-checkin-page">
            <div className="event-checkin-tabs">
                {(['scan', 'manual', 'walkin'] as const).map((item) => (
                    <button key={item} type="button" onClick={() => setMode(item)} className={mode === item ? 'pill pill-active' : 'pill'}>
                        {item === 'scan' ? 'Scan mode' : item === 'manual' ? 'Manual mode' : 'Walk-in mode'}
                    </button>
                ))}
            </div>

            {mode === 'scan' && (
                <section className="card">
                    <h2>Scan mode</h2>
                    <div className="scan-box">Camera scanner placeholder for QR-based check-in.</div>
                    <p className="hint">This view is ready for a camera scanner library. The same check-in endpoint already accepts confirmation codes.</p>
                </section>
            )}

            {mode === 'manual' && (
                <section className="card">
                    <h2>Manual mode</h2>
                    <input value={code} onChange={(event) => setCode(event.target.value)} placeholder="6-character confirmation code" className="input" />
                    <button type="button" onClick={() => void handleManualCheckIn()} className="button">Check in attendee</button>
                </section>
            )}

            {mode === 'walkin' && (
                <section className="card">
                    <h2>Walk-in mode</h2>
                    <div className="grid">
                        <input value={fullName} onChange={(event) => setFullName(event.target.value)} placeholder="Full name" className="input" />
                        <input value={email} onChange={(event) => setEmail(event.target.value)} placeholder="Email" className="input" />
                        <input value={phoneNumber} onChange={(event) => setPhoneNumber(event.target.value)} placeholder="Phone" className="input" />
                        <select value={tierId} onChange={(event) => setTierId(event.target.value)} className="input" aria-label="Tier">
                            <option value="">No tier</option>
                            {tiers.map((tier) => <option key={tier.id} value={tier.id}>{tier.name}</option>)}
                        </select>
                    </div>
                    <button type="button" onClick={() => void handleWalkIn()} className="button">Save walk-in</button>
                </section>
            )}

            {status ? <div className="status">{status}</div> : null}

            <style jsx>{`
                .event-checkin-page {
                    padding: 1.5rem;
                    max-width: 960px;
                    margin: 0 auto;
                }

                .event-checkin-tabs {
                    display: flex;
                    gap: 0.5rem;
                    margin-bottom: 1rem;
                    flex-wrap: wrap;
                }

                .pill {
                    min-height: 44px;
                    border-radius: 999px;
                    border: 1px solid rgba(15, 23, 42, 0.12);
                    background: #fff;
                    padding: 0 1rem;
                    font-weight: 700;
                }

                .pill-active {
                    background: #111827;
                    color: #fff;
                }

                .card {
                    display: grid;
                    gap: 1rem;
                    border-radius: 1rem;
                    background: #fff;
                    border: 1px solid rgba(15, 23, 42, 0.08);
                    padding: 1rem;
                }

                .scan-box {
                    min-height: 200px;
                    border-radius: 1rem;
                    border: 1px dashed rgba(15, 23, 42, 0.18);
                    display: grid;
                    place-items: center;
                    background: #f8fafc;
                    color: #64748b;
                    text-align: center;
                }

                .hint {
                    margin: 0;
                    color: #64748b;
                }

                .input {
                    min-height: 46px;
                    border-radius: 0.85rem;
                    border: 1px solid rgba(15, 23, 42, 0.14);
                    background: #fff;
                    padding: 0 0.9rem;
                    color: #0f172a;
                }

                .grid {
                    display: grid;
                    gap: 0.75rem;
                    grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
                }

                .button {
                    min-height: 46px;
                    border-radius: 999px;
                    border: none;
                    background: #111827;
                    color: #fff;
                    padding: 0 1rem;
                    font-weight: 700;
                }

                .status {
                    margin-top: 1rem;
                    border-radius: 1rem;
                    background: #ecfeff;
                    color: #155e75;
                    padding: 1rem;
                    border: 1px solid #a5f3fc;
                }
            `}</style>
        </main>
    );
}
