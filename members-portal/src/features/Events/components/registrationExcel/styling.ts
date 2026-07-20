import type { Worksheet } from 'exceljs';

export const HEADER_FILL = 'FF561789';
export const HEADER_FONT = 'FFFFFFFF';
export const ZEBRA_FILL = 'FFF9FAFB';
export const BODY_FONT = 'FF111827';
export const BORDER_COLOR = 'FFE5E7EB';

const thinBorder = {
    style: 'thin' as const,
    color: { argb: BORDER_COLOR },
};

const cellBorder = {
    top: thinBorder,
    bottom: thinBorder,
    left: thinBorder,
    right: thinBorder,
};

function computeColumnWidths(matrix: string[][]): number[] {
    const columnCount = matrix[0]?.length ?? 0;
    const widths: number[] = Array.from({ length: columnCount }, () => 10);

    matrix.forEach((row) => {
        row.forEach((value, columnIndex) => {
            const length = String(value ?? '').length;
            widths[columnIndex] = Math.max(widths[columnIndex], Math.min(40, length + 2));
        });
    });

    return widths.map((width) => Math.max(10, width));
}

export interface StyleSheetOptions {
    freezeHeader?: boolean;
    codeColumnLabel?: string;
}

export function styleDataSheet(worksheet: Worksheet, matrix: string[][], options: StyleSheetOptions = {}) {
    const { freezeHeader = true, codeColumnLabel = 'Code' } = options;

    if (freezeHeader) {
        worksheet.views = [{ state: 'frozen', ySplit: 1 }];
    }

    worksheet.addRows(matrix);

    const codeColumnIndex = matrix[0]?.indexOf(codeColumnLabel) ?? -1;
    const columnWidths = computeColumnWidths(matrix);

    columnWidths.forEach((width, index) => {
        worksheet.getColumn(index + 1).width = width;
    });

    matrix.forEach((row, rowIndex) => {
        const excelRow = worksheet.getRow(rowIndex + 1);
        row.forEach((_value, columnIndex) => {
            const cell = excelRow.getCell(columnIndex + 1);
            cell.border = cellBorder;

            if (rowIndex === 0) {
                cell.fill = {
                    type: 'pattern',
                    pattern: 'solid',
                    fgColor: { argb: HEADER_FILL },
                };
                cell.font = {
                    name: 'Arial',
                    size: 11,
                    bold: true,
                    color: { argb: HEADER_FONT },
                };
                cell.alignment = {
                    horizontal: 'center',
                    vertical: 'middle',
                    wrapText: true,
                };
                return;
            }

            cell.fill = {
                type: 'pattern',
                pattern: 'solid',
                fgColor: { argb: rowIndex % 2 === 0 ? ZEBRA_FILL : 'FFFFFFFF' },
            };
            cell.font = {
                name: 'Arial',
                size: 10,
                color: { argb: BODY_FONT },
            };
            cell.alignment = {
                horizontal: columnIndex === codeColumnIndex ? 'left' : 'left',
                vertical: 'middle',
                wrapText: false,
            };
        });
    });
}

export function styleOverviewSheet(worksheet: Worksheet, matrix: string[][]) {
    styleDataSheet(worksheet, matrix, { freezeHeader: false });

    worksheet.getColumn(1).width = 24;
    worksheet.getColumn(2).width = 16;

    for (let rowIndex = 2; rowIndex <= matrix.length; rowIndex += 1) {
        const labelCell = worksheet.getCell(rowIndex, 1);
        labelCell.font = { name: 'Arial', size: 10, bold: true, color: { argb: BODY_FONT } };
    }
}
