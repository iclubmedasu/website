import { useState } from 'react';
import { eventsAPI } from '@/services/api';
import type { EventTierRef, Id } from '@/types/backend-contracts';

interface EventCheckInSectionProps {
    eventId: Id | string;
    tiers: EventTierRef[];
    onCheckIn: () => void;
}

export default function EventCheckInSection({ eventId, tiers, onCheckIn }: EventCheckInSectionProps) {
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
        <section className="event-expanded-panel">
            <h2 className="expanded-section-title">Check-in</h2>
            <p className="event-expanded-muted">This pass currently supports manual code lookup and walk-ins. Camera scanning can be added on top of the same endpoint.</p>
            <div className="event-expanded-stack event-expanded-stack--spaced">
                <div className="event-expanded-two-column">
                    <div className="event-expanded-panel event-expanded-panel--nested">
                        <h3 className="expanded-section-title expanded-section-title--sm">Scan mode</h3>
                        <p className="event-expanded-muted">Camera scanning will reuse the same confirmation-code endpoint. For now, use the manual code field below.</p>
                        <div className="event-expanded-scan-placeholder">Camera scanner placeholder</div>
                    </div>
                    <div className="event-expanded-panel event-expanded-panel--nested">
                        <h3 className="expanded-section-title expanded-section-title--sm">Manual mode</h3>
                        <input value={code} onChange={(e) => setCode(e.target.value)} placeholder="6-character code" className="form-input" />
                        <button type="button" onClick={() => void handleManualCheckIn()} className="btn btn-primary event-expanded-btn-block">Check in</button>
                    </div>
                </div>
                <div className="event-expanded-panel event-expanded-panel--nested">
                    <h3 className="expanded-section-title expanded-section-title--sm">Walk-in mode</h3>
                    <div className="event-expanded-form-grid">
                        <input value={fullName} onChange={(e) => setFullName(e.target.value)} placeholder="Full name" className="form-input" />
                        <input value={email} onChange={(e) => setEmail(e.target.value)} placeholder="Email" className="form-input" />
                        <input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="Phone" className="form-input" />
                        <select aria-label="Tier" value={tierId} onChange={(e) => setTierId(e.target.value)} className="form-input">
                            <option value="">No tier</option>
                            {tiers.map((tier) => <option key={tier.id} value={tier.id}>{tier.name}</option>)}
                        </select>
                    </div>
                    <button type="button" onClick={() => void handleWalkIn()} className="btn btn-primary event-expanded-btn-block">Save walk-in</button>
                </div>
                {result ? <div className="event-expanded-result">{result}</div> : null}
            </div>
        </section>
    );
}
