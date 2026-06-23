import type { EventTaskRef } from '@/types/backend-contracts';

export const HOUR_WIDTH = 60;
export const HOURS_PER_DAY = 24;
export const LANE_HEIGHT = 36;
export const DEFAULT_TIMETABLE_START_HOUR = 8;

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
    startMin: number;
    endMin: number;
}

export interface DayLocationRow {
    location: string;
    bars: TimetableBar[];
    laneCount: number;
    isPlaceholder?: boolean;
}

export interface DaySection {
    key: string;
    date: Date;
    label: string;
    rows: DayLocationRow[];
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

export function formatDateLabel(date: Date): string {
    return date.toLocaleDateString([], { weekday: 'short', month: 'short', day: '2-digit' });
}

export function formatHourLabel(hour: number): string {
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
                startMin,
                endMin,
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
            startMin: first.startMin,
            endMin: first.endMin,
            members,
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
        startMin: bar.startMin,
        endMin: bar.endMin,
    }));
}

export function buildDaySections(days: Date[], tasks: EventTaskRef[], minuteWidth: number): DaySection[] {
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

export function getDefaultMinuteWidth(): number {
    return HOUR_WIDTH / 60;
}

export function resolveTimetableStartHour(tasks: EventTaskRef[]): number {
    const earlyMorningEndMin = DEFAULT_TIMETABLE_START_HOUR * 60;
    let startHour = DEFAULT_TIMETABLE_START_HOUR;

    for (const task of tasks) {
        for (const assignment of task.assignments ?? []) {
            const start = getDateOrNull(assignment.startDateTime);
            if (!start) continue;

            const startMin = minutesWithinDay(start);
            if (startMin < earlyMorningEndMin) {
                startHour = Math.min(startHour, Math.floor(startMin / 60));
            }
        }
    }

    return startHour;
}

export function getVisibleHourCount(startHour: number): number {
    return HOURS_PER_DAY - startHour;
}

export function getBarDisplayGeometry(
    bar: Pick<TimetableBar, 'startMin' | 'endMin'>,
    startHour: number,
    minuteWidth: number,
): { left: number; width: number } | null {
    const windowStartMin = startHour * 60;
    const windowEndMin = HOURS_PER_DAY * 60;

    if (bar.endMin <= windowStartMin || bar.startMin >= windowEndMin) {
        return null;
    }

    const visibleStartMin = Math.max(bar.startMin, windowStartMin);
    const visibleEndMin = Math.min(bar.endMin, windowEndMin);

    return {
        left: (visibleStartMin - windowStartMin) * minuteWidth,
        width: Math.max(4, (visibleEndMin - visibleStartMin) * minuteWidth),
    };
}
