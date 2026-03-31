import { useState, useEffect } from 'react';
import { X, Link2, Trash2 } from 'lucide-react';
import { tasksAPI } from '../../../services/api';
import { toTitleCase } from '../../../utils/titleCase';

const PRIORITIES = ['LOW', 'MEDIUM', 'HIGH', 'URGENT'];
const DIFFICULTIES = ['EASY', 'MEDIUM', 'HARD'];
const STATUSES = ['NOT_STARTED', 'IN_PROGRESS', 'COMPLETED', 'DELAYED', 'BLOCKED', 'ON_HOLD', 'CANCELLED'];

const PRIORITY_LABELS = { LOW: 'Low', MEDIUM: 'Medium', HIGH: 'High', URGENT: 'Urgent' };
const DIFFICULTY_LABELS = { EASY: 'Easy', MEDIUM: 'Medium', HARD: 'Hard' };
const STATUS_LABELS = { NOT_STARTED: 'Not Started', IN_PROGRESS: 'In Progress', COMPLETED: 'Completed', DELAYED: 'Delayed', BLOCKED: 'Blocked', ON_HOLD: 'On Hold', CANCELLED: 'Cancelled' };

function flattenProjectTasks(projectDetail) {
    const flattened = [];

    const visitTask = (task) => {
        flattened.push(task);
        (task.subtasks || []).forEach(visitTask);
    };

    (projectDetail?.phases || []).forEach((phase) => {
        (phase.tasks || []).forEach(visitTask);
    });

    return flattened;
}

