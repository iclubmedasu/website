import { fmtDate } from '@/components/cards/LifecycleCardView/LifecycleCardView';
import type { EventCustomFieldRef, EventRegistrationRef } from '@/types/backend-contracts';
import {
    formatCustomFieldValue,
    formatRegistrationSource,
    formatRegistrationStatus,
    getCustomFieldValue,
} from './EventExpandedContent/customFieldUtils';
import { formatAttendanceDayLabel } from './eventDateUtils';

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
    multiDayEvent: boolean;
    fileName: string;
}

function buildRegistrationMatrix(
    registrations: EventRegistrationRef[],
    fields: EventCustomFieldRef[],
    multiDayEvent: boolean,
): string[][] {
    const sortedFields = [...fields].sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
    const headers = [
        'Name',
        'Email',
        'Phone',
        ...sortedFields.map((field) => field.label),
        'Tier',
        'Code',
        ...(multiDayEvent ? ['Attendance'] : []),
        'Status',
        'Source',
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
            registration.tier?.name || '',
            registration.confirmationCode,
        ];

        if (multiDayEvent) {
            const attendance = registration.attendanceDays?.length
                ? registration.attendanceDays.map((day) => formatAttendanceDayLabel(day.eventDay)).join(', ')
                : '';
            row.push(attendance);
        }

        row.push(
            formatRegistrationStatus(registration),
            formatRegistrationSource(registration),
            fmtDate(registration.createdAt) || '',
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
function styleRegistrationSheet(XLSX: any, matrix: string[][]) {
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

export async function exportEventRegistrationsExcel({
    registrations,
    fields,
    multiDayEvent,
    fileName,
}: ExportEventRegistrationsExcelOptions): Promise<void> {
    const xlsxModule = await import('xlsx-js-style');
    const XLSX = xlsxModule.default || xlsxModule;
    const matrix = buildRegistrationMatrix(registrations, fields, multiDayEvent);
    const sheet = styleRegistrationSheet(XLSX, matrix);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, sheet, 'Registrations');

    const workbookBytes = XLSX.write(workbook, { bookType: 'xlsx', type: 'array', cellStyles: true }) as ArrayBuffer;

    const jszipModule = await import('jszip');
    const JSZip = jszipModule.default;
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

    const workbookBlob = await workbookZip.generateAsync({ type: 'blob' });
    downloadBlob(workbookBlob, `${sanitizeFileName(fileName)}-registrations.xlsx`);
}
