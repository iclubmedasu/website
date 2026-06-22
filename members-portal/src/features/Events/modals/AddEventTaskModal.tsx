'use client';

import { useMemo, useState } from 'react';
import { Plus, X, Trash2 } from 'lucide-react';
import { eventsAPI } from '@/services/api';
import QuarterHourTimeSelect from '@/features/Events/components/QuarterHourTimeSelect';
import {
    formatTimeFromDate,
    isQuarterHourTime,
} from '@/features/Events/components/eventTaskTimeUtils';
import type {
    CreateEventTaskPayload,
    EventTaskAssignmentInput,
    EventTaskRef,
    Id,
    MemberSummary,
} from '@/types/backend-contracts';

interface AssigneeRow {
    memberId: string;
    startTime: string;
    endTime: string;
}

interface AddEventTaskModalProps {
    eventId: Id | string;
    day?: Date;
    task?: EventTaskRef;
    members: MemberSummary[];
    onClose: () => void;
    onSaved: () => void | Promise<void>;
}

function formatDayLabel(date: Date): string {
    return date.toLocaleDateString([], { weekday: 'long', month: 'short', day: '2-digit', year: 'numeric' });
}

function combineDayTime(day: Date, time: string): string | null {
    if (!time) return null;
    const [hours, minutes] = time.split(':').map((part) => Number.parseInt(part, 10));
    if (Number.isNaN(hours) || Number.isNaN(minutes)) return null;
    const result = new Date(day);
    result.setHours(hours, minutes, 0, 0);
    return result.toISOString();
}

function extractTimeValue(value: string | Date | null | undefined): string {
    return formatTimeFromDate(value);
}

function emptyAssignee(): AssigneeRow {
    return { memberId: '', startTime: '', endTime: '' };
}

function buildInitialState(task?: EventTaskRef, fallbackDay?: Date) {
    if (!task) {
        return {
            day: fallbackDay ?? new Date(),
            title: '',
            description: '',
            location: '',
            leaderId: '',
            leaderStart: '',
            leaderEnd: '',
            assignees: [emptyAssignee()],
        };
    }

    const taskDay = task.taskDate ? new Date(task.taskDate) : (fallbackDay ?? new Date());
    const leaderId = task.leaderId != null ? String(task.leaderId) : '';
    const leaderAssignment = task.assignments?.find(
        (assignment) => leaderId && String(assignment.memberId) === leaderId,
    );
    const assigneeAssignments = (task.assignments ?? []).filter(
        (assignment) => !leaderId || String(assignment.memberId) !== leaderId,
    );

    return {
        day: taskDay,
        title: task.title ?? '',
        description: task.description ?? '',
        location: task.location ?? '',
        leaderId,
        leaderStart: extractTimeValue(leaderAssignment?.startDateTime),
        leaderEnd: extractTimeValue(leaderAssignment?.endDateTime),
        assignees: assigneeAssignments.length > 0
            ? assigneeAssignments.map((assignment) => ({
                memberId: String(assignment.memberId),
                startTime: extractTimeValue(assignment.startDateTime),
                endTime: extractTimeValue(assignment.endDateTime),
            }))
            : [emptyAssignee()],
    };
}

