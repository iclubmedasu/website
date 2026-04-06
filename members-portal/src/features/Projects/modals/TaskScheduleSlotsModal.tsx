'use client';

import { useEffect, useState } from 'react';
import { X, Loader, Trash2 } from 'lucide-react';
import { scheduleSlotsAPI } from '../../../services/api';
import ScheduleTimetable from '../components/ScheduleTimetable/ScheduleTimetable';
import type { Id, MemberSummary, ScheduleSlot, TaskSummary } from '../../../types/backend-contracts';

interface ScheduleSlotView extends ScheduleSlot {
    task?: {
        title?: string | null;
    } | null;
}

interface TaskWithProject extends TaskSummary {
    project?: {
        id?: Id;
    } | null;
}

interface TaskScheduleSlotFormState {
    memberId: string;
    title: string;
    startDateTime: string;
    endDateTime: string;
    notes: string;
}

interface TaskScheduleSlotsModalProps {
    task: TaskWithProject | null;
    allMembers?: MemberSummary[];
    onClose: () => void;
}

function getErrorMessage(error: unknown, fallback: string): string {
    if (error instanceof Error && error.message) {
        return error.message;
    }
    return fallback;
}

function formatDateTime(value: string | Date | null | undefined): string {
    if (!value) return '—';
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return '—';
    return date.toLocaleString();
}

export default function TaskScheduleSlotsModal({ task, allMembers = [], onClose }: TaskScheduleSlotsModalProps) {
    const [slots, setSlots] = useState<ScheduleSlotView[]>([]);
    const [loading, setLoading] = useState(false);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState('');
    const [form, setForm] = useState<TaskScheduleSlotFormState>({
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
            setSlots(Array.isArray(data) ? (data as ScheduleSlotView[]) : []);
        } catch (err: unknown) {
            setError(getErrorMessage(err, 'Failed to load time slots'));
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        void loadSlots();
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
        } catch (err: unknown) {
            setError(getErrorMessage(err, 'Failed to add time slot'));
        } finally {
            setSaving(false);
        }
    };

    const handleRemoveSlot = async (slotId: Id | string) => {
        try {
            setSaving(true);
            setError('');
            await scheduleSlotsAPI.remove(slotId);
            await loadSlots();
        } catch (err: unknown) {
            setError(getErrorMessage(err, 'Failed to remove time slot'));
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
                                    <div className="project-slot-grid">
                                        <ScheduleTimetable slots={slots} emptyMessage="No schedule slots available." />

                                        {slots.map((slot) => (
                                            <div
                                                key={slot.id}
                                                className={`project-slot-card${slot.isActive ? '' : ' project-slot-card--inactive'}`}
                                            >
                                                <div className="project-slot-card-header">
                                                    <div className="project-slot-card-title">
                                                        <span>{slot.title || 'Untitled slot'}</span>
                                                        <span className="project-slot-state">
                                                            {slot.isActive ? 'Active' : 'Inactive'}
                                                        </span>
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

                                                <p className="form-hint-inline">
                                                    {slot.member?.fullName ?? 'Unknown member'}
                                                </p>
                                                <p className="form-hint-inline">
                                                    {formatDateTime(slot.startDateTime)} → {formatDateTime(slot.endDateTime)}
                                                </p>
                                                {slot.notes && (
                                                    <p className="project-slot-notes">{slot.notes}</p>
                                                )}
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
                                        <label className="form-label" htmlFor="task-slot-member">
                                            Member
                                        </label>
                                        <select
                                            id="task-slot-member"
                                            title="Select member"
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
                                        <label className="form-label" htmlFor="task-slot-title">
                                            Title
                                        </label>
                                        <input
                                            id="task-slot-title"
                                            className="form-input"
                                            value={form.title}
                                            onChange={(e) => setForm((current) => ({ ...current, title: e.target.value }))}
                                            placeholder="Focus block, review, etc."
                                        />
                                    </div>
                                </div>

                                <div className="form-row">
                                    <div className="form-group">
                                        <label className="form-label" htmlFor="task-slot-start">
                                            Start
                                        </label>
                                        <input
                                            id="task-slot-start"
                                            title="Start date and time"
                                            type="datetime-local"
                                            className="form-input"
                                            value={form.startDateTime}
                                            onChange={(e) => setForm((current) => ({ ...current, startDateTime: e.target.value }))}
                                        />
                                    </div>
                                    <div className="form-group">
                                        <label className="form-label" htmlFor="task-slot-end">
                                            End
                                        </label>
                                        <input
                                            id="task-slot-end"
                                            title="End date and time"
                                            type="datetime-local"
                                            className="form-input"
                                            value={form.endDateTime}
                                            onChange={(e) => setForm((current) => ({ ...current, endDateTime: e.target.value }))}
                                        />
                                    </div>
                                </div>

                                <div className="form-group">
                                    <label className="form-label" htmlFor="task-slot-notes">
                                        Notes
                                    </label>
                                    <textarea
                                        id="task-slot-notes"
                                        className="form-input form-textarea"
                                        value={form.notes}
                                        onChange={(e) => setForm((current) => ({ ...current, notes: e.target.value }))}
                                        placeholder="Optional notes"
                                    />
                                </div>

                                {!allMembers.length && (
                                    <p className="form-hint">
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