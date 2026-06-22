'use client';

import { useEffect, useState, type ChangeEvent } from 'react';
import { useRouter } from 'next/navigation';
import { X } from 'lucide-react';
import { Checkbox } from '@/components/checkbox';
import { eventsAPI, projectsAPI, projectTypesAPI } from '@/services/api';
import { toTitleCase } from '@/utils/titleCase';
import type {
    CreateEventPayload,
    EventDetail,
    Id,
    Priority,
    ProjectStatus,
    ProjectSummary,
    ProjectTypeRef,
    TeamRef,
} from '@/types/backend-contracts';

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

interface CreateEventModalProps {
    mode?: 'create' | 'edit';
    initial?: EventDetail | null;
    allTeams: TeamRef[];
    userTeamIds?: Id[];
    onClose?: () => void;
    onCreated?: (saved: EventDetail) => void;
    onSaved?: (saved: EventDetail) => void;
}

function toDateInput(value: string): string {
    if (!value) return '';
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return '';
    return date.toISOString().slice(0, 16);
}

export default function CreateEventModal({
    mode = 'create',
    initial = null,
    allTeams,
    userTeamIds = [],
    onClose,
    onCreated,
    onSaved,
}: CreateEventModalProps) {
    const router = useRouter();
    const isEdit = mode === 'edit' && !!initial;

    const buildInitialTeamIds = (): TeamSelection[] => {
        if (initial?.eventTeams) {
            const existing = initial.eventTeams.flatMap((eventTeam) => {
                const teamId = eventTeam.team?.id ?? eventTeam.teamId;
                if (teamId == null) return [];
                return [{
                    teamId,
                    canEdit: eventTeam.canEdit !== false,
                    isOwner: eventTeam.isOwner === true,
                }];
            });
            const existingIds = new Set(existing.map((team) => team.teamId));
            const missing = userTeamIds.filter((teamId) => !existingIds.has(teamId));
            return [...existing, ...missing.map((teamId) => ({ teamId, canEdit: true, isOwner: false }))];
        }
        return userTeamIds.map((teamId) => ({ teamId, canEdit: true, isOwner: false }));
    };

    const [projects, setProjects] = useState<ProjectSummary[]>([]);
    const [loadingProjects, setLoadingProjects] = useState(true);
    const [projectTypes, setProjectTypes] = useState<ProjectTypeRef[]>([]);
    const [selectedCategory, setSelectedCategory] = useState('');
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState('');
    const [form, setForm] = useState({
        title: initial?.title ?? '',
        description: initial?.description ?? '',
        projectTypeId: initial?.projectTypeId != null ? String(initial.projectTypeId) : '',
        priority: (initial?.priority as LegacyPriority | undefined) ?? 'MEDIUM',
        status: (initial?.status as ProjectStatus | undefined) ?? 'NOT_STARTED',
        venue: initial?.venue ?? '',
        eventDate: initial?.eventDate ? toDateInput(initial.eventDate) : '',
        eventEndDate: initial?.eventEndDate
            ? toDateInput(initial.eventEndDate)
            : (initial?.eventDate ? toDateInput(initial.eventDate) : ''),
        registrationDeadline: initial?.registrationDeadline ? toDateInput(initial.registrationDeadline) : '',
        capacity: initial?.capacity != null ? String(initial.capacity) : '',
        projectId: initial?.projectId != null ? String(initial.projectId) : '',
        allowWalkIns: initial?.allowWalkIns ?? false,
        isCertifiable: initial?.isCertifiable ?? false,
        teamIds: buildInitialTeamIds(),
    });

    useEffect(() => {
        let active = true;

        const load = async () => {
            try {
                const [projectsResult, typesResult] = await Promise.all([
                    projectsAPI.getAll({ isActive: true, archived: false }),
                    projectTypesAPI.getAll(),
                ]);
                if (!active) return;
                setProjects(projectsResult);
                setProjectTypes(typesResult);
                if (initial?.projectTypeId) {
                    const match = typesResult.find((typeItem) => typeItem.id === initial.projectTypeId);
                    if (match?.category) setSelectedCategory(match.category);
                }
            } catch {
                if (!active) return;
                setProjects([]);
                setProjectTypes([]);
            } finally {
                if (active) setLoadingProjects(false);
            }
        };

        void load();
        return () => { active = false; };
    }, [initial?.projectTypeId]);

    const categories = [...new Set(
        projectTypes
            .map((typeItem) => typeItem.category)
            .filter((category): category is string => typeof category === 'string' && category.length > 0),
    )];

    const filteredTypes = selectedCategory
        ? projectTypes.filter((typeItem) => typeItem.category === selectedCategory)
        : projectTypes;

    const handleChange = (key: keyof typeof form) => (
        event: ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>,
    ) => {
        const value = event.target.type === 'checkbox'
            ? (event.target as HTMLInputElement).checked
            : event.target.value;
        setForm((current) => ({ ...current, [key]: value }));
    };

    const handleCategoryChange = (event: ChangeEvent<HTMLSelectElement>) => {
        const category = event.target.value;
        setSelectedCategory(category);
        const stillValid = projectTypes.some(
            (typeItem) => String(typeItem.id) === form.projectTypeId && typeItem.category === category,
        );
        if (!stillValid) {
            setForm((current) => ({ ...current, projectTypeId: '' }));
        }
    };

    const toggleTeam = (teamId: Id) => {
        if (userTeamIds.includes(teamId)) return;

        setForm((current) => {
            const exists = current.teamIds.find((team) => team.teamId === teamId);
            if (exists) {
                return { ...current, teamIds: current.teamIds.filter((team) => team.teamId !== teamId) };
            }
            return { ...current, teamIds: [...current.teamIds, { teamId, canEdit: true, isOwner: false }] };
        });
    };

    const handleClose = () => {
        if (onClose) {
            onClose();
            return;
        }
        router.push('/events');
    };

    const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
        event.preventDefault();
        setError('');

        if (!form.title.trim()) {
            setError('Title is required');
            return;
        }

        if (!form.projectTypeId) {
            setError('Please select an event type');
            return;
        }

        if (!form.eventDate) {
            setError('Duration start date is required');
            return;
        }

        const endDateValue = form.eventEndDate || form.eventDate;
        if (new Date(endDateValue).getTime() < new Date(form.eventDate).getTime()) {
            setError('Duration end must be on or after the start date');
            return;
        }

        setSaving(true);
        try {
            const normalizedPriority: Priority = form.priority === 'URGENT' ? 'CRITICAL' : form.priority;

            const payload: CreateEventPayload = {
                title: toTitleCase(form.title.trim()),
                description: form.description.trim() || null,
                venue: form.venue.trim() || null,
                eventDate: form.eventDate,
                eventEndDate: endDateValue,
                registrationDeadline: form.registrationDeadline || null,
                capacity: form.capacity ? Number.parseInt(form.capacity, 10) : null,
                projectId: form.projectId ? Number.parseInt(form.projectId, 10) : null,
                projectTypeId: Number.parseInt(form.projectTypeId, 10),
                priority: normalizedPriority,
                status: form.status,
                teamIds: form.teamIds,
                allowWalkIns: form.allowWalkIns,
                isCertifiable: form.isCertifiable,
            };

            const saved: EventDetail = isEdit && initial
                ? await eventsAPI.update(initial.id, payload)
                : await eventsAPI.create(payload);

            if (onSaved) {
                onSaved(saved);
                return;
            }
            if (onCreated) {
                onCreated(saved);
                return;
            }

            router.push(`/events?event=${saved.id}`);
        } catch (saveError) {
            setError(saveError instanceof Error ? saveError.message : `Failed to ${isEdit ? 'update' : 'create'} event`);
        } finally {
            setSaving(false);
        }
    };

    return (
        <>
            <div className="modal-backdrop" onClick={handleClose} />
            <div className="modal-container">
                <div className="modal-header">
                    <div className="modal-header-content">
                        <div>
                            <h2 className="modal-title">{isEdit ? 'Edit Event' : 'Create Event'}</h2>
                        </div>
                    </div>
                    <button className="modal-close-btn" type="button" onClick={handleClose} aria-label="Close">
                        <X />
                    </button>
                </div>

                <form onSubmit={handleSubmit}>
                    <div className="modal-body">
                        {error && <div className="error-message">{error}</div>}

                        <div className="form-section">
                            <h3 className="form-section-title">Event Info</h3>

                            <div className="form-group">
                                <label className="form-label" htmlFor="event-title">Title *</label>
                                <input
                                    id="event-title"
                                    className="form-input"
                                    value={form.title}
                                    onChange={handleChange('title')}
                                    onBlur={(e) => setForm((current) => ({ ...current, title: toTitleCase(e.target.value) }))}
                                    placeholder="Event title"
                                    autoFocus
                                />
                            </div>

                            <div className="form-group">
                                <label className="form-label" htmlFor="event-description">Description</label>
                                <textarea
                                    id="event-description"
                                    className="form-input form-textarea"
                                    value={form.description}
                                    onChange={handleChange('description')}
                                    placeholder="Short description for organizers and attendees"
                                />
                            </div>
                        </div>

                        <div className="form-section">
                            <h3 className="form-section-title">Details</h3>

                            <div className="form-row">
                                <div className="form-group">
                                    <label className="form-label" htmlFor="event-category">Category</label>
                                    <select
                                        id="event-category"
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
                                    <label className="form-label" htmlFor="event-type">Type *</label>
                                    <select
                                        id="event-type"
                                        className="form-input"
                                        value={form.projectTypeId}
                                        onChange={handleChange('projectTypeId')}
                                        disabled={filteredTypes.length === 0}
                                    >
                                        <option value="">Select type...</option>
                                        {filteredTypes.map((typeItem) => (
                                            <option key={typeItem.id} value={typeItem.id}>{typeItem.name}</option>
                                        ))}
                                    </select>
                                </div>
                            </div>

                            <div className="form-row">
                                <div className="form-group">
                                    <label className="form-label" htmlFor="event-priority">Priority</label>
                                    <select id="event-priority" className="form-input" value={form.priority} onChange={handleChange('priority')}>
                                        {PRIORITIES.map((priority) => (
                                            <option key={priority} value={priority}>{PRIORITY_LABELS[priority]}</option>
                                        ))}
                                    </select>
                                </div>
                                <div className="form-group">
                                    <label className="form-label" htmlFor="event-status">Status</label>
                                    <select id="event-status" className="form-input" value={form.status} onChange={handleChange('status')}>
                                        {PROJECT_STATUSES.map((status) => (
                                            <option key={status} value={status}>{STATUS_LABELS[status]}</option>
                                        ))}
                                    </select>
                                </div>
                            </div>
                        </div>

                        <div className="form-section">
                            <h3 className="form-section-title">Scheduling</h3>

                            <div className="form-row">
                                <div className="form-group">
                                    <label className="form-label" htmlFor="event-start-date">Duration start *</label>
                                    <input
                                        id="event-start-date"
                                        type="datetime-local"
                                        className="form-input"
                                        value={toDateInput(form.eventDate)}
                                        onChange={handleChange('eventDate')}
                                    />
                                </div>

                                <div className="form-group">
                                    <label className="form-label" htmlFor="event-end-date">Duration end *</label>
                                    <input
                                        id="event-end-date"
                                        type="datetime-local"
                                        className="form-input"
                                        value={toDateInput(form.eventEndDate || form.eventDate)}
                                        onChange={handleChange('eventEndDate')}
                                    />
                                </div>
                            </div>

                            <div className="form-row">
                                <div className="form-group">
                                    <label className="form-label" htmlFor="event-venue">Venue</label>
                                    <input
                                        id="event-venue"
                                        className="form-input"
                                        value={form.venue}
                                        onChange={handleChange('venue')}
                                        placeholder="Hall, room, or location"
                                    />
                                </div>

                                <div className="form-group">
                                    <label className="form-label" htmlFor="event-deadline">Registration deadline</label>
                                    <input
                                        id="event-deadline"
                                        type="datetime-local"
                                        className="form-input"
                                        value={toDateInput(form.registrationDeadline)}
                                        onChange={handleChange('registrationDeadline')}
                                    />
                                </div>
                            </div>

                            <div className="form-row">
                                <div className="form-group">
                                    <label className="form-label" htmlFor="event-capacity">Capacity</label>
                                    <input
                                        id="event-capacity"
                                        type="number"
                                        min="0"
                                        className="form-input"
                                        value={form.capacity}
                                        onChange={handleChange('capacity')}
                                        placeholder="Optional"
                                    />
                                </div>
                            </div>
                        </div>

                        <div className="form-section">
                            <h3 className="form-section-title">Options</h3>

                            <div className="form-group">
                                <label className="form-label" htmlFor="event-project">Linked Project</label>
                                <select
                                    id="event-project"
                                    className="form-input"
                                    value={form.projectId}
                                    onChange={handleChange('projectId')}
                                    disabled={loadingProjects}
                                >
                                    <option value="">No project linked</option>
                                    {projects.map((project) => (
                                        <option key={project.id} value={project.id}>{project.title}</option>
                                    ))}
                                </select>
                            </div>

                            <div className="form-row">
                                <label className="toggle-field">
                                    <Checkbox checked={form.allowWalkIns} onChange={handleChange('allowWalkIns')} />
                                    <span>
                                        <strong>Allow walk-ins</strong>
                                        <small>Organizers can add attendees at the door on event days only.</small>
                                    </span>
                                </label>

                                <label className="toggle-field">
                                    <Checkbox checked={form.isCertifiable} onChange={handleChange('isCertifiable')} />
                                    <span>
                                        <strong>Certifiable event</strong>
                                        <small>Mark attendance for certificate or recognition tracking.</small>
                                    </span>
                                </label>
                            </div>
                        </div>

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
                        <button className="btn btn-secondary" type="button" onClick={handleClose} disabled={saving}>
                            Cancel
                        </button>
                        <button className="btn btn-primary" type="submit" disabled={saving}>
                            {saving ? 'Saving...' : isEdit ? 'Save Event' : 'Create Event'}
                        </button>
                    </div>
                </form>
            </div>
        </>
    );
}
