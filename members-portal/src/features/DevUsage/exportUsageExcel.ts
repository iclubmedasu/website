import type {
    UsageAnnouncementListItem,
    UsageAnnouncementsOrgSummary,
    UsageDashboardSummary,
    UsageEventListItem,
    UsageEventsOrgSummary,
    UsageProjectListItem,
    UsageProjectsOrgSummary,
} from '@/services/usageDashboardAPI';
import { downloadBlob } from '@/utils/downloadBlob';
import { generateXlsxBlob } from '@/utils/generateXlsxBlob';

const HEADER_FILL = '#561789';
const ZEBRA_FILL = '#F9FAFB';
const BORDER_COLOR = '#E5E7EB';

export type ExportUsageInput =
    | {
          tab: 'platform';
          from: string;
          to: string;
          platform: UsageDashboardSummary;
      }
    | {
          tab: 'events';
          from: string;
          to: string;
          eventsSummary: UsageEventsOrgSummary;
          events: UsageEventListItem[];
      }
    | {
          tab: 'projects';
          from: string;
          to: string;
          projectsSummary: UsageProjectsOrgSummary;
          projects: UsageProjectListItem[];
      }
    | {
          tab: 'announcements';
          from: string;
          to: string;
          announcementsSummary: UsageAnnouncementsOrgSummary;
          announcements: UsageAnnouncementListItem[];
      };

const PLATFORM_METRIC_ROWS: { key: keyof UsageDashboardSummary['counts']; label: string }[] = [
    { key: 'eventsCreated', label: 'Events created' },
    { key: 'certificatesIssued', label: 'Certificates issued' },
    { key: 'checkInsScanned', label: 'Check-ins scanned' },
    { key: 'registrationsCreated', label: 'Registrations created' },
    { key: 'dataExports', label: 'Data exports' },
    { key: 'logins', label: 'Logins' },
    { key: 'activeMembers', label: 'Active members (logins)' },
];

const EVENT_SUMMARY_ROWS: { key: keyof UsageEventsOrgSummary; label: string }[] = [
    { key: 'eventsCreated', label: 'Events created' },
    { key: 'eventTasks', label: 'Event tasks' },
    { key: 'eventTaskAssignments', label: 'Assignments' },
    { key: 'tasksPerEvent', label: 'Tasks per event' },
    { key: 'peopleWorked', label: 'People worked' },
    { key: 'totalAssignmentHours', label: 'Assignment hours' },
    { key: 'totalEventDurationHours', label: 'Event duration hours' },
    { key: 'registrations', label: 'Registrations' },
    { key: 'ticketsSent', label: 'Tickets sent' },
    { key: 'remindersSent', label: 'Reminders sent' },
    { key: 'certificatesIssued', label: 'Certificates' },
    { key: 'sessions', label: 'Sessions' },
    { key: 'filesUploaded', label: 'Files uploaded' },
    { key: 'photosUploaded', label: 'Photos uploaded' },
    { key: 'checkIns', label: 'Check-ins' },
];

const PROJECT_SUMMARY_ROWS: { key: keyof UsageProjectsOrgSummary; label: string }[] = [
    { key: 'projectsCreated', label: 'Projects created' },
    { key: 'tasks', label: 'Tasks' },
    { key: 'subtasks', label: 'Subtasks' },
    { key: 'phases', label: 'Phases' },
    { key: 'peopleWorked', label: 'People worked' },
    { key: 'totalPlannedDurationDays', label: 'Planned duration (days)' },
    { key: 'files', label: 'Files' },
    { key: 'photos', label: 'Photos' },
    { key: 'certificates', label: 'Certificates' },
];

const ANNOUNCEMENT_SUMMARY_ROWS: {
    key: keyof UsageAnnouncementsOrgSummary;
    label: string;
}[] = [
    { key: 'announcementsCreated', label: 'Announcements created' },
    { key: 'totalResponses', label: 'Total responses' },
    { key: 'availableCount', label: 'Available' },
    { key: 'unavailableCount', label: 'Unavailable' },
    { key: 'avgResponsesPerAnnouncement', label: 'Avg responses per announcement' },
];

function hexToArgb(hex: string): string {
    const normalized = hex.replace('#', '');
    if (normalized.length === 6) return `FF${normalized.toUpperCase()}`;
    return normalized.toUpperCase();
}

function applySheetCellStyle(
    cell: Record<string, unknown>,
    {
        fill,
        fontColor = '#000000',
        bold = false,
        align = 'left',
        wrapText = false,
        border = null,
    }: {
        fill?: string;
        fontColor?: string;
        bold?: boolean;
        align?: string;
        wrapText?: boolean;
        border?: Record<string, { style: string; color: { rgb: string } }> | null;
    } = {},
) {
    if (!cell) return;
    cell.s = {
        font: {
            name: 'Arial',
            sz: 10,
            bold,
            color: { rgb: hexToArgb(fontColor) },
        },
        alignment: {
            horizontal: align,
            vertical: 'center',
            wrapText,
        },
        fill: fill
            ? {
                  patternType: 'solid',
                  fgColor: { rgb: hexToArgb(fill) },
              }
            : undefined,
        border: border ?? undefined,
    };
}

