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
        <main style={{ padding: '1.5rem', maxWidth: '960px', margin: '0 auto' }}>
            <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1rem', flexWrap: 'wrap' }}>
                {(['scan', 'manual', 'walkin'] as const).map((item) => (
                    <button key={item} type="button" onClick={() => setMode(item)} style={{ ...pillStyle, ...(mode === item ? activePillStyle : {}) }}>
                        {item === 'scan' ? 'Scan mode' : item === 'manual' ? 'Manual mode' : 'Walk-in mode'}
                    </button>
                ))}
            </div>

            {mode === 'scan' && (
                <section style={cardStyle}>
                    <h2>Scan mode</h2>
                    <div style={scanBoxStyle}>Camera scanner placeholder for QR-based check-in.</div>
                    <p style={hintStyle}>This view is ready for a camera scanner library. The same check-in endpoint already accepts confirmation codes.</p>
                </section>
            )}

            {mode === 'manual' && (
                <section style={cardStyle}>
                    <h2>Manual mode</h2>
                    <input value={code} onChange={(event) => setCode(event.target.value)} placeholder="6-character confirmation code" style={inputStyle} />
                    <button type="button" onClick={() => void handleManualCheckIn()} style={buttonStyle}>Check in attendee</button>
                </section>
            )}

            {mode === 'walkin' && (
                <section style={cardStyle}>
                    <h2>Walk-in mode</h2>
                    <div style={gridStyle}>
                        <input value={fullName} onChange={(event) => setFullName(event.target.value)} placeholder="Full name" style={inputStyle} />
                        <input value={email} onChange={(event) => setEmail(event.target.value)} placeholder="Email" style={inputStyle} />
                        <input value={phoneNumber} onChange={(event) => setPhoneNumber(event.target.value)} placeholder="Phone" style={inputStyle} />
                        <select value={tierId} onChange={(event) => setTierId(event.target.value)} style={inputStyle}>
                            <option value="">No tier</option>
                            {tiers.map((tier) => <option key={tier.id} value={tier.id}>{tier.name}</option>)}
                        </select>
                    </div>
                    <button type="button" onClick={() => void handleWalkIn()} style={buttonStyle}>Save walk-in</button>
                </section>
            )}

            {status ? <div style={statusStyle}>{status}</div> : null}
        </main>
    );
}

const pillStyle: React.CSSProperties = { minHeight: '44px', borderRadius: '999px', border: '1px solid rgba(15, 23, 42, 0.12)', background: '#fff', padding: '0 1rem', fontWeight: 700 };
const activePillStyle: React.CSSProperties = { background: '#111827', color: '#fff' };
const cardStyle: React.CSSProperties = { display: 'grid', gap: '1rem', borderRadius: '1rem', background: '#fff', border: '1px solid rgba(15, 23, 42, 0.08)', padding: '1rem' };
const scanBoxStyle: React.CSSProperties = { minHeight: '200px', borderRadius: '1rem', border: '1px dashed rgba(15, 23, 42, 0.18)', display: 'grid', placeItems: 'center', background: '#f8fafc', color: '#64748b', textAlign: 'center' };
const hintStyle: React.CSSProperties = { margin: 0, color: '#64748b' };
const inputStyle: React.CSSProperties = { minHeight: '46px', borderRadius: '0.85rem', border: '1px solid rgba(15, 23, 42, 0.14)', background: '#fff', padding: '0 0.9rem', color: '#0f172a' };
const gridStyle: React.CSSProperties = { display: 'grid', gap: '0.75rem', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))' };
const buttonStyle: React.CSSProperties = { minHeight: '46px', borderRadius: '999px', border: 'none', background: '#111827', color: '#fff', padding: '0 1rem', fontWeight: 700 };
const statusStyle: React.CSSProperties = { marginTop: '1rem', borderRadius: '1rem', background: '#ecfeff', color: '#155e75', padding: '1rem', border: '1px solid #a5f3fc' };
