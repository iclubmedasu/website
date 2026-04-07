'use client';

import { useState, useRef, useMemo, useCallback, useEffect } from 'react';
import { flushSync } from 'react-dom';
import {
    ChevronRight,
    ChevronDown,
    Plus,
    Pencil,
    Trash2,
    X,
    MessageCircle,
    History,
    Crosshair,
    ArrowUp,
    ArrowDown,
    Undo2,
    Redo2,
    Copy,
    Scissors,
    ClipboardPaste,
    Columns3,
    Download,
    Maximize2,
    Minimize2,
    Calendar,
} from 'lucide-react';
import { tasksAPI, phasesAPI, getProfilePhotoUrl } from '../../../../services/api';
import DeletePhaseTaskModal from '../../modals/DeletePhaseTaskModal';
import ScheduleTimetable from '../ScheduleTimetable/ScheduleTimetable';
import './GanttChart.css';

type ScaleKey = 'quarter' | 'month' | 'week' | 'day';

interface SheetCellStyleOptions {
    fill?: string;
    fontColor?: string;
    bold?: boolean;
    italic?: boolean;
    align?: string;
    valign?: string;
    wrapText?: boolean;
    indent?: number;
    border?: any;
    fillPattern?: string;
}

// ─────────────────────────────────────────────────────────
//  Constants
// ─────────────────────────────────────────────────────────
const STATUS_COLORS: Record<string, string> = {
    NOT_STARTED: '#94a3b8',
    IN_PROGRESS: '#3b82f6',
    COMPLETED: '#22c55e',
    DELAYED: '#f97316',
    BLOCKED: '#f87171',
    ON_HOLD: '#ca8a04',
    CANCELLED: '#991b1b',
};

const STATUS_LABELS: Record<string, string> = {
    NOT_STARTED: 'Not Started',
    IN_PROGRESS: 'In Progress',
    COMPLETED: 'Completed',
    DELAYED: 'Delayed',
    BLOCKED: 'Blocked',
    ON_HOLD: 'On Hold',
    CANCELLED: 'Cancelled',
};

const PRIORITY_LABELS: Record<string, string> = {
    LOW: 'Low',
    MEDIUM: 'Medium',
    HIGH: 'High',
    URGENT: 'Urgent',
};

const DIFFICULTY_LABELS: Record<string, string> = {
    EASY: 'Easy',
    MEDIUM: 'Medium',
    HARD: 'Hard',
    EXPERT: 'Expert',
};

const PRIORITY_COLORS: Record<string, string> = {
    LOW: '#22c55e',
    MEDIUM: '#3b82f6',
    HIGH: '#f97316',
    URGENT: '#ef4444',
};

const DIFFICULTY_COLORS: Record<string, string> = {
    EASY: '#22c55e',
    MEDIUM: '#3b82f6',
    HARD: '#f97316',
    EXPERT: '#ef4444',
};

// Progress % inferred from status (for items without subtasks)
const STATUS_PROGRESS: Record<string, number> = {
    NOT_STARTED: 0,
    IN_PROGRESS: 50,
    COMPLETED: 100,
    DELAYED: 25,
    BLOCKED: 10,
    ON_HOLD: 30,
    CANCELLED: 0,
};

// Toggleable attribute columns (order: assignees, status, priority, difficulty)
const ATTR_COLUMNS: Array<{ key: string; label: string; width: number }> = [
    { key: 'assignees', label: 'Assignees', width: 100 },
    { key: 'status', label: 'Status', width: 120 },
    { key: 'priority', label: 'Priority', width: 75 },
    { key: 'difficulty', label: 'Difficulty', width: 75 },
];

const SCALES: ScaleKey[] = ['quarter', 'month', 'week', 'day'];
const SCALE_LABELS: Record<ScaleKey, string> = { quarter: 'Quarters', month: 'Months', week: 'Weeks', day: 'Days' };
const COL_WIDTHS: Record<ScaleKey, number> = { quarter: 120, month: 100, week: 50, day: 32 };

const ROW_HEIGHT = 36;
const HEADER_HEIGHT = 52;
const DEFAULT_TREE_WIDTH = 360;
const MIN_TREE_WIDTH = 160;
const MAX_TREE_WIDTH = 600;
const MAX_TREE_WIDTH_MAXIMIZED = 960;
const TREE_WIDTH_MAXIMIZE_SCALE = 1.25;
const DAY_MS = 24 * 60 * 60 * 1000;
const PREVIEW_MEMBER_COLUMN_WIDTH = 180;
const PREVIEW_HOUR_WIDTH = 56;
const PREVIEW_MAX_WIDTH = 440;
const PREVIEW_PADDING = 12;
const PREVIEW_ESTIMATED_HEIGHT = 360;
const PREVIEW_HOVER_DELAY_MS = 900;

// ─────────────────────────────────────────────────────────
//  Date helpers
// ─────────────────────────────────────────────────────────
function startOfDay(d: any) {
    const r = new Date(d);
    r.setHours(0, 0, 0, 0);
    return r;
}

function addDays(d: any, n: number) {
    const r = new Date(d);
    r.setDate(r.getDate() + n);
    return r;
}

function applyElementStyles(
    node: HTMLElement | SVGElement | null,
    styles: Record<string, string | undefined>,
) {
    if (!node) return;
    const elementStyle = node.style as unknown as Record<string, string>;
    for (const [property, value] of Object.entries(styles)) {
        elementStyle[property] = value ?? '';
    }
}

function flattenTaskNodes(phases: any[] = []) {
    const nodes: any[] = [];

    const visitTask = (task: any, phase: any, parentTask: any = null, depth = 0) => {
        nodes.push({
            id: task.id,
            type: parentTask ? 'subtask' : 'task',
            phaseId: phase?.id ?? task.phaseId ?? null,
            parentTaskId: parentTask?.id ?? task.parentTaskId ?? null,
            depth,
            data: task,
            phase,
            parentTask,
        });

        for (const subtask of (task.subtasks || [])) {
            visitTask(subtask, phase, task, depth + 1);
        }
    };

    for (const phase of phases) {
        for (const task of (phase.tasks || [])) {
            visitTask(task, phase, null, 0);
        }
    }

    return nodes;
}

function getTaskDurationDays(task: any) {
    const startDate = task?.startDate ? new Date(task.startDate) : null;
    const dueDate = task?.dueDate ? new Date(task.dueDate) : null;

    if (startDate && dueDate) {
        const span = Math.ceil((dueDate.getTime() - startDate.getTime()) / DAY_MS);
        return Math.max(1, span);
    }

    if (task?.estimatedHours != null) {
        return Math.max(1, Math.ceil(Number(task.estimatedHours) / 8));
    }

    return 1;
}

function getPhaseDurationDays(phase: any) {
    const range = getPhaseRange(phase);
    if (!range.start && !range.end) return 1;

    const start = range.start || range.end;
    const end = range.end || range.start;
    if (!start || !end) return 1;
    const span = Math.ceil((end.getTime() - start.getTime()) / DAY_MS);
    return Math.max(1, span);
}

function getDependencyEdgeKey(edge: any) {
    return `${edge.sourceType || 'task'}:${edge.sourceId}->${edge.targetType || 'task'}:${edge.targetId}`;
}

function getOrderedPhases(phases: any[] = []) {
    return [...phases].sort((a, b) => {
        const orderA = Number.isFinite(Number(a.order)) ? Number(a.order) : Number.MAX_SAFE_INTEGER;
        const orderB = Number.isFinite(Number(b.order)) ? Number(b.order) : Number.MAX_SAFE_INTEGER;
        if (orderA !== orderB) return orderA - orderB;

        const dateA = a.createdAt ? new Date(a.createdAt).getTime() : 0;
        const dateB = b.createdAt ? new Date(b.createdAt).getTime() : 0;
        if (dateA !== dateB) return dateA - dateB;

        return (a.id || 0) - (b.id || 0);
    });
}

function buildDependencyGraph(nodes: any[] = []) {
    const nodeMap = new Map<any, any>(nodes.map((node) => [node.id, node]));
    const incoming = new Map<any, any[]>();
    const outgoing = new Map<any, any[]>();
    const edges: any[] = [];

    for (const node of nodes) {
        const dependencies = Array.isArray(node.data?.dependencies) ? node.data.dependencies : [];
        for (const dependency of dependencies) {
            const sourceId = dependency.dependsOnTask?.id ?? dependency.dependsOnTaskId;
            if (!sourceId || sourceId === node.id || !nodeMap.has(sourceId)) continue;

            const edge = {
                sourceId,
                targetId: node.id,
                sourceType: nodeMap.get(sourceId)?.type || 'task',
                targetType: node.type,
                dependencyType: dependency.dependencyType || 'FINISH_TO_START',
            };

            edges.push(edge);

            if (!outgoing.has(sourceId)) outgoing.set(sourceId, []);
            const sourceEdges = outgoing.get(sourceId);
            if (sourceEdges) sourceEdges.push(edge);

            if (!incoming.has(node.id)) incoming.set(node.id, []);
            const targetIncoming = incoming.get(node.id);
            if (targetIncoming) targetIncoming.push(edge);
        }
    }

    return { nodeMap, incoming, outgoing, edges };
}

function calculatePhaseChain(phases: any[] = []) {
    const orderedPhases = getOrderedPhases(phases);
    const nodeAnalysis = new Map<any, any>();
    const criticalPhaseIds = new Set<any>();
    const criticalEdgeKeys = new Set<string>();
    const edges: any[] = [];

    let elapsedDays = 0;

    for (let index = 0; index < orderedPhases.length; index++) {
        const phase = orderedPhases[index];
        const duration = getPhaseDurationDays(phase);
        const earliestStart = elapsedDays;
        const earliestFinish = earliestStart + duration;

        nodeAnalysis.set(phase.id, {
            durationDays: duration,
            earliestStart,
            earliestFinish,
            latestStart: earliestStart,
            latestFinish: earliestFinish,
            slack: 0,
            critical: true,
        });
        criticalPhaseIds.add(phase.id);

        if (index < orderedPhases.length - 1) {
            const nextPhase = orderedPhases[index + 1];
            const edge = {
                sourceId: phase.id,
                targetId: nextPhase.id,
                sourceType: 'phase',
                targetType: 'phase',
                dependencyType: 'FINISH_TO_START',
            };
            edges.push(edge);
            criticalEdgeKeys.add(getDependencyEdgeKey(edge));
        }

        elapsedDays = earliestFinish;
    }

    return { nodeAnalysis, criticalPhaseIds, criticalEdgeKeys, edges };
}

function topologicalSort(nodeIds: any[], incoming: Map<any, any[]>, outgoing: Map<any, any[]>) {
    const indegree = new Map<any, number>(nodeIds.map((id) => [id, 0]));

    for (const id of nodeIds) {
        indegree.set(id, (incoming.get(id) || []).length);
    }

    const queue: any[] = nodeIds.filter((id) => indegree.get(id) === 0);
    const ordered: any[] = [];

    while (queue.length > 0) {
        const id = queue.shift();
        if (id == null) continue;
        ordered.push(id);

        for (const edge of outgoing.get(id) || []) {
            const nextDegree = Number(indegree.get(edge.targetId) || 0) - 1;
            indegree.set(edge.targetId, nextDegree);
            if (nextDegree === 0) queue.push(edge.targetId);
        }
    }

    if (ordered.length < nodeIds.length) {
        const seen = new Set(ordered);
        for (const id of nodeIds) {
            if (!seen.has(id)) ordered.push(id);
        }
    }

    return ordered;
}

