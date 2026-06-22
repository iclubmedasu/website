'use client';

import {
    useCallback,
    useEffect,
    useMemo,
    useRef,
    useState,
    type CSSProperties,
    type MouseEvent,
} from 'react';
import { createPortal } from 'react-dom';
import { Pencil, Plus, Trash2 } from 'lucide-react';
import type { EventTaskRef } from '@/types/backend-contracts';
import { getBarPreviewPosition } from '@/features/Events/components/eventTaskTimeUtils';
import EventTaskBarPreview from './EventTaskBarPreview';
import BarMemberNames from './BarMemberNames';
import './EventTasksTimetable.css';

const DATE_COL_WIDTH = 136;
const LOCATION_COL_WIDTH = 200;
const HOUR_WIDTH = 60;
const LANE_HEIGHT = 36;
const HOURS_PER_DAY = 24;
const PREVIEW_HOVER_DELAY_MS = 900;

export interface TimetableBarMember {
    assignmentId: number;
    memberName: string;
    isLeader: boolean;
}

export interface TimetableBar {
    key: string;
    taskId: number;
    title: string;
    left: number;
    width: number;
    lane: number;
    timeLabel: string;
    members: TimetableBarMember[];
}

interface DayLocationRow {
    location: string;
    bars: TimetableBar[];
    laneCount: number;
    isPlaceholder?: boolean;
}

interface DaySection {
    key: string;
    date: Date;
    label: string;
    rows: DayLocationRow[];
}

export interface RemoveAssignmentTarget {
    taskId: number;
    assignmentId: number;
    taskTitle: string;
    memberName: string;
}

interface BarPreviewState {
    barKey: string;
    pinned: boolean;
    position: ReturnType<typeof getBarPreviewPosition>;
}

interface EventTasksTimetableProps {
    days: Date[];
    tasks: EventTaskRef[];
    onAddTask: (day: Date) => void;
    onEditTask: (task: EventTaskRef) => void;
    onRemoveAssignment: (target: RemoveAssignmentTarget) => void;
    canManage: boolean;
}

function getDateOrNull(value: string | Date | null | undefined): Date | null {
    if (!value) return null;
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? null : date;
}

function startOfDay(date: Date): Date {
    const result = new Date(date);
    result.setHours(0, 0, 0, 0);
    return result;
}

function getLocalDateKey(date: Date): string {
    return [date.getFullYear(), String(date.getMonth() + 1).padStart(2, '0'), String(date.getDate()).padStart(2, '0')].join('-');
}

function formatDateLabel(date: Date): string {
    return date.toLocaleDateString([], { weekday: 'short', month: 'short', day: '2-digit' });
}

function formatHourLabel(hour: number): string {
    return `${String(hour).padStart(2, '0')}:00`;
}

function formatClock(date: Date): string {
    return `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`;
}

function minutesWithinDay(date: Date): number {
    return (date.getHours() * 60) + date.getMinutes() + (date.getSeconds() / 60);
}

function assignLanes(bars: Array<{ start: number; end: number; taskId: number }>): number[] {
    const lanes: Array<{ end: number; taskIds: Set<number> }> = [];
    const result: number[] = [];

    bars.forEach((bar) => {
        let assigned = -1;
        for (let lane = 0; lane < lanes.length; lane++) {
            if (bar.start >= lanes[lane].end && !lanes[lane].taskIds.has(bar.taskId)) {
                assigned = lane;
                break;
            }
        }
        if (assigned === -1) {
            assigned = lanes.length;
            lanes.push({ end: bar.end, taskIds: new Set([bar.taskId]) });
        } else {
            lanes[assigned].end = bar.end;
            lanes[assigned].taskIds.add(bar.taskId);
        }
        result.push(assigned);
    });

    return result;
}

