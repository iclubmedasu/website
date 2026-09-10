import type { EmployeeKpiListItem, EmployeeKpiOrgSummary } from '@/services/kpisAPI';
import { downloadBlob } from '@/utils/downloadBlob';
import { generateXlsxBlob } from '@/utils/generateXlsxBlob';

const HEADER_FILL = '#561789';
const ZEBRA_FILL = '#F9FAFB';
const BORDER_COLOR = '#E5E7EB';

type ExportEmployeeKpisInput = {
    startDate: string;
    endDate: string;
    summary: EmployeeKpiOrgSummary;
    employees: EmployeeKpiListItem[];
};

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

function formatRate(rate: number | null | undefined): string {
    if (rate == null || Number.isNaN(rate)) return '';
    return `${Math.round(rate * 1000) / 10}%`;
}

function formatAvgDays(days: number | null | undefined): string {
    if (days == null || Number.isNaN(days)) return '';
    return String(Math.round(days * 10) / 10);
}

function buildSummaryMatrix(
    startDate: string,
    endDate: string,
    summary: EmployeeKpiOrgSummary,
): string[][] {
    return [
        ['Metric', 'Value'],
        ['Period From', startDate],
        ['Period To', endDate],
        ['Total Active Members', String(summary.totalMembers)],
        ['Total Project Tasks Assigned', String(summary.totalProjectTasksAssigned)],
        ['Total Project Tasks Completed', String(summary.totalProjectTasksCompleted)],
        ['Total Event Task Assignments', String(summary.totalEventTaskAssignments)],
    ];
}

function buildEventTasksMatrix(employees: EmployeeKpiListItem[]): string[][] {
    const rows = [...employees].sort(
        (a, b) => b.eventTasks.assignedCount - a.eventTasks.assignedCount,
    );
    return [
        ['Name', 'Event Task Assignments'],
        ...rows.map((row) => [row.fullName || 'Unknown', String(row.eventTasks.assignedCount)]),
    ];
}

function buildProjectTasksMatrix(employees: EmployeeKpiListItem[]): string[][] {
    const rows = [...employees].sort(
        (a, b) => b.projectTasks.assignedCount - a.projectTasks.assignedCount,
    );
    return [
        ['Name', 'Assigned', 'Completed', 'Completion Rate', 'Overdue', 'Avg Completion Days'],
        ...rows.map((row) => [
            row.fullName || 'Unknown',
            String(row.projectTasks.assignedCount),
            String(row.projectTasks.completedCount),
            formatRate(row.projectTasks.completionRate),
            String(row.projectTasks.overdueCount),
            formatAvgDays(row.projectTasks.avgCompletionDays),
        ]),
    ];
}

export async function exportEmployeeKpisExcel(input: ExportEmployeeKpisInput): Promise<void> {
    const { startDate, endDate, summary, employees } = input;
    const xlsxModule = await import('xlsx-js-style');
    const XLSX = xlsxModule.default || xlsxModule;
    const jszipModule = await import('jszip');
    const JSZip = jszipModule.default;

    const sheets: { name: string; matrix: string[][] }[] = [
        { name: 'Summary', matrix: buildSummaryMatrix(startDate, endDate, summary) },
        { name: 'Event Tasks', matrix: buildEventTasksMatrix(employees) },
        { name: 'Project Tasks', matrix: buildProjectTasksMatrix(employees) },
    ];

    const workbook = XLSX.utils.book_new();
    for (const sheetDef of sheets) {
        const rawSheet = XLSX.utils.aoa_to_sheet(sheetDef.matrix);
        const styledSheet = styleSheet(XLSX, rawSheet, sheetDef.matrix);
        XLSX.utils.book_append_sheet(workbook, styledSheet, sheetDef.name);
    }

    const workbookBytes = XLSX.write(workbook, { bookType: 'xlsx', type: 'array', cellStyles: true }) as ArrayBuffer;
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
    downloadBlob(workbookBlob, `employee-kpis-${startDate}_to_${endDate}.xlsx`);
}
