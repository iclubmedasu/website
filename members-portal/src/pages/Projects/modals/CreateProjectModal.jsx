import { useState, useEffect } from 'react';
import { X } from 'lucide-react';
import { projectsAPI, projectTypesAPI } from '../../../services/api';
import './CreateProjectModal.css';

const PROJECT_STATUSES = ['NOT_STARTED', 'IN_PROGRESS', 'COMPLETED', 'ON_HOLD', 'CANCELLED'];
const PRIORITIES = ['LOW', 'MEDIUM', 'HIGH', 'URGENT'];

const STATUS_LABELS = {
    NOT_STARTED: 'Not Started',
    IN_PROGRESS: 'In Progress',
    COMPLETED: 'Completed',
    ON_HOLD: 'On Hold',
    CANCELLED: 'Cancelled',
    DELAYED: 'Delayed',
    BLOCKED: 'Blocked',
};

const PRIORITY_LABELS = {
    LOW: 'Low',
    MEDIUM: 'Medium',
    HIGH: 'High',
    URGENT: 'Urgent',
};

export default function ProjectModal({ mode = 'create', initial = null, allTeams, onClose, onSaved }) {
    const [form, setForm] = useState({
        title: initial?.title ?? '',
        description: initial?.description ?? '',
        projectTypeId: initial?.projectTypeId ? String(initial.projectTypeId) : '',
        priority: initial?.priority ?? 'MEDIUM',
        status: initial?.status ?? 'NOT_STARTED',
        startDate: initial?.startDate ? initial.startDate.split('T')[0] : '',
        dueDate: initial?.dueDate ? initial.dueDate.split('T')[0] : '',
        teamIds: initial?.projectTeams?.map((pt) => ({ teamId: pt.team.id, canEdit: pt.canEdit, isOwner: pt.isOwner })) ?? [],
    });
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');

    // Project types cascade
    const [projectTypes, setProjectTypes] = useState([]);
    const [selectedCategory, setSelectedCategory] = useState('');

    useEffect(() => {
        projectTypesAPI.getAll().then((types) => {
            setProjectTypes(types);
            // Pre-select category when editing an existing project
            if (initial?.projectTypeId) {
                const match = types.find((t) => t.id === initial.projectTypeId);
                if (match) setSelectedCategory(match.category);
            }
        }).catch(() => { });
    }, []);

    // Derived: unique ordered categories
    const categories = [...new Set(projectTypes.map((t) => t.category))];

    // Derived: types filtered by selected category
    const filteredTypes = selectedCategory
        ? projectTypes.filter((t) => t.category === selectedCategory)
        : projectTypes;

    const handleCategoryChange = (e) => {
        const cat = e.target.value;
        setSelectedCategory(cat);
        // Clear type selection if the current one doesn't belong to the new category
        const stillValid = projectTypes.some((t) => String(t.id) === form.projectTypeId && t.category === cat);
        if (!stillValid) setForm((f) => ({ ...f, projectTypeId: '' }));
    };

    const setField = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));

    const toggleTeam = (teamId) => {
        setForm((f) => {
            const exists = f.teamIds.find((t) => t.teamId === teamId);
            if (exists) return { ...f, teamIds: f.teamIds.filter((t) => t.teamId !== teamId) };
            return { ...f, teamIds: [...f.teamIds, { teamId, canEdit: true, isOwner: false }] };
        });
    };

    const handleSubmit = async () => {
        if (!form.title.trim()) { setError('Title is required'); return; }
        if (!form.projectTypeId) { setError('Please select a project type'); return; }
        setLoading(true); setError('');
        try {
            const payload = {
                title: form.title.trim(),
                description: form.description.trim() || null,
                projectTypeId: parseInt(form.projectTypeId),
                priority: form.priority,
                status: form.status,
                startDate: form.startDate || null,
                dueDate: form.dueDate || null,
                teamIds: form.teamIds,
            };

            const saved = mode === 'create'
                ? await projectsAPI.create(payload)
                : await projectsAPI.update(initial.id, payload);

            onSaved(saved);
            onClose();
        } catch (err) {
            setError(err.message || 'Failed to save project');
        } finally {
            setLoading(false);
        }
    };

    return (
        <>
            <div className="modal-backdrop" onClick={onClose} />
            <div className="modal-container modal-large">
                <div className="modal-header">
                    <h2 className="modal-title">
                        {mode === 'create' ? 'Create Project' : 'Edit Project'}
                    </h2>
                    <button className="modal-close-btn" type="button" onClick={onClose} aria-label="Close">
                        <X />
                    </button>
                </div>

                <div className="modal-body">
                    {error && <div className="error-message">{error}</div>}

                    {/* ── Section 1: Project Info ── */}
                    <div className="form-section">
                        <h3 className="form-section-title">Project Info</h3>

                        <div className="form-group">
                            <label className="form-label">Title *</label>
                            <input
                                className="form-input"
                                placeholder="Project title"
                                value={form.title}
                                onChange={setField('title')}
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

                    {/* ── Section 2: Details ── */}
                    <div className="form-section">
                        <h3 className="form-section-title">Details</h3>

                        {/* Row 1: Category | Type */}
                        <div className="form-row">
                            <div className="form-group">
                                <label className="form-label">Category</label>
                                <select
                                    className="form-input"
                                    value={selectedCategory}
                                    onChange={handleCategoryChange}
                                >
                                    <option value="">All categories</option>
                                    {categories.map((cat) => (
                                        <option key={cat} value={cat}>{cat}</option>
                                    ))}
                                </select>
                            </div>
                            <div className="form-group">
                                <label className="form-label">Type</label>
                                <select
                                    className="form-input"
                                    value={form.projectTypeId}
                                    onChange={setField('projectTypeId')}
                                    disabled={filteredTypes.length === 0}
                                >
                                    <option value="">Select type…</option>
                                    {filteredTypes.map((t) => (
                                        <option key={t.id} value={t.id}>{t.name}</option>
                                    ))}
                                </select>
                            </div>
                        </div>

                        {/* Row 2: Priority | Status */}
                        <div className="form-row">
                            <div className="form-group">
                                <label className="form-label">Priority</label>
                                <select className="form-input" value={form.priority} onChange={setField('priority')}>
                                    {PRIORITIES.map((p) => <option key={p} value={p}>{PRIORITY_LABELS[p]}</option>)}
                                </select>
                            </div>
                            <div className="form-group">
                                <label className="form-label">Status</label>
                                <select className="form-input" value={form.status} onChange={setField('status')}>
                                    {PROJECT_STATUSES.map((s) => <option key={s} value={s}>{STATUS_LABELS[s]}</option>)}
                                </select>
                            </div>
                        </div>

                        {/* Row 3: Start Date | Due Date */}
                        <div className="form-row">
                            <div className="form-group">
                                <label className="form-label">Start Date</label>
                                <input type="date" className="form-input" value={form.startDate} onChange={setField('startDate')} />
                            </div>
                            <div className="form-group">
                                <label className="form-label">Due Date</label>
                                <input type="date" className="form-input" value={form.dueDate} onChange={setField('dueDate')} />
                            </div>
                        </div>
                    </div>

                    {/* ── Section 3: Teams ── */}
                    {allTeams.length > 0 && (
                        <div className="form-section">
                            <h3 className="form-section-title">Teams</h3>
                            <div className="team-badge-picker">
                                {allTeams.map((t) => {
                                    const selected = form.teamIds.some((x) => x.teamId === t.id);
                                    return (
                                        <button
                                            key={t.id}
                                            type="button"
                                            className={`team-badge-option${selected ? ' team-badge-option--selected' : ''}`}
                                            onClick={() => toggleTeam(t.id)}
                                        >
                                            {t.name}
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
                        {loading ? 'Saving…' : mode === 'create' ? 'Create Project' : 'Save Changes'}
                    </button>
                </div>
            </div>
        </>
    );
}