function buildBarsForTasks(locationTasks: EventTaskRef[], minuteWidth: number): TimetableBar[] {
    const rawBars = locationTasks.flatMap((task) =>
        (task.assignments ?? []).map((assignment) => {
            const start = getDateOrNull(assignment.startDateTime);
            const end = getDateOrNull(assignment.endDateTime);
            if (!start || !end) return null;

            const startMin = Math.max(0, Math.min(HOURS_PER_DAY * 60, minutesWithinDay(start)));
            const endMin = Math.max(startMin, Math.min(HOURS_PER_DAY * 60, minutesWithinDay(end)));
            const startPx = startMin * minuteWidth;
            const endPx = endMin * minuteWidth;

            return {
                taskId: Number(task.id),
                title: task.title,
                memberName: assignment.member?.fullName ?? 'Unknown member',
                isLeader: task.leaderId != null && Number(task.leaderId) === Number(assignment.memberId),
                startPx,
                endPx,
                timeLabel: `${formatClock(start)} - ${formatClock(end)}`,
                assignmentId: Number(assignment.id),
            };
        }).filter((bar): bar is NonNullable<typeof bar> => bar !== null),
    );

    const grouped = new Map<string, typeof rawBars>();
    for (const bar of rawBars) {
        const groupKey = `${bar.taskId}|${bar.startPx}|${bar.endPx}`;
        if (!grouped.has(groupKey)) grouped.set(groupKey, []);
        grouped.get(groupKey)!.push(bar);
    }

    const mergedBars = [...grouped.values()].map((group) => {
        const first = group[0];
        const members = group.map((entry) => ({
            assignmentId: entry.assignmentId,
            memberName: entry.memberName,
            isLeader: entry.isLeader,
        }));
        const memberIds = members.map((member) => member.assignmentId).sort((a, b) => a - b);

        return {
            key: `${first.taskId}-${first.startPx}-${first.endPx}-${memberIds.join('-')}`,
            taskId: first.taskId,
            title: first.title,
            left: first.startPx,
            width: Math.max(4, first.endPx - first.startPx),
            timeLabel: first.timeLabel,
            startPx: first.startPx,
            endPx: first.endPx,
            members,
            hasLeader: members.some((member) => member.isLeader),
        };
    });

    mergedBars.sort((a, b) => a.startPx - b.startPx || a.endPx - b.endPx);
    const lanes = assignLanes(mergedBars.map((bar) => ({
        start: bar.startPx,
        end: bar.endPx,
        taskId: bar.taskId,
    })));

    return mergedBars.map((bar, index) => ({
        key: bar.key,
        taskId: bar.taskId,
        title: bar.title,
        left: bar.left,
        width: bar.width,
        lane: lanes[index],
        timeLabel: bar.timeLabel,
        members: bar.members,
    }));
}

function buildDaySections(days: Date[], tasks: EventTaskRef[], minuteWidth: number): DaySection[] {
    const sortedDays = days.map((day) => startOfDay(day)).sort((a, b) => a.getTime() - b.getTime());

    return sortedDays.map((day) => {
        const dayKey = getLocalDateKey(day);
        const dayTasks = tasks.filter((task) => {
            const taskDate = getDateOrNull(task.taskDate);
            return taskDate != null && getLocalDateKey(taskDate) === dayKey;
        });

        const byLocation = new Map<string, EventTaskRef[]>();
        for (const task of dayTasks) {
            const location = task.location?.trim() || 'Unassigned';
            if (!byLocation.has(location)) byLocation.set(location, []);
            byLocation.get(location)!.push(task);
        }

        let rows: DayLocationRow[];
        if (byLocation.size === 0) {
            rows = [{ location: 'No tasks yet', bars: [], laneCount: 1, isPlaceholder: true }];
        } else {
            rows = [...byLocation.entries()]
                .sort((a, b) => a[0].localeCompare(b[0]))
                .map(([location, locationTasks]) => {
                    const bars = buildBarsForTasks(locationTasks, minuteWidth);
                    return {
                        location,
                        bars,
                        laneCount: Math.max(1, bars.length ? Math.max(...bars.map((b) => b.lane)) + 1 : 1),
                    };
                });
        }

        return {
            key: dayKey,
            date: day,
            label: formatDateLabel(day),
            rows,
        };
    });
}

