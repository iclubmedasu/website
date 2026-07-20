import {
    CLUB_TIMEZONE,
    formatDateTime,
    toEventDayString,
} from '@iclub/shared/utils';
import type { EventCustomFieldRef, EventRegistrationRef, EventSessionRef } from '@/types/backend-contracts';
import {
    formatCustomFieldValue,
    formatRegistrationSource,
    formatRegistrationStatus,
    getCustomFieldValue,
} from '../EventExpandedContent/customFieldUtils';
import { formatAttendanceDayLabel } from '../eventDateUtils';
import { formatSessionDisplayLabel } from '../eventUtils';

export const XLSX_MIME = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';

export interface OverviewKpis {
    registered: number;
    checkedIn: number;
    walkIns: number;
    noShows: number;
    totalAttended: number;
}

export interface SessionMetricRow {
    sessionId: string;
    label: string;
    registered: number;
    attended: number;
    missed: number;
}

export interface MemberMetricRow {
    name: string;
    email: string;
    tier: string;
    totalSessions: number;
    sessionsSelected: number;
    attended: number;
    missed: number;
    attendancePercent: number;
}

export interface TierMetricRow {
    tierId: string;
    tierName: string;
    registrations: number;
}

interface AttendanceLogRow {
    name: string;
    email: string;
    code: string;
    type: string;
    detail: string;
    mode: string;
    timestamp: string;
    sortName: string;
    sortTime: number;
}

export function isCancelledRegistration(registration: EventRegistrationRef): boolean {
    return registration.status === 'CANCELLED' || Boolean(registration.cancelledAt);
}

export function getActiveRegistrations(registrations: EventRegistrationRef[]): EventRegistrationRef[] {
    return registrations.filter((registration) => !isCancelledRegistration(registration));
}

export function computeOverviewKpis(registrations: EventRegistrationRef[]): OverviewKpis {
    const active = getActiveRegistrations(registrations);
    const registered = active.filter((registration) => !registration.isWalkIn).length;
    const checkedIn = active.filter(
        (registration) => !registration.isWalkIn && registration.status === 'CHECKED_IN',
    ).length;
    const walkIns = active.filter((registration) => registration.isWalkIn).length;
    const noShows = active.filter(
        (registration) => !registration.isWalkIn && registration.status === 'REGISTERED',
    ).length;

    return {
        registered,
        checkedIn,
        walkIns,
        noShows,
        totalAttended: checkedIn + walkIns,
    };
}

export function getSortedActiveSessions(sessions: EventSessionRef[]): EventSessionRef[] {
    return [...sessions]
        .filter((session) => session.isActive !== false)
        .sort((a, b) => {
            const dateCompare = a.sessionDate.localeCompare(b.sessionDate);
            if (dateCompare !== 0) return dateCompare;
            return (a.order ?? 0) - (b.order ?? 0);
        });
}

function countRegisteredForSession(registrations: EventRegistrationRef[], sessionId: string): number {
    return getActiveRegistrations(registrations).filter((registration) =>
        (registration.sessionSelections ?? []).some(
            (selection) => String(selection.sessionId) === sessionId,
        ),
    ).length;
}

function countAttendedForSession(registrations: EventRegistrationRef[], sessionId: string): number {
    return getActiveRegistrations(registrations).filter((registration) =>
        (registration.sessionAttendances ?? []).some(
            (attendance) => String(attendance.sessionId) === sessionId && attendance.joinedAt,
        ),
    ).length;
}

export function computeSessionMetrics(
    registrations: EventRegistrationRef[],
    sessions: EventSessionRef[],
): SessionMetricRow[] {
    return getSortedActiveSessions(sessions).map((session) => {
        const sessionId = String(session.id);
        const registered = countRegisteredForSession(registrations, sessionId);
        const attended = countAttendedForSession(registrations, sessionId);
        return {
            sessionId,
            label: formatSessionDisplayLabel(session),
            registered,
            attended,
            missed: Math.max(0, registered - attended),
        };
    });
}

export function formatAttendancePercent(attended: number, totalSessions: number): string {
    if (totalSessions <= 0) return '0%';
    return `${Math.round((attended / totalSessions) * 100)}%`;
}

export function computeMemberMetrics(
    registrations: EventRegistrationRef[],
    sessions: EventSessionRef[] = [],
): MemberMetricRow[] {
    const totalSessions = getSortedActiveSessions(sessions).length;

    return getActiveRegistrations(registrations)
        .map((registration) => {
            const sessionsSelected = registration.sessionSelections?.length ?? 0;
            const attended = (registration.sessionAttendances ?? []).filter((entry) => entry.joinedAt).length;
            const attendancePercent =
                totalSessions <= 0 ? 0 : Math.round((attended / totalSessions) * 100);
            return {
                name: registration.fullName,
                email: registration.email,
                tier: registration.tier?.name || '',
                totalSessions,
                sessionsSelected,
                attended,
                missed: Math.max(0, sessionsSelected - attended),
                attendancePercent,
            };
        })
        .sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true, sensitivity: 'base' }));
}

