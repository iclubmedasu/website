'use client';

import { useEffect, useMemo, useState } from 'react';
import { Loader } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { eventsAPI } from '@/services/api';
import type { EventTaskRef, Id, MemberSummary } from '@/types/backend-contracts';
import RemoveEventTaskAssignmentModal from '../../../modals/RemoveEventTaskAssignmentModal';
import EventTasksTimetable, { type RemoveAssignmentTarget } from '../EventTasksTimetable';
import AddEventTaskModal from '../../../modals/AddEventTaskModal';

interface EventTasksSectionProps {
    eventId: Id | string;
    eventDate?: string | null;
    eventEndDate?: string | null;
}

function startOfDay(date: Date): Date {
    const result = new Date(date);
    result.setHours(0, 0, 0, 0);
    return result;
}

function addDays(date: Date, amount: number): Date {
    const result = new Date(date);
    result.setDate(result.getDate() + amount);
    return result;
}

function getLocalDateKey(date: Date): string {
    return [date.getFullYear(), String(date.getMonth() + 1).padStart(2, '0'), String(date.getDate()).padStart(2, '0')].join('-');
}

function buildDays(eventDate?: string | null, eventEndDate?: string | null, tasks: EventTaskRef[] = []): Date[] {
    const seen = new Set<string>();
    const days: Date[] = [];

    const pushDay = (date: Date) => {
        const key = getLocalDateKey(date);
        if (!seen.has(key)) {
            seen.add(key);
            days.push(startOfDay(date));
        }
    };

    const start = eventDate ? new Date(eventDate) : null;
    const end = eventEndDate ? new Date(eventEndDate) : start;
    if (start && !Number.isNaN(start.getTime()) && end && !Number.isNaN(end.getTime())) {
        let cursor = startOfDay(start);
        const finalDay = startOfDay(end);
        let guard = 0;
        while (cursor <= finalDay && guard < 366) {
            pushDay(cursor);
            cursor = addDays(cursor, 1);
            guard += 1;
        }
    }

    for (const task of tasks) {
        const taskDate = task.taskDate ? new Date(task.taskDate) : null;
        if (taskDate && !Number.isNaN(taskDate.getTime())) {
            pushDay(taskDate);
        }
    }

    return days.sort((a, b) => a.getTime() - b.getTime());
}

export default function EventTasksSection({ eventId, eventDate, eventEndDate }: EventTasksSectionProps) {
    const { user } = useAuth();
    const canManage = !!(user?.isDeveloper || user?.isAdmin || user?.isOfficer || user?.isLeadership);

    const [tasks, setTasks] = useState<EventTaskRef[]>([]);
    const [members, setMembers] = useState<MemberSummary[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [modalDay, setModalDay] = useState<Date | null>(null);
    const [editTask, setEditTask] = useState<EventTaskRef | null>(null);
    const [removeTarget, setRemoveTarget] = useState<RemoveAssignmentTarget | null>(null);

    const loadTasks = async () => {
        const data = await eventsAPI.getTasks(eventId);
        setTasks(Array.isArray(data) ? data : []);
    };

    useEffect(() => {
        let active = true;

        const load = async () => {
            setLoading(true);
            setError('');
            try {
                const [tasksResult, membersResult] = await Promise.all([
                    eventsAPI.getTasks(eventId),
                    eventsAPI.getAssignableMembers(eventId).catch(() => []),
                ]);
                if (!active) return;
                setTasks(Array.isArray(tasksResult) ? tasksResult : []);
                setMembers(Array.isArray(membersResult) ? membersResult : []);
            } catch {
                if (!active) return;
                setError('Failed to load tasks.');
                setTasks([]);
            } finally {
                if (active) setLoading(false);
            }
        };

        void load();
        return () => { active = false; };
    }, [eventId]);

    const days = useMemo(() => buildDays(eventDate, eventEndDate, tasks), [eventDate, eventEndDate, tasks]);

    const handleRemoveAssignment = async () => {
        if (!removeTarget || !canManage) return;
        await eventsAPI.removeTaskAssignment(eventId, removeTarget.taskId, removeTarget.assignmentId);
        await loadTasks();
    };

    if (loading) {
        return (
            <div className="empty-state">
                <Loader size={16} className="file-status-processing" />
                <p>Loading tasks…</p>
            </div>
        );
    }

    return (
        <div className="event-tasks-section">
            {error ? <p className="error-message">{error}</p> : null}

            <EventTasksTimetable
                days={days}
                tasks={tasks}
                onAddTask={(day) => setModalDay(day)}
                onEditTask={(task) => setEditTask(task)}
                onRemoveAssignment={(target) => setRemoveTarget(target)}
                canManage={canManage}
            />

            {modalDay && (
                <AddEventTaskModal
                    eventId={eventId}
                    day={modalDay}
                    members={members}
                    onClose={() => setModalDay(null)}
                    onSaved={async () => {
                        setModalDay(null);
                        await loadTasks();
                    }}
                />
            )}

            {editTask && (
                <AddEventTaskModal
                    eventId={eventId}
                    task={editTask}
                    members={members}
                    onClose={() => setEditTask(null)}
                    onSaved={async () => {
                        setEditTask(null);
                        await loadTasks();
                    }}
                />
            )}

            {removeTarget && (
                <RemoveEventTaskAssignmentModal
                    memberName={removeTarget.memberName}
                    taskTitle={removeTarget.taskTitle}
                    onConfirm={handleRemoveAssignment}
                    onClose={() => setRemoveTarget(null)}
                />
            )}
        </div>
    );
}