export default function EditTaskModal({ task, projectDetail = null, allMembers = [], onClose, onTaskUpdated }) {
    const [form, setForm] = useState({
        title: '',
        description: '',
        status: 'NOT_STARTED',
        priority: 'MEDIUM',
        difficulty: 'MEDIUM',
        startDate: '',
        dueDate: '',
        estimatedHours: '',
        actualHours: '',
        assigneeIds: [],
    });
    const [loading, setLoading] = useState(false);
    const [actionLoading, setActionLoading] = useState(false);
    const [error, setError] = useState('');
    const [taskDetail, setTaskDetail] = useState(task);
    const [dependencyTaskId, setDependencyTaskId] = useState('');
    const [dependencyType, setDependencyType] = useState('FINISH_TO_START');

    useEffect(() => {
        if (task) {
            setForm({
                title: task.title || '',
                description: task.description || '',
                status: task.status || 'NOT_STARTED',
                priority: task.priority || 'MEDIUM',
                difficulty: task.difficulty || 'MEDIUM',
                startDate: task.startDate ? task.startDate.slice(0, 10) : '',
                dueDate: task.dueDate ? task.dueDate.slice(0, 10) : '',
                estimatedHours: task.estimatedHours ?? '',
                actualHours: task.actualHours ?? '',
                assigneeIds: (task.assignments || []).map((a) => a.member?.id ?? a.memberId).filter(Boolean),
            });
        }
    }, [task]);

    useEffect(() => {
        if (!task?.id) return;

        let cancelled = false;

        const loadTaskDetail = async () => {
            try {
                const detailedTask = await tasksAPI.getById(task.id);
                if (cancelled) return;
                setTaskDetail(detailedTask);
            } catch (err) {
                if (!cancelled) {
                    setError(err.message || 'Failed to load task details');
                }
            }
        };

        loadTaskDetail();

        return () => {
            cancelled = true;
        };
    }, [task?.id]);

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

    const refreshTaskDetail = async () => {
        if (!task?.id) return;
        const detailedTask = await tasksAPI.getById(task.id);
        setTaskDetail(detailedTask);
        return detailedTask;
    };

    const handleAddDependency = async () => {
        if (!dependencyTaskId) return;
        setActionLoading(true);
        setError('');
        try {
            await tasksAPI.addDependency(task.id, dependencyTaskId, dependencyType);
            setDependencyTaskId('');
            setDependencyType('FINISH_TO_START');
            await refreshTaskDetail();
        } catch (err) {
            setError(err.message || 'Failed to add dependency');
        } finally {
            setActionLoading(false);
        }
    };

    const handleRemoveDependency = async (dependsOnTaskId) => {
        setActionLoading(true);
        setError('');
        try {
            await tasksAPI.removeDependency(task.id, dependsOnTaskId);
            await refreshTaskDetail();
        } catch (err) {
            setError(err.message || 'Failed to remove dependency');
        } finally {
            setActionLoading(false);
        }
    };

    const handleSubmit = async () => {
        if (!form.title.trim()) { setError('Title is required'); return; }
        setLoading(true);
        setError('');
        try {
            const payload = {
                title: form.title.trim(),
                description: form.description.trim() || null,
                status: form.status,
                priority: form.priority,
                difficulty: form.difficulty,
                startDate: form.startDate || null,
                dueDate: form.dueDate || null,
                estimatedHours: form.estimatedHours !== '' ? parseFloat(form.estimatedHours) : null,
                actualHours: form.actualHours !== '' ? parseFloat(form.actualHours) : null,
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
    const currentTask = taskDetail || task;
    const projectTasks = flattenProjectTasks(projectDetail).filter((candidate) => candidate.id !== task?.id);
    const dependencies = currentTask?.dependencies || [];
    const dependsOn = currentTask?.dependsOn || [];
    const canManageTask = currentTask?.canEdit ?? task?.canEdit ?? true;

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
                                <label className="form-label">Status</label>
                                <select className="form-input" value={form.status} onChange={setField('status')}>
                                    {STATUSES.map((s) => (
                                        <option key={s} value={s}>{STATUS_LABELS[s]}</option>
                                    ))}
                                </select>
                            </div>
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

                        <div className="form-row">
                            <div className="form-group">
                                <label className="form-label">Start Date</label>
                                <input
                                    type="date"
                                    className="form-input"
                                    value={form.startDate}
                                    onChange={setField('startDate')}
                                />
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

                        <div className="form-row">
                            <div className="form-group">
                                <label className="form-label">Estimated Hours</label>
                                <input
                                    type="number"
                                    className="form-input"
                                    placeholder="0"
                                    min="0"
                                    step="0.5"
                                    value={form.estimatedHours}
                                    onChange={setField('estimatedHours')}
                                />
                            </div>
                            <div className="form-group">
                                <label className="form-label">Actual Hours</label>
                                <input
                                    type="number"
                                    className="form-input"
                                    placeholder="0"
                                    min="0"
                                    step="0.5"
                                    value={form.actualHours}
                                    onChange={setField('actualHours')}
                                />
                            </div>
                        </div>
                    </div>

                    <div className="form-section">
                        <h3 className="form-section-title">Dependencies</h3>

                        <div className="form-row">
                            <div className="form-group">
                                <label className="form-label">Depends on</label>
                                {projectDetail ? (
                                    <select
                                        className="form-input"
                                        value={dependencyTaskId}
                                        onChange={(e) => setDependencyTaskId(e.target.value)}
                                    >
                                        <option value="">Select a task</option>
                                        {projectTasks.map((candidate) => (
                                            <option key={candidate.id} value={candidate.id}>
                                                {candidate.title}
                                            </option>
                                        ))}
                                    </select>
                                ) : (
                                    <input
                                        className="form-input"
                                        type="number"
                                        min="1"
                                        placeholder="Task ID"
                                        value={dependencyTaskId}
                                        onChange={(e) => setDependencyTaskId(e.target.value)}
                                    />
                                )}
                            </div>
                            <div className="form-group">
                                <label className="form-label">Dependency Type</label>
                                <select
                                    className="form-input"
                                    value={dependencyType}
                                    onChange={(e) => setDependencyType(e.target.value)}
                                >
                                    <option value="FINISH_TO_START">Finish to Start</option>
                                    <option value="START_TO_START">Start to Start</option>
                                </select>
                            </div>
                        </div>

                        <button className="btn btn-secondary" type="button" onClick={handleAddDependency} disabled={!canManageTask || !dependencyTaskId || actionLoading}>
                            <Link2 size={14} />
                            Add Dependency
                        </button>

                        <div style={{ display: 'grid', gap: '0.9rem', marginTop: '1rem' }}>
                            <div>
                                <p className="form-hint" style={{ marginBottom: '0.45rem' }}>This task depends on</p>
                                {dependencies.length > 0 ? dependencies.map((dependency) => (
                                    <div
                                        key={dependency.id}
                                        style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0.75rem', padding: '0.6rem 0.75rem', border: '1px solid var(--gray-200)', borderRadius: 'var(--radius-sm)', marginBottom: '0.45rem' }}
                                    >
                                        <div>
                                            <strong>{dependency.dependsOnTask?.title ?? 'Unknown task'}</strong>
                                            <div className="form-hint" style={{ margin: 0 }}>{dependency.dependencyType}</div>
                                        </div>
                                        <button className="btn btn-secondary" type="button" onClick={() => handleRemoveDependency(dependency.dependsOnTask?.id)} disabled={!canManageTask || actionLoading}>
                                            <Trash2 size={13} />
                                            Remove
                                        </button>
                                    </div>
                                )) : (
                                    <p className="form-hint">No prerequisites set.</p>
                                )}
                            </div>

                            <div>
                                <p className="form-hint" style={{ marginBottom: '0.45rem' }}>Tasks depending on this task</p>
                                {dependsOn.length > 0 ? dependsOn.map((dependency) => (
                                    <div
                                        key={dependency.id}
                                        style={{ padding: '0.6rem 0.75rem', border: '1px solid var(--gray-200)', borderRadius: 'var(--radius-sm)', marginBottom: '0.45rem' }}
                                    >
                                        <strong>{dependency.task?.title ?? 'Unknown task'}</strong>
                                        <div className="form-hint" style={{ margin: 0 }}>{dependency.dependencyType}</div>
                                    </div>
                                )) : (
                                    <p className="form-hint">No tasks depend on this one yet.</p>
                                )}
                            </div>
                        </div>
                    </div>

                    <div className="form-section">
                        <h3 className="form-section-title">Assignees</h3>
                        {allMembers.length > 0 ? (
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
                        ) : (
                            <p className="form-hint">No members available.</p>
                        )}
                    </div>
                </div>

                <div className="modal-footer">
                    <button className="btn btn-secondary" type="button" onClick={onClose} disabled={loading || actionLoading}>
                        Cancel
                    </button>
                    <button className="btn btn-primary" type="button" onClick={handleSubmit} disabled={loading || actionLoading}>
                        {loading ? 'Saving…' : 'Save Changes'}
                    </button>
                </div>
            </div>
        </>
    );
}