function calculateCriticalPath(nodes: any[] = [], phases: any[] = []) {
    if (!nodes.length) {
        const phaseChain = calculatePhaseChain(phases);
        return {
            nodeAnalysis: new Map(),
            criticalNodeIds: new Set(),
            criticalPhaseIds: phaseChain.criticalPhaseIds,
            criticalEdgeKeys: phaseChain.criticalEdgeKeys,
            edges: phaseChain.edges,
        };
    }

    const { incoming, outgoing, edges } = buildDependencyGraph(nodes);
    const nodeIds = nodes.map((node) => node.id);
    const orderedIds = topologicalSort(nodeIds, incoming, outgoing);
    const durationDays = new Map<any, number>(nodes.map((node) => [node.id, getTaskDurationDays(node.data)]));
    const earliestStart = new Map<any, number>();

    for (const id of orderedIds) {
        let start = 0;
        for (const edge of incoming.get(id) || []) {
            const predecessorStart = earliestStart.get(edge.sourceId) ?? 0;
            const predecessorDuration = durationDays.get(edge.sourceId) ?? 1;
            const constraint = edge.dependencyType === 'START_TO_START'
                ? predecessorStart
                : predecessorStart + predecessorDuration;
            start = Math.max(start, constraint);
        }
        earliestStart.set(id, start);
    }

    let projectDuration = 1;
    for (const id of orderedIds) {
        const finish = (earliestStart.get(id) ?? 0) + (durationDays.get(id) ?? 1);
        projectDuration = Math.max(projectDuration, finish);
    }

    const latestStart = new Map<any, number>();

    for (let i = orderedIds.length - 1; i >= 0; i--) {
        const id = orderedIds[i];
        const nodeDuration = durationDays.get(id) ?? 1;
        const successors = outgoing.get(id) || [];

        let latest = projectDuration - nodeDuration;
        if (successors.length > 0) {
            latest = Math.min(...successors.map((edge) => {
                const successorLatestStart = latestStart.get(edge.targetId) ?? (projectDuration - (durationDays.get(edge.targetId) ?? 1));
                if (edge.dependencyType === 'START_TO_START') {
                    return successorLatestStart;
                }
                return successorLatestStart - nodeDuration;
            }));
        }

        if (!Number.isFinite(latest)) latest = earliestStart.get(id) ?? 0;
        latestStart.set(id, Math.max(0, latest));
    }

    const nodeAnalysis = new Map<any, any>();
    const criticalNodeIds = new Set<any>();

    for (const node of nodes) {
        const es = earliestStart.get(node.id) ?? 0;
        const ls = latestStart.get(node.id) ?? es;
        const duration = durationDays.get(node.id) ?? 1;
        const slack = Math.max(0, ls - es);
        const critical = slack <= 0.0001;

        if (critical) criticalNodeIds.add(node.id);
        nodeAnalysis.set(node.id, {
            durationDays: duration,
            earliestStart: es,
            earliestFinish: es + duration,
            latestStart: ls,
            latestFinish: ls + duration,
            slack,
            critical,
        });
    }

    const criticalEdgeKeys = new Set<string>();

    for (const edge of edges) {
        const source = nodeAnalysis.get(edge.sourceId);
        const target = nodeAnalysis.get(edge.targetId);
        if (!source || !target || !source.critical || !target.critical) continue;

        const satisfiesConstraint = edge.dependencyType === 'START_TO_START'
            ? Math.abs(target.earliestStart - source.earliestStart) <= 0.0001
            : Math.abs(target.earliestStart - source.earliestFinish) <= 0.0001;

        if (satisfiesConstraint) {
            criticalEdgeKeys.add(getDependencyEdgeKey(edge));
        }
    }

    const phaseChain = calculatePhaseChain(phases);
    const criticalPhaseIds = new Set([...phaseChain.criticalPhaseIds]);
    for (const node of nodes) {
        if (criticalNodeIds.has(node.id) && node.phaseId) {
            criticalPhaseIds.add(node.phaseId);
        }
    }

    for (const edgeKey of phaseChain.criticalEdgeKeys) {
        criticalEdgeKeys.add(edgeKey);
    }

    return {
        nodeAnalysis,
        criticalNodeIds,
        criticalPhaseIds,
        criticalEdgeKeys,
        edges: [...edges, ...phaseChain.edges],
    };
}

function downloadBlob(blob: Blob, filename: string) {
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = filename;
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1500);
}

function withFrozenPaneInWorksheetXml(
    worksheetXml: string,
    {
        xSplit,
        ySplit,
        topLeftCell,
        activePane = 'bottomRight',
    }: {
        xSplit: number;
        ySplit: number;
        topLeftCell: string;
        activePane?: string;
    },
) {
    const paneXml = `<pane xSplit="${xSplit}" ySplit="${ySplit}" topLeftCell="${topLeftCell}" activePane="${activePane}" state="frozen"/>`;

    if (!/<sheetViews\b[^>]*>[\s\S]*<\/sheetViews>/.test(worksheetXml)) {
        return worksheetXml.replace(
            /<sheetData\b/,
            `<sheetViews><sheetView workbookViewId="0">${paneXml}</sheetView></sheetViews><sheetData`,
        );
    }

    if (/<sheetView\b[^>]*\/>/.test(worksheetXml)) {
        return worksheetXml.replace(/<sheetView\b([^>]*)\/>/, `<sheetView$1>${paneXml}</sheetView>`);
    }

    if (/<pane\b[^>]*\/>/.test(worksheetXml)) {
        return worksheetXml.replace(/<pane\b[^>]*\/>/, paneXml);
    }

    return worksheetXml.replace(/<sheetView\b([^>]*)>/, `<sheetView$1>${paneXml}`);
}

function formatExportDate(value: any) {
    if (!value) return '';
    const date = getDateOrNull(value);
    if (!date) return '';
    const day = String(date.getDate()).padStart(2, '0');
    const month = String(date.getMonth() + 1).padStart(2, '0');
    return `${day}-${month}-${date.getFullYear()}`;
}

function getExportContentWidth(values: any[] = [], { minWidth = 8, maxWidth = 16, padding = 2 }: { minWidth?: number; maxWidth?: number; padding?: number } = {}) {
    const longest = values.reduce((max, value) => {
        const length = String(value ?? '').length;
        return Math.max(max, length);
    }, 0);

    return Math.min(maxWidth, Math.max(minWidth, longest + padding));
}

function getDateOrNull(value: any): Date | null {
    if (!value) return null;
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? null : date;
}

function formatPreviewDateLabel(value: any) {
    const date = getDateOrNull(value);
    if (!date) return '—';

    return date.toLocaleDateString([], {
        month: 'short',
        day: '2-digit',
    });
}

function uniqueSlots(slots: any[] = []) {
    const seen = new Set<any>();
    return slots.filter((slot) => {
        const key = slot?.id ?? `${slot?.member?.id ?? 'member'}-${slot?.task?.id ?? 'task'}-${slot?.startDateTime ?? ''}-${slot?.endDateTime ?? ''}-${slot?.title ?? ''}`;
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
    });
}

function slotOverlapsRange(slot: any, rangeStart: Date | null, rangeEnd: Date | null) {
    const start = getDateOrNull(slot?.startDateTime);
    const end = getDateOrNull(slot?.endDateTime);
    if (!start || !end || !rangeStart || !rangeEnd) return false;
    return start <= rangeEnd && end >= rangeStart;
}

function getPreviewWindow(slots: any[] = [], fallbackStart: any = null, fallbackEnd: any = null) {
    let start = getDateOrNull(fallbackStart);
    let end = getDateOrNull(fallbackEnd);

    for (const slot of slots) {
        const slotStart = getDateOrNull(slot?.startDateTime);
        const slotEnd = getDateOrNull(slot?.endDateTime);
        if (slotStart && (!start || slotStart < start)) start = slotStart;
        if (slotEnd && (!end || slotEnd > end)) end = slotEnd;
    }

    if (!start && end) start = new Date(end);
    if (!end && start) end = new Date(start);
    if (!start || !end) return null;
    if (start.getTime() === end.getTime()) end = new Date(start.getTime() + DAY_MS);

    return { start, end };
}

function getPreviewPosition(rect: DOMRect | { left: number; top: number; width: number; bottom: number }) {
    const popupWidth = Math.min(PREVIEW_MAX_WIDTH, window.innerWidth - PREVIEW_PADDING * 2);
    const popupHeight = PREVIEW_ESTIMATED_HEIGHT;
    const centeredLeft = rect.left + (rect.width / 2) - (popupWidth / 2);
    const left = Math.max(PREVIEW_PADDING, Math.min(centeredLeft, window.innerWidth - popupWidth - PREVIEW_PADDING));
    const spaceBelow = window.innerHeight - rect.bottom - PREVIEW_PADDING;
    const spaceAbove = rect.top - PREVIEW_PADDING;
    const placeAbove = spaceBelow < popupHeight && spaceAbove > spaceBelow;
    let top = placeAbove
        ? rect.top - popupHeight - PREVIEW_PADDING
        : rect.bottom + PREVIEW_PADDING;
    top = Math.max(PREVIEW_PADDING, Math.min(top, window.innerHeight - popupHeight - PREVIEW_PADDING));

    return {
        left,
        top,
        width: popupWidth,
        placement: placeAbove ? 'above' : 'below',
    };
}

function getPreviewKindLabel(rowType: any) {
    if (rowType === 'phase') return 'Phase';
    if (rowType === 'subtask') return 'Subtask';
    return 'Task';
}

function collectPreviewSlots(row: any, allTaskNodes: any[] = [], projectDetail: any = null) {
    if (!row) return [];

    if (row.type === 'phase') {
        const phaseRange = getPhaseRange(row.data);
        const phaseStart = phaseRange.start ? new Date(phaseRange.start) : null;
        const phaseEnd = phaseRange.end ? new Date(phaseRange.end) : null;
        const descendantSlots = allTaskNodes
            .filter((node: any) => node.phaseId === row.id)
            .flatMap((node: any) => node.data?.scheduleSlots || []);
        const projectSlots = (projectDetail?.scheduleSlots || []).filter((slot: any) => {
            if (!phaseStart || !phaseEnd) return true;
            return slotOverlapsRange(slot, phaseStart, phaseEnd);
        });

        return uniqueSlots([...descendantSlots, ...projectSlots]);
    }

    return uniqueSlots(row.data?.scheduleSlots || []);
}

function hexToArgb(hex: any) {
    const value = String(hex || '').replace('#', '').trim();
    if (value.length === 6) return `FF${value.toUpperCase()}`;
    if (value.length === 8) return value.toUpperCase();
    return 'FFFFFFFF';
}

function formatExportShortDate(value: any) {
    const date = getDateOrNull(value);
    if (!date) return '';
    return date.toLocaleDateString('en-GB', { day: '2-digit', month: 'short' });
}

function waitForNextPaint(): Promise<void> {
    return new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(() => resolve())));
}

function getWeekStartDate(date: any) {
    const result = startOfDay(date);
    const day = result.getDay();
    result.setDate(result.getDate() - ((day + 6) % 7));
    return result;
}

function getExportRowRange(row: any) {
    if (!row) return { start: null, end: null };

    if (row.type === 'phase') {
        const range = getPhaseRange(row.data);
        return {
            start: range.start ? new Date(range.start) : null,
            end: range.end ? new Date(range.end) : null,
        };
    }

    return {
        start: getDateOrNull(row.data?.startDate),
        end: getDateOrNull(row.data?.dueDate),
    };
}

function buildExportRows(phases: any[] = []) {
    const exportRows: any[] = [];

    const pushRow = (type: any, data: any, depth: number, phase: any = null, parentTask: any = null) => {
        const range = getExportRowRange({ type, data, phase, parentTask });
        const status = type === 'phase' ? getPhaseStatus(data) : data?.status;
        const priority = type === 'phase' ? '' : (data?.priority || '');
        const difficulty = type === 'phase' ? '' : (data?.difficulty || '');
        const start = range.start;
        const end = range.end;
        const durationDays = start && end
            ? Math.max(1, Math.ceil((end.getTime() - start.getTime()) / DAY_MS))
            : (start || end ? 1 : '');

        const assignments = Array.isArray(data?.assignments)
            ? data.assignments
            : Array.isArray(data?.assignees)
                ? data.assignees
                : [];
        const dependencies = Array.isArray(data?.dependencies) ? data.dependencies : [];

        exportRows.push({
            type,
            depth,
            phase,
            parentTask,
            data,
            status,
            priority,
            difficulty,
            start,
            end,
            durationDays,
            wbs: data?.wbs || '',
            name: data?.title || '',
            dependencies: dependencies
                .map((dependency: any) => dependency.dependsOnTask?.title || dependency.dependsOnTask?.fileName || dependency.dependsOnTaskId)
                .filter(Boolean)
                .join(', '),
            assignees: assignments
                .map((assignment: any) => assignment.member?.fullName || assignment.fullName || assignment.name || assignment.memberName)
                .filter(Boolean)
                .join(', '),
            statusColor: STATUS_COLORS[status] || STATUS_COLORS.NOT_STARTED,
            priorityColor: type === 'phase' ? '' : (PRIORITY_COLORS[priority] || ''),
            difficultyColor: type === 'phase' ? '' : (DIFFICULTY_COLORS[difficulty] || ''),
        });
    };

    for (const phase of phases) {
        pushRow('phase', phase, 0);
        for (const task of (phase.tasks || [])) {
            pushRow('task', task, 1, phase, null);
            for (const subtask of (task.subtasks || [])) {
                pushRow('subtask', subtask, 2, phase, task);
            }
        }
    }

    return exportRows;
}

function getExportDateRange(phases: any[] = [], projectStartDate: any = null, projectDueDate: any = null) {
    let start = getDateOrNull(projectStartDate);
    let end = getDateOrNull(projectDueDate);

    for (const phase of phases) {
        const phaseRange = getPhaseRange(phase);
        if (phaseRange.start && (!start || phaseRange.start < start)) start = phaseRange.start;
        if (phaseRange.end && (!end || phaseRange.end > end)) end = phaseRange.end;

        for (const task of (phase.tasks || [])) {
            const taskStart = getDateOrNull(task.startDate);
            const taskEnd = getDateOrNull(task.dueDate);
            if (taskStart && (!start || taskStart < start)) start = taskStart;
            if (taskEnd && (!end || taskEnd > end)) end = taskEnd;

            for (const subtask of (task.subtasks || [])) {
                const subStart = getDateOrNull(subtask.startDate);
                const subEnd = getDateOrNull(subtask.dueDate);
                if (subStart && (!start || subStart < start)) start = subStart;
                if (subEnd && (!end || subEnd > end)) end = subEnd;
            }
        }
    }

    if (!start && !end) {
        const today = startOfDay(new Date());
        return { start: today, end: today };
    }

    if (!start && end) start = new Date(end);
    if (!end && start) end = new Date(start);
    if (!start || !end) {
        const today = startOfDay(new Date());
        return { start: today, end: today };
    }

    const normalizedStart = startOfDay(start);
    const normalizedEnd = startOfDay(end);
    if (normalizedStart > normalizedEnd) {
        return { start: normalizedEnd, end: normalizedStart };
    }

    return { start: normalizedStart, end: normalizedEnd };
}

