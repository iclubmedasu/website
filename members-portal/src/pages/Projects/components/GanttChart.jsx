import { useState, useRef, useMemo, useCallback, useEffect } from 'react';
import {
    ChevronRight,
    ChevronDown,
    Plus,
    Pencil,
    Trash2,
    Crosshair,
    ArrowUp,
    ArrowDown,
    Undo2,
    Redo2,
    Copy,
    Scissors,
    ClipboardPaste,
    Columns3,
    Milestone,
} from 'lucide-react';
import { tasksAPI, phasesAPI, projectsAPI, getProfilePhotoUrl } from '../../../services/api';
import ConfirmModal from '../modals/ConfirmModal';
import './GanttChart.css';

// ─────────────────────────────────────────────────────────
//  Constants
// ─────────────────────────────────────────────────────────
const STATUS_COLORS = {
    NOT_STARTED: '#94a3b8',
    IN_PROGRESS: '#3b82f6',
    COMPLETED: '#22c55e',
    DELAYED: '#f97316',
    BLOCKED: '#ff1818',
    ON_HOLD: '#64748b',
    CANCELLED: '#ef4444',
};

const STATUS_LABELS = {
    NOT_STARTED: 'Not Started',
    IN_PROGRESS: 'In Progress',
    COMPLETED: 'Completed',
    DELAYED: 'Delayed',
    BLOCKED: 'Blocked',
    ON_HOLD: 'On Hold',
    CANCELLED: 'Cancelled',
};

const PRIORITY_LABELS = {
    LOW: 'Low',
    MEDIUM: 'Medium',
    HIGH: 'High',
    URGENT: 'Urgent',
};

const DIFFICULTY_LABELS = {
    EASY: 'Easy',
    MEDIUM: 'Medium',
    HARD: 'Hard',
    EXPERT: 'Expert',
};

const PRIORITY_COLORS = {
    LOW: '#22c55e',
    MEDIUM: '#3b82f6',
    HIGH: '#f97316',
    URGENT: '#ef4444',
};

const DIFFICULTY_COLORS = {
    EASY: '#22c55e',
    MEDIUM: '#3b82f6',
    HARD: '#f97316',
    EXPERT: '#ef4444',
};

// Progress % inferred from status (for items without subtasks)
const STATUS_PROGRESS = {
    NOT_STARTED: 0,
    IN_PROGRESS: 50,
    COMPLETED: 100,
    DELAYED: 25,
    BLOCKED: 10,
    ON_HOLD: 30,
    CANCELLED: 0,
};

// Toggleable attribute columns (order: assignees, status, priority, difficulty)
const ATTR_COLUMNS = [
    { key: 'assignees', label: 'Assignees', width: 100 },
    { key: 'status', label: 'Status', width: 120 },
    { key: 'priority', label: 'Priority', width: 75 },
    { key: 'difficulty', label: 'Difficulty', width: 75 },
];

const SCALES = ['quarter', 'month', 'week', 'day'];
const SCALE_LABELS = { quarter: 'Quarters', month: 'Months', week: 'Weeks', day: 'Days' };
const COL_WIDTHS = { quarter: 120, month: 100, week: 50, day: 32 };

const ROW_HEIGHT = 36;
const HEADER_HEIGHT = 52;
const DEFAULT_TREE_WIDTH = 280;
const MIN_TREE_WIDTH = 160;
const MAX_TREE_WIDTH = 600;

// ─────────────────────────────────────────────────────────
//  Date helpers
// ─────────────────────────────────────────────────────────
function startOfDay(d) {
    const r = new Date(d);
    r.setHours(0, 0, 0, 0);
    return r;
}

function addDays(d, n) {
    const r = new Date(d);
    r.setDate(r.getDate() + n);
    return r;
}

// ─────────────────────────────────────────────────────────
//  Timeline generation
// ─────────────────────────────────────────────────────────
function generateTimeline(rangeStart, rangeEnd, scale) {
    const cols = [];
    const topH = [];
    const colWidth = COL_WIDTHS[scale];
    const start = startOfDay(rangeStart);
    const end = startOfDay(rangeEnd);
    const today = startOfDay(new Date());

    if (scale === 'day') {
        let cur = new Date(start);
        let prevMonth = -1;
        while (cur <= end) {
            const mk = cur.getFullYear() * 12 + cur.getMonth();
            if (mk !== prevMonth) {
                topH.push({
                    key: `top-${cur.getFullYear()}-${cur.getMonth()}`,
                    label: cur.toLocaleDateString('en-US', { month: 'short', year: 'numeric' }),
                    colSpan: 0,
                });
                prevMonth = mk;
            }
            topH[topH.length - 1].colSpan++;
            const next = addDays(cur, 1);
            cols.push({
                key: cur.toISOString().split('T')[0],
                label: String(cur.getDate()),
                date: new Date(cur),
                endDate: new Date(next),
                isWeekend: cur.getDay() === 0 || cur.getDay() === 6,
                isToday: cur.getTime() === today.getTime(),
            });
            cur = next;
        }
    } else if (scale === 'week') {
        let cur = new Date(start);
        const dow = cur.getDay();
        cur.setDate(cur.getDate() - ((dow + 6) % 7)); // Monday
        let prevMonth = -1;
        while (cur <= end) {
            const mk = cur.getFullYear() * 12 + cur.getMonth();
            if (mk !== prevMonth) {
                topH.push({
                    key: `top-${cur.getFullYear()}-${cur.getMonth()}`,
                    label: cur.toLocaleDateString('en-US', { month: 'short', year: 'numeric' }),
                    colSpan: 0,
                });
                prevMonth = mk;
            }
            topH[topH.length - 1].colSpan++;
            const weekEnd = addDays(cur, 7);
            cols.push({
                key: `w-${cur.toISOString().split('T')[0]}`,
                label: String(cur.getDate()),
                date: new Date(cur),
                endDate: new Date(weekEnd),
                isToday: today >= cur && today < weekEnd,
            });
            cur = weekEnd;
        }
    } else if (scale === 'month') {
        let cur = new Date(start.getFullYear(), start.getMonth(), 1);
        let prevYear = -1;
        while (cur <= end) {
            if (cur.getFullYear() !== prevYear) {
                topH.push({
                    key: `top-${cur.getFullYear()}`,
                    label: String(cur.getFullYear()),
                    colSpan: 0,
                });
                prevYear = cur.getFullYear();
            }
            topH[topH.length - 1].colSpan++;
            const next = new Date(cur.getFullYear(), cur.getMonth() + 1, 1);
            cols.push({
                key: `m-${cur.getFullYear()}-${cur.getMonth()}`,
                label: cur.toLocaleDateString('en-US', { month: 'short' }),
                date: new Date(cur),
                endDate: new Date(next),
                isToday: today.getFullYear() === cur.getFullYear() && today.getMonth() === cur.getMonth(),
            });
            cur = next;
        }
    } else if (scale === 'quarter') {
        let cur = new Date(start.getFullYear(), Math.floor(start.getMonth() / 3) * 3, 1);
        let prevYear = -1;
        while (cur <= end) {
            if (cur.getFullYear() !== prevYear) {
                topH.push({
                    key: `top-${cur.getFullYear()}`,
                    label: String(cur.getFullYear()),
                    colSpan: 0,
                });
                prevYear = cur.getFullYear();
            }
            topH[topH.length - 1].colSpan++;
            const q = Math.floor(cur.getMonth() / 3) + 1;
            const next = new Date(cur.getFullYear(), cur.getMonth() + 3, 1);
            cols.push({
                key: `q-${cur.getFullYear()}-Q${q}`,
                label: `Q${q}`,
                date: new Date(cur),
                endDate: new Date(next),
                isToday: today >= cur && today < next,
            });
            cur = next;
        }
    }

    return { columns: cols, topHeaders: topH, colWidth, totalWidth: cols.length * colWidth };
}