function computeColumnWidths(matrix: string[][]): { wch: number }[] {
    const widths: number[] = [];
    for (const row of matrix) {
        row.forEach((value, index) => {
            widths[index] = Math.max(widths[index] ?? 10, Math.min(String(value ?? '').length + 2, 40));
        });
    }
    return widths.map((wch) => ({ wch }));
}

function styleSheet(
    XLSX: { utils: { encode_cell: (ref: { r: number; c: number }) => string } },
    sheet: Record<string, unknown>,
    matrix: string[][],
) {
    const cellBorder = {
        top: { style: 'thin', color: { rgb: hexToArgb(BORDER_COLOR) } },
        bottom: { style: 'thin', color: { rgb: hexToArgb(BORDER_COLOR) } },
        left: { style: 'thin', color: { rgb: hexToArgb(BORDER_COLOR) } },
        right: { style: 'thin', color: { rgb: hexToArgb(BORDER_COLOR) } },
    };

    matrix.forEach((row, rowIndex) => {
        row.forEach((value, columnIndex) => {
            const cellRef = XLSX.utils.encode_cell({ r: rowIndex, c: columnIndex });
            const cell = (sheet[cellRef] as Record<string, unknown>) || (sheet[cellRef] = { t: 's', v: value });
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
                return;
            }

            applySheetCellStyle(cell, {
                fill: rowIndex % 2 === 0 ? ZEBRA_FILL : '#FFFFFF',
                fontColor: '#111827',
                border: cellBorder,
            });
        });
    });

    sheet['!cols'] = computeColumnWidths(matrix);
    return sheet;
}

function withFrozenPaneInWorksheetXml(
    sheetXml: string,
    pane: { xSplit: number; ySplit: number; topLeftCell: string },
): string {
    const sheetViewsBlock = `<sheetViews><sheetView workbookViewId="0"><pane xSplit="${pane.xSplit}" ySplit="${pane.ySplit}" topLeftCell="${pane.topLeftCell}" activePane="bottomRight" state="frozen"/></sheetView></sheetViews>`;
    if (sheetXml.includes('<sheetViews')) {
        return sheetXml.replace(/<sheetViews>[\s\S]*?<\/sheetViews>/, sheetViewsBlock);
    }
    return sheetXml.replace('<sheetData>', `${sheetViewsBlock}<sheetData>`);
}

function formatNumber(value: number | null | undefined): string {
    if (value == null || Number.isNaN(value)) return '';
    return String(Math.round(value * 10) / 10);
}

function buildPlatformMatrix(data: UsageDashboardSummary): string[][] {
    return [
        ['Metric', 'Count'],
        ['Window (days)', String(data.windowDays)],
        ['From (UTC)', data.since],
        ['To (UTC)', data.until],
        ...PLATFORM_METRIC_ROWS.map((row) => [row.label, String(data.counts[row.key])]),
    ];
}

function buildEventsSummaryMatrix(
    from: string,
    to: string,
    summary: UsageEventsOrgSummary,
): string[][] {
    return [
        ['Metric', 'Value'],
        ['Period From', from],
        ['Period To', to],
        ...EVENT_SUMMARY_ROWS.map((row) => [row.label, formatNumber(summary[row.key])]),
    ];
}

function buildEventsTableMatrix(events: UsageEventListItem[]): string[][] {
    return [
        [
            'Title',
            'Venue',
            'Event Date',
            'Event End',
            'Status',
            'Registrations',
            'Sessions',
            'Tickets Sent',
            'Reminders Sent',
            'Certificates',
            'Files',
            'Photos',
            'People Worked',
            'Assignment Hours',
            'Tasks',
        ],
        ...events.map((row) => [
            row.title || '',
            row.venue || '',
            row.eventDate || '',
            row.eventEndDate || '',
            row.status || '',
            String(row.registrations),
            String(row.sessions),
            String(row.ticketsSent),
            String(row.remindersSent),
            String(row.certificatesIssued),
            String(row.files),
            String(row.photos),
            String(row.peopleWorked),
            formatNumber(row.assignmentHours),
            String(row.tasks),
        ]),
    ];
}

function buildProjectsSummaryMatrix(
    from: string,
    to: string,
    summary: UsageProjectsOrgSummary,
): string[][] {
    return [
        ['Metric', 'Value'],
        ['Period From', from],
        ['Period To', to],
        ...PROJECT_SUMMARY_ROWS.map((row) => [row.label, formatNumber(summary[row.key])]),
    ];
}