function buildExportTimeline(rangeStart: any, rangeEnd: any) {
    const days: Date[] = [];
    let cursor = startOfDay(rangeStart);
    const end = startOfDay(rangeEnd);

    while (cursor <= end) {
        days.push(new Date(cursor));
        cursor = addDays(cursor, 1);
    }

    const buildBands = (keyFn: (day: Date) => string, labelFn: (day: Date) => string) => {
        const bands: any[] = [];
        let current: any = null;

        days.forEach((day, index) => {
            const key = keyFn(day);
            if (!current || current.key !== key) {
                if (current) bands.push(current);
                current = {
                    key,
                    label: labelFn(day),
                    startIndex: index,
                    endIndex: index,
                };
            } else {
                current.endIndex = index;
            }
        });

        if (current) bands.push(current);
        return bands;
    };

    return {
        days,
        yearBands: buildBands(
            (day) => String(day.getFullYear()),
            (day) => String(day.getFullYear()),
        ),
        quarterBands: buildBands(
            (day) => `${day.getFullYear()}-Q${Math.floor(day.getMonth() / 3) + 1}`,
            (day) => `Q${Math.floor(day.getMonth() / 3) + 1}`,
        ),
        monthBands: buildBands(
            (day) => `${day.getFullYear()}-${day.getMonth()}`,
            (day) => day.toLocaleDateString('en-GB', { month: 'short' }),
        ),
        weekBands: buildBands(
            (day) => getWeekStartDate(day).toISOString().split('T')[0],
            (day) => formatExportShortDate(getWeekStartDate(day)),
        ),
    };
}

function collectScheduleTimelineSlots(projectDetail: any, allTaskNodes: any[] = []) {
    const slotSources = [
        ...(projectDetail?.scheduleSlots || []),
        ...allTaskNodes.flatMap((node) => node.data?.scheduleSlots || []),
    ];

    return uniqueSlots(slotSources).filter((slot) => getDateOrNull(slot?.startDateTime) && getDateOrNull(slot?.endDateTime));
}

function formatScheduleClock(date: any) {
    const value = getDateOrNull(date);
    if (!value) return '—';
    return `${String(value.getHours()).padStart(2, '0')}:00`;
}

function formatScheduleClockRange(start: any, end: any) {
    const startDate = getDateOrNull(start);
    const endDate = getDateOrNull(end);
    if (!startDate || !endDate) return '—';

    const formatClock = (date: Date) => `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`;
    return `${formatClock(startDate)} - ${formatClock(endDate)}`;
}

function getLocalDateKey(date: Date) {
    return [date.getFullYear(), String(date.getMonth() + 1).padStart(2, '0'), String(date.getDate()).padStart(2, '0')].join('-');
}

function getScheduleTimelineMinuteOffset(date: any, timelineStart: Date | null) {
    const current = getDateOrNull(date);
    if (!current || !timelineStart) return null;
    return (current.getTime() - timelineStart.getTime()) / 60000;
}

function getScheduleMemberLabel(slot: any) {
    const fullName = String(slot?.member?.fullName || '').trim();
    if (fullName) return fullName;

    const fallbackId = slot?.member?.id ?? slot?.memberId ?? slot?.createdBy?.id ?? slot?.createdByMemberId ?? null;
    if (fallbackId != null) return `Member #${fallbackId}`;

    return 'Member';
}

function getScheduleSlotLabel(slot: any) {
    return String(slot?.title || slot?.task?.title || 'Time slot').trim();
}

function buildScheduleTimelineExport(slots: any[] = []) {
    const visibleDays = [];
    const seenDays = new Set();

    let timelineStart = null;
    let timelineEnd = null;

    for (const slot of slots) {
        const start = getDateOrNull(slot?.startDateTime);
        const end = getDateOrNull(slot?.endDateTime);
        if (!start || !end) continue;

        if (!timelineStart || start < timelineStart) timelineStart = start;
        if (!timelineEnd || end > timelineEnd) timelineEnd = end;
    }

    if (!timelineStart || !timelineEnd) return null;

    let cursor = startOfDay(timelineStart);
    const lastDay = startOfDay(timelineEnd);

    while (cursor <= lastDay) {
        const dayKey = getLocalDateKey(cursor);
        if (!seenDays.has(dayKey)) {
            seenDays.add(dayKey);
            visibleDays.push(new Date(cursor));
        }
        cursor = addDays(cursor, 1);
    }

    const columns = [];
    const dayGroups = [];

    for (const day of visibleDays) {
        const startIndex = columns.length;
        for (let hour = 0; hour < 24; hour++) {
            const hourDate = new Date(day);
            hourDate.setHours(hour, 0, 0, 0);
            columns.push({
                key: `${getLocalDateKey(day)}-${String(hour).padStart(2, '0')}`,
                date: hourDate,
                label: formatScheduleClock(hourDate),
                isWeekend: day.getDay() === 0 || day.getDay() === 6,
            });
        }

        dayGroups.push({
            key: getLocalDateKey(day),
            label: formatExportShortDate(day),
            startIndex,
            endIndex: columns.length - 1,
        });
    }

    return {
        visibleDays,
        columns,
        dayGroups,
        timelineStart: startOfDay(timelineStart),
        timelineEnd: startOfDay(timelineEnd),
    };
}

function groupScheduleSlotsByMember(slots: any[] = []) {
    const groups = new Map<any, any>();

    for (const slot of slots) {
        const key = slot?.member?.id ?? slot?.memberId ?? slot?.createdBy?.id ?? slot?.createdByMemberId ?? slot?.id ?? `slot-${slot?.id}`;
        const label = getScheduleMemberLabel(slot);

        if (!groups.has(key)) {
            groups.set(key, { key, label, slots: [] });
        }

        const group = groups.get(key);
        if (!group.label || group.label === 'Member') {
            group.label = label;
        }

        group.slots.push(slot);
    }

    return [...groups.values()]
        .map((group) => ({
            ...group,
            slots: group.slots.sort((a: any, b: any) => {
                const startA = getDateOrNull(a.startDateTime)?.getTime() ?? 0;
                const startB = getDateOrNull(b.startDateTime)?.getTime() ?? 0;
                return startA - startB;
            }),
        }))
        .sort((a, b) => (a.label ?? '').localeCompare(b.label ?? ''));
}

function buildScheduleTimelineSheet(XLSX: any, slots: any[] = [], title = 'Schedule Timeline') {
    const timeline = buildScheduleTimelineExport(slots);
    const sheetTitle = title || 'Schedule Timeline';

    if (!timeline) {
        const sheet = XLSX.utils.aoa_to_sheet([
            [sheetTitle],
            ['No schedule slots available.'],
        ]);

        sheet['!merges'] = [{ s: { r: 0, c: 0 }, e: { r: 0, c: 4 } }];
        sheet['!cols'] = [{ wch: 28 }, { wch: 18 }, { wch: 18 }, { wch: 18 }, { wch: 18 }];
        sheet['!rows'] = [{ hpt: 24 }, { hpt: 22 }];

        applySheetCellStyle(sheet.A1, {
            fill: '#5b21b6',
            fontColor: '#ffffff',
            bold: true,
            align: 'left',
            wrapText: true,
        });

        applySheetCellStyle(sheet.A2, {
            fill: '#f8fafc',
            fontColor: '#475569',
            align: 'left',
            wrapText: true,
        });

        return sheet;
    }

    const groupedSlots = groupScheduleSlotsByMember(slots);
    const totalColumns = 1 + timeline.columns.length;
    const totalRows = 3 + groupedSlots.length;
    const matrix = Array.from({ length: totalRows }, () => Array(totalColumns).fill(''));
    const merges = [];
    const titleRow = 0;
    const dayRow = 1;
    const hourRow = 2;
    const dataRowStart = 3;

    matrix[titleRow][0] = sheetTitle;
    merges.push({ s: { r: titleRow, c: 0 }, e: { r: titleRow, c: totalColumns - 1 } });

    matrix[dayRow][0] = 'Member Name';
    matrix[hourRow][0] = 'Time';

    timeline.dayGroups.forEach((group) => {
        const startCol = 1 + group.startIndex;
        const endCol = 1 + group.endIndex;
        matrix[dayRow][startCol] = group.label;
        if (endCol > startCol) {
            merges.push({ s: { r: dayRow, c: startCol }, e: { r: dayRow, c: endCol } });
        }
    });

    timeline.columns.forEach((column, index) => {
        matrix[hourRow][1 + index] = column.label;
    });

    const dayHeaderBorder = {
        top: { style: 'thin', color: { rgb: hexToArgb('#E5E7EB') } },
        left: { style: 'thin', color: { rgb: hexToArgb('#E5E7EB') } },
        right: { style: 'thin', color: { rgb: hexToArgb('#E5E7EB') } },
        bottom: { style: 'medium', color: { rgb: hexToArgb('#7c3aed') } },
    };

    const cellBorder = {
        top: { style: 'thin', color: { rgb: hexToArgb('#E5E7EB') } },
        bottom: { style: 'thin', color: { rgb: hexToArgb('#E5E7EB') } },
        left: { style: 'thin', color: { rgb: hexToArgb('#E5E7EB') } },
        right: { style: 'thin', color: { rgb: hexToArgb('#E5E7EB') } },
    };

    const sheet = XLSX.utils.aoa_to_sheet(matrix);
    sheet['!merges'] = merges;
    const memberRowLabels = groupedSlots.map((group) => `${group.label}\n${group.slots.length} slot${group.slots.length === 1 ? '' : 's'}`);
    const memberColumnWidth = getExportContentWidth(['Member Name', ...memberRowLabels], { minWidth: 22, maxWidth: 34, padding: 2 });
    const timeColumnWidths = timeline.columns.map((column, index) => {
        const samples = [column.label];
        for (const group of groupedSlots) {
            for (const slot of group.slots) {
                const slotStart = getDateOrNull(slot.startDateTime);
                const slotEnd = getDateOrNull(slot.endDateTime);
                if (!slotStart || !slotEnd) continue;

                const startMinutes = getScheduleTimelineMinuteOffset(slotStart, timeline.timelineStart);
                const endMinutes = getScheduleTimelineMinuteOffset(slotEnd, timeline.timelineStart);
                if (startMinutes == null || endMinutes == null) continue;

                const startIndex = Math.max(0, Math.floor(startMinutes / 60));
                if (startIndex !== index) continue;

                const slotLabel = getScheduleSlotLabel(slot);
                const timeLabel = formatScheduleClockRange(slot.startDateTime, slot.endDateTime);
                samples.push(`${slotLabel}\n${timeLabel}`);
            }
        }

        return getExportContentWidth(samples, { minWidth: 8, maxWidth: 16, padding: 2 });
    });

    sheet['!cols'] = [
        { wch: memberColumnWidth },
        ...timeColumnWidths.map((wch) => ({ wch })),
    ];
    sheet['!rows'] = [
        { hpt: 24 },
        { hpt: 20 },
        { hpt: 20 },
        ...groupedSlots.map(() => ({ hpt: 48 })),
    ];

    const styleCell = (rowIndex: number, colIndex: number, styles: any, value = '') => {
        const cellRef = XLSX.utils.encode_cell({ r: rowIndex, c: colIndex });
        const cell = sheet[cellRef] || (sheet[cellRef] = { t: 's', v: value });
        applySheetCellStyle(cell, styles);
        return cell;
    };

    const titleFill = '#5b21b6';
    const dayFill = '#6d28d9';
    const hourFill = '#ede9fe';
    const memberFill = '#f8fafc';

    for (let col = 0; col < totalColumns; col++) {
        styleCell(titleRow, col, {
            fill: titleFill,
            fontColor: '#ffffff',
            bold: true,
            align: 'center',
            wrapText: true,
            border: cellBorder,
        });
    }

    styleCell(dayRow, 0, {
        fill: '#4c1d95',
        fontColor: '#ffffff',
        bold: true,
        align: 'center',
        wrapText: true,
        border: cellBorder,
    });
    styleCell(hourRow, 0, {
        fill: '#ede9fe',
        fontColor: '#4c1d95',
        bold: true,
        align: 'center',
        wrapText: true,
        border: dayHeaderBorder,
    });

    timeline.dayGroups.forEach((group) => {
        for (let col = group.startIndex + 1; col <= group.endIndex + 1; col++) {
            styleCell(dayRow, col, {
                fill: dayFill,
                fontColor: '#ffffff',
                bold: true,
                align: 'center',
                wrapText: true,
                border: dayHeaderBorder,
            });
        }
    });

    timeline.columns.forEach((column, index) => {
        styleCell(hourRow, 1 + index, {
            fill: column.isWeekend ? '#f5f3ff' : hourFill,
            fontColor: '#4c1d95',
            bold: true,
            align: 'center',
            wrapText: true,
            border: cellBorder,
        });
    });

    groupedSlots.forEach((group, groupIndex) => {
        const sheetRow = dataRowStart + groupIndex;
        const rowFill = groupIndex % 2 === 0 ? '#ffffff' : '#f8fafc';
        matrix[sheetRow][0] = `${group.label}\n${group.slots.length} slot${group.slots.length === 1 ? '' : 's'}`;

        styleCell(sheetRow, 0, {
            fill: memberFill,
            fontColor: '#111827',
            bold: true,
            align: 'left',
            wrapText: true,
            border: cellBorder,
        });

        timeline.columns.forEach((_column, index) => {
            styleCell(sheetRow, 1 + index, {
                fill: rowFill,
                fontColor: '#111827',
                align: 'center',
                border: cellBorder,
            });
        });

        for (const slot of group.slots) {
            const slotStart = getDateOrNull(slot.startDateTime);
            const slotEnd = getDateOrNull(slot.endDateTime);
            if (!slotStart || !slotEnd) continue;

            const startMinutes = getScheduleTimelineMinuteOffset(slotStart, timeline.timelineStart);
            const endMinutes = getScheduleTimelineMinuteOffset(slotEnd, timeline.timelineStart);
            if (startMinutes == null || endMinutes == null) continue;

            const startIndex = Math.max(0, Math.floor(startMinutes / 60));
            const endIndex = Math.max(startIndex, Math.ceil(endMinutes / 60) - 1);
            const fillColor = slot.isActive === false ? '#94a3b8' : '#7c3aed';
            const slotLabel = getScheduleSlotLabel(slot);
            const timeLabel = formatScheduleClockRange(slot.startDateTime, slot.endDateTime);

            for (let columnIndex = startIndex; columnIndex <= endIndex && columnIndex < timeline.columns.length; columnIndex++) {
                const cell = styleCell(sheetRow, 1 + columnIndex, {
                    fill: fillColor,
                    fontColor: '#ffffff',
                    bold: columnIndex === startIndex,
                    align: 'center',
                    wrapText: true,
                    border: cellBorder,
                });

                if (columnIndex === startIndex) {
                    cell.v = timeLabel ? `${slotLabel}\n${timeLabel}` : slotLabel;
                    cell.t = 's';
                }
            }
        }
    });

    return sheet;
}