export function computeTierMetrics(registrations: EventRegistrationRef[]): TierMetricRow[] {
    const counts = new Map<string, TierMetricRow>();

    getActiveRegistrations(registrations).forEach((registration) => {
        const tierId = registration.tierId != null ? String(registration.tierId) : 'none';
        const tierName = registration.tier?.name || 'No tier';
        const existing = counts.get(tierId);
        if (existing) {
            existing.registrations += 1;
            return;
        }
        counts.set(tierId, { tierId, tierName, registrations: 1 });
    });

    return Array.from(counts.values()).sort((a, b) =>
        a.tierName.localeCompare(b.tierName, undefined, { numeric: true, sensitivity: 'base' }),
    );
}

export function fmtDateTime(value: string | Date | null | undefined): string {
    if (!value) return '';
    const formatted = formatDateTime(value);
    return formatted === '—' ? '' : formatted;
}

function formatAttendanceMode(mode: string | null | undefined): string {
    if (mode === 'ONLINE') return 'Online';
    if (mode === 'ONSITE') return 'Onsite';
    return mode || '';
}

function formatSessionSelectionsExport(registration: EventRegistrationRef): string {
    return (registration.sessionSelections ?? [])
        .map((selection) => selection.label?.trim() || formatAttendanceDayLabel(selection.sessionDate))
        .filter(Boolean)
        .join(', ');
}

function formatAttendanceExport(
    registration: EventRegistrationRef,
    sessionDateById: Map<string, string>,
): string {
    const chips: string[] = [];

    registration.attendanceDays?.forEach((day) => {
        const timeLabel = fmtDateTime(day.checkedInAt);
        const dayLabel = formatAttendanceDayLabel(day.eventDay);
        chips.push(timeLabel ? `Onsite · ${dayLabel} · ${timeLabel}` : `Onsite · ${dayLabel}`);
    });

    registration.sessionAttendances?.forEach((attendance) => {
        const sessionDate = sessionDateById.get(String(attendance.sessionId));
        const dayLabel = sessionDate ? formatAttendanceDayLabel(sessionDate) : 'Session';
        const modeLabel = attendance.mode === 'ONLINE' ? 'Online' : 'Onsite';
        const timeLabel = fmtDateTime(attendance.joinedAt);
        chips.push(timeLabel ? `${modeLabel} · ${dayLabel} · ${timeLabel}` : `${modeLabel} · ${dayLabel}`);
    });

    return chips.join(', ');
}

function formatSessionColumnHeader(session: EventSessionRef): string {
    return `Session: ${formatSessionDisplayLabel(session)}`;
}

function formatSessionAttendanceExport(
    registration: EventRegistrationRef,
    session: EventSessionRef,
): string {
    const attendance = (registration.sessionAttendances ?? []).find(
        (entry) => String(entry.sessionId) === String(session.id),
    );
    if (!attendance) return 'Missed';
    return fmtDateTime(attendance.joinedAt) || 'Attended';
}

function buildSessionLabelById(sessions: EventSessionRef[]): Map<string, string> {
    return new Map(
        sessions.map((session) => [String(session.id), formatSessionDisplayLabel(session)]),
    );
}

function pushAttendanceLogRow(
    rows: AttendanceLogRow[],
    registration: EventRegistrationRef,
    type: string,
    detail: string,
    mode: string,
    timestamp: string | Date | null | undefined,
) {
    if (!timestamp) return;
    const parsed = new Date(timestamp);
    if (Number.isNaN(parsed.getTime())) return;

    rows.push({
        name: registration.fullName,
        email: registration.email,
        code: registration.confirmationCode,
        type,
        detail,
        mode,
        timestamp: fmtDateTime(timestamp),
        sortName: registration.fullName.toLowerCase(),
        sortTime: parsed.getTime(),
    });
}

export function buildOverviewMatrix(kpis: OverviewKpis): string[][] {
    return [
        ['Metric', 'Value'],
        ['Registered', String(kpis.registered)],
        ['Check-ins', String(kpis.checkedIn)],
        ['Walk-ins', String(kpis.walkIns)],
        ['No-shows', String(kpis.noShows)],
        ['Total attended', String(kpis.totalAttended)],
    ];
}

export function buildSessionSummaryMatrix(metrics: SessionMetricRow[]): string[][] {
    return [
        ['Session', 'Registered', 'Attended', 'Missed'],
        ...metrics.map((row) => [
            row.label,
            String(row.registered),
            String(row.attended),
            String(row.missed),
        ]),
    ];
}

