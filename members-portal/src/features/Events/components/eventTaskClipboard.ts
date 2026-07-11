import type {
    CreateEventTaskPayload,
    EventTaskAssignmentInput,
    EventTaskRef,
    Id,
} from '@/types/backend-contracts';
import { formatTimeFromDate } from '@/features/Events/components/eventTaskTimeUtils';

export interface EventTaskSlotSnapshot {
    memberId: string;
    startTime: string;
    endTime: string;
}

export interface EventTaskClipboardSnapshot {
    title: string;
    description: string | null;
    location: string;
    leaderId: string | null;
    sourceTaskDateKey: string;
    slots: EventTaskSlotSnapshot[];
}

export interface EventTaskClipboard {
    mode: 'copy' | 'cut';
    taskId: Id | string;
    snapshot: EventTaskClipboardSnapshot;
}

export type EventTasksSelection =
    | { type: 'task'; taskId: number; task: EventTaskRef }
    | { type: 'day'; dateKey: string; day: Date }
    | null;

export interface UndoEntry {
    description: string;
    undo: () => Promise<void>;
    redo: () => Promise<void>;
}

export function getLocalDateKey(date: Date): string {
    return [
        date.getFullYear(),
        String(date.getMonth() + 1).padStart(2, '0'),
        String(date.getDate()).padStart(2, '0'),
    ].join('-');
}

export function startOfDay(date: Date): Date {
    const result = new Date(date);
    result.setHours(0, 0, 0, 0);
    return result;
}

export function combineDayTime(day: Date, time: string): string | null {
    if (!time) return null;
    const [hours, minutes] = time.split(':').map((part) => Number.parseInt(part, 10));
    if (Number.isNaN(hours) || Number.isNaN(minutes)) return null;
    const result = new Date(day);
    result.setHours(hours, minutes, 0, 0);
    return result.toISOString();
}

export function snapshotEventTask(task: EventTaskRef): EventTaskClipboardSnapshot {
    const taskDate = task.taskDate ? new Date(task.taskDate) : new Date();
    const slots: EventTaskSlotSnapshot[] = (task.assignments ?? []).map((assignment) => ({
        memberId: String(assignment.memberId),
        startTime: formatTimeFromDate(assignment.startDateTime),
        endTime: formatTimeFromDate(assignment.endDateTime),
    }));

    return {
        title: task.title,
        description: task.description ?? null,
        location: task.location,
        leaderId: task.leaderId != null ? String(task.leaderId) : null,
        sourceTaskDateKey: getLocalDateKey(taskDate),
        slots,
    };
}

export function buildCreatePayloadFromSnapshot(
    snapshot: EventTaskClipboardSnapshot,
    targetDay: Date,
): CreateEventTaskPayload {
    const assignments: EventTaskAssignmentInput[] = [];
    for (const slot of snapshot.slots) {
        const startDateTime = combineDayTime(targetDay, slot.startTime);
        const endDateTime = combineDayTime(targetDay, slot.endTime);
        if (!startDateTime || !endDateTime) continue;
        assignments.push({
            memberId: slot.memberId,
            startDateTime,
            endDateTime,
        });
    }

    return {
        title: snapshot.title,
        description: snapshot.description,
        location: snapshot.location,
        taskDate: combineDayTime(targetDay, '12:00') ?? targetDay.toISOString(),
        leaderId: snapshot.leaderId,
        assignments,
    };
}