export default function AddEventTaskModal({ eventId, day, task, members, onClose, onSaved }: AddEventTaskModalProps) {
    const isEditMode = task != null;
    const initialState = useMemo(() => buildInitialState(task, day), [task, day]);

    const [title, setTitle] = useState(initialState.title);
    const [description, setDescription] = useState(initialState.description);
    const [location, setLocation] = useState(initialState.location);
    const [leaderId, setLeaderId] = useState(initialState.leaderId);
    const [leaderStart, setLeaderStart] = useState(initialState.leaderStart);
    const [leaderEnd, setLeaderEnd] = useState(initialState.leaderEnd);
    const [assignees, setAssignees] = useState<AssigneeRow[]>(initialState.assignees);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState('');

    const taskDay = initialState.day;

    const updateAssignee = (index: number, patch: Partial<AssigneeRow>) => {
        setAssignees((current) => current.map((row, rowIndex) => (rowIndex === index ? { ...row, ...patch } : row)));
    };

    const buildAssignments = (): { assignments: EventTaskAssignmentInput[]; error?: string } => {
        const assignments: EventTaskAssignmentInput[] = [];
        let assigneeCount = 0;

        if (leaderId) {
            if (leaderStart && !isQuarterHourTime(leaderStart)) {
                return { assignments: [], error: 'Times must use 15-minute intervals (00, 15, 30, 45).' };
            }
            if (leaderEnd && !isQuarterHourTime(leaderEnd)) {
                return { assignments: [], error: 'Times must use 15-minute intervals (00, 15, 30, 45).' };
            }
            const start = combineDayTime(taskDay, leaderStart);
            const end = combineDayTime(taskDay, leaderEnd);
            if (!start || !end) return { assignments: [], error: 'Set a start and end time for the task leader.' };
            if (new Date(end) <= new Date(start)) return { assignments: [], error: 'Leader end time must be after start time.' };
            assignments.push({ memberId: leaderId, startDateTime: start, endDateTime: end });
        }

        for (const row of assignees) {
            if (!row.memberId && !row.startTime && !row.endTime) continue;
            if (!row.memberId) return { assignments: [], error: 'Select a member for each assignee row.' };
            if (row.startTime && !isQuarterHourTime(row.startTime)) {
                return { assignments: [], error: 'Times must use 15-minute intervals (00, 15, 30, 45).' };
            }
            if (row.endTime && !isQuarterHourTime(row.endTime)) {
                return { assignments: [], error: 'Times must use 15-minute intervals (00, 15, 30, 45).' };
            }
            if (String(row.memberId) === String(leaderId)) {
                return { assignments: [], error: 'The leader is already scheduled; remove the duplicate assignee row.' };
            }
            const start = combineDayTime(taskDay, row.startTime);
            const end = combineDayTime(taskDay, row.endTime);
            if (!start || !end) return { assignments: [], error: 'Set a start and end time for every assignee.' };
            if (new Date(end) <= new Date(start)) return { assignments: [], error: 'Assignee end time must be after start time.' };
            assignments.push({ memberId: row.memberId, startDateTime: start, endDateTime: end });
            assigneeCount += 1;
        }

        if (assigneeCount === 0) {
            return { assignments: [], error: 'Add at least one assignee.' };
        }

        return { assignments };
    };

    const handleSave = async () => {
        const trimmedTitle = title.trim();
        const trimmedLocation = location.trim();
        if (!trimmedTitle) {
            setError('Task title is required.');
            return;
        }
        if (!trimmedLocation) {
            setError('Location is required.');
            return;
        }

        const { assignments, error: assignmentError } = buildAssignments();
        if (assignmentError) {
            setError(assignmentError);
            return;
        }

        const payload: CreateEventTaskPayload = {
            title: trimmedTitle,
            description: description.trim() || null,
            location: trimmedLocation,
            taskDate: combineDayTime(taskDay, '12:00') ?? taskDay.toISOString(),
            leaderId: leaderId || null,
            assignments,
        };

        setSaving(true);
        setError('');
        try {
            if (isEditMode && task) {
                await eventsAPI.updateTask(eventId, task.id, payload);
            } else {
                await eventsAPI.createTask(eventId, payload);
            }
            await onSaved();
        } catch {
            setError(isEditMode ? 'Failed to update task. Please try again.' : 'Failed to create task. Please try again.');
            setSaving(false);
        }
    };

    return (
        <>
            <div className="modal-backdrop" onClick={onClose} />
            <div className="modal-container" role="dialog" aria-modal="true" aria-labelledby="add-event-task-title">
                <div className="modal-header">
                    <div>
                        <h2 className="modal-title" id="add-event-task-title">{isEditMode ? 'Edit task' : 'Add task'}</h2>
                        <p className="modal-subtitle">{formatDayLabel(taskDay)}</p>
                    </div>
                    <button type="button" className="modal-close-btn" onClick={onClose} aria-label="Close">
                        <X />
                    </button>
                </div>

                <div className="modal-body">
                    <div className="form-group">
                        <label className="form-label" htmlFor="event-task-title">Title</label>
                        <input
                            id="event-task-title"
                            className="form-input"
                            value={title}
                            onChange={(event) => setTitle(event.target.value)}
                            placeholder="e.g. Registration desk"
                        />
                    </div>

                    <div className="form-group">
                        <label className="form-label" htmlFor="event-task-location">Location</label>
                        <input
                            id="event-task-location"
                            className="form-input"
                            value={location}
                            onChange={(event) => setLocation(event.target.value)}
                            placeholder="e.g. Main hall, Booth A"
                        />
                    </div>

                    <div className="form-group">
                        <label className="form-label" htmlFor="event-task-description">Description</label>
                        <textarea
                            id="event-task-description"
                            className="form-input form-textarea"
                            value={description}
                            onChange={(event) => setDescription(event.target.value)}
                            placeholder="Optional details about this task"
                        />
                    </div>

                    <div className="form-group">
                        <label className="form-label">Task leader <span className="form-label-optional">(optional)</span></label>
                        <div className="form-slot-row">
                            <select
                                className="form-input"
                                aria-label="Task leader"
                                value={leaderId}
                                onChange={(event) => setLeaderId(event.target.value)}
                            >
                                <option value="">No leader</option>
                                {members.map((member) => (
                                    <option key={member.id} value={member.id}>{member.fullName}</option>
                                ))}
                            </select>
                            <QuarterHourTimeSelect
                                aria-label="Leader start time"
                                value={leaderStart}
                                onChange={setLeaderStart}
                                disabled={!leaderId}
                            />
                            <QuarterHourTimeSelect
                                aria-label="Leader end time"
                                value={leaderEnd}
                                onChange={setLeaderEnd}
                                disabled={!leaderId}
                            />
                        </div>
                    </div>

                    <div className="form-group">
                        <label className="form-label">Assignees</label>
                        <div className="custom-field-options-list">
                            {assignees.map((row, index) => (
                                <div key={index} className="form-slot-row">
                                    <select
                                        className="form-input"
                                        aria-label={`Assignee ${index + 1}`}
                                        value={row.memberId}
                                        onChange={(event) => updateAssignee(index, { memberId: event.target.value })}
                                    >
                                        <option value="">Select member</option>
                                        {members.map((member) => (
                                            <option key={member.id} value={member.id}>{member.fullName}</option>
                                        ))}
                                    </select>
                                    <QuarterHourTimeSelect
                                        aria-label={`Assignee ${index + 1} start time`}
                                        value={row.startTime}
                                        onChange={(startTime) => updateAssignee(index, { startTime })}
                                    />
                                    <QuarterHourTimeSelect
                                        aria-label={`Assignee ${index + 1} end time`}
                                        value={row.endTime}
                                        onChange={(endTime) => updateAssignee(index, { endTime })}
                                    />
                                    <button
                                        type="button"
                                        className="custom-field-option-remove"
                                        onClick={() => setAssignees((current) => (current.length > 1 ? current.filter((_, rowIndex) => rowIndex !== index) : [emptyAssignee()]))}
                                        aria-label={`Remove assignee ${index + 1}`}
                                    >
                                        <Trash2 size={15} />
                                    </button>
                                </div>
                            ))}
                        </div>
                        <button
                            type="button"
                            className="btn btn-secondary custom-field-option-add"
                            onClick={() => setAssignees((current) => {
                                const previous = current[current.length - 1];
                                return [...current, {
                                    memberId: '',
                                    startTime: previous?.startTime ?? '',
                                    endTime: previous?.endTime ?? '',
                                }];
                            })}
                        >
                            <Plus size={16} />
                            Add assignee
                        </button>
                    </div>

                    {error ? <p className="error-message">{error}</p> : null}
                </div>

                <div className="modal-footer">
                    <button type="button" onClick={onClose} className="btn btn-secondary" disabled={saving}>Cancel</button>
                    <button type="button" onClick={() => void handleSave()} className="btn btn-primary" disabled={saving}>
                        {saving ? 'Saving…' : (isEditMode ? 'Save changes' : 'Add task')}
                    </button>
                </div>
            </div>
        </>
    );
}
