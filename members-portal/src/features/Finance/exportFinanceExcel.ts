import type { FinanceExportResponse } from '@iclub/shared';
import { downloadBlob } from '@/utils/downloadBlob';

const HEADER_FILL = '#561789';
const ZEBRA_FILL = '#F9FAFB';
const BORDER_COLOR = '#E5E7EB';

interface SheetCellStyleOptions {
    fill?: string;
    fontColor?: string;
    bold?: boolean;
    align?: string;
    wrapText?: boolean;
    border?: Record<string, { style: string; color: { rgb: string } }> | null;
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
    align = 'left',
    wrapText = false,
    border = null,
}: SheetCellStyleOptions = {}) {
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
        fill: fill ? {
            patternType: 'solid',
            fgColor: { rgb: hexToArgb(fill) },
        } : undefined,
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

function withFrozenPaneInWorksheetXml(sheetXml: string, pane: { xSplit: number; ySplit: number; topLeftCell: string }): string {
    const sheetViewsBlock = `<sheetViews><sheetView workbookViewId="0"><pane xSplit="${pane.xSplit}" ySplit="${pane.ySplit}" topLeftCell="${pane.topLeftCell}" activePane="bottomRight" state="frozen"/></sheetView></sheetViews>`;
    if (sheetXml.includes('<sheetViews')) {
        return sheetXml.replace(/<sheetViews>[\s\S]*?<\/sheetViews>/, sheetViewsBlock);
    }
    return sheetXml.replace('<sheetData>', `${sheetViewsBlock}<sheetData>`);
}

function buildAccountsMatrix(data: FinanceExportResponse): string[][] {
    return [
        ['Name', 'Type', 'Currency', 'Opening Balance', 'Current Balance', 'Active', 'Description'],
        ...data.accounts.map((account) => [
            account.name,
            account.accountType,
            account.currency,
            String(account.openingBalance),
            String(account.currentBalance),
            account.isActive ? 'Yes' : 'No',
            account.description ?? '',
        ]),
    ];
}

function buildTransactionsMatrix(data: FinanceExportResponse): string[][] {
    return [
        ['Date', 'Account', 'Type', 'Category', 'Description', 'Reference', 'Amount'],
        ...data.transactions.map((tx) => [
            tx.transactionDate,
            tx.accountName,
            tx.type,
            tx.category,
            tx.description ?? '',
            tx.reference ?? '',
            String(tx.amount),
        ]),
    ];
}

function buildLiabilitiesMatrix(data: FinanceExportResponse): string[][] {
    return [
        ['Creditor', 'Account', 'Total', 'Paid', 'Remaining', 'Due Date', 'Status', 'Currency', 'Description'],
        ...data.liabilities.map((item) => [
            item.creditor,
            item.accountName,
            String(item.totalAmount),
            String(item.paidAmount),
            String(item.remainingAmount),
            item.dueDate ?? '',
            item.status,
            item.currency,
            item.description ?? '',
        ]),
    ];
}

function buildScheduledMatrix(data: FinanceExportResponse): string[][] {
    return [
        ['Title', 'Type', 'Amount', 'Due Date', 'Account', 'Recurrence', 'Completed', 'Notes'],
        ...data.scheduledItems.map((item) => [
            item.title,
            item.type,
            String(item.amount),
            item.dueDate,
            item.accountName,
            item.recurrence ?? '',
            item.isCompleted ? 'Yes' : 'No',
            item.notes ?? '',
        ]),
    ];
}

export async function exportFinanceExcel(data: FinanceExportResponse): Promise<void> {
    const xlsxModule = await import('xlsx-js-style');
    const XLSX = xlsxModule.default || xlsxModule;
    const jszipModule = await import('jszip');
    const JSZip = jszipModule.default;

    const sheets = [
        { name: 'Accounts', matrix: buildAccountsMatrix(data) },
        { name: 'Transactions', matrix: buildTransactionsMatrix(data) },
        { name: 'Liabilities', matrix: buildLiabilitiesMatrix(data) },
        { name: 'Scheduled Items', matrix: buildScheduledMatrix(data) },
    ];

    const workbook = XLSX.utils.book_new();
    sheets.forEach(({ name, matrix }) => {
        const rawSheet = XLSX.utils.aoa_to_sheet(matrix);
        const styledSheet = styleSheet(XLSX, rawSheet, matrix);
        XLSX.utils.book_append_sheet(workbook, styledSheet, name);
    });

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

    const exportDate = data.exportedAt.slice(0, 10);
    const workbookBlob = await workbookZip.generateAsync({ type: 'blob' });
    downloadBlob(workbookBlob, `finance-export-${exportDate}.xlsx`);
}