interface DayBlockProps {
    section: DaySection;
    tasksById: Map<number, EventTaskRef>;
    onAddTask: (day: Date) => void;
    onEditTask: (task: EventTaskRef) => void;
    onRemoveAssignment: (target: RemoveAssignmentTarget) => void;
    onBarMouseEnter: (bar: TimetableBar, event: MouseEvent<HTMLDivElement>) => void;
    onBarMouseLeave: (bar: TimetableBar) => void;
    onBarClick: (bar: TimetableBar, event: MouseEvent<HTMLDivElement>) => void;
    setBarRef: (barKey: string) => (node: HTMLDivElement | null) => void;
    canManage: boolean;
}

function DayBlock({
    section,
    tasksById,
    onAddTask,
    onEditTask,
    onRemoveAssignment,
    onBarMouseEnter,
    onBarMouseLeave,
    onBarClick,
    setBarRef,
    canManage,
}: DayBlockProps) {
    const dayTrackWidth = HOURS_PER_DAY * HOUR_WIDTH;
    const tableWidth = DATE_COL_WIDTH + dayTrackWidth + LOCATION_COL_WIDTH;
    const dateRowSpan = section.rows.length + 1;

    return (
        <div className="ett-day-block">
            <div className="ett-day-scroll">
                <table className="ett-table" style={{ minWidth: `${tableWidth}px` }}>
                    <thead>
                        <tr>
                            <th className="ett-date-header ett-sticky-left" scope="col">Date</th>
                            {Array.from({ length: HOURS_PER_DAY }, (_, hour) => (
                                <th key={`${section.key}-h-${hour}`} className="ett-hour-cell" scope="col">
                                    {formatHourLabel(hour)}
                                </th>
                            ))}
                            <th className="ett-location-header ett-sticky-right" scope="col">Location</th>
                        </tr>
                    </thead>
                    <tbody>
                        {section.rows.map((row, index) => (
                            <tr key={`${section.key}-${row.location}-${index}`} className={row.isPlaceholder ? 'ett-row--empty' : undefined}>
                                {index === 0 && (
                                    <td className="ett-date-cell ett-sticky-left" rowSpan={dateRowSpan}>
                                        {section.label}
                                    </td>
                                )}
                                <td colSpan={HOURS_PER_DAY} className="ett-day-track-cell">
                                    <div
                                        className="ett-day-track"
                                        style={{ minHeight: `${row.laneCount * LANE_HEIGHT + 10}px` }}
                                    >
                                        <div className="ett-track-grid" />
                                        {row.bars.map((bar) => {
                                            const task = tasksById.get(bar.taskId);
                                            const isMerged = bar.members.length > 1;
                                            const hasLeader = bar.members.some((member) => member.isLeader);
                                            const singleMember = bar.members.length === 1 ? bar.members[0] : null;

                                            return (
                                                <div
                                                    key={bar.key}
                                                    ref={setBarRef(bar.key)}
                                                    className={`ett-bar${hasLeader ? ' ett-bar--leader' : ''}${isMerged ? ' ett-bar--merged' : ''}`}
                                                    style={{
                                                        left: `${bar.left}px`,
                                                        width: `${bar.width}px`,
                                                        top: `${bar.lane * LANE_HEIGHT + 5}px`,
                                                    }}
                                                    onMouseEnter={(event) => onBarMouseEnter(bar, event)}
                                                    onMouseLeave={() => onBarMouseLeave(bar)}
                                                    onClick={(event) => onBarClick(bar, event)}
                                                >
                                                    <span className="ett-bar-title">
                                                        {hasLeader ? '★ ' : ''}{bar.title}
                                                    </span>
                                                    <BarMemberNames members={bar.members} />
                                                    {canManage && !row.isPlaceholder && task && (
                                                        <div className="ett-bar-actions">
                                                            <button
                                                                type="button"
                                                                className="ett-bar-action"
                                                                onClick={(event) => {
                                                                    event.stopPropagation();
                                                                    onEditTask(task);
                                                                }}
                                                                aria-label={`Edit task ${bar.title}`}
                                                            >
                                                                <Pencil size={11} />
                                                            </button>
                                                            {!isMerged && singleMember && (
                                                                <button
                                                                    type="button"
                                                                    className="ett-bar-action"
                                                                    onClick={(event) => {
                                                                        event.stopPropagation();
                                                                        onRemoveAssignment({
                                                                            taskId: bar.taskId,
                                                                            assignmentId: singleMember.assignmentId,
                                                                            taskTitle: bar.title,
                                                                            memberName: singleMember.memberName,
                                                                        });
                                                                    }}
                                                                    aria-label={`Remove ${singleMember.memberName} from ${bar.title}`}
                                                                >
                                                                    <Trash2 size={11} />
                                                                </button>
                                                            )}
                                                        </div>
                                                    )}
                                                </div>
                                            );
                                        })}
                                    </div>
                                </td>
                                <td className="ett-location-cell ett-sticky-right" title={row.location}>
                                    {row.location}
                                </td>
                            </tr>
                        ))}
                        <tr className="ett-add-row">
                            <td colSpan={HOURS_PER_DAY} className="ett-add-cell">
                                <button
                                    type="button"
                                    className="ett-add-trigger"
                                    onClick={() => onAddTask(section.date)}
                                    disabled={!canManage}
                                >
                                    <Plus size={13} className="ett-add-icon" />
                                    <span className="ett-add-label">Add task</span>
                                </button>
                            </td>
                            <td className="ett-add-location-stub ett-sticky-right" />
                        </tr>
                    </tbody>
                </table>
            </div>
        </div>
    );
}

