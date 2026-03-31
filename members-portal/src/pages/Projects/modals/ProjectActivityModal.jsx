import { useEffect, useState } from 'react';
import { X, CalendarDays, Clock3, Users } from 'lucide-react';
import { projectsAPI, scheduleSlotsAPI, getProfilePhotoUrl } from '../../../services/api';
import ActivityTimeline from '../../../components/ActivityTimeline';

function formatDateTime(value) {
    if (!value) return '—';
    return new Date(value).toLocaleString();
}

export default function ProjectActivityModal({ project, onClose }) {
    const [activity, setActivity] = useState([]);
    const [slots, setSlots] = useState([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');

    useEffect(() => {
        if (!project?.id) return;

        let cancelled = false;
        const load = async () => {
            try {
                setLoading(true);
                setError('');
                const [activityData, slotsData] = await Promise.all([
                    projectsAPI.getActivity(project.id),
                    scheduleSlotsAPI.getAll({ projectId: project.id, includeInactive: true }),
                ]);

                if (cancelled) return;
                setActivity(Array.isArray(activityData) ? activityData : []);
                setSlots(Array.isArray(slotsData) ? slotsData : []);
            } catch (err) {
                if (!cancelled) setError(err.message || 'Failed to load project activity');
            } finally {
                if (!cancelled) setLoading(false);
            }
        };

        load();

        return () => {
            cancelled = true;
        };
    }, [project?.id]);

    if (!project) return null;

    return (
        <>
            <div className="modal-backdrop" onClick={onClose} />
            <div className="modal-container modal-large project-activity-modal">
                <div className="modal-header">
                    <div>
                        <h2 className="modal-title">Project Activity</h2>
                        <p className="modal-subtitle">{project.title}</p>
                    </div>
                    <button className="modal-close-btn" type="button" onClick={onClose} aria-label="Close">
                        <X />
                    </button>
                </div>

                <div className="modal-body">
                    {loading ? (
                        <div className="empty-state">
                            <p>Loading project history…</p>
                        </div>
                    ) : error ? (
                        <div className="error-message">{error}</div>
                    ) : (
                        <>
                            {/*
                            <div className="form-section">
                                <h3 className="form-section-title">Schedule Snapshot</h3>
                                {slots.length > 0 ? (
                                    <div className="project-slot-grid">
                                        {slots.map((slot) => (
                                            <div key={slot.id} className={`project-slot-card${slot.isActive ? '' : ' project-slot-card--inactive'}`}>
                                                <div className="project-slot-card-header">
                                                    <div className="project-slot-card-title">
                                                        <CalendarDays size={14} />
                                                        <span>{slot.title || (slot.task ? slot.task.title : 'Project Slot')}</span>
                                                    </div>
                                                    <span className="project-slot-state">{slot.isActive ? 'Active' : 'Inactive'}</span>
                                                </div>
                                                <div className="project-slot-card-row">
                                                    <Users size={13} />
                                                    <span>{slot.member?.fullName ?? 'Unknown member'}</span>
                                                    {slot.member?.profilePhotoUrl && (
                                                        <img
                                                            src={getProfilePhotoUrl(slot.member.id)}
                                                            alt={slot.member.fullName}
                                                            className="project-slot-avatar"
                                                        />
                                                    )}
                                                </div>
                                                <div className="project-slot-card-row">
                                                    <Clock3 size={13} />
                                                    <span>{formatDateTime(slot.startDateTime)} → {formatDateTime(slot.endDateTime)}</span>
                                                </div>
                                                {slot.task && (
                                                    <div className="project-slot-task-link">Task: {slot.task.title}</div>
                                                )}
                                                {slot.notes && <p className="project-slot-notes">{slot.notes}</p>}
                                            </div>
                                        ))}
                                    </div>
                                ) : (
                                    <div className="empty-state">
                                        <p>No schedule slots yet.</p>
                                    </div>
                                )}
                            </div>
                            */}

                            <ActivityTimeline
                                title="History"
                                events={activity}
                                emptyMessage="No activity recorded yet."
                                chronology="descending"
                            />
                        </>
                    )}
                </div>
            </div>
        </>
    );
}