import { useState, useEffect } from 'react';
import { X } from 'lucide-react';
import { tasksAPI } from '../../../services/api';
import { toTitleCase } from '../../../utils/titleCase';

const PRIORITIES = ['LOW', 'MEDIUM', 'HIGH', 'URGENT'];
const DIFFICULTIES = ['EASY', 'MEDIUM', 'HARD'];

const PRIORITY_LABELS = { LOW: 'Low', MEDIUM: 'Medium', HIGH: 'High', URGENT: 'Urgent' };
const DIFFICULTY_LABELS = { EASY: 'Easy', MEDIUM: 'Medium', HARD: 'Hard' };

export default function EditTaskModal({ task, allMembers = [], onClose, onTaskUpdated }) {
    const [form, setForm] = useState({
        title: '',
        description: '',
        priority: 'MEDIUM',
        difficulty: 'MEDIUM',
        dueDate: '',
        assigneeIds: [],
    });
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');

    useEffect(() => {
        if (task) {
            setForm({
                title: task.title || '',
                description: task.description || '',
                priority: task.priority || 'MEDIUM',
                difficulty: task.difficulty || 'MEDIUM',
                dueDate: task.dueDate ? task.dueDate.slice(0, 10) : '',
                assigneeIds: (task.assignments || []).map((a) => a.member?.id ?? a.memberId).filter(Boolean),
            });
        }
    }, [task]);

    const setField = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));

    const toggleAssignee = (memberId) => {
        setForm((f) => {
            const exists = f.assigneeIds.includes(memberId);
            return {
                ...f,
                assigneeIds: exists
                    ? f.assigneeIds.filter((id) => id !== memberId)
                    : [...f.assigneeIds, memberId],
            };
        });
    };

    const handleSubmit = async () => {
        if (!form.title.trim()) { setError('Title is required'); return; }
        setLoading(true);
        setError('');
        try {
            const payload = {
                title: form.title.trim(),
                description: form.description.trim() || null,
                priority: form.priority,
                difficulty: form.difficulty,
                dueDate: form.dueDate || null,
                assigneeIds: form.assigneeIds,
            };

            await tasksAPI.update(task.id, payload);
            onTaskUpdated();
            onClose();
        } catch (err) {
            setError(err.message || 'Failed to update task');
        } finally {
            setLoading(false);
        }
    };

    const isSubtask = !!task?.parentTaskId;
    const heading = isSubtask ? `Edit Subtask` : 'Edit Task';

    return (
        <>
            <div className="modal-backdrop" onClick={onClose} />
            <div className="modal-container modal-large">
                <div className="modal-header">
                    <h2 className="modal-title">{heading}</h2>
                    <button className="modal-close-btn" type="button" onClick={onClose} aria-label="Close">
                        <X />
                    </button>
                </div>

                <div className="modal-body">
                    {error && <div className="error-message">{error}</div>}

                    {/* ── Title & Description ── */}
                    <div className="form-section">
                        <h3 className="form-section-title">Task Info</h3>
                        <div className="form-group">
                            <label className="form-label">Title *</label>
                            <input
                                className="form-input"
                                placeholder="Task title"
                                value={form.title}
                                onChange={setField('title')}
                                onBlur={(e) => setForm(f => ({ ...f, title: toTitleCase(e.target.value) }))}
                                autoFocus
                            />
                        </div>
                        <div className="form-group">
                            <label className="form-label">Description</label>
                            <textarea
                                className="form-input form-textarea"
                                placeholder="Optional description…"
                                value={form.description}
                                onChange={setField('description')}
                            />
                        </div>
                    </div>

                    {/* ── Details ── */}
                    <div className="form-section">
                        <h3 className="form-section-title">Details</h3>
                        <div className="form-row">
                            <div className="form-group">
                                <label className="form-label">Priority</label>
                                <select className="form-input" value={form.priority} onChange={setField('priority')}>
                                    {PRIORITIES.map((p) => (
                                        <option key={p} value={p}>{PRIORITY_LABELS[p]}</option>
                                    ))}
                                </select>
                            </div>
                            <div className="form-group">
                                <label className="form-label">Difficulty</label>
                                <select className="form-input" value={form.difficulty} onChange={setField('difficulty')}>
                                    {DIFFICULTIES.map((d) => (
                                        <option key={d} value={d}>{DIFFICULTY_LABELS[d]}</option>
                                    ))}
                                </select>
                            </div>
                        </div>

                        <div className="form-group">
                            <label className="form-label">Due Date</label>
                            <input
                                type="date"
                                className="form-input"
                                value={form.dueDate}
                                onChange={setField('dueDate')}
                            />
                        </div>
                    </div>

                    {/* ── Assignees ── */}
                    {allMembers.length > 0 && (
                        <div className="form-section">
                            <h3 className="form-section-title">Assignees</h3>
                            <div className="team-badge-picker">
                                {allMembers.map((m) => {
                                    const selected = form.assigneeIds.includes(m.id);
                                    return (
                                        <button
                                            key={m.id}
                                            type="button"
                                            className={`team-badge-option${selected ? ' team-badge-option--selected' : ''}`}
                                            onClick={() => toggleAssignee(m.id)}
                                        >
                                            {m.fullName}
                                        </button>
                                    );
                                })}
                            </div>
                        </div>
                    )}
                </div>

                <div className="modal-footer">
                    <button className="btn btn-secondary" type="button" onClick={onClose} disabled={loading}>
                        Cancel
                    </button>
                    <button className="btn btn-primary" type="button" onClick={handleSubmit} disabled={loading}>
                        {loading ? 'Saving…' : 'Save Changes'}
                    </button>
                </div>
            </div>
        </>
    );
}