function applySheetCellStyle(cell: any, {
    fill,
    fontColor = '000000',
    bold = false,
    italic = false,
    align = 'left',
    valign = 'center',
    wrapText = false,
    indent = 0,
    border = null,
    fillPattern = 'solid',
}: SheetCellStyleOptions = {}) {
    if (!cell) return;
    cell.s = {
        font: {
            name: 'Arial',
            sz: 10,
            bold,
            italic,
            color: { rgb: hexToArgb(fontColor) },
        },
        alignment: {
            horizontal: align,
            vertical: valign,
            wrapText,
            indent,
        },
        fill: fill ? {
            patternType: fillPattern,
            fgColor: { rgb: hexToArgb(fill) },
        } : undefined,
        border: border || undefined,
    };
}

// ─────────────────────────────────────────────────────────
//  Timeline generation
// ─────────────────────────────────────────────────────────
function generateTimeline(rangeStart: any, rangeEnd: any, scale: ScaleKey) {
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
function dateToPx(date: any, columns: any[], colWidth: number) {
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
function getPhaseRange(phase: any) {
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
function getPhaseStatus(phase: any) {
    const tasks = phase.tasks || [];
    if (tasks.length === 0) return 'NOT_STARTED';
    const allDone = tasks.every((t: any) => t.status === 'COMPLETED');
    if (allDone) return 'COMPLETED';
    const anyActive = tasks.some((t: any) => t.status === 'IN_PROGRESS');
    if (anyActive) return 'IN_PROGRESS';
    const anyDelayed = tasks.some((t: any) => t.status === 'DELAYED');
    if (anyDelayed) return 'DELAYED';
    const anyBlocked = tasks.some((t: any) => t.status === 'BLOCKED');
    if (anyBlocked) return 'BLOCKED';
    return 'NOT_STARTED';
}

// ─────────────────────────────────────────────────────────
//  Format a date for tooltip
// ─────────────────────────────────────────────────────────
function fmtDate(d: any) {
    if (!d) return '—';
    return new Date(d).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
}

function fmtDateCompact(d: any) {
    if (!d) return '—';
    return new Date(d).toLocaleDateString('en-GB', { day: '2-digit', month: 'short' });
}

// ─────────────────────────────────────────────────────────
//  GanttChart — main export
// ─────────────────────────────────────────────────────────
export default function GanttChart({
    phases,
    projectId,
    projectTitle,
    projectDetail,
    projectStartDate,
    projectDueDate,
    currentMemberId,
    canEdit,
    canEditStatus,
    onAddPhase,
    onAddTask,
    onAddSubtask,
    onEditPhase,
    onEditTask,
    onOpenTaskComments,
    onOpenTaskScheduleSlots,
    onOpenTaskActivity,
    onDeletePhase,
    onRefresh,
}: any) {
    void onDeletePhase;
    const [scale, setScale] = useState<ScaleKey>('week');
    const [selected, setSelected] = useState<any>(null); // { type, id, data, phase?, parentTask? }
    const [expandedPhases, setExpandedPhases] = useState<Set<any>>(() => new Set(phases.map((p: any) => p.id)));
    const [expandedTasks, setExpandedTasks] = useState<Set<any>>(new Set());
    const [confirmDelete, setConfirmDelete] = useState<any>(null); // { type, id, title }
    const [isMaximized, setIsMaximized] = useState(false);
    const [exportingFormat, setExportingFormat] = useState<'png' | 'xlsx' | null>(null);
    const [preview, setPreview] = useState<any>(null);

    // Clipboard: { mode: 'copy'|'cut', type: 'phase'|'task'|'subtask', id, data, phase?, parentTask? }
    const [clipboard, setClipboard] = useState<any>(null);

    // Undo / redo stacks stored in refs (don't trigger re-renders on their own)
    // Each entry: { description: string, undo: async () => void, redo: async () => void }
    const undoStackRef = useRef<any[]>([]);
    const redoStackRef = useRef<any[]>([]);
    const [, setUndoRedoVersion] = useState(0); // bump to re-render toolbar

    const pushUndo = useCallback((entry: any) => {
        undoStackRef.current.push(entry);
        redoStackRef.current = [];
        setUndoRedoVersion((v) => v + 1);
    }, []);

    const treeBodyRef = useRef<any>(null);
    const timelineRef = useRef<any>(null);
    const colsBodyRef = useRef<any>(null);
    const ganttMainRef = useRef<any>(null);
    const previewPopoverRef = useRef<any>(null);
    const barRefs = useRef<Map<string, any>>(new Map());
    const previewHoverTimerRef = useRef<number | null>(null);

    // ── Resizable tree panel ──
    const [treeWidth, setTreeWidth] = useState<number>(DEFAULT_TREE_WIDTH);
    const isResizingRef = useRef(false);
    const resizeStartXRef = useRef(0);
    const resizeStartWidthRef = useRef(DEFAULT_TREE_WIDTH);

    useEffect(() => {
        const handleMouseMove = (e: MouseEvent) => {
            if (!isResizingRef.current) return;
            const delta = e.clientX - resizeStartXRef.current;
            const maxWidth = isMaximized ? MAX_TREE_WIDTH_MAXIMIZED : MAX_TREE_WIDTH;
            const newWidth = Math.min(maxWidth, Math.max(MIN_TREE_WIDTH, resizeStartWidthRef.current + delta));
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
    }, [isMaximized]);

    const handleResizeStart = useCallback((e: any) => {
        e.preventDefault();
        isResizingRef.current = true;
        resizeStartXRef.current = e.clientX;
        resizeStartWidthRef.current = treeWidth;
        document.body.style.cursor = 'col-resize';
        document.body.style.userSelect = 'none';
    }, [treeWidth]);

    const toggleMaximize = useCallback(() => {
        setIsMaximized((prev) => {
            const next = !prev;
            setTreeWidth((width) => {
                const scaled = next
                    ? Math.round(width * TREE_WIDTH_MAXIMIZE_SCALE)
                    : Math.round(width / TREE_WIDTH_MAXIMIZE_SCALE);
                const maxWidth = next ? MAX_TREE_WIDTH_MAXIMIZED : MAX_TREE_WIDTH;
                return Math.min(maxWidth, Math.max(MIN_TREE_WIDTH, scaled));
            });
            return next;
        });
    }, []);

    useEffect(() => {
        if (!isMaximized) return undefined;
        const prevOverflow = document.body.style.overflow;
        document.body.style.overflow = 'hidden';
        return () => {
            document.body.style.overflow = prevOverflow;
        };
    }, [isMaximized]);

    // ── Baselines ──
    const showBaselines = false;

    const allTaskNodes = useMemo(() => flattenTaskNodes(phases), [phases]);
    const dependencyAnalysis = useMemo(() => calculateCriticalPath(allTaskNodes, phases), [allTaskNodes, phases]);
    const exportBaseName = useMemo(() => {
        const raw = (projectTitle || `project-${projectId || 'gantt'}`).toString().trim().toLowerCase();
        const slug = raw.replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
        return slug || 'gantt-chart';
    }, [projectId, projectTitle]);

    // Inline cell editing (dropdown open state)
    const [editingCell, setEditingCell] = useState<any>(null); // { rowId, rowType, colKey }
    const activeSelectRef = useRef<any>(null);

    // Toggleable attribute columns
    const [visibleCols, setVisibleCols] = useState<Set<string>>(new Set());
    const toggleCol = useCallback((key: string) => {
        setVisibleCols((prev) => {
            const next = new Set(prev);
            next.has(key) ? next.delete(key) : next.add(key);
            return next;
        });
    }, []);
    const activeColumns = useMemo(() => ATTR_COLUMNS.filter((c) => visibleCols.has(c.key)), [visibleCols]);
    const columnsWidth = useMemo(() => activeColumns.reduce((sum, c) => sum + c.width, 0), [activeColumns]);

    const isRowAssignedToCurrentUser = useCallback((row: any) => {
        if (!currentMemberId || row.type === 'phase') return false;
        return (row.data?.assignments || []).some((assignment: any) => {
            const assignedMemberId = assignment?.member?.id ?? assignment?.memberId;
            return Number(assignedMemberId) === Number(currentMemberId);
        });
    }, [currentMemberId]);

    // ── Inline cell update (status / priority / difficulty) ──
    const handleCellUpdate = useCallback(async (rowType: any, rowId: any, field: string, value: any) => {
        void rowType;
        try {
            if (field === 'status') {
                await tasksAPI.updateStatus(rowId, value);
            } else {
                await tasksAPI.update(rowId, { [field]: value });
            }
            onRefresh();
        } catch (err) {
            console.error('Failed to update', field, err);
        }
        setEditingCell(null);
    }, [onRefresh]);

    const openInlineEditor = useCallback((row: any, col: any) => {
        flushSync(() => {
            setEditingCell({ rowId: row.id, rowType: row.type, colKey: col.key });
        });

        const select = activeSelectRef.current;
        if (!select) return;

        try {
            if (typeof select.showPicker === 'function') {
                select.showPicker();
                return;
            }
        } catch {
            // Fall through to the compatibility path below.
        }

        try {
            select.focus();
            select.click();
        } catch {
            try {
                select.focus();
            } catch {
                // Ignore browsers that refuse programmatic focus here.
            }
        }
    }, []);

    // ── Move up / move down helpers (phases, tasks, & subtasks) ──
    // Get the sibling list for a selected item
    const getSiblings = useCallback((sel: any) => {
        if (!sel) return [];
        if (sel.type === 'phase') return phases;
        if (sel.type === 'task') {
            const phase = phases.find((p: any) => p.id === (sel.phase?.id || sel.data.phaseId));
            return phase?.tasks || [];
        }
        if (sel.type === 'subtask') {
            const phase = phases.find((p: any) => p.id === (sel.phase?.id || sel.data.phaseId));
            const parent = (phase?.tasks || []).find((t: any) => t.id === (sel.parentTask?.id || sel.data.parentTaskId));
            return parent?.subtasks || [];
        }
        return [];
    }, [phases]);

    const handleMoveUp = useCallback(async () => {
        if (!selected || !canEdit) return;
        const siblings = getSiblings(selected);
        const idx = siblings.findIndex((s: any) => s.id === selected.id);
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
        const idx = siblings.findIndex((s: any) => s.id === selected.id);
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
        return siblings.findIndex((s: any) => s.id === selected.id) > 0;
    }, [selected, canEdit, getSiblings]);

    const canMoveDown = useMemo(() => {
        if (!selected || !canEdit) return false;
        const siblings = getSiblings(selected);
        const idx = siblings.findIndex((s: any) => s.id === selected.id);
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
                    const body: any = {};
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
                            const b: any = {};
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
        if (!entry) return;
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
        if (!entry) return;
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
        if (preview?.rowKey) {
            const bar = barRefs.current.get(preview.rowKey);
            if (bar) {
                const position = getPreviewPosition(bar.getBoundingClientRect());
                setPreview((current: any) => {
                    if (!current || current.rowKey !== preview.rowKey) return current;
                    return { ...current, position };
                });
            }
        }
    }, [preview?.rowKey]);

    // Toggle expand/collapse
    const togglePhase = useCallback((id: any) => {
        setExpandedPhases((prev: Set<any>) => {
            const next = new Set(prev);
            next.has(id) ? next.delete(id) : next.add(id);
            return next;
        });
    }, []);

    const toggleTask = useCallback((id: any) => {
        setExpandedTasks((prev) => {
            const next = new Set(prev);
            next.has(id) ? next.delete(id) : next.add(id);
            return next;
        });
    }, []);

    // Selection
    const handleSelect = useCallback((type: any, data: any, phase: any, parentTask: any) => {
        setSelected((prev: any) => {
            if (prev && prev.type === type && prev.id === data.id) {
                return prev;
            }
            return { type, id: data.id, data, phase: phase || null, parentTask: parentTask || null };
        });
    }, []);

    // Build flat row list from hierarchy (includes "add" placeholder rows)
    // WBS codes come from the database (persisted, synced across devices)
    const rows = useMemo<any[]>(() => {
        const result: any[] = [];
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

    const selectedPhaseId = useMemo(() => {
        if (!selected) return null;
        if (selected.type === 'phase') return selected.id;
        return selected.phase?.id || selected.data?.phaseId || null;
    }, [selected]);

    const phaseBoundaryRows = useMemo(() => {
        const boundary = new Set<string>();
        const getPhaseId = (row: any) => {
            if (!row) return null;
            if (row.type === 'phase') return row.id;
            return row.phase?.id || row.data?.phaseId || null;
        };

        for (let i = 0; i < rows.length; i++) {
            const current = rows[i];
            const next = rows[i + 1];
            const currentPhaseId = getPhaseId(current);
            const nextPhaseId = getPhaseId(next);
            if (currentPhaseId && currentPhaseId !== nextPhaseId) {
                boundary.add(`${current.type}-${current.id}`);
            }
        }
        return boundary;
    }, [rows]);

    const rowIndexByKey = useMemo(() => new Map<string, number>(rows.map((row: any, index: number) => [`${row.type}-${row.id}`, index])), [rows]);
    const timelineBodyHeight = rows.length * ROW_HEIGHT;

    const criticalPhaseIds = dependencyAnalysis.criticalPhaseIds;
    const criticalNodeIds = dependencyAnalysis.criticalNodeIds;
    const criticalEdgeKeys = dependencyAnalysis.criticalEdgeKeys;

    const previewRow = useMemo(() => {
        if (!preview) return null;
        return rows.find((row) => `${row.type}-${row.id}` === preview.rowKey) || null;
    }, [preview, rows]);

    const previewData = useMemo(() => {
        if (!previewRow) return null;

        const slots = collectPreviewSlots(previewRow, allTaskNodes, projectDetail);
        const baseRange = previewRow.type === 'phase'
            ? getPhaseRange(previewRow.data)
            : {
                start: getDateOrNull(previewRow.data?.startDate),
                end: getDateOrNull(previewRow.data?.dueDate),
            };
        const window = getPreviewWindow(slots, baseRange.start, baseRange.end);
        const status = previewRow.type === 'phase'
            ? getPhaseStatus(previewRow.data)
            : previewRow.data?.status;
        const priority = previewRow.type === 'phase'
            ? null
            : previewRow.data?.priority;

        return {
            row: previewRow,
            kindLabel: getPreviewKindLabel(previewRow.type),
            title: previewRow.data?.title || '',
            status,
            statusLabel: STATUS_LABELS[status] || status || '—',
            statusColor: status ? STATUS_COLORS[status] : null,
            priority,
            priorityLabel: previewRow.type === 'phase' ? '—' : (PRIORITY_LABELS[priority] || priority || '—'),
            priorityColor: priority ? PRIORITY_COLORS[priority] : null,
            isCritical: previewRow.type === 'phase'
                ? criticalPhaseIds.has(previewRow.id)
                : criticalNodeIds.has(previewRow.id),
            slots,
            memberCount: new Set(slots.map((slot) => String(slot?.member?.id ?? slot?.memberId ?? slot?.id ?? 'unknown'))).size,
            window,
            baseRange,
            hasSlots: slots.length > 0,
        };
    }, [allTaskNodes, criticalNodeIds, criticalPhaseIds, previewRow, projectDetail]);

    const refreshPreviewPosition = useCallback((rowKey?: string) => {
        const targetKey = rowKey || preview?.rowKey;
        if (!targetKey) return;

        const bar = barRefs.current.get(targetKey);
        if (!bar) {
            setPreview(null);
            return;
        }

        const position = getPreviewPosition(bar.getBoundingClientRect());
        setPreview((current: any) => {
            if (!current || current.rowKey !== targetKey) return current;
            if (
                current.position
                && current.position.left === position.left
                && current.position.top === position.top
                && current.position.width === position.width
                && current.position.placement === position.placement
            ) {
                return current;
            }
            return { ...current, position };
        });
    }, [preview?.rowKey]);

    const clearPreviewHoverTimer = useCallback(() => {
        if (previewHoverTimerRef.current) {
            window.clearTimeout(previewHoverTimerRef.current);
            previewHoverTimerRef.current = null;
        }
    }, []);

    const openPreview = useCallback((row: any, element: any, pinned = false) => {
        if (!row || !element) return;
        const rowKey = `${row.type}-${row.id}`;
        const position = getPreviewPosition(element.getBoundingClientRect());

        setPreview((current: any) => {
            if (current?.pinned && current.rowKey !== rowKey && !pinned) return current;
            if (current?.pinned && current.rowKey === rowKey && !pinned) return current;
            return {
                rowKey,
                pinned: pinned || (current?.pinned && current.rowKey === rowKey),
                position,
            };
        });
    }, []);

    const handlePreviewMouseEnter = useCallback((row: any, event: any) => {
        clearPreviewHoverTimer();

        if (preview?.pinned && preview.rowKey !== `${row.type}-${row.id}`) return;

        const element = event.currentTarget;
        previewHoverTimerRef.current = window.setTimeout(() => {
            openPreview(row, element, false);
        }, PREVIEW_HOVER_DELAY_MS);
    }, [clearPreviewHoverTimer, openPreview, preview?.pinned, preview?.rowKey]);

    const handlePreviewMouseLeave = useCallback((row: any) => {
        clearPreviewHoverTimer();
        const rowKey = `${row.type}-${row.id}`;
        setPreview((current: any) => {
            if (!current || current.rowKey !== rowKey || current.pinned) return current;
            return null;
        });
    }, [clearPreviewHoverTimer]);

    const handlePreviewClick = useCallback((row: any, event: any) => {
        event.stopPropagation();
        clearPreviewHoverTimer();
        const rowKey = `${row.type}-${row.id}`;
        const element = event.currentTarget;
        if (!element) return;
        const position = getPreviewPosition(element.getBoundingClientRect());
        setPreview((current: any) => {
            if (current?.rowKey === rowKey && current.pinned) return null;
            return { rowKey, pinned: true, position };
        });
    }, [clearPreviewHoverTimer]);

    const setBarRef = useCallback((rowKey: string) => (node: any) => {
        if (node) {
            barRefs.current.set(rowKey, node);
        } else {
            barRefs.current.delete(rowKey);
        }
    }, []);

    useEffect(() => {
        if (!preview?.rowKey) return;

        const exists = rows.some((row) => `${row.type}-${row.id}` === preview.rowKey);
        if (!exists) {
            setPreview(null);
            return;
        }

        refreshPreviewPosition(preview.rowKey);
    }, [preview?.rowKey, rows, refreshPreviewPosition]);

    useEffect(() => {
        if (!preview?.rowKey) return undefined;

        const handleResize = () => refreshPreviewPosition(preview.rowKey);
        const handleEscape = (event: KeyboardEvent) => {
            if (event.key === 'Escape') {
                setPreview(null);
            }
        };
        const handlePointerDown = (event: MouseEvent) => {
            const target = event.target;
            if (!(target instanceof Element)) return;
            if (previewPopoverRef.current?.contains(target)) return;
            if (target.closest('.gantt-bar')) return;
            setPreview(null);
        };

        window.addEventListener('resize', handleResize);
        window.addEventListener('keydown', handleEscape);
        document.addEventListener('mousedown', handlePointerDown);

        return () => {
            window.removeEventListener('resize', handleResize);
            window.removeEventListener('keydown', handleEscape);
            document.removeEventListener('mousedown', handlePointerDown);
        };
    }, [preview?.rowKey, refreshPreviewPosition]);

    useEffect(() => () => clearPreviewHoverTimer(), [clearPreviewHoverTimer]);

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
    const getBaselineBarData = useCallback((row: any) => {
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
    const getBarData = useCallback((row: any) => {
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
        if (!barStart || !barEnd) return null;
        const isMilestone = barStart.getTime() === barEnd.getTime();

        return { left: leftPx, width, status, isMilestone, startDate: barStart, endDate: barEnd };
    }, [columns, colWidth]);

    const dependencySegments = useMemo(() => {
        const segments = [];

        for (const edge of dependencyAnalysis.edges) {
            const sourceRow = rows.find((row) => row.type === (edge.sourceType || 'task') && row.id === edge.sourceId);
            const targetRow = rows.find((row) => row.type === (edge.targetType || 'task') && row.id === edge.targetId);
            if (!sourceRow || !targetRow) continue;

            const sourceBar = getBarData(sourceRow);
            const targetBar = getBarData(targetRow);
            const sourceIndex = rowIndexByKey.get(`${sourceRow.type}-${sourceRow.id}`);
            const targetIndex = rowIndexByKey.get(`${targetRow.type}-${targetRow.id}`);

            if (!sourceBar || !targetBar || sourceIndex == null || targetIndex == null) continue;

            const sourceY = sourceIndex * ROW_HEIGHT + ROW_HEIGHT / 2;
            const targetY = targetIndex * ROW_HEIGHT + ROW_HEIGHT / 2;
            const sourceX = sourceBar.left + sourceBar.width;
            const targetX = targetBar.left;
            const direction = targetX >= sourceX ? 1 : -1;
            const elbowX = sourceX + (direction * 14);

            segments.push({
                key: getDependencyEdgeKey(edge),
                critical: criticalEdgeKeys.has(getDependencyEdgeKey(edge)),
                sourceX,
                sourceY,
                targetX,
                targetY,
                elbowX,
            });
        }

        return segments;
    }, [criticalEdgeKeys, dependencyAnalysis.edges, getBarData, rowIndexByKey, rows]);

    const exportAsPng = useCallback(async () => {
        if (!ganttMainRef.current || exportingFormat) return;

        setExportingFormat('png');
        const previousExpandedPhases = new Set(expandedPhases);
        const previousExpandedTasks = new Set(expandedTasks);
        const previousScale = scale;
        const shouldRestoreScale = previousScale !== 'day';
        const previousVisibility = ganttMainRef.current.style.visibility;
        let wrapper = null;
        try {
            if (shouldRestoreScale) {
                setScale('day');
                await waitForNextPaint();
            }

            const allPhaseIds = new Set(phases.map((phase: any) => phase.id));
            const allTaskIds = new Set(allTaskNodes.filter((node) => node.type === 'task').map((node) => node.id));

            ganttMainRef.current.style.visibility = 'hidden';
            setExpandedPhases(allPhaseIds);
            setExpandedTasks(allTaskIds);

            await waitForNextPaint();
            await waitForNextPaint();

            const html2canvasModule = await import('html2canvas');
            const html2canvas = html2canvasModule.default || html2canvasModule;
            const source = ganttMainRef.current;
            const clone = source.cloneNode(true);

            wrapper = document.createElement('div');
            wrapper.style.position = 'fixed';
            wrapper.style.left = '-100000px';
            wrapper.style.top = '0';
            wrapper.style.background = 'white';
            wrapper.style.pointerEvents = 'none';
            wrapper.style.zIndex = '-1';
            wrapper.appendChild(clone);
            document.body.appendChild(wrapper);

            clone.style.width = 'max-content';
            clone.style.height = 'auto';
            clone.style.minHeight = '0';
            clone.style.overflow = 'visible';
            clone.style.visibility = 'visible';
            clone.style.fontVariantNumeric = 'tabular-nums';

            const setStyle = (selector: string, styles: Partial<CSSStyleDeclaration>) => {
                const element = clone.querySelector(selector);
                if (element) Object.assign(element.style, styles);
            };

            setStyle('.gantt', { height: 'auto', overflow: 'visible', background: '#ffffff' });
            setStyle('.gantt-toolbar', { position: 'relative' });
            setStyle('.gantt-main', { height: 'auto', overflow: 'visible', minHeight: '0', width: 'max-content' });
            setStyle('.gantt-tree-panel', { height: 'auto', overflow: 'visible' });
            setStyle('.gantt-tree-body', { height: 'auto', overflow: 'visible' });
            setStyle('.gantt-columns-panel', { height: 'auto', overflow: 'visible' });
            setStyle('.gantt-columns-body', { height: 'auto', overflow: 'visible' });
            setStyle('.gantt-timeline-panel', { height: 'auto', overflow: 'visible' });
            setStyle('.gantt-timeline-body', { height: 'auto', overflow: 'visible' });
            setStyle('.gantt-timeline-header', { position: 'static' });
            setStyle('.gantt-timeline-surface', { height: 'auto', overflow: 'visible' });
            setStyle('.gantt-dependency-overlay', { overflow: 'visible' });
            setStyle('.gantt-preview-popover', { display: 'none' });
            setStyle('.gantt-tree-row--add', { display: 'none' });
            setStyle('.gantt-columns-row--add', { display: 'none' });
            setStyle('.gantt-timeline-row--add', { display: 'none' });

            await waitForNextPaint();
            await waitForNextPaint();

            const canvas = await html2canvas(clone, {
                backgroundColor: '#ffffff',
                scale: 2,
                useCORS: true,
                logging: false,
                windowWidth: Math.max(clone.scrollWidth, clone.getBoundingClientRect().width),
                windowHeight: Math.max(clone.scrollHeight, clone.getBoundingClientRect().height),
            });

            const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/png'));
            if (blob) {
                downloadBlob(blob, `${exportBaseName}-gantt.png`);
            }
        } catch (error) {
            console.error('PNG export failed', error);
        } finally {
            if (wrapper?.parentNode) wrapper.parentNode.removeChild(wrapper);
            if (ganttMainRef.current) {
                ganttMainRef.current.style.visibility = previousVisibility;
            }
            if (shouldRestoreScale) {
                setScale(previousScale);
            }
            setExpandedPhases(previousExpandedPhases);
            setExpandedTasks(previousExpandedTasks);
            setExportingFormat(null);
        }
    }, [allTaskNodes, expandedPhases, expandedTasks, exportBaseName, exportingFormat, phases, scale]);

    const exportAsExcel = useCallback(async () => {
        if (exportingFormat) return;

        setExportingFormat('xlsx');
        try {
            const xlsxModule = await import('xlsx-js-style');
            const XLSX = xlsxModule.default || xlsxModule;

            const exportRows = buildExportRows(phases);
            const exportRange = getExportDateRange(phases, projectStartDate, projectDueDate);
            const timeline = buildExportTimeline(exportRange.start, exportRange.end);

            const metaHeaders = ['WBS', 'Name', 'Type', 'Dependencies', 'Assignees', 'Priority', 'Difficulty', 'Status', 'Start', 'Due', 'Duration'];
            const headerRows = 5;
            const metaColumnCount = metaHeaders.length;
            const dateColumnStart = metaColumnCount;
            const totalColumns = metaColumnCount + timeline.days.length;
            const totalRows = headerRows + exportRows.length;
            const matrix = Array.from({ length: totalRows }, () => Array(totalColumns).fill(''));
            const merges = [];
            const dayHeaderBorder = {
                top: { style: 'thin', color: { rgb: hexToArgb('#E5E7EB') } },
                left: { style: 'thin', color: { rgb: hexToArgb('#E5E7EB') } },
                right: { style: 'thin', color: { rgb: hexToArgb('#E5E7EB') } },
                bottom: { style: 'medium', color: { rgb: hexToArgb('#7c3aed') } },
            };

            metaHeaders.forEach((label, index) => {
                matrix[0][index] = label;
                merges.push({ s: { r: 0, c: index }, e: { r: headerRows - 1, c: index } });
            });

            const bandConfigs = [
                { rowIndex: 0, bands: timeline.yearBands, labelStyle: 'year' },
                { rowIndex: 1, bands: timeline.quarterBands, labelStyle: 'quarter' },
                { rowIndex: 2, bands: timeline.monthBands, labelStyle: 'month' },
                { rowIndex: 3, bands: timeline.weekBands, labelStyle: 'week' },
            ];

            for (const { rowIndex, bands } of bandConfigs) {
                for (const band of bands) {
                    const sheetRow = rowIndex;
                    const startCol = dateColumnStart + band.startIndex;
                    const endCol = dateColumnStart + band.endIndex;
                    matrix[sheetRow][startCol] = band.label;
                    if (endCol > startCol) {
                        merges.push({ s: { r: sheetRow, c: startCol }, e: { r: sheetRow, c: endCol } });
                    }
                }
            }

            timeline.days.forEach((day, index) => {
                matrix[4][dateColumnStart + index] = String(day.getDate()).padStart(2, '0');
            });

            exportRows.forEach((row, rowIndex) => {
                const sheetRow = headerRows + rowIndex;
                matrix[sheetRow][0] = row.wbs;
                matrix[sheetRow][1] = `${'  '.repeat(row.depth)}${row.name}`;
                matrix[sheetRow][2] = row.type.charAt(0).toUpperCase() + row.type.slice(1);
                matrix[sheetRow][3] = row.dependencies;
                matrix[sheetRow][4] = row.assignees;
                matrix[sheetRow][5] = row.priority;
                matrix[sheetRow][6] = row.difficulty;
                matrix[sheetRow][7] = row.status;
                matrix[sheetRow][8] = formatExportDate(row.start);
                matrix[sheetRow][9] = formatExportDate(row.end);
                matrix[sheetRow][10] = row.durationDays;

                const rowStart = row.start || row.end;
                const rowEnd = row.end || row.start;
                if (rowStart && rowEnd) {
                    const startKey = startOfDay(rowStart).toISOString().split('T')[0];
                    const endKey = startOfDay(rowEnd).toISOString().split('T')[0];
                    for (let i = 0; i < timeline.days.length; i++) {
                        const dayKey = timeline.days[i].toISOString().split('T')[0];
                        if (dayKey >= startKey && dayKey <= endKey) {
                            matrix[sheetRow][dateColumnStart + i] = '';
                        }
                    }
                }
            });

            const sheet = XLSX.utils.aoa_to_sheet(matrix);
            sheet['!merges'] = merges;
            const metaColumnWidths = [
                getExportContentWidth([metaHeaders[0], ...exportRows.map((row) => row.wbs)], { minWidth: 6, maxWidth: 10 }),
                32,
                getExportContentWidth([metaHeaders[2], ...exportRows.map((row) => row.type.charAt(0).toUpperCase() + row.type.slice(1))], { minWidth: 8, maxWidth: 12 }),
                28,
                24,
                getExportContentWidth([metaHeaders[5], ...exportRows.map((row) => row.priority)], { minWidth: 8, maxWidth: 10 }),
                getExportContentWidth([metaHeaders[6], ...exportRows.map((row) => row.difficulty)], { minWidth: 8, maxWidth: 10 }),
                getExportContentWidth([metaHeaders[7], ...exportRows.map((row) => row.status)], { minWidth: 10, maxWidth: 14 }),
                12,
                12,
                11,
            ];

            sheet['!cols'] = [
                ...metaColumnWidths.map((wch) => ({ wch })),
                ...timeline.days.map(() => ({ wch: 4 })),
            ];
            sheet['!rows'] = [
                { hpt: 22 },
                { hpt: 20 },
                { hpt: 20 },
                { hpt: 20 },
                { hpt: 20 },
                ...exportRows.map((row) => ({ hpt: row.type === 'phase' ? 22 : 20 })),
            ];

            const cellBorder = {
                top: { style: 'thin', color: { rgb: hexToArgb('#E5E7EB') } },
                bottom: { style: 'thin', color: { rgb: hexToArgb('#E5E7EB') } },
                left: { style: 'thin', color: { rgb: hexToArgb('#E5E7EB') } },
                right: { style: 'thin', color: { rgb: hexToArgb('#E5E7EB') } },
            };

            const occupiedBorder = {
                top: { style: 'thin', color: { rgb: hexToArgb('#ffffff') } },
                bottom: { style: 'thin', color: { rgb: hexToArgb('#ffffff') } },
                left: { style: 'thin', color: { rgb: hexToArgb('#ffffff') } },
                right: { style: 'thin', color: { rgb: hexToArgb('#ffffff') } },
            };

            const styleCell = (rowIndex: number, colIndex: number, styles: any, value = '') => {
                const cellRef = XLSX.utils.encode_cell({ r: rowIndex, c: colIndex });
                const cell = sheet[cellRef] || (sheet[cellRef] = { t: 's', v: value });
                applySheetCellStyle(cell, styles);
                return cell;
            };

            const headerFillStyles = [
                { row: 0, fill: '#5b21b6', fontColor: '#ffffff' },
                { row: 1, fill: '#6d28d9', fontColor: '#ffffff' },
                { row: 2, fill: '#7c3aed', fontColor: '#ffffff' },
                { row: 3, fill: '#8b5cf6', fontColor: '#ffffff' },
                { row: 4, fill: '#ede9fe', fontColor: '#4c1d95' },
            ];

            for (const { row, fill, fontColor } of headerFillStyles) {
                for (let col = 0; col < totalColumns; col++) {
                    styleCell(row, col, {
                        fill,
                        fontColor,
                        bold: true,
                        align: 'center',
                        wrapText: true,
                        border: cellBorder,
                    });
                }
            }

            metaHeaders.forEach((_, index) => {
                styleCell(0, index, {
                    fill: '#5b21b6',
                    fontColor: '#ffffff',
                    bold: true,
                    align: 'center',
                    wrapText: true,
                    border: cellBorder,
                });
            });

            timeline.days.forEach((day, index) => {
                styleCell(4, dateColumnStart + index, {
                    fill: day.getDay() === 0 || day.getDay() === 6 ? '#f5f3ff' : '#ede9fe',
                    fontColor: '#4c1d95',
                    bold: true,
                    align: 'center',
                    border: dayHeaderBorder,
                });
            });

            exportRows.forEach((row, rowIndex) => {
                const sheetRow = headerRows + rowIndex;
                const metaCellIndices = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10];

                for (const colIndex of metaCellIndices) {
                    const isNameColumn = colIndex === 1;
                    const isStatusColumn = colIndex === 7;
                    const isTypeRow = row.type === 'phase';
                    const fill = isTypeRow
                        ? (colIndex <= 1 ? '#f5f3ff' : '#faf5ff')
                        : (row.type === 'task' ? '#ffffff' : '#f8fafc');
                    const align = colIndex === 0
                        ? 'left'
                        : (colIndex === 2 || colIndex === 5 || colIndex === 6 || colIndex === 7 || colIndex >= 8 ? 'center' : 'left');

                    styleCell(sheetRow, colIndex, {
                        fill: isStatusColumn ? row.statusColor : fill,
                        fontColor: isStatusColumn ? '#ffffff' : '#1f2937',
                        bold: isTypeRow || isNameColumn,
                        align,
                        wrapText: true,
                        indent: colIndex === 1 ? row.depth : 0,
                        border: cellBorder,
                    });
                }

                const rowStart = row.start || row.end;
                const rowEnd = row.end || row.start;
                if (rowStart && rowEnd) {
                    const startKey = startOfDay(rowStart).toISOString().split('T')[0];
                    const endKey = startOfDay(rowEnd).toISOString().split('T')[0];
                    for (let index = 0; index < timeline.days.length; index++) {
                        const day = timeline.days[index];
                        const dayKey = day.toISOString().split('T')[0];
                        const inRange = dayKey >= startKey && dayKey <= endKey;
                        const weekendFill = day.getDay() === 0 || day.getDay() === 6 ? '#f8fafc' : '#ffffff';

                        styleCell(sheetRow, dateColumnStart + index, {
                            fill: inRange ? row.statusColor : weekendFill,
                            fontColor: inRange ? '#ffffff' : '#111827',
                            bold: inRange || row.type === 'phase',
                            align: 'center',
                            border: inRange ? occupiedBorder : cellBorder,
                        });
                    }
                }
            });

            const workbook = XLSX.utils.book_new();
            XLSX.utils.book_append_sheet(workbook, sheet, 'Gantt');
            XLSX.utils.book_append_sheet(
                workbook,
                buildScheduleTimelineSheet(XLSX, collectScheduleTimelineSlots(projectDetail, allTaskNodes), projectTitle || 'Schedule Timeline'),
                'Schedule Timeline'
            );

            const jszipModule = await import('jszip');
            const JSZip = jszipModule.default;
            const workbookBytes = XLSX.write(workbook, { bookType: 'xlsx', type: 'array', cellStyles: true }) as ArrayBuffer;
            const workbookZip = await JSZip.loadAsync(workbookBytes);

            // `xlsx-js-style` does not emit freeze pane XML, so patch the first worksheet (`Gantt`) directly.
            const ganttSheetPath = 'xl/worksheets/sheet1.xml';
            const ganttSheetFile = workbookZip.file(ganttSheetPath);
            if (ganttSheetFile) {
                const ganttSheetXml = await ganttSheetFile.async('string');
                const topLeftCell = XLSX.utils.encode_cell({ r: headerRows, c: 2 });
                const patchedGanttSheetXml = withFrozenPaneInWorksheetXml(ganttSheetXml, {
                    xSplit: 2,
                    ySplit: headerRows,
                    topLeftCell,
                });
                workbookZip.file(ganttSheetPath, patchedGanttSheetXml);
            }

            const workbookBlob = await workbookZip.generateAsync({ type: 'blob' });
            downloadBlob(workbookBlob, `${exportBaseName}-gantt.xlsx`);
        } catch (error) {
            console.error('Excel export failed', error);
        } finally {
            setExportingFormat(null);
        }
    }, [allTaskNodes, dependencyAnalysis, exportBaseName, exportingFormat, phases, projectDueDate, projectStartDate]);

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
    const handleDelete = useCallback(async (id: any) => {
        try {
            const delType = confirmDelete?.type;
            const delTitle = confirmDelete?.title;

            if (delType === 'phase') {
                // Snapshot the phase data for undo
                const phaseData = phases.find((p: any) => p.id === id);
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
    const getBarTooltip = useCallback((row: any) => {
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
    const getProgress = useCallback((row: any) => {
        if (row.type === 'phase') {
            const tasks = row.data.tasks || [];
            if (tasks.length === 0) return 0;
            return Math.round(tasks.filter((t: any) => t.status === 'COMPLETED').length / tasks.length * 100);
        }
        if (row.type === 'task') {
            const subs = row.data.subtasks || [];
            if (subs.length > 0) {
                return Math.round(subs.filter((s: any) => s.status === 'COMPLETED').length / subs.length * 100);
            }
        }
        return STATUS_PROGRESS[row.data.status] ?? 0;
    }, []);

    const mobileRotateHint = (
        <div className="gantt-mobile-rotate-hint" role="status" aria-live="polite">
            Rotate your device to landscape for a better Gantt view.
        </div>
    );

    // ─── Empty state ───
    if (phases.length === 0 && !canEdit) {
        return (
            <div className="gantt">
                {mobileRotateHint}
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
        <div className={`gantt${isMaximized ? ' gantt--maximized' : ''}`}>
            {mobileRotateHint}
            {/* ── Confirm delete modal ── */}
            {confirmDelete && (
                <DeletePhaseTaskModal
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
                            <div className="gantt-toolbar-group">
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
                            </div>

                            <span className="gantt-toolbar-divider" aria-hidden="true" />

                            <div className="gantt-toolbar-group">
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
                            </div>

                            <span className="gantt-toolbar-divider" aria-hidden="true" />

                            <div className="gantt-toolbar-group">
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
                            </div>

                            <span className="gantt-toolbar-divider" aria-hidden="true" />

                            <div className="gantt-toolbar-group">
                                <div className="gantt-col-toggle-group">
                                    <button
                                        className="gantt-utility-btn"
                                        title="Toggle attribute columns"
                                        ref={(node) => applyElementStyles(node, {
                                            width: 'auto',
                                            padding: '0 0.45rem',
                                            gap: '0.25rem',
                                        })}
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
                    <div className="gantt-toolbar-group">
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
                    </div>
                    <div className="gantt-toolbar-group">
                        <button className="gantt-today-btn" onClick={scrollToToday} title="Scroll to today">
                            <Crosshair size={13} />
                            <span>Today</span>
                        </button>
                    </div>
                    <span className="gantt-toolbar-divider" aria-hidden="true" />
                    <div className="gantt-toolbar-group">
                        <div className="gantt-export-group">
                            <button
                                className="gantt-export-btn"
                                type="button"
                                onClick={exportAsPng}
                                disabled={!!exportingFormat}
                                title="Export the Gantt chart as a PNG image"
                            >
                                <Download size={13} />
                                <span>{exportingFormat === 'png' ? 'Exporting…' : 'PNG'}</span>
                            </button>
                            <button
                                className="gantt-export-btn"
                                type="button"
                                onClick={exportAsExcel}
                                disabled={!!exportingFormat}
                                title="Export the Gantt chart data as Excel"
                            >
                                <Download size={13} />
                                <span>{exportingFormat === 'xlsx' ? 'Exporting…' : 'Excel'}</span>
                            </button>
                        </div>
                    </div>
                    <span className="gantt-toolbar-divider" aria-hidden="true" />
                    <div className="gantt-toolbar-group">
                        <button
                            className="gantt-today-btn"
                            onClick={toggleMaximize}
                            title={isMaximized ? 'Minimize gantt chart' : 'Maximize gantt chart'}
                        >
                            {isMaximized ? <Minimize2 size={13} /> : <Maximize2 size={13} />}
                            <span>{isMaximized ? 'Minimize' : 'Maximize'}</span>
                        </button>
                    </div>
                </div>
            </div>

            {/* ── Main chart area ── */}
            <div className="gantt-main" ref={ganttMainRef}>
                {/* Left: Tree panel */}
                <div
                    className="gantt-tree-panel"
                    ref={(node) => applyElementStyles(node, {
                        width: `${treeWidth}px`,
                        minWidth: `${treeWidth}px`,
                    })}
                >
                    <div
                        className="gantt-tree-header"
                        ref={(node) => applyElementStyles(node, { height: `${HEADER_HEIGHT}px` })}
                    >
                        <span className="gantt-tree-header-wbs">WBS</span>
                        <span>Task Name</span>
                    </div>
                    <div className="gantt-tree-body" ref={treeBodyRef}>
                        {rows.map((row) => {
                            const rowKey = `${row.type}-${row.id}`;
                            const rowPhaseId = row.type === 'phase' ? row.id : row.phase?.id || row.data?.phaseId || null;
                            const inSelectedPhase = !!selectedPhaseId && rowPhaseId === selectedPhaseId;
                            const hasPhaseSeparator = phaseBoundaryRows.has(rowKey);

                            // "Add" placeholder rows
                            if (row.type === 'add-phase') {
                                return (
                                    <div
                                        key="tree-add-phase"
                                        className="gantt-tree-row gantt-tree-row--add"
                                        ref={(node) => applyElementStyles(node, {
                                            height: `${ROW_HEIGHT}px`,
                                            paddingLeft: '0.5rem',
                                        })}
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
                                        className={`gantt-tree-row gantt-tree-row--add${inSelectedPhase ? ' phase-highlighted' : ''}${hasPhaseSeparator ? ' gantt-row-phase-separator' : ''}`}
                                        ref={(node) => applyElementStyles(node, {
                                            height: `${ROW_HEIGHT}px`,
                                            paddingLeft: `${0.5 + 1 * 1.25}rem`,
                                        })}
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
                                        className={`gantt-tree-row gantt-tree-row--add${inSelectedPhase ? ' phase-highlighted' : ''}${hasPhaseSeparator ? ' gantt-row-phase-separator' : ''}`}
                                        ref={(node) => applyElementStyles(node, {
                                            height: `${ROW_HEIGHT}px`,
                                            paddingLeft: `${0.5 + 2 * 1.25}rem`,
                                        })}
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

                            const rowIsTaskLike = row.type !== 'phase';
                            const rowAssignedToCurrentUser = rowIsTaskLike && isRowAssignedToCurrentUser(row);
                            const rowCanManageStructure = canEdit;
                            const rowCanEditStatus = rowIsTaskLike && canEditStatus && (canEdit || rowAssignedToCurrentUser);
                            const rowCanCollaborate = rowIsTaskLike && canEditStatus && (canEdit || rowAssignedToCurrentUser);
                            const rowCanOpenActions = row.type === 'phase'
                                ? rowCanManageStructure
                                : (rowCanManageStructure || rowCanCollaborate || rowCanEditStatus);
                            const isCriticalRow = row.type === 'phase'
                                ? criticalPhaseIds.has(row.id)
                                : criticalNodeIds.has(row.id);

                            return (
                                <div
                                    key={`tree-${row.type}-${row.id}`}
                                    className={`gantt-tree-row gantt-tree-row--${row.type}${isSelected ? ' selected' : ''}${isSelected && row.type !== 'phase' ? ' selected-emphasis' : ''}${inSelectedPhase ? ' phase-highlighted' : ''}${hasPhaseSeparator ? ' gantt-row-phase-separator' : ''}${isCriticalRow ? ' gantt-tree-row--critical' : ''}`}
                                    ref={(node) => applyElementStyles(node, {
                                        height: `${ROW_HEIGHT}px`,
                                        paddingLeft: `${0.5 + row.depth * 1.25}rem`,
                                    })}
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
                                    <span
                                        className="gantt-tree-status-dot"
                                        ref={(node) => applyElementStyles(node, { background: statusColor })}
                                    />
                                    <div className="gantt-tree-wbs-stack">
                                        <span className="gantt-tree-wbs">{row.data.wbs || ''}</span>
                                        {/* Inline progress bar */}
                                        {(() => {
                                            const pct = getProgress(row);
                                            return (
                                                <span className="gantt-progress-wrap" title={`${pct}%`}>
                                                    <span className="gantt-progress-track">
                                                        <span
                                                            className="gantt-progress-fill"
                                                            ref={(node) => applyElementStyles(node, { width: `${pct}%` })}
                                                        />
                                                    </span>
                                                </span>
                                            );
                                        })()}
                                    </div>
                                    <span className={`gantt-tree-title gantt-tree-title--${row.type}`} title={row.data.title}>
                                        {row.data.title}
                                    </span>
                                    {row.type === 'phase' && (
                                        <span className="gantt-tree-count">
                                            {(row.data.tasks?.length ?? 0)}
                                        </span>
                                    )}
                                    {/* Inline edit / delete actions */}
                                    {rowCanOpenActions && (
                                        <div className="gantt-row-actions" onClick={(e) => e.stopPropagation()}>
                                            {row.type !== 'phase' && rowCanCollaborate && onOpenTaskComments && (
                                                <button
                                                    className="gantt-row-btn gantt-row-btn--comment"
                                                    title="Task comments"
                                                    onClick={() => onOpenTaskComments({ ...row.data, canEdit: rowCanManageStructure, canEditStatus: rowCanEditStatus, canCollaborate: rowCanCollaborate })}
                                                >
                                                    <MessageCircle size={12} />
                                                </button>
                                            )}
                                            {row.type !== 'phase' && rowCanCollaborate && onOpenTaskScheduleSlots && (
                                                <button
                                                    className="gantt-row-btn gantt-row-btn--schedule"
                                                    title="Task time slots"
                                                    onClick={() => onOpenTaskScheduleSlots({ ...row.data, canEdit: rowCanManageStructure, canEditStatus: rowCanEditStatus, canCollaborate: rowCanCollaborate })}
                                                >
                                                    <Calendar size={12} />
                                                </button>
                                            )}
                                            {row.type === 'phase' && rowCanManageStructure && (
                                                <button
                                                    className="gantt-row-btn gantt-row-btn--edit"
                                                    title={`Edit ${row.type}`}
                                                    onClick={() => onEditPhase(row.data)}
                                                >
                                                    <Pencil size={12} />
                                                </button>
                                            )}
                                            {row.type !== 'phase' && (rowCanManageStructure || rowCanEditStatus) && (
                                                <button
                                                    className="gantt-row-btn gantt-row-btn--edit"
                                                    title={`Edit ${row.type}`}
                                                    onClick={() => onEditTask({ ...row.data, canEdit: rowCanManageStructure, canEditStatus: rowCanEditStatus, canCollaborate: rowCanCollaborate })}
                                                >
                                                    <Pencil size={12} />
                                                </button>
                                            )}
                                            {rowCanManageStructure && canEdit && (
                                                <button
                                                    className="gantt-row-btn gantt-row-btn--danger"
                                                    title={`Delete ${row.type}`}
                                                    onClick={() => setConfirmDelete({ type: row.type, id: row.id, title: row.data.title })}
                                                >
                                                    <Trash2 size={12} />
                                                </button>
                                            )}
                                            {row.type !== 'phase' && rowCanCollaborate && onOpenTaskActivity && (
                                                <button
                                                    className="gantt-row-btn gantt-row-btn--activity"
                                                    title="Task activity"
                                                    onClick={() => onOpenTaskActivity({ ...row.data, canEdit: rowCanManageStructure, canEditStatus: rowCanEditStatus, canCollaborate: rowCanCollaborate })}
                                                >
                                                    <History size={12} />
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
                    <div
                        className="gantt-columns-panel"
                        ref={(node) => applyElementStyles(node, {
                            width: `${columnsWidth}px`,
                            minWidth: `${columnsWidth}px`,
                        })}
                    >
                        <div
                            className="gantt-columns-header"
                            ref={(node) => applyElementStyles(node, { height: `${HEADER_HEIGHT}px` })}
                        >
                            {activeColumns.map((col) => (
                                <div
                                    key={col.key}
                                    className="gantt-col-hdr"
                                    ref={(node) => applyElementStyles(node, { width: `${col.width}px` })}
                                >
                                    {col.label}
                                </div>
                            ))}
                        </div>
                        <div className="gantt-columns-body" ref={colsBodyRef}>
                            {rows.map((row) => {
                                const isAdd = row.type === 'add-phase' || row.type === 'add-task' || row.type === 'add-subtask';
                                const isColSelected = !isAdd && selected?.type === row.type && selected?.id === row.id;
                                const rowPhaseId = row.type === 'phase' ? row.id : row.phase?.id || row.data?.phaseId || null;
                                const inSelectedPhase = !!selectedPhaseId && rowPhaseId === selectedPhaseId;
                                const hasPhaseSeparator = phaseBoundaryRows.has(`${row.type}-${row.id}`);
                                const isCriticalRow = row.type === 'phase'
                                    ? criticalPhaseIds.has(row.id)
                                    : criticalNodeIds.has(row.id);
                                return (
                                    <div
                                        key={`col-${row.type}-${row.id}`}
                                        className={`gantt-columns-row${isColSelected ? ' selected' : ''}${isColSelected && row.type !== 'phase' ? ' selected-emphasis' : ''}${isAdd ? ' gantt-columns-row--add' : ''} gantt-columns-row--${row.type}${inSelectedPhase ? ' phase-highlighted' : ''}${hasPhaseSeparator ? ' gantt-row-phase-separator' : ''}${isCriticalRow ? ' gantt-columns-row--critical' : ''}`}
                                        ref={(node) => applyElementStyles(node, { height: `${ROW_HEIGHT}px` })}
                                    >
                                        {!isAdd && activeColumns.map((col) => {
                                            const isEditing = editingCell?.rowId === row.id && editingCell?.rowType === row.type && editingCell?.colKey === col.key;
                                            const rowAssignedToCurrentUser = isRowAssignedToCurrentUser(row);
                                            const canEditStatusForRow = row.type !== 'phase' && canEditStatus && (canEdit || rowAssignedToCurrentUser);
                                            const cellEditable = row.type !== 'phase' && (
                                                (col.key === 'status' && canEditStatusForRow)
                                                || (col.key !== 'assignees' && col.key !== 'status' && canEdit)
                                            );
                                            return (
                                                <div
                                                    key={col.key}
                                                    className={`gantt-col-cell gantt-col-cell--${col.key}${cellEditable ? ' gantt-col-cell--editable' : ''}`}
                                                    ref={(node) => applyElementStyles(node, { width: `${col.width}px` })}
                                                    onPointerDown={(e) => {
                                                        e.stopPropagation();
                                                        if (!cellEditable || isEditing) return;
                                                        e.preventDefault();
                                                        openInlineEditor(row, col);
                                                    }}
                                                >
                                                    {/* Assignees */}
                                                    {col.key === 'assignees' && row.type !== 'phase' && (
                                                        <div className="gantt-col-assignees">
                                                            {(row.data.assignments || []).slice(0, 3).map((a: any) => (
                                                                <span
                                                                    key={a.member?.id || a.id}
                                                                    className={`gantt-col-avatar${a.member?.profilePhotoUrl ? '' : ' gantt-col-avatar--solid'}`}
                                                                    title={a.member?.fullName}
                                                                >
                                                                    {a.member?.profilePhotoUrl ? (
                                                                        <img src={getProfilePhotoUrl(a.member.id) || undefined} alt="" />
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
                                                            ref={(node) => applyElementStyles(node, {
                                                                background: STATUS_COLORS[row.data.status],
                                                                color: '#fff',
                                                            })}
                                                        >
                                                            {STATUS_LABELS[row.data.status] || row.data.status}
                                                        </span>
                                                    )}
                                                    {col.key === 'status' && row.type !== 'phase' && isEditing && (
                                                        <select
                                                            ref={activeSelectRef}
                                                            className="gantt-col-select"
                                                            title="Select status"
                                                            aria-label="Select status"
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
                                                            ref={(node) => applyElementStyles(node, {
                                                                background: STATUS_COLORS[getPhaseStatus(row.data)],
                                                                color: '#fff',
                                                            })}
                                                        >
                                                            {STATUS_LABELS[getPhaseStatus(row.data)] || ''}
                                                        </span>
                                                    )}

                                                    {/* Priority */}
                                                    {col.key === 'priority' && row.type !== 'phase' && !isEditing && (
                                                        <span
                                                            className="gantt-col-badge"
                                                            ref={(node) => applyElementStyles(node, {
                                                                background: PRIORITY_COLORS[row.data.priority],
                                                                color: '#fff',
                                                            })}
                                                        >
                                                            {PRIORITY_LABELS[row.data.priority] || row.data.priority}
                                                        </span>
                                                    )}
                                                    {col.key === 'priority' && row.type !== 'phase' && isEditing && (
                                                        <select
                                                            ref={activeSelectRef}
                                                            className="gantt-col-select"
                                                            title="Select priority"
                                                            aria-label="Select priority"
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
                                                        <span
                                                            className="gantt-col-badge"
                                                            ref={(node) => applyElementStyles(node, {
                                                                background: DIFFICULTY_COLORS[row.data.difficulty],
                                                                color: '#fff',
                                                            })}
                                                        >
                                                            {DIFFICULTY_LABELS[row.data.difficulty] || row.data.difficulty}
                                                        </span>
                                                    )}
                                                    {col.key === 'difficulty' && row.type !== 'phase' && isEditing && (
                                                        <select
                                                            ref={activeSelectRef}
                                                            className="gantt-col-select"
                                                            title="Select difficulty"
                                                            aria-label="Select difficulty"
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
                    <div ref={(node) => applyElementStyles(node, { minWidth: `${totalWidth}px` })}>
                        {/* Header */}
                        <div
                            className="gantt-timeline-header"
                            ref={(node) => applyElementStyles(node, { height: `${HEADER_HEIGHT}px` })}
                        >
                            <div className="gantt-header-top">
                                {topHeaders.map((h) => (
                                    <div
                                        key={h.key}
                                        className="gantt-header-top-cell"
                                        ref={(node) => applyElementStyles(node, { width: `${h.colSpan * colWidth}px` })}
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
                                        ref={(node) => applyElementStyles(node, { width: `${colWidth}px` })}
                                    >
                                        {col.label}
                                    </div>
                                ))}
                            </div>
                        </div>

                        {/* Body */}
                        <div
                            className="gantt-timeline-body"
                            ref={(node) => applyElementStyles(node, { minHeight: `${timelineBodyHeight || ROW_HEIGHT}px` })}
                        >
                            {/* Grid lines (rendered once, spans full height) */}
                            <div className="gantt-grid-lines">
                                {columns.map((col) => (
                                    <div
                                        key={col.key}
                                        className={`gantt-grid-col${col.isWeekend ? ' weekend' : ''}${col.isToday ? ' today' : ''}`}
                                        ref={(node) => applyElementStyles(node, { width: `${colWidth}px` })}
                                    />
                                ))}
                            </div>

                            {/* Today line */}
                            {todayPx != null && (
                                <div
                                    className="gantt-today-line"
                                    ref={(node) => applyElementStyles(node, { left: `${todayPx}px` })}
                                />
                            )}

                            {dependencySegments.length > 0 && (
                                <svg
                                    className="gantt-dependency-overlay"
                                    width={totalWidth}
                                    height={timelineBodyHeight || ROW_HEIGHT}
                                    viewBox={`0 0 ${totalWidth} ${timelineBodyHeight || ROW_HEIGHT}`}
                                    aria-hidden="true"
                                >
                                    <defs>
                                        <marker
                                            id="gantt-dependency-arrow"
                                            markerWidth="8"
                                            markerHeight="8"
                                            refX="7"
                                            refY="4"
                                            orient="auto"
                                            markerUnits="strokeWidth"
                                        >
                                            <path d="M 0 0 L 8 4 L 0 8 z" fill="currentColor" />
                                        </marker>
                                    </defs>
                                    {dependencySegments.map((segment) => (
                                        <path
                                            key={segment.key}
                                            className={`gantt-dependency-path${segment.critical ? ' gantt-dependency-path--critical' : ''}`}
                                            d={`M ${segment.sourceX} ${segment.sourceY} H ${segment.elbowX} V ${segment.targetY} H ${segment.targetX}`}
                                            markerEnd="url(#gantt-dependency-arrow)"
                                            ref={(node) => applyElementStyles(node, {
                                                color: segment.critical ? 'var(--purple-600)' : '#64748b',
                                            })}
                                        />
                                    ))}
                                </svg>
                            )}

                            {/* Rows with bars */}
                            {rows.map((row) => {
                                const rowPhaseId = row.type === 'phase' ? row.id : row.phase?.id || row.data?.phaseId || null;
                                const inSelectedPhase = !!selectedPhaseId && rowPhaseId === selectedPhaseId;
                                const hasPhaseSeparator = phaseBoundaryRows.has(`${row.type}-${row.id}`);
                                const isCriticalRow = row.type === 'phase'
                                    ? criticalPhaseIds.has(row.id)
                                    : criticalNodeIds.has(row.id);

                                // "Add" rows have no bar — just an empty spacer row
                                if (row.type === 'add-phase' || row.type === 'add-task' || row.type === 'add-subtask') {
                                    return (
                                        <div
                                            key={`tl-${row.id}`}
                                            className={`gantt-timeline-row gantt-timeline-row--add${inSelectedPhase ? ' phase-highlighted' : ''}${hasPhaseSeparator ? ' gantt-row-phase-separator' : ''}`}
                                            ref={(node) => applyElementStyles(node, { height: `${ROW_HEIGHT}px` })}
                                        />
                                    );
                                }

                                const rowKey = `${row.type}-${row.id}`;
                                const bar = getBarData(row);
                                const baselineBar = showBaselines ? getBaselineBarData(row) : null;
                                const isSelected = selected?.type === row.type && selected?.id === row.id;

                                return (
                                    <div
                                        key={`tl-${row.type}-${row.id}`}
                                        className={`gantt-timeline-row${isSelected ? ' selected' : ''}${isSelected && row.type !== 'phase' ? ' selected-emphasis' : ''}${inSelectedPhase ? ' phase-highlighted' : ''}${hasPhaseSeparator ? ' gantt-row-phase-separator' : ''}${isCriticalRow ? ' gantt-timeline-row--critical' : ''}`}
                                        ref={(node) => applyElementStyles(node, { height: `${ROW_HEIGHT}px` })}
                                        onClick={() => handleSelect(row.type, row.data, row.phase, row.parentTask)}
                                    >
                                        {/* Baseline bar (behind actual bar) */}
                                        {baselineBar && (
                                            <div
                                                className={`gantt-bar-baseline gantt-bar-baseline--${row.type}`}
                                                ref={(node) => applyElementStyles(node, {
                                                    left: `${baselineBar.left}px`,
                                                    width: `${baselineBar.width}px`,
                                                })}
                                                title={`Baseline: ${fmtDate(row.data.baselineStartDate)} → ${fmtDate(row.data.baselineDueDate)}`}
                                            />
                                        )}
                                        {bar && (
                                            <div
                                                className={`gantt-bar gantt-bar--${row.type} gantt-bar--${bar.status}${bar.isMilestone ? ' gantt-bar--milestone' : ''}${isCriticalRow ? ' gantt-bar--critical' : ''}`}
                                                ref={(node) => {
                                                    setBarRef(rowKey)(node);
                                                    applyElementStyles(node, {
                                                        left: `${bar.left}px`,
                                                        width: `${bar.width}px`,
                                                    });
                                                }}
                                                aria-label={getBarTooltip(row)}
                                                onMouseEnter={(event) => handlePreviewMouseEnter(row, event)}
                                                onMouseLeave={() => handlePreviewMouseLeave(row)}
                                                onClick={(event) => handlePreviewClick(row, event)}
                                            >
                                                {/* Show label inside bar if wide enough */}
                                                {bar.width > 60 && (
                                                    <span className="gantt-bar-label">{row.data.title}</span>
                                                )}
                                            </div>
                                        )}
                                        {bar && (
                                            <div
                                                className="gantt-bar-date-range"
                                                ref={(node) => applyElementStyles(node, {
                                                    left: `${bar.left}px`,
                                                    width: `${Math.max(bar.width, 90)}px`,
                                                })}
                                                title={`${fmtDate(bar.startDate)} → ${fmtDate(bar.endDate)}`}
                                            >
                                                {fmtDateCompact(bar.startDate)} → {fmtDateCompact(bar.endDate)}
                                            </div>
                                        )}
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                </div>

                {preview && previewData && preview.position && (
                    <div
                        ref={(node) => {
                            previewPopoverRef.current = node;
                            applyElementStyles(node, {
                                left: `${preview.position.left}px`,
                                top: `${preview.position.top}px`,
                                width: `${preview.position.width}px`,
                            });
                        }}
                        className={`gantt-preview-popover gantt-preview-popover--${preview.position.placement}`}
                        onClick={(event) => event.stopPropagation()}
                    >
                        <div className="gantt-preview-header">
                            <div className="gantt-preview-heading">
                                <span className="gantt-preview-kind">{previewData.kindLabel}</span>
                                <h4 className="gantt-preview-title">{previewData.title}</h4>
                            </div>
                            <button
                                type="button"
                                className="gantt-preview-close"
                                onClick={() => setPreview(null)}
                                aria-label="Close schedule preview"
                            >
                                <X size={12} />
                            </button>
                        </div>

                        <div className="gantt-preview-meta">
                            <span
                                className="gantt-preview-pill"
                                ref={(node) => applyElementStyles(node, {
                                    backgroundColor: previewData.statusColor || '',
                                    color: previewData.statusColor ? '#fff' : '',
                                })}
                            >
                                {previewData.statusLabel}
                            </span>
                            <span
                                className="gantt-preview-pill"
                                ref={(node) => applyElementStyles(node, {
                                    backgroundColor: previewData.priorityColor || '',
                                    color: previewData.priorityColor ? '#fff' : '',
                                })}
                            >
                                Priority: {previewData.priorityLabel}
                            </span>
                            {previewData.isCritical && (
                                <span className="gantt-preview-pill gantt-preview-pill--critical">Critical path</span>
                            )}
                        </div>

                        <div className="gantt-preview-dates">
                            <div className="gantt-preview-date-card">
                                <span>Start</span>
                                <strong>{formatPreviewDateLabel(previewData.baseRange.start || previewData.window?.start)}</strong>
                            </div>
                            <div className="gantt-preview-date-card">
                                <span>End</span>
                                <strong>{formatPreviewDateLabel(previewData.baseRange.end || previewData.window?.end)}</strong>
                            </div>
                        </div>

                        <div className="gantt-preview-summary">
                            {previewData.slots.length} slot{previewData.slots.length === 1 ? '' : 's'} across {previewData.memberCount} member{previewData.memberCount === 1 ? '' : 's'}
                        </div>

                        <div className="gantt-preview-schedule">
                            <ScheduleTimetable
                                slots={previewData.slots}
                                emptyMessage="No schedule slots available for this item."
                                memberColumnWidth={PREVIEW_MEMBER_COLUMN_WIDTH}
                                hourWidth={PREVIEW_HOUR_WIDTH}
                            />
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}
