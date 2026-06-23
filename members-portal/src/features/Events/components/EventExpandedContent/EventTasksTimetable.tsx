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
import {
    HOUR_WIDTH,
    LANE_HEIGHT,
    buildDaySections,
    formatHourLabel,
    getBarDisplayGeometry,
    getDefaultMinuteWidth,
    getVisibleHourCount,
    resolveTimetableStartHour,
    type DaySection,
    type TimetableBar,
} from '@/features/Events/components/eventTaskTimetableModel';
import EventTaskBarPreview from './EventTaskBarPreview';
import BarMemberNames from './BarMemberNames';
import './EventTasksTimetable.css';

const DATE_COL_WIDTH = 136;
const LOCATION_COL_WIDTH = 200;
const PREVIEW_HOVER_DELAY_MS = 900;

export type { TimetableBarMember, TimetableBar } from '@/features/Events/components/eventTaskTimetableModel';

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

interface DayBlockProps {
    section: DaySection;
    tasksById: Map<number, EventTaskRef>;
    startHour: number;
    visibleHourCount: number;
    dayTrackWidth: number;
    minuteWidth: number;
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
    startHour,
    visibleHourCount,
    dayTrackWidth,
    minuteWidth,
    onAddTask,
    onEditTask,
    onRemoveAssignment,
    onBarMouseEnter,
    onBarMouseLeave,
    onBarClick,
    setBarRef,
    canManage,
}: DayBlockProps) {
    const tableWidth = DATE_COL_WIDTH + LOCATION_COL_WIDTH + dayTrackWidth;
    const dateRowSpan = section.rows.length + 1;

    return (
        <div className="ett-day-block">
            <div className="ett-day-scroll">
                <table className="ett-table" style={{ minWidth: `${tableWidth}px` }}>
                    <thead>
                        <tr>
                            <th className="ett-date-header ett-sticky-left" scope="col">Date</th>
                            <th className="ett-location-header ett-sticky-left-2" scope="col">Location</th>
                            {Array.from({ length: visibleHourCount }, (_, index) => {
                                const hour = startHour + index;
                                return (
                                    <th key={`${section.key}-h-${hour}`} className="ett-hour-cell" scope="col">
                                        {formatHourLabel(hour)}
                                    </th>
                                );
                            })}
                        </tr>
                    </thead>
                    <tbody>
                        {section.rows.map((row, index) => (
                            <tr key={`${section.key}-${row.location}-${index}`} className={row.isPlaceholder ? 'ett-row--empty' : undefined}>
                                {index === 0 && (
                                    <td className="ett-date-cell ett-sticky-left" rowSpan={dateRowSpan}>
                                        <span className="ett-cell-label">{section.label}</span>
                                    </td>
                                )}
                                <td className="ett-location-cell ett-sticky-left-2" title={row.location}>
                                    <span className="ett-cell-label">{row.location}</span>
                                </td>
                                <td colSpan={visibleHourCount} className="ett-day-track-cell">
                                    <div
                                        className="ett-day-track"
                                        style={{ minHeight: `${row.laneCount * LANE_HEIGHT + 10}px` }}
                                    >
                                        <div className="ett-track-grid" />
                                        {row.bars.map((bar) => {
                                            const geometry = getBarDisplayGeometry(bar, startHour, minuteWidth);
                                            if (!geometry) return null;

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
                                                        left: `${geometry.left}px`,
                                                        width: `${geometry.width}px`,
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
                            </tr>
                        ))}
                        <tr className="ett-add-row">
                            <td className="ett-add-location-stub ett-sticky-left-2" />
                            <td colSpan={visibleHourCount} className="ett-add-cell">
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
    const minuteWidth = getDefaultMinuteWidth();
    const startHour = useMemo(() => resolveTimetableStartHour(tasks), [tasks]);
    const visibleHourCount = getVisibleHourCount(startHour);
    const dayTrackWidth = visibleHourCount * HOUR_WIDTH;
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
        '--ett-day-track-width': `${dayTrackWidth}px`,
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
                            startHour={startHour}
                            visibleHourCount={visibleHourCount}
                            dayTrackWidth={dayTrackWidth}
                            minuteWidth={minuteWidth}
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
