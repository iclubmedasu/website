import type { EventCustomFieldRef, EventRegistrationRef, EventSessionRef } from '@/types/backend-contracts';
import {
    formatCustomFieldValue,
    formatRegistrationSource,
    formatRegistrationStatus,
    getCustomFieldValue,
} from './EventExpandedContent/customFieldUtils';
import { formatAttendanceDayLabel } from './eventDateUtils';
import { formatSessionDisplayLabel } from './eventUtils';

const HEADER_FILL = '#561789';
const ZEBRA_FILL = '#F9FAFB';
const BORDER_COLOR = '#E5E7EB';

interface SheetCellStyleOptions {
    fill?: string;
    fontColor?: string;
    bold?: boolean;
    italic?: boolean;
    align?: string;
    valign?: string;
    wrapText?: boolean;
    indent?: number;
    border?: Record<string, { style: string; color: { rgb: string } }> | null;
    fillPattern?: string;
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

function sanitizeFileName(name: string): string {
    const cleaned = name.replace(/[<>:"/\\|?*]/g, '').trim();
    return cleaned || 'event-registrations';
}

function hexToArgb(hex: string): string {
    const normalized = hex.replace('#', '');
    if (normalized.length === 6) return `FF${normalized.toUpperCase()}`;
    return normalized.toUpperCase();
}

function fmtDateTime(value: string | Date | null | undefined): string {
    if (!value) return '';
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return '';
    return date.toLocaleString('en-GB', {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
    });
}

function formatAttendanceMode(mode: string | null | undefined): string {
    if (mode === 'ONLINE') return 'Online';
    if (mode === 'ONSITE') return 'Onsite';
    return mode || '';
}

function applySheetCellStyle(cell: Record<string, unknown>, {
    fill,
    fontColor = '#000000',
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

export interface ExportEventRegistrationsExcelOptions {
    registrations: EventRegistrationRef[];
    fields: EventCustomFieldRef[];
    sessions?: EventSessionRef[];
    multiDayEvent: boolean;
    fileName: string;
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

function getSortedActiveSessions(sessions: EventSessionRef[]): EventSessionRef[] {
    return [...sessions]
        .filter((session) => session.isActive !== false)
        .sort((a, b) => {
            const dateCompare = a.sessionDate.localeCompare(b.sessionDate);
            if (dateCompare !== 0) return dateCompare;
            return (a.order ?? 0) - (b.order ?? 0);
        });
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

function buildAttendanceLogMatrix(
    registrations: EventRegistrationRef[],
    sessionLabelById: Map<string, string>,
): string[][] {
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

function buildSessionAttendanceMatrix(
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

function buildRegistrationMatrix(
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

function computeColumnWidths(matrix: string[][]): Array<{ wch: number }> {
    const columnCount = matrix[0]?.length ?? 0;
    const widths: number[] = Array.from({ length: columnCount }, () => 10);

    matrix.forEach((row) => {
        row.forEach((value, columnIndex) => {
            const length = String(value ?? '').length;
            widths[columnIndex] = Math.max(widths[columnIndex], Math.min(40, length + 2));
        });
    });

    return widths.map((width) => ({ wch: Math.max(10, width) }));
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function styleSheet(XLSX: any, matrix: string[][]) {
    const sheet = XLSX.utils.aoa_to_sheet(matrix);
    const cellBorder = {
        top: { style: 'thin', color: { rgb: hexToArgb(BORDER_COLOR) } },
        bottom: { style: 'thin', color: { rgb: hexToArgb(BORDER_COLOR) } },
        left: { style: 'thin', color: { rgb: hexToArgb(BORDER_COLOR) } },
        right: { style: 'thin', color: { rgb: hexToArgb(BORDER_COLOR) } },
    };

    const codeColumnIndex = matrix[0]?.indexOf('Code') ?? -1;

    matrix.forEach((row, rowIndex) => {
        row.forEach((value, columnIndex) => {
            const cellRef = XLSX.utils.encode_cell({ r: rowIndex, c: columnIndex });
            const cell = sheet[cellRef] || (sheet[cellRef] = { t: 's', v: value });
            if (value !== undefined && value !== '') cell.v = value;

            if (rowIndex === 0) {
                applySheetCellStyle(cell, {
                    fill: HEADER_FILL,
                    fontColor: '#FFFFFF',
                    bold: true,
                    align: 'center',
                    wrapText: true,
                    border: cellBorder,
                });
                const styled = cell.s as { font?: { sz?: number } };
                if (styled?.font) styled.font.sz = 11;
                return;
            }

            const zebraFill = rowIndex % 2 === 0 ? ZEBRA_FILL : '#FFFFFF';
            applySheetCellStyle(cell, {
                fill: zebraFill,
                fontColor: '#111827',
                align: columnIndex === codeColumnIndex ? 'left' : 'left',
                border: cellBorder,
            });
        });
    });

    sheet['!cols'] = computeColumnWidths(matrix);
    return sheet;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function applyFrozenTopRowToAllSheets(workbookZip: any) {
    const sheetPaths = Object.keys(workbookZip.files ?? {})
        .filter((path) => /^xl\/worksheets\/sheet\d+\.xml$/.test(path));

    await Promise.all(sheetPaths.map(async (sheetPath: string) => {
        const sheetFile = workbookZip.file(sheetPath);
        if (!sheetFile) return;
        let sheetXml = await sheetFile.async('string');
        sheetXml = withFrozenPaneInWorksheetXml(sheetXml, {
            xSplit: 0,
            ySplit: 1,
            topLeftCell: 'A2',
        });
        workbookZip.file(sheetPath, sheetXml);
    }));
}

export async function exportEventRegistrationsExcel({
    registrations,
    fields,
    sessions = [],
    multiDayEvent,
    fileName,
}: ExportEventRegistrationsExcelOptions): Promise<void> {
    const xlsxModule = await import('xlsx-js-style');
    const XLSX = xlsxModule.default || xlsxModule;
    const sessionDateById = new Map(
        sessions.map((session) => [String(session.id), session.sessionDate.slice(0, 10)]),
    );
    const sessionLabelById = buildSessionLabelById(sessions);
    const registrationMatrix = buildRegistrationMatrix(
        registrations,
        fields,
        multiDayEvent,
        sessionDateById,
    );
    const sessionAttendanceMatrix = buildSessionAttendanceMatrix(registrations, sessions);
    const attendanceLogMatrix = buildAttendanceLogMatrix(registrations, sessionLabelById);
    const registrationSheet = styleSheet(XLSX, registrationMatrix);
    const sessionAttendanceSheet = styleSheet(XLSX, sessionAttendanceMatrix);
    const attendanceLogSheet = styleSheet(XLSX, attendanceLogMatrix);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, registrationSheet, 'Registrations');
    XLSX.utils.book_append_sheet(workbook, sessionAttendanceSheet, 'Session Attendance');
    XLSX.utils.book_append_sheet(workbook, attendanceLogSheet, 'Attendance Log');

    const workbookBytes = XLSX.write(workbook, { bookType: 'xlsx', type: 'array', cellStyles: true }) as ArrayBuffer;

    const jszipModule = await import('jszip');
    const JSZip = jszipModule.default;
    const workbookZip = await JSZip.loadAsync(workbookBytes);

    await applyFrozenTopRowToAllSheets(workbookZip);

    const workbookBlob = await workbookZip.generateAsync({ type: 'blob' });
    downloadBlob(workbookBlob, `${sanitizeFileName(fileName)}-registrations.xlsx`);
}
