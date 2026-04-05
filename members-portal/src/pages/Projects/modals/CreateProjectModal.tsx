import { useEffect, useState, type ChangeEvent } from 'react';
import { X } from 'lucide-react';
import { projectsAPI, projectTypesAPI } from '../../../services/api';
import { toTitleCase } from '../../../utils/titleCase';
import type {
    CreateProjectPayload,
    Id,
    Priority,
    ProjectDetail,
    ProjectStatus,
    ProjectTypeRef,
    TeamRef,
} from '../../../types/backend-contracts';

const PROJECT_STATUSES = ['NOT_STARTED', 'IN_PROGRESS', 'COMPLETED', 'ON_HOLD', 'CANCELLED'] as const;
const PRIORITIES = ['LOW', 'MEDIUM', 'HIGH', 'URGENT'] as const;

type LegacyPriority = (typeof PRIORITIES)[number];

const STATUS_LABELS: Record<ProjectStatus | 'DELAYED' | 'BLOCKED', string> = {
    NOT_STARTED: 'Not Started',
    IN_PROGRESS: 'In Progress',
    COMPLETED: 'Completed',
    ON_HOLD: 'On Hold',
    CANCELLED: 'Cancelled',
    DELAYED: 'Delayed',
    BLOCKED: 'Blocked',
};

const PRIORITY_LABELS: Record<LegacyPriority, string> = {
    LOW: 'Low',
    MEDIUM: 'Medium',
    HIGH: 'High',
    URGENT: 'Urgent',
};

interface TeamSelection {
    teamId: Id;
    canEdit: boolean;
    isOwner: boolean;
}

interface InitialProjectTeam {
    teamId?: Id;
    team?: {
        id: Id;
    } | null;
    canEdit?: boolean;
    isOwner?: boolean;
}

interface ProjectFormState {
    title: string;
    description: string;
    projectTypeId: string;
    priority: LegacyPriority;
    status: ProjectStatus;
    startDate: string;
    dueDate: string;
    teamIds: TeamSelection[];
}

interface ProjectModalProps {
    mode?: 'create' | 'edit';
    initial?: (ProjectDetail & { projectTeams?: InitialProjectTeam[] }) | null;
    allTeams: TeamRef[];
    userTeamIds?: Id[];
    onClose: () => void;
    onSaved: (saved: ProjectDetail) => void;
}

function getErrorMessage(error: unknown, fallback: string): string {
    if (error instanceof Error && error.message) {
        return error.message;
    }
    return fallback;
}