// ─────────────────────────────────────────────────────────
//  Pixel position for a date within columns
// ─────────────────────────────────────────────────────────
function dateToPx(date, columns, colWidth) {
    if (!date || !columns.length) return null;
    const ts = new Date(date).getTime();

    for (let i = 0; i < columns.length; i++) {
        const cS = columns[i].date.getTime();
        const cE = columns[i].endDate.getTime();
        if (ts >= cS && ts < cE) {
            const frac = (ts - cS) / (cE - cS);
            return i * colWidth + frac * colWidth;
        }
    }

    if (ts < columns[0].date.getTime()) return 0;
    return columns.length * colWidth;
}

// ─────────────────────────────────────────────────────────
//  Derive date range for a phase from its children
// ─────────────────────────────────────────────────────────
function getPhaseRange(phase) {
    let min = null, max = null;
    for (const task of (phase.tasks || [])) {
        const s = task.startDate ? new Date(task.startDate) : null;
        const d = task.dueDate ? new Date(task.dueDate) : null;
        if (s && (!min || s < min)) min = s;
        if (d && (!max || d > max)) max = d;
        if (!s && d && (!min || d < min)) min = d;
        if (!d && s && (!max || s > max)) max = s;
        for (const sub of (task.subtasks || [])) {
            const ss = sub.startDate ? new Date(sub.startDate) : null;
            const sd = sub.dueDate ? new Date(sub.dueDate) : null;
            if (ss && (!min || ss < min)) min = ss;
            if (sd && (!max || sd > max)) max = sd;
            if (!ss && sd && (!min || sd < min)) min = sd;
            if (!sd && ss && (!max || ss > max)) max = ss;
        }
    }
    return { start: min, end: max };
}

// ─────────────────────────────────────────────────────────
//  Compute derived status for a phase
// ─────────────────────────────────────────────────────────
function getPhaseStatus(phase) {
    const tasks = phase.tasks || [];
    if (tasks.length === 0) return 'NOT_STARTED';
    const allDone = tasks.every((t) => t.status === 'COMPLETED');
    if (allDone) return 'COMPLETED';
    const anyActive = tasks.some((t) => t.status === 'IN_PROGRESS');
    if (anyActive) return 'IN_PROGRESS';
    const anyDelayed = tasks.some((t) => t.status === 'DELAYED');
    if (anyDelayed) return 'DELAYED';
    const anyBlocked = tasks.some((t) => t.status === 'BLOCKED');
    if (anyBlocked) return 'BLOCKED';
    return 'NOT_STARTED';
}

// ─────────────────────────────────────────────────────────
//  Format a date for tooltip
// ─────────────────────────────────────────────────────────
function fmtDate(d) {
    if (!d) return '—';
    return new Date(d).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
}

