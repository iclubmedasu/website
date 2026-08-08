import { toDateInputValue } from '@iclub/shared/utils';
import type { UsageDashboardSummary } from '@/services/api';
import { downloadBlob } from '@/utils/downloadBlob';
import { generateXlsxBlob } from '@/utils/generateXlsxBlob';

const HEADER_FILL = '#561789';
const ZEBRA_FILL = '#F9FAFB';
const BORDER_COLOR = '#E5E7EB';

const METRIC_ROWS: { key: keyof UsageDashboardSummary['counts']; label: string }[] = [
    { key: 'eventsCreated', label: 'Events created' },
    { key: 'certificatesIssued', label: 'Certificates issued' },
    { key: 'checkInsScanned', label: 'Check-ins scanned' },
    { key: 'registrationsCreated', label: 'Registrations created' },
    { key: 'dataExports', label: 'Data exports' },
    { key: 'logins', label: 'Logins' },
    { key: 'activeMembers', label: 'Active members (logins)' },
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

function buildSummaryMatrix(data: UsageDashboardSummary): string[][] {
    return [
        ['Metric', 'Count'],
        ['Window (days)', String(data.windowDays)],
        ['From (UTC)', data.since],
        ['To (UTC)', data.until],
        ...METRIC_ROWS.map((row) => [row.label, String(data.counts[row.key])]),
    ];
}

export async function exportUsageExcel(data: UsageDashboardSummary): Promise<void> {
    const xlsxModule = await import('xlsx-js-style');
    const XLSX = xlsxModule.default || xlsxModule;
    const jszipModule = await import('jszip');
    const JSZip = jszipModule.default;

    const matrix = buildSummaryMatrix(data);
    const workbook = XLSX.utils.book_new();
    const rawSheet = XLSX.utils.aoa_to_sheet(matrix);
    const styledSheet = styleSheet(XLSX, rawSheet, matrix);
    XLSX.utils.book_append_sheet(workbook, styledSheet, 'Summary');

    const workbookBytes = XLSX.write(workbook, { bookType: 'xlsx', type: 'array', cellStyles: true }) as ArrayBuffer;
    const workbookZip = await JSZip.loadAsync(workbookBytes);

    const sheetPath = 'xl/worksheets/sheet1.xml';
    const sheetFile = workbookZip.file(sheetPath);
    if (sheetFile) {
        let sheetXml = await sheetFile.async('string');
        sheetXml = withFrozenPaneInWorksheetXml(sheetXml, {
            xSplit: 0,
            ySplit: 1,
            topLeftCell: 'A2',
        });
        workbookZip.file(sheetPath, sheetXml);
    }

    const fromDay = toDateInputValue(data.since);
    const toDay = toDateInputValue(data.until);
    const exportDate =
        fromDay && toDay ? `${fromDay}_to_${toDay}` : fromDay || toDateInputValue(new Date().toISOString());
    const workbookBlob = await generateXlsxBlob(workbookZip);
    downloadBlob(workbookBlob, `usage-analytics-${exportDate}.xlsx`);
}