export default function EventTasksTimetable({
    days,
    tasks,
    onAddTask,
    onEditTask,
    onRemoveAssignment,
    canManage,
}: EventTasksTimetableProps) {
    const minuteWidth = HOUR_WIDTH / 60;
    const previewHoverTimerRef = useRef<number | null>(null);
    const barRefs = useRef<Map<string, HTMLDivElement>>(new Map());
    const previewPopoverRef = useRef<HTMLDivElement | null>(null);
    const [preview, setPreview] = useState<BarPreviewState | null>(null);
    const [mounted, setMounted] = useState(false);

    useEffect(() => {
        setMounted(true);
    }, []);

    const daySections = useMemo(
        () => buildDaySections(days, tasks, minuteWidth),
        [days, tasks, minuteWidth],
    );

    const tasksById = useMemo(
        () => new Map(tasks.map((task) => [Number(task.id), task])),
        [tasks],
    );

    const barsByKey = useMemo(() => {
        const map = new Map<string, TimetableBar>();
        for (const section of daySections) {
            for (const row of section.rows) {
                for (const bar of row.bars) {
                    map.set(bar.key, bar);
                }
            }
        }
        return map;
    }, [daySections]);

    const previewBar = preview ? barsByKey.get(preview.barKey) ?? null : null;
    const previewTask = previewBar ? tasksById.get(previewBar.taskId) ?? null : null;

    const setBarRef = useCallback((barKey: string) => (node: HTMLDivElement | null) => {
        if (node) {
            barRefs.current.set(barKey, node);
        } else {
            barRefs.current.delete(barKey);
        }
    }, []);

    const clearPreviewHoverTimer = useCallback(() => {
        if (previewHoverTimerRef.current) {
            window.clearTimeout(previewHoverTimerRef.current);
            previewHoverTimerRef.current = null;
        }
    }, []);

    const refreshPreviewPosition = useCallback((barKey: string) => {
        const barElement = barRefs.current.get(barKey);
        if (!barElement) {
            setPreview(null);
            return;
        }

        const position = getBarPreviewPosition(barElement.getBoundingClientRect());
        setPreview((current) => {
            if (!current || current.barKey !== barKey) return current;
            return { ...current, position };
        });
    }, []);

    const openPreview = useCallback((bar: TimetableBar, element: HTMLDivElement, pinned: boolean) => {
        const position = getBarPreviewPosition(element.getBoundingClientRect());
        setPreview({ barKey: bar.key, pinned, position });
    }, []);

    const handleBarMouseEnter = useCallback((bar: TimetableBar, event: MouseEvent<HTMLDivElement>) => {
        clearPreviewHoverTimer();
        if (preview?.pinned && preview.barKey !== bar.key) return;

        const element = event.currentTarget;
        previewHoverTimerRef.current = window.setTimeout(() => {
            openPreview(bar, element, false);
        }, PREVIEW_HOVER_DELAY_MS);
    }, [clearPreviewHoverTimer, openPreview, preview?.barKey, preview?.pinned]);

    const handleBarMouseLeave = useCallback((bar: TimetableBar) => {
        clearPreviewHoverTimer();
        setPreview((current) => {
            if (!current || current.barKey !== bar.key || current.pinned) return current;
            return null;
        });
    }, [clearPreviewHoverTimer]);

    const handleBarClick = useCallback((bar: TimetableBar, event: MouseEvent<HTMLDivElement>) => {
        event.stopPropagation();
        clearPreviewHoverTimer();
        const element = event.currentTarget;
        const position = getBarPreviewPosition(element.getBoundingClientRect());
        setPreview((current) => {
            if (current?.barKey === bar.key && current.pinned) return null;
            return { barKey: bar.key, pinned: true, position };
        });
    }, [clearPreviewHoverTimer]);

    const handleRemoveAssignment = useCallback((target: RemoveAssignmentTarget) => {
        setPreview(null);
        onRemoveAssignment(target);
    }, [onRemoveAssignment]);

    useEffect(() => {
        if (!preview?.barKey) return undefined;

        const exists = barsByKey.has(preview.barKey);
        if (!exists) {
            setPreview(null);
            return undefined;
        }

        const handleResize = () => refreshPreviewPosition(preview.barKey);
        const handleEscape = (event: KeyboardEvent) => {
            if (event.key === 'Escape') setPreview(null);
        };
        const handlePointerDown = (event: Event) => {
            const target = event.target;
            if (!(target instanceof Element)) return;
            if (previewPopoverRef.current?.contains(target)) return;
            if (target.closest('.ett-bar')) return;
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
    }, [preview?.barKey, barsByKey, refreshPreviewPosition]);

    if (daySections.length === 0) {
        return <div className="ett-empty">No event dates available to schedule tasks.</div>;
    }

    const cssVars: CSSProperties & Record<string, string> = {
        '--ett-date-width': `${DATE_COL_WIDTH / 16}rem`,
        '--ett-location-width': `${LOCATION_COL_WIDTH / 16}rem`,
        '--ett-hour-width': `${HOUR_WIDTH / 16}rem`,
        '--ett-day-track-width': `${HOURS_PER_DAY * HOUR_WIDTH}px`,
        '--ett-minute-width': `${minuteWidth}px`,
        '--ett-lane-height': `${LANE_HEIGHT}px`,
    };

    return (
        <div className="ett" style={cssVars}>
            <div className="ett-shell">
                <div className="ett-day-blocks">
                    {daySections.map((section) => (
                        <DayBlock
                            key={section.key}
                            section={section}
                            tasksById={tasksById}
                            onAddTask={onAddTask}
                            onEditTask={onEditTask}
                            onRemoveAssignment={handleRemoveAssignment}
                            onBarMouseEnter={handleBarMouseEnter}
                            onBarMouseLeave={handleBarMouseLeave}
                            onBarClick={handleBarClick}
                            setBarRef={setBarRef}
                            canManage={canManage}
                        />
                    ))}
                </div>
            </div>

            {mounted && preview && previewBar && previewTask && createPortal(
                <div ref={previewPopoverRef}>
                    <EventTaskBarPreview
                        task={previewTask}
                        bar={previewBar}
                        position={preview.position}
                        canManage={canManage}
                        onClose={() => setPreview(null)}
                        onRemoveAssignment={handleRemoveAssignment}
                    />
                </div>,
                document.body,
            )}
        </div>
    );
}
