import { useEffect, useState } from 'react';
import { X, Loader, Trash2 } from 'lucide-react';
import { scheduleSlotsAPI } from '../../../services/api';

function formatDateTime(value) {
    if (!value) return '—';
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return '—';
    return date.toLocaleString();
}

function toDateTimeLocal(value) {
    if (!value) return '';
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return '';
    const pad = (num) => String(num).padStart(2, '0');
    return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

export default function TaskScheduleSlotsModal({ task, allMembers = [], onClose }) {
    const [slots, setSlots] = useState([]);
    const [loading, setLoading] = useState(false);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState('');
    const [form, setForm] = useState({
        memberId: '',
        title: '',
        startDateTime: '',
        endDateTime: '',
        notes: '',
    });

    const defaultMemberId = allMembers[0]?.id ? String(allMembers[0].id) : '';

    const loadSlots = async () => {
        if (!task?.id) return;
        try {
            setLoading(true);
            setError('');
            const data = await scheduleSlotsAPI.getAll({ taskId: task.id, includeInactive: true });
            setSlots(Array.isArray(data) ? data : []);
        } catch (err) {
            setError(err.message || 'Failed to load time slots');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        loadSlots();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [task?.id]);

    useEffect(() => {
        if (!form.memberId && defaultMemberId) {
            setForm((current) => ({ ...current, memberId: defaultMemberId }));
        }
    }, [defaultMemberId, form.memberId]);

    const handleAddSlot = async () => {
        if (!task?.id || !form.memberId || !form.startDateTime || !form.endDateTime) return;
        try {
            setSaving(true);
            setError('');
            await scheduleSlotsAPI.create({
                projectId: task.projectId ?? task.project?.id,
                taskId: task.id,
                memberId: Number(form.memberId),
                title: form.title.trim() || null,
                notes: form.notes.trim() || null,
                startDateTime: form.startDateTime,
                endDateTime: form.endDateTime,
            });
            setForm((current) => ({
                ...current,
                title: '',
                startDateTime: '',
                endDateTime: '',
                notes: '',
            }));
            await loadSlots();
        } catch (err) {
            setError(err.message || 'Failed to add time slot');
        } finally {
            setSaving(false);
        }
    };

    const handleRemoveSlot = async (slotId) => {
        try {
            setSaving(true);
            setError('');
            await scheduleSlotsAPI.remove(slotId);
            await loadSlots();
        } catch (err) {
            setError(err.message || 'Failed to remove time slot');
        } finally {
            setSaving(false);
        }
    };

    if (!task) return null;

    return (
        <>
            <div className="modal-backdrop" onClick={onClose} />
            <div className="modal-container modal-large">
                <div className="modal-header">
                    <div>
                        <h2 className="modal-title">Task Time Slots</h2>
                        <p className="modal-subtitle">{task.title}</p>
                    </div>
                    <button className="modal-close-btn" type="button" onClick={onClose} aria-label="Close">
                        <X />
                    </button>
                </div>

                <div className="modal-body">
                    {loading ? (
                        <div className="empty-state">
                            <Loader size={16} className="file-status-processing" />
                            <p>Loading time slots…</p>
                        </div>
                    ) : error ? (
                        <div className="error-message">{error}</div>
                    ) : (
                        <>
                            <div className="form-section">
                                <h3 className="form-section-title">Current Slots</h3>
                                {slots.length > 0 ? (
                                    <div style={{ display: 'grid', gap: '0.75rem' }}>
                                        {slots.map((slot) => (
                                            <div
                                                key={slot.id}
                                                style={{
                                                    border: '1px solid var(--gray-200)',
                                                    borderRadius: 'var(--radius-md)',
                                                    padding: '0.75rem',
                                                    background: slot.isActive ? 'var(--gray-50)' : 'rgba(148, 163, 184, 0.08)',
                                                    display: 'flex',
                                                    justifyContent: 'space-between',
                                                    gap: '0.75rem',
                                                    alignItems: 'flex-start',
                                                }}
                                            >
                                                <div>
                                                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem', marginBottom: '0.35rem' }}>
                                                        <strong>{slot.title || 'Untitled slot'}</strong>
                                                        <span className="project-slot-state">{slot.isActive ? 'Active' : 'Inactive'}</span>
                                                    </div>
                                                    <div className="form-hint" style={{ margin: '0.25rem 0' }}>
                                                        {slot.member?.fullName ?? 'Unknown member'}
                                                    </div>
                                                    <div className="form-hint" style={{ margin: 0 }}>
                                                        {formatDateTime(slot.startDateTime)} → {formatDateTime(slot.endDateTime)}
                                                    </div>
                                                    {slot.notes && (
                                                        <p style={{ margin: '0.45rem 0 0', whiteSpace: 'pre-wrap', color: 'var(--gray-700)' }}>
                                                            {slot.notes}
                                                        </p>
                                                    )}
                                                </div>
                                                <button
                                                    className="btn btn-secondary"
                                                    type="button"
                                                    onClick={() => handleRemoveSlot(slot.id)}
                                                    disabled={saving}
                                                >
                                                    <Trash2 size={13} />
                                                    Remove
                                                </button>
                                            </div>
                                        ))}
                                    </div>
                                ) : (
                                    <p className="form-hint">No time slots assigned yet.</p>
                                )}
                            </div>

                            <div className="form-section">
                                <h3 className="form-section-title">Add Slot</h3>
                                <div className="form-row">
                                    <div className="form-group">
                                        <label className="form-label">Member</label>
                                        <select
                                            className="form-input"
                                            value={form.memberId}
                                            onChange={(e) => setForm((current) => ({ ...current, memberId: e.target.value }))}
                                        >
                                            <option value="">Select a member</option>
                                            {allMembers.map((member) => (
                                                <option key={member.id} value={member.id}>
                                                    {member.fullName}
                                                </option>
                                            ))}
                                        </select>
                                    </div>
                                    <div className="form-group">
                                        <label className="form-label">Title</label>
                                        <input
                                            className="form-input"
                                            value={form.title}
                                            onChange={(e) => setForm((current) => ({ ...current, title: e.target.value }))}
                                            placeholder="Focus block, review, etc."
                                        />
                                    </div>
                                </div>

                                <div className="form-row">
                                    <div className="form-group">
                                        <label className="form-label">Start</label>
                                        <input
                                            type="datetime-local"
                                            className="form-input"
                                            value={form.startDateTime}
                                            onChange={(e) => setForm((current) => ({ ...current, startDateTime: e.target.value }))}
                                        />
                                    </div>
                                    <div className="form-group">
                                        <label className="form-label">End</label>
                                        <input
                                            type="datetime-local"
                                            className="form-input"
                                            value={form.endDateTime}
                                            onChange={(e) => setForm((current) => ({ ...current, endDateTime: e.target.value }))}
                                        />
                                    </div>
                                </div>

                                <div className="form-group">
                                    <label className="form-label">Notes</label>
                                    <textarea
                                        className="form-input form-textarea"
                                        value={form.notes}
                                        onChange={(e) => setForm((current) => ({ ...current, notes: e.target.value }))}
                                        placeholder="Optional notes"
                                    />
                                </div>

                                {!allMembers.length && (
                                    <p className="form-hint" style={{ marginTop: '0.75rem' }}>
                                        No members available for this project.
                                    </p>
                                )}
                            </div>
                        </>
                    )}
                </div>

                <div className="modal-footer">
                    <button className="btn btn-secondary" type="button" onClick={onClose} disabled={saving}>
                        Cancel
                    </button>
                    <button
                        className="btn btn-primary"
                        type="button"
                        onClick={handleAddSlot}
                        disabled={!form.memberId || !form.startDateTime || !form.endDateTime || saving}
                    >
                        {saving ? 'Saving…' : 'Add Time Slot'}
                    </button>
                </div>
            </div>
        </>
    );
}
