'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
    ClipboardPaste,
    Copy,
    Download,
    Loader,
    Maximize2,
    Minimize2,
    Redo2,
    Scissors,
    Trash2,
    Undo2,
} from 'lucide-react';
import { eventsAPI } from '@/services/api';
import type { EventTaskRef, Id, MemberSummary } from '@/types/backend-contracts';
import { exportEventTasksExcel } from '@/features/Events/components/eventTaskExcelExport';
import {
    buildCreatePayloadFromSnapshot,
    getLocalDateKey,
    snapshotEventTask,
    startOfDay,
    type EventTaskClipboard,
    type EventTasksSelection,
    type UndoEntry,
} from '@/features/Events/components/eventTaskClipboard';
import RemoveEventTaskAssignmentModal from '../../../modals/RemoveEventTaskAssignmentModal';
import DeleteEventTaskModal from '../../../modals/DeleteEventTaskModal';
import EventTasksTimetable, { type RemoveAssignmentTarget } from '../EventTasksTimetable';
import AddEventTaskModal from '../../../modals/AddEventTaskModal';
import './EventTasksSection.css';

interface EventTasksSectionProps {
    eventId: Id | string;
    eventTitle?: string;
    eventDate?: string | null;
    eventEndDate?: string | null;
    canManage?: boolean;
}

