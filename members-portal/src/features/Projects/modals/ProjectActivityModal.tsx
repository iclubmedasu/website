'use client';

import { useEffect, useState } from 'react';
import { X } from 'lucide-react';
import { projectsAPI } from '../../../services/api';
import ActivityTimeline from '../../../components/ActivityTimeline/ActivityTimeline';
import type { ProjectActivityEntry, ProjectSummary } from '../../../types/backend-contracts';

interface ProjectActivityModalProject extends ProjectSummary {
    name?: string | null;
}

interface ProjectActivityModalProps {
    project: ProjectActivityModalProject | null;
    onClose: () => void;
}

function getErrorMessage(error: unknown): string {
    if (error instanceof Error && error.message) {
        return error.message;
    }
    return 'Failed to load project activity';
}

export default function ProjectActivityModal({ project, onClose }: ProjectActivityModalProps) {
    const [activity, setActivity] = useState<ProjectActivityEntry[]>([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');

    useEffect(() => {
        if (!project?.id) return;

        let cancelled = false;
        const load = async () => {
            try {
                setLoading(true);
                setError('');
                const activityData = await projectsAPI.getActivity(project.id);

                if (cancelled) return;
                setActivity(Array.isArray(activityData) ? activityData : []);
            } catch (err: unknown) {
                if (!cancelled) {
                    setError(getErrorMessage(err));
                }
            } finally {
                if (!cancelled) setLoading(false);
            }
        };

        void load();

        return () => {
            cancelled = true;
        };
    }, [project?.id]);

    if (!project) return null;

    return (
        <>
            <div className="modal-backdrop" onClick={onClose} />
            <div className="modal-container activity-history-modal project-activity-modal">
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
                    <div className="activity-history-content">
                        {loading ? (
                            <div className="loading-state">
                                <div className="spinner" />
                                <p>Loading project activity…</p>
                            </div>
                        ) : error ? (
                            <div className="error-message">{error}</div>
                        ) : (
                            <ActivityTimeline
                                title="Project History"
                                events={activity}
                                emptyMessage="No project activity yet."
                                chronology="descending"
                                contextEntity={{
                                    label: 'Project',
                                    name: project.title || project.name || 'Untitled project',
                                }}
                            />
                        )}
                    </div>
                </div>
            </div>
        </>
    );
}