export default function ProjectModal({ mode = 'create', initial = null, allTeams, userTeamIds = [], onClose, onSaved }: ProjectModalProps) {
    // Build initial teamIds: auto-include the creator's teams
    const buildInitialTeamIds = (): TeamSelection[] => {
        if (initial?.projectTeams) {
            const existing = initial.projectTeams
                .flatMap((projectTeam) => {
                    const teamId = projectTeam.team?.id ?? projectTeam.teamId;
                    if (teamId == null) return [];
                    return [{
                        teamId,
                        canEdit: projectTeam.canEdit !== false,
                        isOwner: projectTeam.isOwner === true,
                    }];
                });

            // Ensure user's teams are always present (even for older projects)
            const existingIds = new Set(existing.map((team) => team.teamId));
            const missing = userTeamIds.filter((teamId) => !existingIds.has(teamId));
            return [...existing, ...missing.map((teamId) => ({ teamId, canEdit: true, isOwner: false }))];
        }
        return userTeamIds.map((teamId) => ({ teamId, canEdit: true, isOwner: false }));
    };

    const [form, setForm] = useState<ProjectFormState>({
        title: initial?.title ?? '',
        description: initial?.description ?? '',
        projectTypeId: initial?.projectTypeId != null ? String(initial.projectTypeId) : '',
        priority: (initial?.priority as LegacyPriority | undefined) ?? 'MEDIUM',
        status: initial?.status ?? 'NOT_STARTED',
        startDate: initial?.startDate ? initial.startDate.split('T')[0] : '',
        dueDate: initial?.dueDate ? initial.dueDate.split('T')[0] : '',
        teamIds: buildInitialTeamIds(),
    });
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');

    // Project types cascade
    const [projectTypes, setProjectTypes] = useState<ProjectTypeRef[]>([]);
    const [selectedCategory, setSelectedCategory] = useState('');

    useEffect(() => {
        projectTypesAPI.getAll()
            .then((types) => {
                setProjectTypes(types);

                // Pre-select category when editing an existing project
                if (initial?.projectTypeId) {
                    const match = types.find((typeItem) => typeItem.id === initial.projectTypeId);
                    if (match?.category) setSelectedCategory(match.category);
                }
            })
            .catch(() => {
                setProjectTypes([]);
            });
    }, [initial?.projectTypeId]);

    // Derived: unique ordered categories
    const categories = [...new Set(
        projectTypes
            .map((typeItem) => typeItem.category)
            .filter((category): category is string => typeof category === 'string' && category.length > 0),
    )];

    // Derived: types filtered by selected category
    const filteredTypes = selectedCategory
        ? projectTypes.filter((typeItem) => typeItem.category === selectedCategory)
        : projectTypes;

    const handleCategoryChange = (e: ChangeEvent<HTMLSelectElement>) => {
        const category = e.target.value;
        setSelectedCategory(category);

        // Clear type selection if the current one doesn't belong to the new category
        const stillValid = projectTypes.some(
            (typeItem) => String(typeItem.id) === form.projectTypeId && typeItem.category === category,
        );

        if (!stillValid) {
            setForm((current) => ({ ...current, projectTypeId: '' }));
        }
    };

    const setField = (key: keyof Omit<ProjectFormState, 'teamIds'>) =>
        (e: ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
            const value = e.target.value;
            setForm((current) => ({ ...current, [key]: value }));
        };

    const toggleTeam = (teamId: Id) => {
        // Don't allow removing the creator's own teams
        if (userTeamIds.includes(teamId)) return;

        setForm((current) => {
            const exists = current.teamIds.find((team) => team.teamId === teamId);
            if (exists) {
                return { ...current, teamIds: current.teamIds.filter((team) => team.teamId !== teamId) };
            }
            return { ...current, teamIds: [...current.teamIds, { teamId, canEdit: true, isOwner: false }] };
        });
    };

    const handleSubmit = async () => {
        if (!form.title.trim()) {
            setError('Title is required');
            return;
        }

        if (!form.projectTypeId) {
            setError('Please select a project type');
            return;
        }

        setLoading(true);
        setError('');

        try {
            const normalizedPriority: Priority = form.priority === 'URGENT' ? 'CRITICAL' : form.priority;

            const payload: CreateProjectPayload = {
                title: form.title.trim(),
                description: form.description.trim() || null,
                projectTypeId: parseInt(form.projectTypeId, 10),
                priority: normalizedPriority,
                status: form.status,
                startDate: form.startDate || null,
                dueDate: form.dueDate || null,
                teamIds: form.teamIds,
            };

            const saved = mode === 'create'
                ? await projectsAPI.create(payload)
                : await projectsAPI.update(initial?.id ?? 0, payload);

            onSaved(saved);
            onClose();
        } catch (err: unknown) {
            setError(getErrorMessage(err, 'Failed to save project'));
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

                    {/* Section 1: Project Info */}
                    <div className="form-section">
                        <h3 className="form-section-title">Project Info</h3>

                        <div className="form-group">
                            <label className="form-label">Title *</label>
                            <input
                                className="form-input"
                                placeholder="Project title"
                                value={form.title}
                                onChange={setField('title')}
                                onBlur={(e) => setForm((current) => ({ ...current, title: toTitleCase(e.target.value) }))}
                                autoFocus
                            />
                        </div>

                        <div className="form-group">
                            <label className="form-label">Description</label>
                            <textarea
                                className="form-input form-textarea"
                                placeholder="Optional description..."
                                value={form.description}
                                onChange={setField('description')}
                            />
                        </div>
                    </div>

                    {/* Section 2: Details */}
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
                                    {categories.map((category) => (
                                        <option key={category} value={category}>{category}</option>
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
                                    <option value="">Select type...</option>
                                    {filteredTypes.map((typeItem) => (
                                        <option key={typeItem.id} value={typeItem.id}>{typeItem.name}</option>
                                    ))}
                                </select>
                            </div>
                        </div>

                        {/* Row 2: Priority | Status */}
                        <div className="form-row">
                            <div className="form-group">
                                <label className="form-label">Priority</label>
                                <select className="form-input" value={form.priority} onChange={setField('priority')}>
                                    {PRIORITIES.map((priority) => <option key={priority} value={priority}>{PRIORITY_LABELS[priority]}</option>)}
                                </select>
                            </div>
                            <div className="form-group">
                                <label className="form-label">Status</label>
                                <select className="form-input" value={form.status} onChange={setField('status')}>
                                    {PROJECT_STATUSES.map((status) => <option key={status} value={status}>{STATUS_LABELS[status]}</option>)}
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

                    {/* Section 3: Teams */}
                    {allTeams.length > 0 && (
                        <div className="form-section">
                            <h3 className="form-section-title">Teams</h3>
                            {userTeamIds.length > 0 && (
                                <p className="form-hint-text">Your team{userTeamIds.length > 1 ? 's are' : ' is'} automatically included and cannot be removed.</p>
                            )}
                            <div className="team-badge-picker">
                                {allTeams.map((team) => {
                                    const selected = form.teamIds.some((teamSelection) => teamSelection.teamId === team.id);
                                    const locked = userTeamIds.includes(team.id);
                                    return (
                                        <button
                                            key={team.id}
                                            type="button"
                                            className={`team-badge-option${selected ? ' team-badge-option--selected' : ''}${locked ? ' team-badge-option--locked' : ''}`}
                                            onClick={() => toggleTeam(team.id)}
                                            title={locked ? 'Your team - required' : undefined}
                                        >
                                            {team.name}
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
                        {loading ? 'Saving...' : mode === 'create' ? 'Create Project' : 'Save Changes'}
                    </button>
                </div>
            </div>
        </>
    );
}