function addDays(date: Date, amount: number): Date {
    const result = new Date(date);
    result.setDate(result.getDate() + amount);
    return result;
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

export default function EventTasksSection({
    eventId,
    eventTitle,
    eventDate,
    eventEndDate,
    canManage = false,
}: EventTasksSectionProps) {
    const [tasks, setTasks] = useState<EventTaskRef[]>([]);
    const [members, setMembers] = useState<MemberSummary[]>([]);
    const [loading, setLoading] = useState(true);
    const [exporting, setExporting] = useState(false);
    const [error, setError] = useState('');
    const [modalDay, setModalDay] = useState<Date | null>(null);
    const [editTask, setEditTask] = useState<EventTaskRef | null>(null);
    const [removeTarget, setRemoveTarget] = useState<RemoveAssignmentTarget | null>(null);
    const [deleteTaskTarget, setDeleteTaskTarget] = useState<EventTaskRef | null>(null);
    const [selection, setSelection] = useState<EventTasksSelection>(null);
    const [clipboard, setClipboard] = useState<EventTaskClipboard | null>(null);
    const [isMaximized, setIsMaximized] = useState(false);
    const [, setUndoRedoVersion] = useState(0);

    const undoStackRef = useRef<UndoEntry[]>([]);
    const redoStackRef = useRef<UndoEntry[]>([]);

    const loadTasks = useCallback(async () => {
        const data = await eventsAPI.getTasks(eventId);
        setTasks(Array.isArray(data) ? data : []);
    }, [eventId]);

    useEffect(() => {
        let active = true;

        const load = async () => {
            setLoading(true);
            setError('');
            try {
                const [tasksResult, membersResult] = await Promise.all([
                    eventsAPI.getTasks(eventId),
                    canManage ? eventsAPI.getAssignableMembers(eventId).catch(() => []) : Promise.resolve([]),
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
    }, [eventId, canManage]);

    useEffect(() => {
        if (!isMaximized) return undefined;
        const previousOverflow = document.body.style.overflow;
        document.body.style.overflow = 'hidden';
        const handleEscape = (event: KeyboardEvent) => {
            if (event.key === 'Escape') setIsMaximized(false);
        };
        window.addEventListener('keydown', handleEscape);
        return () => {
            document.body.style.overflow = previousOverflow;
            window.removeEventListener('keydown', handleEscape);
        };
    }, [isMaximized]);

    // Keep selection in sync when tasks reload
    useEffect(() => {
        if (!selection) return;
        if (selection.type === 'task') {
            const next = tasks.find((task) => Number(task.id) === selection.taskId);
            if (!next) {
                setSelection(null);
                return;
            }
            if (next !== selection.task) {
                setSelection({ type: 'task', taskId: selection.taskId, task: next });
            }
        }
    }, [tasks, selection]);

    const days = useMemo(() => buildDays(eventDate, eventEndDate, tasks), [eventDate, eventEndDate, tasks]);

    const pushUndo = useCallback((entry: UndoEntry) => {
        undoStackRef.current.push(entry);
        redoStackRef.current = [];
        setUndoRedoVersion((version) => version + 1);
    }, []);

    const handleUndo = useCallback(async () => {
        const entry = undoStackRef.current.pop();
        if (!entry) return;
        try {
            await entry.undo();
            redoStackRef.current.push(entry);
            setUndoRedoVersion((version) => version + 1);
        } catch {
            undoStackRef.current.push(entry);
            setError('Undo failed.');
            setUndoRedoVersion((version) => version + 1);
        }
    }, []);

    const handleRedo = useCallback(async () => {
        const entry = redoStackRef.current.pop();
        if (!entry) return;
        try {
            await entry.redo();
            undoStackRef.current.push(entry);
            setUndoRedoVersion((version) => version + 1);
        } catch {
            redoStackRef.current.push(entry);
            setError('Redo failed.');
            setUndoRedoVersion((version) => version + 1);
        }
    }, []);

    const selectedTask = selection?.type === 'task' ? selection.task : null;
    const selectedDay = selection?.type === 'day' ? selection.day : null;
    const canCopyCut = Boolean(canManage && selectedTask);
    const canPaste = Boolean(
        canManage
        && clipboard
        && selectedDay
        && (clipboard.mode === 'copy' || clipboard.snapshot.sourceTaskDateKey !== getLocalDateKey(selectedDay)),
    );
    const canDeleteSelected = Boolean(canManage && selectedTask);
    const hasUndo = undoStackRef.current.length > 0;
    const hasRedo = redoStackRef.current.length > 0;

    const handleCopy = useCallback(() => {
        if (!selectedTask) return;
        setClipboard({
            mode: 'copy',
            taskId: selectedTask.id,
            snapshot: snapshotEventTask(selectedTask),
        });
    }, [selectedTask]);

    const handleCut = useCallback(() => {
        if (!selectedTask) return;
        setClipboard({
            mode: 'cut',
            taskId: selectedTask.id,
            snapshot: snapshotEventTask(selectedTask),
        });
    }, [selectedTask]);

    const handlePaste = useCallback(async () => {
        if (!clipboard || !selectedDay || !canManage) return;
        const targetDay = startOfDay(selectedDay);
        const targetKey = getLocalDateKey(targetDay);
        setError('');

        try {
            if (clipboard.mode === 'copy') {
                const payload = buildCreatePayloadFromSnapshot(clipboard.snapshot, targetDay);
                const created = await eventsAPI.createTask(eventId, payload);
                await loadTasks();
                setSelection({ type: 'task', taskId: Number(created.id), task: created });

                let currentId: Id | string = created.id;
                pushUndo({
                    description: `Paste copy of "${clipboard.snapshot.title}"`,
                    undo: async () => {
                        await eventsAPI.removeTask(eventId, currentId);
                        await loadTasks();
                    },
                    redo: async () => {
                        const recreated = await eventsAPI.createTask(
                            eventId,
                            buildCreatePayloadFromSnapshot(clipboard.snapshot, targetDay),
                        );
                        currentId = recreated.id;
                        await loadTasks();
                    },
                });
                return;
            }

            // Cut: move task to target day
            if (clipboard.snapshot.sourceTaskDateKey === targetKey) return;

            const sourceSnapshot = clipboard.snapshot;
            const sourceDay = days.find((day) => getLocalDateKey(day) === sourceSnapshot.sourceTaskDateKey)
                ?? new Date(`${sourceSnapshot.sourceTaskDateKey}T12:00:00`);
            const movedId = clipboard.taskId;
            const payload = buildCreatePayloadFromSnapshot(sourceSnapshot, targetDay);
            await eventsAPI.updateTask(eventId, movedId, payload);
            await loadTasks();
            setClipboard(null);
            setSelection({ type: 'day', dateKey: targetKey, day: targetDay });

            pushUndo({
                description: `Move "${sourceSnapshot.title}" to ${targetKey}`,
                undo: async () => {
                    await eventsAPI.updateTask(
                        eventId,
                        movedId,
                        buildCreatePayloadFromSnapshot(sourceSnapshot, startOfDay(sourceDay)),
                    );
                    await loadTasks();
                },
                redo: async () => {
                    await eventsAPI.updateTask(
                        eventId,
                        movedId,
                        buildCreatePayloadFromSnapshot(sourceSnapshot, targetDay),
                    );
                    await loadTasks();
                },
            });
        } catch (pasteError) {
            setError(pasteError instanceof Error ? pasteError.message : 'Paste failed.');
        }
    }, [canManage, clipboard, days, eventId, loadTasks, pushUndo, selectedDay]);

    const handleRemoveAssignment = async () => {
        if (!removeTarget || !canManage) return;
        await eventsAPI.removeTaskAssignment(eventId, removeTarget.taskId, removeTarget.assignmentId);
        await loadTasks();
    };

    const handleConfirmDeleteTask = async () => {
        if (!deleteTaskTarget || !canManage) return;
        const snapshot = snapshotEventTask(deleteTaskTarget);
        const originalDay = deleteTaskTarget.taskDate
            ? startOfDay(new Date(deleteTaskTarget.taskDate))
            : startOfDay(new Date());
        const deletedId = deleteTaskTarget.id;

        await eventsAPI.removeTask(eventId, deletedId);
        setSelection(null);
        await loadTasks();

        let currentId: Id | string | null = null;
        pushUndo({
            description: `Delete "${snapshot.title}"`,
            undo: async () => {
                const recreated = await eventsAPI.createTask(
                    eventId,
                    buildCreatePayloadFromSnapshot(snapshot, originalDay),
                );
                currentId = recreated.id;
                await loadTasks();
            },
            redo: async () => {
                if (currentId == null) return;
                await eventsAPI.removeTask(eventId, currentId);
                currentId = null;
                await loadTasks();
            },
        });
    };

    const handleExportExcel = async () => {
        setExporting(true);
        try {
            await exportEventTasksExcel({
                days,
                tasks,
                fileName: eventTitle?.trim() || `event-${eventId}`,
            });
        } catch {
            setError('Failed to export tasks to Excel.');
        } finally {
            setExporting(false);
        }
    };

    if (loading) {
        return (
            <section className="event-expanded-panel">
                <div className="empty-state">
                    <Loader size={16} className="file-status-processing" />
                    <p>Loading tasks…</p>
                </div>
            </section>
        );
    }

    return (
        <section className="event-expanded-panel">
            <div className="event-expanded-header event-expanded-header--compact">
                <div>
                    <h2 className="expanded-section-title">Tasks</h2>
                </div>
            </div>
            <div className={`event-tasks-section${isMaximized ? ' event-tasks-section--maximized' : ''}`}>
                {error ? <p className="error-message">{error}</p> : null}

                <div className="event-tasks-toolbar">
                    <div className="event-tasks-toolbar-left">
                        {canManage ? (
                            <>
                                <div className="event-tasks-toolbar-group">
                                    <div className="event-tasks-utility-group" role="group" aria-label="Undo and redo">
                                        <button
                                            type="button"
                                            className={`event-tasks-utility-btn${!hasUndo ? ' disabled' : ''}`}
                                            onClick={() => void handleUndo()}
                                            disabled={!hasUndo}
                                            title="Undo"
                                        >
                                            <Undo2 size={14} />
                                        </button>
                                        <button
                                            type="button"
                                            className={`event-tasks-utility-btn${!hasRedo ? ' disabled' : ''}`}
                                            onClick={() => void handleRedo()}
                                            disabled={!hasRedo}
                                            title="Redo"
                                        >
                                            <Redo2 size={14} />
                                        </button>
                                    </div>
                                </div>

                                <span className="event-tasks-toolbar-divider" aria-hidden="true" />

                                <div className="event-tasks-toolbar-group">
                                    <div className="event-tasks-utility-group" role="group" aria-label="Clipboard">
                                        <button
                                            type="button"
                                            className={`event-tasks-utility-btn${!canCopyCut ? ' disabled' : ''}`}
                                            onClick={handleCopy}
                                            disabled={!canCopyCut}
                                            title="Copy"
                                        >
                                            <Copy size={14} />
                                        </button>
                                        <button
                                            type="button"
                                            className={`event-tasks-utility-btn${!canCopyCut ? ' disabled' : ''}`}
                                            onClick={handleCut}
                                            disabled={!canCopyCut}
                                            title="Cut"
                                        >
                                            <Scissors size={14} />
                                        </button>
                                        <button
                                            type="button"
                                            className={`event-tasks-utility-btn${!canPaste ? ' disabled' : ''}`}
                                            onClick={() => void handlePaste()}
                                            disabled={!canPaste}
                                            title={clipboard ? `Paste "${clipboard.snapshot.title}"` : 'Paste'}
                                        >
                                            <ClipboardPaste size={14} />
                                        </button>
                                    </div>
                                </div>

                                <span className="event-tasks-toolbar-divider" aria-hidden="true" />

                                <div className="event-tasks-toolbar-group">
                                    <div className="event-tasks-utility-group" role="group" aria-label="Delete">
                                        <button
                                            type="button"
                                            className={`event-tasks-utility-btn${!canDeleteSelected ? ' disabled' : ''}`}
                                            onClick={() => selectedTask && setDeleteTaskTarget(selectedTask)}
                                            disabled={!canDeleteSelected}
                                            title="Delete task"
                                        >
                                            <Trash2 size={14} />
                                        </button>
                                    </div>
                                </div>
                            </>
                        ) : null}
                    </div>
                    <div className="event-tasks-toolbar-right">
                        <div className="event-tasks-toolbar-group">
                            <div className="event-tasks-export-group">
                                <button
                                    type="button"
                                    className="event-tasks-export-btn"
                                    onClick={() => void handleExportExcel()}
                                    disabled={exporting || days.length === 0}
                                    title="Export the task timetable as Excel"
                                >
                                    <Download size={13} />
                                    <span>{exporting ? 'Exporting…' : 'Excel'}</span>
                                </button>
                            </div>
                        </div>
                        <span className="event-tasks-toolbar-divider" aria-hidden="true" />
                        <div className="event-tasks-toolbar-group">
                            <button
                                type="button"
                                className="event-tasks-maximize-btn"
                                onClick={() => setIsMaximized((value) => !value)}
                                title={isMaximized ? 'Minimize tasks' : 'Maximize tasks'}
                            >
                                {isMaximized ? <Minimize2 size={13} /> : <Maximize2 size={13} />}
                                <span>{isMaximized ? 'Minimize' : 'Maximize'}</span>
                            </button>
                        </div>
                    </div>
                </div>

                <EventTasksTimetable
                    days={days}
                    tasks={tasks}
                    selection={selection}
                    onSelectionChange={setSelection}
                    onAddTask={(day) => setModalDay(day)}
                    onEditTask={(task) => setEditTask(task)}
                    onRemoveAssignment={(target) => setRemoveTarget(target)}
                    onDeleteTask={(task) => setDeleteTaskTarget(task)}
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

                {deleteTaskTarget && (
                    <DeleteEventTaskModal
                        taskTitle={deleteTaskTarget.title}
                        assigneeCount={deleteTaskTarget.assignments?.length ?? 0}
                        onConfirm={handleConfirmDeleteTask}
                        onClose={() => setDeleteTaskTarget(null)}
                    />
                )}
            </div>
        </section>
    );
}