// ─────────────────────────────────────────────────────────
//  GanttChart — main export
// ─────────────────────────────────────────────────────────
export default function GanttChart({
    phases,
    projectId,
    projectStartDate,
    projectDueDate,
    canEdit,
    canEditStatus,
    onAddPhase,
    onAddTask,
    onAddSubtask,
    onEditPhase,
    onEditTask,
    onDeletePhase,
    onRefresh,
}) {
    const [scale, setScale] = useState('month');
    const [selected, setSelected] = useState(null); // { type, id, data, phase?, parentTask? }
    const [expandedPhases, setExpandedPhases] = useState(() => new Set(phases.map((p) => p.id)));
    const [expandedTasks, setExpandedTasks] = useState(new Set());
    const [confirmDelete, setConfirmDelete] = useState(null); // { type, id, title }

    // Clipboard: { mode: 'copy'|'cut', type: 'phase'|'task'|'subtask', id, data, phase?, parentTask? }
    const [clipboard, setClipboard] = useState(null);

    // Undo / redo stacks stored in refs (don't trigger re-renders on their own)
    // Each entry: { description: string, undo: async () => void, redo: async () => void }
    const undoStackRef = useRef([]);
    const redoStackRef = useRef([]);
    const [undoRedoVersion, setUndoRedoVersion] = useState(0); // bump to re-render toolbar

    const pushUndo = useCallback((entry) => {
        undoStackRef.current.push(entry);
        redoStackRef.current = [];
        setUndoRedoVersion((v) => v + 1);
    }, []);

    const treeBodyRef = useRef(null);
    const timelineRef = useRef(null);
    const colsBodyRef = useRef(null);

    // ── Resizable tree panel ──
    const [treeWidth, setTreeWidth] = useState(DEFAULT_TREE_WIDTH);
    const isResizingRef = useRef(false);
    const resizeStartXRef = useRef(0);
    const resizeStartWidthRef = useRef(DEFAULT_TREE_WIDTH);

    useEffect(() => {
        const handleMouseMove = (e) => {
            if (!isResizingRef.current) return;
            const delta = e.clientX - resizeStartXRef.current;
            const newWidth = Math.min(MAX_TREE_WIDTH, Math.max(MIN_TREE_WIDTH, resizeStartWidthRef.current + delta));
            setTreeWidth(newWidth);
        };
        const handleMouseUp = () => {
            if (isResizingRef.current) {
                isResizingRef.current = false;
                document.body.style.cursor = '';
                document.body.style.userSelect = '';
            }
        };
        window.addEventListener('mousemove', handleMouseMove);
        window.addEventListener('mouseup', handleMouseUp);
        return () => {
            window.removeEventListener('mousemove', handleMouseMove);
            window.removeEventListener('mouseup', handleMouseUp);
        };
    }, []);

    const handleResizeStart = useCallback((e) => {
        e.preventDefault();
        isResizingRef.current = true;
        resizeStartXRef.current = e.clientX;
        resizeStartWidthRef.current = treeWidth;
        document.body.style.cursor = 'col-resize';
        document.body.style.userSelect = 'none';
    }, [treeWidth]);

    // ── Baselines ──
    const [showBaselines, setShowBaselines] = useState(false);

    // Check if any task in the project has baseline dates set
    const hasBaseline = useMemo(() => {
        for (const phase of phases) {
            for (const task of (phase.tasks || [])) {
                if (task.baselineStartDate || task.baselineDueDate) return true;
                for (const sub of (task.subtasks || [])) {
                    if (sub.baselineStartDate || sub.baselineDueDate) return true;
                }
            }
        }
        return false;
    }, [phases]);

    const handleSetBaseline = useCallback(async () => {
        if (!projectId) return;
        try {
            await projectsAPI.setBaseline(projectId);
            onRefresh();
            setShowBaselines(true);
        } catch (err) {
            console.error('Set baseline failed', err);
        }
    }, [projectId, onRefresh]);

    const handleClearBaseline = useCallback(async () => {
        if (!projectId) return;
        try {
            await projectsAPI.clearBaseline(projectId);
            onRefresh();
            setShowBaselines(false);
        } catch (err) {
            console.error('Clear baseline failed', err);
        }
    }, [projectId, onRefresh]);

    // Inline cell editing (dropdown open state)
    const [editingCell, setEditingCell] = useState(null); // { rowId, rowType, colKey }

    // Toggleable attribute columns
    const [visibleCols, setVisibleCols] = useState(new Set());
    const toggleCol = useCallback((key) => {
        setVisibleCols((prev) => {
            const next = new Set(prev);
            next.has(key) ? next.delete(key) : next.add(key);
            return next;
        });
    }, []);
    const activeColumns = useMemo(() => ATTR_COLUMNS.filter((c) => visibleCols.has(c.key)), [visibleCols]);
    const columnsWidth = useMemo(() => activeColumns.reduce((sum, c) => sum + c.width, 0), [activeColumns]);

    // ── Inline cell update (status / priority / difficulty) ──
    const handleCellUpdate = useCallback(async (rowType, rowId, field, value) => {
        try {
            await tasksAPI.update(rowId, { [field]: value });
            onRefresh();
        } catch (err) {
            console.error('Failed to update', field, err);
        }
        setEditingCell(null);
    }, [onRefresh]);

    // ── Move up / move down helpers (phases, tasks, & subtasks) ──
    // Get the sibling list for a selected item
    const getSiblings = useCallback((sel) => {
        if (!sel) return [];
        if (sel.type === 'phase') return phases;
        if (sel.type === 'task') {
            const phase = phases.find((p) => p.id === (sel.phase?.id || sel.data.phaseId));
            return phase?.tasks || [];
        }
        if (sel.type === 'subtask') {
            const phase = phases.find((p) => p.id === (sel.phase?.id || sel.data.phaseId));
            const parent = (phase?.tasks || []).find((t) => t.id === (sel.parentTask?.id || sel.data.parentTaskId));
            return parent?.subtasks || [];
        }
        return [];
    }, [phases]);

    const handleMoveUp = useCallback(async () => {
        if (!selected || !canEdit) return;
        const siblings = getSiblings(selected);
        const idx = siblings.findIndex((s) => s.id === selected.id);
        if (idx <= 0) return;
        try {
            const prev = siblings[idx - 1];
            const curr = siblings[idx];
            let prevOrder = prev.order;
            let currOrder = curr.order;
            const api = selected.type === 'phase' ? phasesAPI : tasksAPI;

            // Normalize orders when duplicates exist (e.g. all 0)
            if (prevOrder === currOrder) {
                for (let i = 0; i < siblings.length; i++) {
                    await api.update(siblings[i].id, { order: i });
                }
                prevOrder = idx - 1;
                currOrder = idx;
            }

            await api.update(curr.id, { order: prevOrder });
            await api.update(prev.id, { order: currOrder });
            pushUndo({
                description: `Move "${curr.title}" up`,
                undo: async () => {
                    await api.update(curr.id, { order: currOrder });
                    await api.update(prev.id, { order: prevOrder });
                    onRefresh();
                },
                redo: async () => {
                    await api.update(curr.id, { order: prevOrder });
                    await api.update(prev.id, { order: currOrder });
                    onRefresh();
                },
            });
            onRefresh();
        } catch (err) {
            console.error('Move up failed', err);
        }
    }, [selected, canEdit, getSiblings, onRefresh, pushUndo]);

    const handleMoveDown = useCallback(async () => {
        if (!selected || !canEdit) return;
        const siblings = getSiblings(selected);
        const idx = siblings.findIndex((s) => s.id === selected.id);
        if (idx < 0 || idx >= siblings.length - 1) return;
        try {
            const next = siblings[idx + 1];
            const curr = siblings[idx];
            let nextOrder = next.order;
            let currOrder = curr.order;
            const api = selected.type === 'phase' ? phasesAPI : tasksAPI;

            // Normalize orders when duplicates exist (e.g. all 0)
            if (nextOrder === currOrder) {
                for (let i = 0; i < siblings.length; i++) {
                    await api.update(siblings[i].id, { order: i });
                }
                nextOrder = idx + 1;
                currOrder = idx;
            }

            await api.update(curr.id, { order: nextOrder });
            await api.update(next.id, { order: currOrder });
            pushUndo({
                description: `Move "${curr.title}" down`,
                undo: async () => {
                    await api.update(curr.id, { order: currOrder });
                    await api.update(next.id, { order: nextOrder });
                    onRefresh();
                },
                redo: async () => {
                    await api.update(curr.id, { order: nextOrder });
                    await api.update(next.id, { order: currOrder });
                    onRefresh();
                },
            });
            onRefresh();
        } catch (err) {
            console.error('Move down failed', err);
        }
    }, [selected, canEdit, getSiblings, onRefresh, pushUndo]);

    const canMoveUp = useMemo(() => {
        if (!selected || !canEdit) return false;
        const siblings = getSiblings(selected);
        return siblings.findIndex((s) => s.id === selected.id) > 0;
    }, [selected, canEdit, getSiblings]);

    const canMoveDown = useMemo(() => {
        if (!selected || !canEdit) return false;
        const siblings = getSiblings(selected);
        const idx = siblings.findIndex((s) => s.id === selected.id);
        return idx >= 0 && idx < siblings.length - 1;
    }, [selected, canEdit, getSiblings]);

    // ── Copy / Cut / Paste ──────────────────────────────────────
    const handleCopy = useCallback(() => {
        if (!selected) return;
        setClipboard({ mode: 'copy', type: selected.type, id: selected.id, data: selected.data, phase: selected.phase, parentTask: selected.parentTask });
    }, [selected]);

    const handleCut = useCallback(() => {
        if (!selected || !canEdit) return;
        setClipboard({ mode: 'cut', type: selected.type, id: selected.id, data: selected.data, phase: selected.phase, parentTask: selected.parentTask });
    }, [selected, canEdit]);

    // Can we paste?
    // Same-type sibling paste, OR clipboard=task & selected=phase (paste as child),
    // OR clipboard=subtask & selected=task (paste as child)
    const canPaste = useMemo(() => {
        if (!clipboard || !selected || !canEdit) return false;
        if (clipboard.type === selected.type) return true;
        if (clipboard.type === 'task' && selected.type === 'phase') return true;
        if (clipboard.type === 'subtask' && selected.type === 'task') return true;
        return false;
    }, [clipboard, selected, canEdit]);

    const handlePaste = useCallback(async () => {
        if (!clipboard || !selected || !canEdit || !canPaste) return;

        // Determine if pasting as child (task into phase, subtask into task)
        const pasteAsChild = clipboard.type !== selected.type;

        try {
            if (clipboard.mode === 'copy') {
                // ── COPY + PASTE: duplicate the item ──
                let createdId = null;
                if (clipboard.type === 'phase') {
                    const result = await phasesAPI.duplicate(clipboard.id);
                    createdId = result.id;
                    // Move it to right after the selected phase's order
                    const targetOrder = selected.data.order + 1;
                    for (const p of phases) {
                        if (p.order >= targetOrder && p.id !== createdId) {
                            await phasesAPI.update(p.id, { order: p.order + 1 });
                        }
                    }
                    await phasesAPI.update(createdId, { order: targetOrder });
                } else {
                    // task or subtask
                    const body = {};
                    if (pasteAsChild) {
                        // Pasting task into phase → becomes child of that phase
                        // Pasting subtask into task → becomes child of that task
                        if (clipboard.type === 'task') {
                            body.phaseId = selected.data.id; // selected is a phase
                        } else {
                            body.parentTaskId = selected.data.id; // selected is a task
                            body.phaseId = selected.phase?.id || selected.data.phaseId;
                        }
                    } else {
                        // Same-type paste: sibling
                        if (clipboard.type === 'task') {
                            body.phaseId = selected.phase?.id || selected.data.phaseId;
                        } else {
                            body.parentTaskId = selected.parentTask?.id || selected.data.parentTaskId;
                            body.phaseId = selected.phase?.id || selected.data.phaseId;
                        }
                    }
                    const result = await tasksAPI.duplicate(clipboard.id, body);
                    createdId = result.id;
                }

                pushUndo({
                    description: `Paste (copy) "${clipboard.data.title}"`,
                    undo: async () => {
                        if (clipboard.type === 'phase') {
                            await phasesAPI.remove(createdId);
                        } else {
                            await tasksAPI.remove(createdId);
                        }
                        onRefresh();
                    },
                    redo: async () => {
                        if (clipboard.type === 'phase') {
                            await phasesAPI.duplicate(clipboard.id);
                        } else {
                            const b = {};
                            if (pasteAsChild) {
                                if (clipboard.type === 'task') b.phaseId = selected.data.id;
                                else { b.parentTaskId = selected.data.id; b.phaseId = selected.phase?.id || selected.data.phaseId; }
                            } else {
                                if (clipboard.type === 'task') b.phaseId = selected.phase?.id || selected.data.phaseId;
                                else { b.parentTaskId = selected.parentTask?.id || selected.data.parentTaskId; b.phaseId = selected.phase?.id || selected.data.phaseId; }
                            }
                            await tasksAPI.duplicate(clipboard.id, b);
                        }
                        onRefresh();
                    },
                });
                onRefresh();

            } else if (clipboard.mode === 'cut') {
                // ── CUT + PASTE: move the item ──
                const cutId = clipboard.id;
                const oldPhaseId = clipboard.phase?.id || clipboard.data.phaseId || null;
                const oldParentTaskId = clipboard.parentTask?.id || clipboard.data.parentTaskId || null;
                const oldOrder = clipboard.data.order;

                if (clipboard.type === 'phase') {
                    const targetOrder = selected.data.order + 1;
                    for (const p of phases) {
                        if (p.id !== cutId && p.order >= targetOrder) {
                            await phasesAPI.update(p.id, { order: p.order + 1 });
                        }
                    }
                    await phasesAPI.update(cutId, { order: targetOrder });
                } else if (pasteAsChild) {
                    // Cut task → paste into phase (as child)
                    // Cut subtask → paste into task (as child)
                    if (clipboard.type === 'task') {
                        await tasksAPI.update(cutId, { phaseId: selected.data.id });
                    } else {
                        await tasksAPI.update(cutId, { parentTaskId: selected.data.id, phaseId: selected.phase?.id || selected.data.phaseId });
                    }
                } else if (clipboard.type === 'task') {
                    const newPhaseId = selected.phase?.id || selected.data.phaseId;
                    await tasksAPI.update(cutId, { phaseId: newPhaseId });
                } else {
                    const newParentTaskId = selected.parentTask?.id || selected.data.parentTaskId;
                    const newPhaseId = selected.phase?.id || selected.data.phaseId;
                    await tasksAPI.update(cutId, { parentTaskId: newParentTaskId, phaseId: newPhaseId });
                }

                pushUndo({
                    description: `Paste (cut) "${clipboard.data.title}"`,
                    undo: async () => {
                        if (clipboard.type === 'phase') {
                            await phasesAPI.update(cutId, { order: oldOrder });
                        } else if (clipboard.type === 'task') {
                            await tasksAPI.update(cutId, { phaseId: oldPhaseId, parentTaskId: oldParentTaskId || null });
                        } else {
                            await tasksAPI.update(cutId, { parentTaskId: oldParentTaskId, phaseId: oldPhaseId ? oldPhaseId : undefined });
                        }
                        onRefresh();
                    },
                    redo: async () => {
                        if (clipboard.type === 'phase') {
                            const target = selected.data.order + 1;
                            await phasesAPI.update(cutId, { order: target });
                        } else if (pasteAsChild) {
                            if (clipboard.type === 'task') await tasksAPI.update(cutId, { phaseId: selected.data.id });
                            else await tasksAPI.update(cutId, { parentTaskId: selected.data.id });
                        } else if (clipboard.type === 'task') {
                            await tasksAPI.update(cutId, { phaseId: selected.phase?.id || selected.data.phaseId });
                        } else {
                            await tasksAPI.update(cutId, { parentTaskId: selected.parentTask?.id || selected.data.parentTaskId });
                        }
                        onRefresh();
                    },
                });

                setClipboard(null); // cut is consumed
                onRefresh();
            }
        } catch (err) {
            console.error('Paste failed', err);
        }
    }, [clipboard, selected, canEdit, canPaste, phases, onRefresh, pushUndo]);

    // ── Undo / Redo ─────────────────────────────────────────────
    const handleUndo = useCallback(async () => {
        const stack = undoStackRef.current;
        if (stack.length === 0) return;
        const entry = stack.pop();
        try {
            await entry.undo();
            redoStackRef.current.push(entry);
        } catch (err) {
            console.error('Undo failed', err);
        }
        setUndoRedoVersion((v) => v + 1);
    }, []);

    const handleRedo = useCallback(async () => {
        const stack = redoStackRef.current;
        if (stack.length === 0) return;
        const entry = stack.pop();
        try {
            await entry.redo();
            undoStackRef.current.push(entry);
        } catch (err) {
            console.error('Redo failed', err);
        }
        setUndoRedoVersion((v) => v + 1);
    }, []);

    const hasUndo = undoStackRef.current.length > 0;
    const hasRedo = redoStackRef.current.length > 0;

    // Auto-expand newly added phases
    useEffect(() => {
        setExpandedPhases((prev) => {
            const next = new Set(prev);
            for (const p of phases) {
                if (!prev.has(p.id)) next.add(p.id);
            }
            return next;
        });
    }, [phases]);

    // Sync vertical scroll: timeline drives tree + columns
    const handleTimelineScroll = useCallback(() => {
        if (timelineRef.current) {
            const top = timelineRef.current.scrollTop;
            if (treeBodyRef.current) treeBodyRef.current.scrollTop = top;
            if (colsBodyRef.current) colsBodyRef.current.scrollTop = top;
        }
    }, []);

    // Toggle expand/collapse
    const togglePhase = useCallback((id) => {
        setExpandedPhases((prev) => {
            const next = new Set(prev);
            next.has(id) ? next.delete(id) : next.add(id);
            return next;
        });
    }, []);

    const toggleTask = useCallback((id) => {
        setExpandedTasks((prev) => {
            const next = new Set(prev);
            next.has(id) ? next.delete(id) : next.add(id);
            return next;
        });
    }, []);

    // Selection
    const handleSelect = useCallback((type, data, phase, parentTask) => {
        setSelected((prev) => {
            if (prev && prev.type === type && prev.id === data.id) return null;
            return { type, id: data.id, data, phase: phase || null, parentTask: parentTask || null };
        });
    }, []);

    // Build flat row list from hierarchy (includes "add" placeholder rows)
    // WBS codes come from the database (persisted, synced across devices)
    const rows = useMemo(() => {
        const result = [];
        for (let pi = 0; pi < phases.length; pi++) {
            const phase = phases[pi];
            result.push({ type: 'phase', id: phase.id, data: phase, depth: 0 });
            if (expandedPhases.has(phase.id)) {
                const tasks = phase.tasks || [];
                for (let ti = 0; ti < tasks.length; ti++) {
                    const task = tasks[ti];
                    result.push({ type: 'task', id: task.id, data: task, depth: 1, phase });
                    if (expandedTasks.has(task.id)) {
                        const subs = task.subtasks || [];
                        for (let si = 0; si < subs.length; si++) {
                            const sub = subs[si];
                            result.push({ type: 'subtask', id: sub.id, data: sub, depth: 2, phase, parentTask: task });
                        }
                        if (canEdit) {
                            result.push({ type: 'add-subtask', id: `add-sub-${task.id}`, depth: 2, phase, parentTask: task });
                        }
                    }
                }
                if (canEdit) {
                    result.push({ type: 'add-task', id: `add-task-${phase.id}`, depth: 1, phase: phase });
                }
            }
        }
        if (canEdit) {
            result.push({ type: 'add-phase', id: 'add-phase', depth: 0 });
        }
        return result;
    }, [phases, expandedPhases, expandedTasks, canEdit]);

    // Clear selection if item no longer exists
    useEffect(() => {
        if (selected) {
            const exists = rows.some((r) => r.type === selected.type && r.id === selected.id);
            if (!exists) setSelected(null);
        }
    }, [rows, selected]);

    // Compute timeline columns
    const { columns, topHeaders, colWidth, totalWidth } = useMemo(() => {
        let minDate = projectStartDate ? new Date(projectStartDate) : null;
        let maxDate = projectDueDate ? new Date(projectDueDate) : null;

        for (const phase of phases) {
            for (const task of (phase.tasks || [])) {
                if (task.startDate) { const d = new Date(task.startDate); if (!minDate || d < minDate) minDate = d; }
                if (task.dueDate) { const d = new Date(task.dueDate); if (!maxDate || d > maxDate) maxDate = d; }
                for (const sub of (task.subtasks || [])) {
                    if (sub.startDate) { const d = new Date(sub.startDate); if (!minDate || d < minDate) minDate = d; }
                    if (sub.dueDate) { const d = new Date(sub.dueDate); if (!maxDate || d > maxDate) maxDate = d; }
                }
            }
        }

        const today = new Date();
        if (!minDate) minDate = new Date(today.getFullYear(), today.getMonth() - 1, 1);
        if (!maxDate) maxDate = new Date(today.getFullYear(), today.getMonth() + 3, 0);

        // Ensure today is visible
        if (today < minDate) minDate = new Date(today);
        if (today > maxDate) maxDate = new Date(today);

        // Add padding
        minDate = addDays(minDate, -14);
        maxDate = addDays(maxDate, 14);

        return generateTimeline(minDate, maxDate, scale);
    }, [phases, scale, projectStartDate, projectDueDate]);

    // Today pixel position
    const todayPx = useMemo(() => dateToPx(new Date(), columns, colWidth), [columns, colWidth]);

    // Scroll to today
    const scrollToToday = useCallback(() => {
        if (timelineRef.current && todayPx != null) {
            const viewWidth = timelineRef.current.clientWidth;
            timelineRef.current.scrollLeft = Math.max(0, todayPx - viewWidth / 2);
        }
    }, [todayPx]);

    // Compute baseline bar data for a row (tasks/subtasks only)
    const getBaselineBarData = useCallback((row) => {
        if (row.type === 'phase') return null; // phases don't have baseline fields
        const bStart = row.data.baselineStartDate ? new Date(row.data.baselineStartDate) : null;
        const bEnd = row.data.baselineDueDate ? new Date(row.data.baselineDueDate) : null;
        if (!bStart && !bEnd) return null;
        const start = bStart || bEnd;
        const end = bEnd || bStart;
        const displayEnd = addDays(end, 1);
        const leftPx = dateToPx(start, columns, colWidth);
        const rightPx = dateToPx(displayEnd, columns, colWidth);
        if (leftPx == null || rightPx == null) return null;
        const width = Math.max(rightPx - leftPx, 6);
        return { left: leftPx, width };
    }, [columns, colWidth]);

    // Auto-scroll to today on first render
    useEffect(() => {
        const timer = setTimeout(scrollToToday, 100);
        return () => clearTimeout(timer);
    }, []); // eslint-disable-line react-hooks/exhaustive-deps

    // Compute bar data for a row
    const getBarData = useCallback((row) => {
        let barStart, barEnd, status;

        if (row.type === 'phase') {
            const range = getPhaseRange(row.data);
            barStart = range.start;
            barEnd = range.end;
            status = getPhaseStatus(row.data);
        } else {
            barStart = row.data.startDate ? new Date(row.data.startDate) : null;
            barEnd = row.data.dueDate ? new Date(row.data.dueDate) : null;
            status = row.data.status;
        }

        if (!barStart && !barEnd) return null;
        if (!barStart) barStart = barEnd;
        if (!barEnd) barEnd = barStart;

        // Add 1 day to end for inclusive display
        const displayEnd = addDays(barEnd, 1);

        const leftPx = dateToPx(barStart, columns, colWidth);
        const rightPx = dateToPx(displayEnd, columns, colWidth);
        if (leftPx == null || rightPx == null) return null;

        const width = Math.max(rightPx - leftPx, 6);
        const isMilestone = barStart.getTime() === barEnd.getTime();

        return { left: leftPx, width, status, isMilestone };
    }, [columns, colWidth]);

    // Auto-scroll timeline to the selected row's bar
    useEffect(() => {
        if (!selected || !timelineRef.current) return;
        const row = rows.find((r) => r.type === selected.type && r.id === selected.id);
        if (!row) return;
        const bar = getBarData(row);
        if (!bar) return;

        const el = timelineRef.current;
        const viewLeft = el.scrollLeft;
        const viewRight = viewLeft + el.clientWidth;
        const barCenter = bar.left + bar.width / 2;

        // Only scroll if the bar center is not currently visible
        if (barCenter < viewLeft || barCenter > viewRight) {
            el.scrollTo({
                left: Math.max(0, barCenter - el.clientWidth / 2),
                behavior: 'smooth',
            });
        }
    }, [selected]); // eslint-disable-line react-hooks/exhaustive-deps

    // Delete handler (with undo support)
    const handleDelete = useCallback(async (id) => {
        try {
            const delType = confirmDelete?.type;
            const delTitle = confirmDelete?.title;

            if (delType === 'phase') {
                // Snapshot the phase data for undo
                const phaseData = phases.find((p) => p.id === id);
                await phasesAPI.remove(id);
                if (phaseData) {
                    pushUndo({
                        description: `Delete phase "${delTitle}"`,
                        undo: async () => {
                            // Re-create the phase
                            const restored = await phasesAPI.create({
                                projectId: phaseData.projectId,
                                title: phaseData.title,
                                description: phaseData.description,
                                order: phaseData.order,
                            });
                            // Re-create tasks and subtasks
                            for (const task of (phaseData.tasks || [])) {
                                const newTask = await tasksAPI.create({
                                    projectId: task.projectId,
                                    phaseId: restored.id,
                                    title: task.title,
                                    description: task.description,
                                    type: task.type,
                                    priority: task.priority,
                                    status: task.status,
                                    difficulty: task.difficulty,
                                    startDate: task.startDate,
                                    dueDate: task.dueDate,
                                    estimatedHours: task.estimatedHours,
                                });
                                for (const sub of (task.subtasks || [])) {
                                    await tasksAPI.create({
                                        projectId: sub.projectId,
                                        phaseId: restored.id,
                                        parentTaskId: newTask.id,
                                        title: sub.title,
                                        description: sub.description,
                                        type: sub.type,
                                        priority: sub.priority,
                                        status: sub.status,
                                        difficulty: sub.difficulty,
                                        startDate: sub.startDate,
                                        dueDate: sub.dueDate,
                                        estimatedHours: sub.estimatedHours,
                                    });
                                }
                            }
                            onRefresh();
                        },
                        redo: async () => {
                            // Find the phase by title (best effort after undo re-creates it)
                            // Since the phase should exist after undo, re-fetch and delete again
                            await phasesAPI.remove(id).catch(() => { });
                            onRefresh();
                        },
                    });
                }
            } else {
                // Task or subtask — snapshot for undo
                const taskRow = rows.find((r) => r.id === id && (r.type === 'task' || r.type === 'subtask'));
                const taskData = taskRow?.data;
                await tasksAPI.remove(id);
                if (taskData) {
                    pushUndo({
                        description: `Delete ${delType} "${delTitle}"`,
                        undo: async () => {
                            const restored = await tasksAPI.create({
                                projectId: taskData.projectId,
                                phaseId: taskData.phaseId,
                                parentTaskId: taskData.parentTaskId,
                                title: taskData.title,
                                description: taskData.description,
                                type: taskData.type,
                                priority: taskData.priority,
                                status: taskData.status,
                                difficulty: taskData.difficulty,
                                startDate: taskData.startDate,
                                dueDate: taskData.dueDate,
                                estimatedHours: taskData.estimatedHours,
                            });
                            // Re-create subtasks if this was a task
                            if (delType === 'task') {
                                for (const sub of (taskData.subtasks || [])) {
                                    await tasksAPI.create({
                                        projectId: sub.projectId,
                                        phaseId: sub.phaseId,
                                        parentTaskId: restored.id,
                                        title: sub.title,
                                        description: sub.description,
                                        type: sub.type,
                                        priority: sub.priority,
                                        status: sub.status,
                                        difficulty: sub.difficulty,
                                        startDate: sub.startDate,
                                        dueDate: sub.dueDate,
                                        estimatedHours: sub.estimatedHours,
                                    });
                                }
                            }
                            onRefresh();
                        },
                        redo: async () => {
                            await tasksAPI.remove(id).catch(() => { });
                            onRefresh();
                        },
                    });
                }
            }
            setConfirmDelete(null);
            setSelected(null);
            onRefresh();
        } catch { /* swallow */ }
    }, [confirmDelete, phases, rows, onRefresh, pushUndo]);

    // Build bar tooltip
    const getBarTooltip = useCallback((row) => {
        const d = row.data;
        const parts = [d.title];
        if (row.type !== 'phase') {
            parts.push(`Status: ${STATUS_LABELS[d.status] ?? d.status}`);
            parts.push(`Priority: ${PRIORITY_LABELS[d.priority] ?? d.priority}`);
        }
        if (d.startDate || d.dueDate) {
            parts.push(`${fmtDate(d.startDate)} → ${fmtDate(d.dueDate)}`);
        }
        return parts.join('\n');
    }, []);

    // Progress % for a row
    const getProgress = useCallback((row) => {
        if (row.type === 'phase') {
            const tasks = row.data.tasks || [];
            if (tasks.length === 0) return 0;
            return Math.round(tasks.filter((t) => t.status === 'COMPLETED').length / tasks.length * 100);
        }
        if (row.type === 'task') {
            const subs = row.data.subtasks || [];
            if (subs.length > 0) {
                return Math.round(subs.filter((s) => s.status === 'COMPLETED').length / subs.length * 100);
            }
        }
        return STATUS_PROGRESS[row.data.status] ?? 0;
    }, []);

    // ─── Empty state ───
    if (phases.length === 0 && !canEdit) {
        return (
            <div className="gantt">
                <div className="gantt-toolbar">
                    <div className="gantt-toolbar-left">
                        <span className="gantt-toolbar-title">Gantt Chart</span>
                    </div>
                </div>
                <div className="gantt-empty">
                    No phases yet.
                </div>
            </div>
        );
    }

    return (
        <div className="gantt">
            {/* ── Confirm delete modal ── */}
            {confirmDelete && (
                <ConfirmModal
                    title={`Delete ${confirmDelete.type === 'phase' ? 'Phase' : confirmDelete.type === 'task' ? 'Task' : 'Subtask'}`}
                    itemName={confirmDelete.title}
                    message={
                        confirmDelete.type === 'phase'
                            ? 'All tasks, subtasks, and assignees in this phase will be permanently removed.'
                            : 'This item and all its children will be permanently removed.'
                    }
                    confirmLabel="Delete"
                    onConfirm={() => handleDelete(confirmDelete.id)}
                    onClose={() => setConfirmDelete(null)}
                />
            )}

            {/* ── Toolbar ── */}
            <div className="gantt-toolbar">
                {/* Left: utility buttons (closer to tree panel) */}
                <div className="gantt-toolbar-left">
                    {canEdit && (
                        <>
                            {/* Undo / Redo */}
                            <div className="gantt-utility-group">
                                <button
                                    className={`gantt-utility-btn${!hasUndo ? ' disabled' : ''}`}
                                    title="Undo"
                                    disabled={!hasUndo}
                                    onClick={handleUndo}
                                >
                                    <Undo2 size={14} />
                                </button>
                                <button
                                    className={`gantt-utility-btn${!hasRedo ? ' disabled' : ''}`}
                                    title="Redo"
                                    disabled={!hasRedo}
                                    onClick={handleRedo}
                                >
                                    <Redo2 size={14} />
                                </button>
                            </div>

                            {/* Up / Down */}
                            <div className="gantt-utility-group">
                                <button
                                    className={`gantt-utility-btn${!canMoveUp ? ' disabled' : ''}`}
                                    title="Move up"
                                    disabled={!canMoveUp}
                                    onClick={handleMoveUp}
                                >
                                    <ArrowUp size={14} />
                                </button>
                                <button
                                    className={`gantt-utility-btn${!canMoveDown ? ' disabled' : ''}`}
                                    title="Move down"
                                    disabled={!canMoveDown}
                                    onClick={handleMoveDown}
                                >
                                    <ArrowDown size={14} />
                                </button>
                            </div>

                            {/* Copy / Cut / Paste */}
                            <div className="gantt-utility-group">
                                <button
                                    className={`gantt-utility-btn${!selected ? ' disabled' : ''}`}
                                    title="Copy"
                                    disabled={!selected}
                                    onClick={handleCopy}
                                >
                                    <Copy size={14} />
                                </button>
                                <button
                                    className={`gantt-utility-btn${!selected ? ' disabled' : ''}`}
                                    title="Cut"
                                    disabled={!selected}
                                    onClick={handleCut}
                                >
                                    <Scissors size={14} />
                                </button>
                                <button
                                    className={`gantt-utility-btn${!canPaste ? ' disabled' : ''}`}
                                    title={clipboard ? `Paste "${clipboard.data?.title || ''}"` : 'Paste'}
                                    disabled={!canPaste}
                                    onClick={handlePaste}
                                >
                                    <ClipboardPaste size={14} />
                                </button>
                            </div>

                            {/* Column toggles */}
                            <div className="gantt-col-toggle-group">
                                <button
                                    className="gantt-utility-btn"
                                    title="Toggle attribute columns"
                                    style={{ width: 'auto', padding: '0 0.45rem', gap: '0.25rem' }}
                                    onClick={() => {
                                        setVisibleCols((prev) =>
                                            prev.size === ATTR_COLUMNS.length ? new Set() : new Set(ATTR_COLUMNS.map((c) => c.key))
                                        );
                                    }}
                                >
                                    <Columns3 size={13} />
                                </button>
                                {ATTR_COLUMNS.map((col) => (
                                    <button
                                        key={col.key}
                                        className={`gantt-col-toggle-btn${visibleCols.has(col.key) ? ' active' : ''}`}
                                        onClick={() => toggleCol(col.key)}
                                        title={`Toggle ${col.label}`}
                                    >
                                        {col.label}
                                    </button>
                                ))}
                            </div>

                            {/* Baseline controls */}
                            {/*         <div className="gantt-utility-group">
                                <button
                                    className="gantt-utility-btn"
                                    title="Set baseline (snapshot current dates)"
                                    onClick={handleSetBaseline}
                                    style={{ width: 'auto', padding: '0 0.45rem', gap: '0.25rem' }}
                                >
                                    <Milestone size={13} />
                                    <span style={{ fontSize: '0.66rem', fontWeight: 600 }}>Set</span>
                                </button>
                                {hasBaseline && (
                                    <button
                                        className={`gantt-utility-btn${showBaselines ? ' gantt-utility-btn--active' : ''}`}
                                        title="Toggle baseline bars"
                                        onClick={() => setShowBaselines((v) => !v)}
                                    >
                                        <Milestone size={13} />
                                    </button>
                                )}
                                {hasBaseline && (
                                    <button
                                        className="gantt-utility-btn"
                                        title="Clear baseline"
                                        onClick={handleClearBaseline}
                                    >
                                        <Trash2 size={12} />
                                    </button>
                                )}
                            </div> */}
                        </>
                    )}
                </div>

                {/* Right: time controls (above timeline panel) */}
                <div className="gantt-toolbar-right">
                    <div className="gantt-scale-group">
                        {SCALES.map((s) => (
                            <button
                                key={s}
                                className={`gantt-scale-btn${s === scale ? ' active' : ''}`}
                                onClick={() => setScale(s)}
                            >
                                {SCALE_LABELS[s]}
                            </button>
                        ))}
                    </div>
                    <button className="gantt-today-btn" onClick={scrollToToday} title="Scroll to today">
                        <Crosshair size={13} />
                        <span>Today</span>
                    </button>
                </div>
            </div>

            {/* ── Main chart area ── */}
            <div className="gantt-main">
                {/* Left: Tree panel */}
                <div className="gantt-tree-panel" style={{ width: treeWidth, minWidth: treeWidth }}>
                    <div className="gantt-tree-header" style={{ height: HEADER_HEIGHT }}>
                        <span className="gantt-tree-header-wbs">WBS</span>
                        <span>Task Name</span>
                    </div>
                    <div className="gantt-tree-body" ref={treeBodyRef}>
                        {rows.map((row) => {
                            // "Add" placeholder rows
                            if (row.type === 'add-phase') {
                                return (
                                    <div
                                        key="tree-add-phase"
                                        className="gantt-tree-row gantt-tree-row--add"
                                        style={{ height: ROW_HEIGHT, paddingLeft: '0.5rem' }}
                                        onClick={onAddPhase}
                                    >
                                        <Plus size={13} className="gantt-add-icon" />
                                        <span className="gantt-add-label">Add Phase</span>
                                    </div>
                                );
                            }
                            if (row.type === 'add-task') {
                                return (
                                    <div
                                        key={`tree-${row.id}`}
                                        className="gantt-tree-row gantt-tree-row--add"
                                        style={{ height: ROW_HEIGHT, paddingLeft: `${0.5 + 1 * 1.25}rem` }}
                                        onClick={() => onAddTask(row.phase)}
                                    >
                                        <Plus size={13} className="gantt-add-icon" />
                                        <span className="gantt-add-label">Add Task</span>
                                    </div>
                                );
                            }
                            if (row.type === 'add-subtask') {
                                return (
                                    <div
                                        key={`tree-${row.id}`}
                                        className="gantt-tree-row gantt-tree-row--add"
                                        style={{ height: ROW_HEIGHT, paddingLeft: `${0.5 + 2 * 1.25}rem` }}
                                        onClick={() => onAddSubtask(row.phase, row.parentTask)}
                                    >
                                        <Plus size={13} className="gantt-add-icon" />
                                        <span className="gantt-add-label">Add Subtask</span>
                                    </div>
                                );
                            }

                            // Normal rows: phase / task / subtask
                            const isSelected = selected?.type === row.type && selected?.id === row.id;
                            const hasChildren = row.type === 'phase'
                                ? (row.data.tasks?.length > 0 || canEdit)
                                : row.type === 'task'
                                    ? (row.data.subtasks?.length > 0 || canEdit)
                                    : false;
                            const isExpanded = row.type === 'phase'
                                ? expandedPhases.has(row.id)
                                : expandedTasks.has(row.id);
                            const statusColor = row.type === 'phase'
                                ? STATUS_COLORS[getPhaseStatus(row.data)]
                                : STATUS_COLORS[row.data.status];

                            const rowCanEdit = row.type === 'phase' ? canEdit : (canEdit || canEditStatus);

                            return (
                                <div
                                    key={`tree-${row.type}-${row.id}`}
                                    className={`gantt-tree-row gantt-tree-row--${row.type}${isSelected ? ' selected' : ''}`}
                                    style={{ height: ROW_HEIGHT, paddingLeft: `${0.5 + row.depth * 1.25}rem` }}
                                    onClick={() => handleSelect(row.type, row.data, row.phase, row.parentTask)}
                                >
                                    {hasChildren ? (
                                        <span
                                            className="gantt-tree-chevron"
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                row.type === 'phase' ? togglePhase(row.id) : toggleTask(row.id);
                                            }}
                                        >
                                            {isExpanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                                        </span>
                                    ) : (
                                        <span className="gantt-tree-chevron-placeholder" />
                                    )}
                                    <span className="gantt-tree-status-dot" style={{ background: statusColor }} />
                                    <span className="gantt-tree-wbs">{row.data.wbs || ''}</span>
                                    <span className={`gantt-tree-title gantt-tree-title--${row.type}`} title={row.data.title}>
                                        {row.data.title}
                                    </span>
                                    {row.type === 'phase' && (
                                        <span className="gantt-tree-count">
                                            {(row.data.tasks?.length ?? 0)}
                                        </span>
                                    )}
                                    {/* Inline progress bar */}
                                    {(() => {
                                        const pct = getProgress(row);
                                        return (
                                            <span className="gantt-progress-wrap" title={`${pct}%`}>
                                                <span className="gantt-progress-track">
                                                    <span className="gantt-progress-fill" style={{ width: `${pct}%` }} />
                                                </span>
                                            </span>
                                        );
                                    })()}
                                    {/* Inline edit / delete actions */}
                                    {rowCanEdit && (
                                        <div className="gantt-row-actions" onClick={(e) => e.stopPropagation()}>
                                            <button
                                                className="gantt-row-btn gantt-row-btn--edit"
                                                title={`Edit ${row.type}`}
                                                onClick={() => row.type === 'phase' ? onEditPhase(row.data) : onEditTask(row.data)}
                                            >
                                                <Pencil size={12} />
                                            </button>
                                            {canEdit && (
                                                <button
                                                    className="gantt-row-btn gantt-row-btn--danger"
                                                    title={`Delete ${row.type}`}
                                                    onClick={() => setConfirmDelete({ type: row.type, id: row.id, title: row.data.title })}
                                                >
                                                    <Trash2 size={12} />
                                                </button>
                                            )}
                                        </div>
                                    )}
                                </div>
                            );
                        })}
                    </div>
                </div>

                {/* Resize handle */}
                <div className="gantt-resize-handle" onMouseDown={handleResizeStart} />

                {/* Middle: Attribute columns (slide in/out) */}
                {activeColumns.length > 0 && (
                    <div className="gantt-columns-panel" style={{ width: columnsWidth, minWidth: columnsWidth }}>
                        <div className="gantt-columns-header" style={{ height: HEADER_HEIGHT }}>
                            {activeColumns.map((col) => (
                                <div key={col.key} className="gantt-col-hdr" style={{ width: col.width }}>
                                    {col.label}
                                </div>
                            ))}
                        </div>
                        <div className="gantt-columns-body" ref={colsBodyRef}>
                            {rows.map((row) => {
                                const isAdd = row.type === 'add-phase' || row.type === 'add-task' || row.type === 'add-subtask';
                                const isColSelected = !isAdd && selected?.type === row.type && selected?.id === row.id;
                                return (
                                    <div
                                        key={`col-${row.type}-${row.id}`}
                                        className={`gantt-columns-row${isColSelected ? ' selected' : ''}${isAdd ? ' gantt-columns-row--add' : ''} gantt-columns-row--${row.type}`}
                                        style={{ height: ROW_HEIGHT }}
                                    >
                                        {!isAdd && activeColumns.map((col) => {
                                            const isEditing = editingCell?.rowId === row.id && editingCell?.rowType === row.type && editingCell?.colKey === col.key;
                                            const cellEditable = row.type !== 'phase' && (canEdit || canEditStatus) && col.key !== 'assignees';
                                            return (
                                                <div
                                                    key={col.key}
                                                    className={`gantt-col-cell gantt-col-cell--${col.key}${cellEditable ? ' gantt-col-cell--editable' : ''}`}
                                                    style={{ width: col.width }}
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        if (cellEditable && !isEditing) setEditingCell({ rowId: row.id, rowType: row.type, colKey: col.key });
                                                    }}
                                                >
                                                    {/* Assignees */}
                                                    {col.key === 'assignees' && row.type !== 'phase' && (
                                                        <div className="gantt-col-assignees">
                                                            {(row.data.assignments || []).slice(0, 3).map((a) => (
                                                                <span
                                                                    key={a.member?.id || a.id}
                                                                    className={`gantt-col-avatar${a.member?.profilePhotoUrl ? '' : ' gantt-col-avatar--solid'}`}
                                                                    title={a.member?.fullName}
                                                                >
                                                                    {a.member?.profilePhotoUrl ? (
                                                                        <img src={getProfilePhotoUrl(a.member.id)} alt="" />
                                                                    ) : (
                                                                        (a.member?.fullName || '?').charAt(0).toUpperCase()
                                                                    )}
                                                                </span>
                                                            ))}
                                                            {(row.data.assignments || []).length > 3 && (
                                                                <span className="gantt-col-avatar gantt-col-avatar--more">
                                                                    +{row.data.assignments.length - 3}
                                                                </span>
                                                            )}
                                                        </div>
                                                    )}

                                                    {/* Status */}
                                                    {col.key === 'status' && row.type !== 'phase' && !isEditing && (
                                                        <span
                                                            className="gantt-col-badge"
                                                            style={{ background: STATUS_COLORS[row.data.status], color: '#fff' }}
                                                        >
                                                            {STATUS_LABELS[row.data.status] || row.data.status}
                                                        </span>
                                                    )}
                                                    {col.key === 'status' && row.type !== 'phase' && isEditing && (
                                                        <select
                                                            className="gantt-col-select"
                                                            ref={(el) => { if (el) { el.focus(); try { el.showPicker(); } catch (_) { } } }}
                                                            defaultValue={row.data.status}
                                                            onChange={(e) => handleCellUpdate(row.type, row.id, 'status', e.target.value)}
                                                            onBlur={() => setEditingCell(null)}
                                                        >
                                                            {Object.entries(STATUS_LABELS).map(([k, v]) => (
                                                                <option key={k} value={k}>{v}</option>
                                                            ))}
                                                        </select>
                                                    )}
                                                    {col.key === 'status' && row.type === 'phase' && (
                                                        <span
                                                            className="gantt-col-badge"
                                                            style={{ background: STATUS_COLORS[getPhaseStatus(row.data)], color: '#fff' }}
                                                        >
                                                            {STATUS_LABELS[getPhaseStatus(row.data)] || ''}
                                                        </span>
                                                    )}

                                                    {/* Priority */}
                                                    {col.key === 'priority' && row.type !== 'phase' && !isEditing && (
                                                        <span className="gantt-col-badge" style={{ background: PRIORITY_COLORS[row.data.priority], color: '#fff' }}>
                                                            {PRIORITY_LABELS[row.data.priority] || row.data.priority}
                                                        </span>
                                                    )}
                                                    {col.key === 'priority' && row.type !== 'phase' && isEditing && (
                                                        <select
                                                            className="gantt-col-select"
                                                            ref={(el) => { if (el) { el.focus(); try { el.showPicker(); } catch (_) { } } }}
                                                            defaultValue={row.data.priority}
                                                            onChange={(e) => handleCellUpdate(row.type, row.id, 'priority', e.target.value)}
                                                            onBlur={() => setEditingCell(null)}
                                                        >
                                                            {Object.entries(PRIORITY_LABELS).map(([k, v]) => (
                                                                <option key={k} value={k}>{v}</option>
                                                            ))}
                                                        </select>
                                                    )}

                                                    {/* Difficulty */}
                                                    {col.key === 'difficulty' && row.type !== 'phase' && !isEditing && (
                                                        <span className="gantt-col-badge" style={{ background: DIFFICULTY_COLORS[row.data.difficulty], color: '#fff' }}>
                                                            {DIFFICULTY_LABELS[row.data.difficulty] || row.data.difficulty}
                                                        </span>
                                                    )}
                                                    {col.key === 'difficulty' && row.type !== 'phase' && isEditing && (
                                                        <select
                                                            className="gantt-col-select"
                                                            ref={(el) => { if (el) { el.focus(); try { el.showPicker(); } catch (_) { } } }}
                                                            defaultValue={row.data.difficulty}
                                                            onChange={(e) => handleCellUpdate(row.type, row.id, 'difficulty', e.target.value)}
                                                            onBlur={() => setEditingCell(null)}
                                                        >
                                                            {Object.entries(DIFFICULTY_LABELS).map(([k, v]) => (
                                                                <option key={k} value={k}>{v}</option>
                                                            ))}
                                                        </select>
                                                    )}
                                                </div>
                                            );
                                        })}
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                )}

                {/* Right: Timeline panel */}
                <div className="gantt-timeline-panel" ref={timelineRef} onScroll={handleTimelineScroll}>
                    <div style={{ minWidth: totalWidth }}>
                        {/* Header */}
                        <div className="gantt-timeline-header" style={{ height: HEADER_HEIGHT }}>
                            <div className="gantt-header-top">
                                {topHeaders.map((h) => (
                                    <div
                                        key={h.key}
                                        className="gantt-header-top-cell"
                                        style={{ width: h.colSpan * colWidth }}
                                    >
                                        {h.label}
                                    </div>
                                ))}
                            </div>
                            <div className="gantt-header-bottom">
                                {columns.map((col) => (
                                    <div
                                        key={col.key}
                                        className={`gantt-header-bottom-cell${col.isToday ? ' today' : ''}${col.isWeekend ? ' weekend' : ''}`}
                                        style={{ width: colWidth }}
                                    >
                                        {col.label}
                                    </div>
                                ))}
                            </div>
                        </div>

                        {/* Body */}
                        <div className="gantt-timeline-body">
                            {/* Grid lines (rendered once, spans full height) */}
                            <div className="gantt-grid-lines">
                                {columns.map((col) => (
                                    <div
                                        key={col.key}
                                        className={`gantt-grid-col${col.isWeekend ? ' weekend' : ''}${col.isToday ? ' today' : ''}`}
                                        style={{ width: colWidth }}
                                    />
                                ))}
                            </div>

                            {/* Today line */}
                            {todayPx != null && (
                                <div className="gantt-today-line" style={{ left: todayPx }} />
                            )}

                            {/* Rows with bars */}
                            {rows.map((row) => {
                                // "Add" rows have no bar — just an empty spacer row
                                if (row.type === 'add-phase' || row.type === 'add-task' || row.type === 'add-subtask') {
                                    return (
                                        <div
                                            key={`tl-${row.id}`}
                                            className="gantt-timeline-row gantt-timeline-row--add"
                                            style={{ height: ROW_HEIGHT }}
                                        />
                                    );
                                }

                                const bar = getBarData(row);
                                const baselineBar = showBaselines ? getBaselineBarData(row) : null;
                                const isSelected = selected?.type === row.type && selected?.id === row.id;

                                return (
                                    <div
                                        key={`tl-${row.type}-${row.id}`}
                                        className={`gantt-timeline-row${isSelected ? ' selected' : ''}`}
                                        style={{ height: ROW_HEIGHT }}
                                        onClick={() => handleSelect(row.type, row.data, row.phase, row.parentTask)}
                                    >
                                        {/* Baseline bar (behind actual bar) */}
                                        {baselineBar && (
                                            <div
                                                className={`gantt-bar-baseline gantt-bar-baseline--${row.type}`}
                                                style={{ left: baselineBar.left, width: baselineBar.width }}
                                                title={`Baseline: ${fmtDate(row.data.baselineStartDate)} → ${fmtDate(row.data.baselineDueDate)}`}
                                            />
                                        )}
                                        {bar && (
                                            <div
                                                className={`gantt-bar gantt-bar--${row.type} gantt-bar--${bar.status}${bar.isMilestone ? ' gantt-bar--milestone' : ''}`}
                                                style={{ left: bar.left, width: bar.width }}
                                                title={getBarTooltip(row)}
                                            >
                                                {/* Show label inside bar if wide enough */}
                                                {bar.width > 60 && row.type !== 'phase' && (
                                                    <span className="gantt-bar-label">{row.data.title}</span>
                                                )}
                                            </div>
                                        )}
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