function buildProjectsTableMatrix(projects: UsageProjectListItem[]): string[][] {
    return [
        [
            'Title',
            'Status',
            'Start',
            'Due',
            'Completed',
            'Tasks',
            'Subtasks',
            'Phases',
            'People Worked',
            'Files',
            'Photos',
        ],
        ...projects.map((row) => [
            row.title || '',
            row.status || '',
            row.startDate || '',
            row.dueDate || '',
            row.completedDate || '',
            String(row.tasks),
            String(row.subtasks),
            String(row.phases),
            String(row.peopleWorked),
            String(row.files),
            String(row.photos),
        ]),
    ];
}

function formatAnnouncementTarget(row: UsageAnnouncementListItem): string {
    if (row.targetType === 'EVENT') {
        return row.eventTitle ? `Event · ${row.eventTitle}` : 'Event';
    }
    if (row.targetType === 'PROJECT') {
        return row.projectTitle ? `Project · ${row.projectTitle}` : 'Project';
    }
    return 'None';
}

function buildAnnouncementsSummaryMatrix(
    from: string,
    to: string,
    summary: UsageAnnouncementsOrgSummary,
): string[][] {
    return [
        ['Metric', 'Value'],
        ['Period From', from],
        ['Period To', to],
        ...ANNOUNCEMENT_SUMMARY_ROWS.map((row) => [row.label, formatNumber(summary[row.key])]),
    ];
}

function buildAnnouncementsTableMatrix(
    announcements: UsageAnnouncementListItem[],
): string[][] {
    return [
        [
            'Title',
            'Responses',
            'Available',
            'Unavailable',
            'Target',
            'Created',
            'Pinned',
            'Active',
            'Created By',
        ],
        ...announcements.map((row) => [
            row.title || '',
            String(row.responseCount),
            String(row.availableCount),
            String(row.unavailableCount),
            formatAnnouncementTarget(row),
            row.createdAt || '',
            row.isPinned ? 'Yes' : 'No',
            row.isActive ? 'Yes' : 'No',
            row.createdByName || '',
        ]),
    ];
}

export async function exportUsageExcel(input: ExportUsageInput): Promise<void> {
    const xlsxModule = await import('xlsx-js-style');
    const XLSX = xlsxModule.default || xlsxModule;
    const jszipModule = await import('jszip');
    const JSZip = jszipModule.default;

    let sheets: { name: string; matrix: string[][] }[];
    let filePrefix: string;

    if (input.tab === 'platform') {
        sheets = [{ name: 'Platform', matrix: buildPlatformMatrix(input.platform) }];
        filePrefix = 'usage-platform';
    } else if (input.tab === 'events') {
        sheets = [
            {
                name: 'Events Summary',
                matrix: buildEventsSummaryMatrix(input.from, input.to, input.eventsSummary),
            },
            { name: 'Events', matrix: buildEventsTableMatrix(input.events) },
        ];
        filePrefix = 'usage-events';
    } else if (input.tab === 'projects') {
        sheets = [
            {
                name: 'Projects Summary',
                matrix: buildProjectsSummaryMatrix(input.from, input.to, input.projectsSummary),
            },
            { name: 'Projects', matrix: buildProjectsTableMatrix(input.projects) },
        ];
        filePrefix = 'usage-projects';
    } else {
        sheets = [
            {
                name: 'Announcements Summary',
                matrix: buildAnnouncementsSummaryMatrix(
                    input.from,
                    input.to,
                    input.announcementsSummary,
                ),
            },
            {
                name: 'Announcements',
                matrix: buildAnnouncementsTableMatrix(input.announcements),
            },
        ];
        filePrefix = 'usage-announcements';
    }

    const workbook = XLSX.utils.book_new();
    for (const sheetDef of sheets) {
        const rawSheet = XLSX.utils.aoa_to_sheet(sheetDef.matrix);
        const styledSheet = styleSheet(XLSX, rawSheet, sheetDef.matrix);
        XLSX.utils.book_append_sheet(workbook, styledSheet, sheetDef.name);
    }

    const workbookBytes = XLSX.write(workbook, {
        bookType: 'xlsx',
        type: 'array',
        cellStyles: true,
    }) as ArrayBuffer;
    const workbookZip = await JSZip.loadAsync(workbookBytes);

    for (let index = 0; index < sheets.length; index += 1) {
        const sheetPath = `xl/worksheets/sheet${index + 1}.xml`;
        const sheetFile = workbookZip.file(sheetPath);
        if (!sheetFile) continue;
        let sheetXml = await sheetFile.async('string');
        sheetXml = withFrozenPaneInWorksheetXml(sheetXml, {
            xSplit: 0,
            ySplit: 1,
            topLeftCell: 'A2',
        });
        workbookZip.file(sheetPath, sheetXml);
    }

    const workbookBlob = await generateXlsxBlob(workbookZip);
    downloadBlob(workbookBlob, `${filePrefix}-${input.from}_to_${input.to}.xlsx`);
}