export function buildMemberSummaryMatrix(metrics: MemberMetricRow[]): string[][] {
    return [
        [
            'Name',
            'Email',
            'Tier',
            'Total sessions',
            'Sessions selected',
            'Attended',
            'Missed',
            'Attendance %',
        ],
        ...metrics.map((row) => [
            row.name,
            row.email,
            row.tier,
            String(row.totalSessions),
            String(row.sessionsSelected),
            String(row.attended),
            String(row.missed),
            formatAttendancePercent(row.attended, row.totalSessions),
        ]),
    ];
}

export function buildTierSummaryMatrix(metrics: TierMetricRow[]): string[][] {
    return [
        ['Tier', 'Registrations'],
        ...metrics.map((row) => [row.tierName, String(row.registrations)]),
    ];
}

export function buildRegistrationMatrix(
    registrations: EventRegistrationRef[],
    fields: EventCustomFieldRef[],
    multiDayEvent: boolean,
    sessionDateById: Map<string, string>,
): string[][] {
    const sortedFields = [...fields].sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
    const headers = [
        'Name',
        'Email',
        'Phone',
        ...sortedFields.map((field) => field.label),
        'Sessions',
        'Tier',
        'Code',
        ...(multiDayEvent ? ['Attendance'] : []),
        'Status',
        'Source',
        'Cancelled',
        'Registered',
    ];

    const rows = registrations.map((registration) => {
        const row = [
            registration.fullName,
            registration.email,
            registration.phoneNumber || '',
            ...sortedFields.map((field) => {
                const value = formatCustomFieldValue(field, getCustomFieldValue(registration, field));
                return value === '—' ? '' : value;
            }),
            formatSessionSelectionsExport(registration),
            registration.tier?.name || '',
            registration.confirmationCode,
        ];

        if (multiDayEvent) {
            row.push(formatAttendanceExport(registration, sessionDateById));
        }

        row.push(
            formatRegistrationStatus(registration),
            formatRegistrationSource(registration),
            fmtDateTime(registration.cancelledAt),
            fmtDateTime(registration.createdAt),
        );

        return row;
    });

    return [headers, ...rows];
}

export function buildSessionAttendanceMatrix(
    registrations: EventRegistrationRef[],
    sessions: EventSessionRef[],
): string[][] {
    const sortedActiveSessions = getSortedActiveSessions(sessions);
    const headers = [
        'Name',
        'Email',
        'Code',
        ...sortedActiveSessions.map(formatSessionColumnHeader),
    ];

    const rows = registrations.map((registration) => [
        registration.fullName,
        registration.email,
        registration.confirmationCode,
        ...sortedActiveSessions.map((session) => formatSessionAttendanceExport(registration, session)),
    ]);

    return [headers, ...rows];
}

export function buildAttendanceLogMatrix(
    registrations: EventRegistrationRef[],
    sessions: EventSessionRef[],
): string[][] {
    const sessionLabelById = buildSessionLabelById(sessions);
    const headers = ['Name', 'Email', 'Code', 'Type', 'Detail', 'Mode', 'Timestamp'];
    const rows: AttendanceLogRow[] = [];

    registrations.forEach((registration) => {
        (registration.attendanceDays ?? []).forEach((day) => {
            pushAttendanceLogRow(
                rows,
                registration,
                'Day check-in',
                formatAttendanceDayLabel(day.eventDay),
                'Onsite',
                day.checkedInAt,
            );
        });

        (registration.sessionAttendances ?? []).forEach((attendance) => {
            const detail = sessionLabelById.get(String(attendance.sessionId)) || 'Session';
            pushAttendanceLogRow(
                rows,
                registration,
                'Session attendance',
                detail,
                formatAttendanceMode(attendance.mode),
                attendance.joinedAt,
            );
        });
    });

    rows.sort((a, b) => {
        const nameCompare = a.sortName.localeCompare(b.sortName);
        if (nameCompare !== 0) return nameCompare;
        return a.sortTime - b.sortTime;
    });

    return [
        headers,
        ...rows.map((row) => [
            row.name,
            row.email,
            row.code,
            row.type,
            row.detail,
            row.mode,
            row.timestamp,
        ]),
    ];
}

export function buildSessionDateById(
    sessions: EventSessionRef[],
    eventTimezone: string = CLUB_TIMEZONE,
): Map<string, string> {
    return new Map(
        sessions.map((session) => {
            const instant = session.startDateTime ?? session.sessionDate;
            const day = instant ? toEventDayString(instant, eventTimezone) : null;
            return [String(session.id), day ?? ''] as const;
        }),
    );
}

export function sanitizeFileName(name: string): string {
    const cleaned = name.replace(/[<>:"/\\|?*]/g, '').trim();
    return cleaned || 'event-registrations';
}
