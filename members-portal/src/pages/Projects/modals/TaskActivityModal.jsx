import { useEffect, useState } from 'react';
import { X } from 'lucide-react';
import { tasksAPI } from '../../../services/api';
import ActivityTimeline from '../../../components/ActivityTimeline/ActivityTimeline';

export default function TaskActivityModal({ task, onClose }) {
    const [events, setEvents] = useState([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');

    const loadActivity = async () => {
        if (!task?.id) return;
        try {
            setLoading(true);
            setError('');
            const data = await tasksAPI.getActivity(task.id);
            setEvents(Array.isArray(data) ? data : []);
        } catch (err) {
            setError(err.message || 'Failed to load activity');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        loadActivity();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [task?.id]);

    if (!task) return null;

    return (
        <>
            <div className="modal-backdrop" onClick={onClose} />
            <div className="modal-container modal-large activity-history-modal">
                <div className="modal-header">
                    <div>
                        <h2 className="modal-title">Task Activity</h2>
                        <p className="modal-subtitle">{task.title}</p>
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
                                <p>Loading task activity…</p>
                            </div>
                        ) : error ? (
                            <div className="error-message">{error}</div>
                        ) : (
                            <ActivityTimeline
                                title="Task History"
                                events={events}
                                emptyMessage="No task activity yet."
                                chronology="descending"
                                contextEntity={{
                                    label: task.parentTaskId ? 'Subtask' : 'Task',
                                    name: task.title || task.name || 'Untitled task',
                                }}
                            />
                        )}
                    </div>
                </div>
            </div>
        </>
    );
}
