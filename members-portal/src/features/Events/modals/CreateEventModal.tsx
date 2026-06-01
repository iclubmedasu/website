'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { X } from 'lucide-react';
import { eventsAPI, projectsAPI } from '@/services/api';
import type { CreateEventPayload, EventDetail, ProjectSummary } from '@/types/backend-contracts';
import './CreateEventModal.css';

interface CreateEventModalProps {
    onClose?: () => void;
    onCreated?: () => void;
}

function toDateInput(value: string): string {
    if (!value) return '';
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return '';
    return date.toISOString().slice(0, 16);
}

export default function CreateEventModal({ onClose, onCreated }: CreateEventModalProps) {
    const router = useRouter();
    const [projects, setProjects] = useState<ProjectSummary[]>([]);
    const [loadingProjects, setLoadingProjects] = useState(true);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState('');
    const [form, setForm] = useState({
        title: '',
        description: '',
        venue: '',
        eventDate: '',
        registrationDeadline: '',
        capacity: '',
        projectId: '',
        allowWalkIns: false,
        isCertifiable: false,
    });

    useEffect(() => {
        let active = true;

        const loadProjects = async () => {
            try {
                const result = await projectsAPI.getAll({ isActive: true, archived: false });
                if (active) {
                    setProjects(result);
                }
            } catch {
                if (active) {
                    setProjects([]);
                }
            } finally {
                if (active) {
                    setLoadingProjects(false);
                }
            }
        };

        void loadProjects();

        return () => {
            active = false;
        };
    }, []);

    const handleChange = (key: keyof typeof form) => (
        event: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>,
    ) => {
        const value = event.target.type === 'checkbox'
            ? (event.target as HTMLInputElement).checked
            : event.target.value;
        setForm((current) => ({ ...current, [key]: value }));
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

        if (!form.eventDate) {
            setError('Event date is required');
            return;
        }

        setSaving(true);
        try {
            const payload: CreateEventPayload = {
                title: form.title.trim(),
                description: form.description.trim() || null,
                venue: form.venue.trim() || null,
                eventDate: form.eventDate,
                registrationDeadline: form.registrationDeadline || null,
                capacity: form.capacity ? Number.parseInt(form.capacity, 10) : null,
                projectId: form.projectId ? Number.parseInt(form.projectId, 10) : null,
                allowWalkIns: form.allowWalkIns,
                isCertifiable: form.isCertifiable,
            };

            const saved: EventDetail = await eventsAPI.create(payload);
            if (onCreated) {
                onCreated();
                handleClose();
                return;
            }

            router.push(`/events/${saved.id}`);
        } catch (saveError) {
            setError(saveError instanceof Error ? saveError.message : 'Failed to create event');
        } finally {
            setSaving(false);
        }
    };

    return (
        <>
            <div className="modal-backdrop" onClick={handleClose} />
            <div className="modal-container event-create-modal">
                <div className="modal-header">
                    <div className="modal-header-content">
                        <div>
                            <h2 className="modal-title">Create Event</h2>
                            <p className="modal-subtitle">Draft a new club event, link it to a project, and open registration later.</p>
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
                                    <label className="form-label" htmlFor="event-date">Event Date *</label>
                                    <input
                                        id="event-date"
                                        type="datetime-local"
                                        className="form-input"
                                        value={toDateInput(form.eventDate)}
                                        onChange={handleChange('eventDate')}
                                    />
                                </div>
                            </div>

                            <div className="form-row">
                                <div className="form-group">
                                    <label className="form-label" htmlFor="event-deadline">Registration Deadline</label>
                                    <input
                                        id="event-deadline"
                                        type="datetime-local"
                                        className="form-input"
                                        value={toDateInput(form.registrationDeadline)}
                                        onChange={handleChange('registrationDeadline')}
                                    />
                                </div>

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
                            <h3 className="form-section-title">Details</h3>

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
                                    <input type="checkbox" checked={form.allowWalkIns} onChange={handleChange('allowWalkIns')} />
                                    <span>
                                        <strong>Allow walk-ins</strong>
                                        <small>Organizers can add attendees at the door.</small>
                                    </span>
                                </label>

                                <label className="toggle-field">
                                    <input type="checkbox" checked={form.isCertifiable} onChange={handleChange('isCertifiable')} />
                                    <span>
                                        <strong>Certifiable event</strong>
                                        <small>Mark attendance for certificate or recognition tracking.</small>
                                    </span>
                                </label>
                            </div>
                        </div>
                    </div>

                    <div className="modal-footer">
                        <button className="btn btn-secondary" type="button" onClick={handleClose} disabled={saving}>
                            Cancel
                        </button>
                        <button className="btn btn-primary" type="submit" disabled={saving}>
                            {saving ? 'Saving...' : 'Create Event'}
                        </button>
                    </div>
                </form>
            </div>
        </>
    );
}
