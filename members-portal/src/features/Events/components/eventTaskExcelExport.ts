import type { EventTaskRef } from '@/types/backend-contracts';
import {
    HOURS_PER_DAY,
    buildDaySections,
    formatHourLabel,
    getDefaultMinuteWidth,
    resolveTimetableStartHour,
    type TimetableBar,
    type TimetableBarMember,
} from './eventTaskTimetableModel';

const QUARTER_MINUTES = 15;
const SLOTS_PER_HOUR = 60 / QUARTER_MINUTES;
const LOCATION_COL = 1;
const TIME_COL_START = 2;
const HEADER_ROWS = 2;
const DATA_ROW_START = HEADER_ROWS;
const QUARTER_LABELS = [':00', ':15', ':30', ':45'];

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

interface InlineRichTextCell {
    cellRef: string;
    title: string;
    participants: string;
}

interface BuiltSheetResult {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    sheet: any;
    richTextCells: InlineRichTextCell[];
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

function escapeXml(text: string): string {
    return text
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;');
}

function buildInlineStrXml(title: string, participants: string, fontColorArgb: string): string {
    const titleRun = `<r><rPr><b/><sz val="10"/><color rgb="${fontColorArgb}"/><rFont val="Arial"/></rPr><t>${escapeXml(title)}</t></r>`;
    const participantRun = participants
        ? `<r><rPr><sz val="9"/><color rgb="${fontColorArgb}"/><rFont val="Arial"/></rPr><t xml:space="preserve">${escapeXml(`\n${participants}`)}</t></r>`
        : '';
    return `<is>${titleRun}${participantRun}</is>`;
}

function patchInlineRichTextCells(
    sheetXml: string,
    cells: InlineRichTextCell[],
    fontColorArgb: string,
): string {
    let result = sheetXml;
    for (const { cellRef, title, participants } of cells) {
        const regex = new RegExp(`<c r="${cellRef}"([^>]*)>[\\s\\S]*?</c>`);
        result = result.replace(regex, (_match, attrs: string) => {
            const styleAttr = attrs.replace(/\s*t="[^"]*"/, '');
            const inlineStr = buildInlineStrXml(title, participants, fontColorArgb);
            return `<c r="${cellRef}"${styleAttr} t="inlineStr">${inlineStr}</c>`;
        });
    }
    return result;
}

function getExportContentWidth(
    values: unknown[] = [],
    { minWidth = 8, maxWidth = 16, padding = 2 }: { minWidth?: number; maxWidth?: number; padding?: number } = {},
): number {
    const longest = values.reduce<number>((max, value) => {
        const text = String(value ?? '');
        const lines = text.split('\n');
        const lineMax = lines.reduce((lineLongest, line) => Math.max(lineLongest, line.length), 0);
        return Math.max(max, lineMax);
    }, 0);
    return Math.min(maxWidth, Math.max(minWidth, longest + padding));
}

function sanitizeFileName(name: string): string {
    const cleaned = name.replace(/[<>:"/\\|?*]/g, '').trim();
    return cleaned || 'event-tasks';
}

function formatParticipantLines(members: TimetableBarMember[]): string {
    return members.map((member) => `${member.isLeader ? '★ ' : ''}${member.memberName}`).join('\n');
}

function getBarSlotRange(bar: TimetableBar): { startSlot: number; endSlot: number } {
    const startSlot = Math.floor(bar.startMin / QUARTER_MINUTES);
    const endSlot = Math.max(startSlot, Math.ceil(bar.endMin / QUARTER_MINUTES) - 1);
    return { startSlot, endSlot };
}

function getBarExportSlotRange(
    bar: TimetableBar,
    startHour: number,
    visibleSlots: number,
): { startSlot: number; endSlot: number } | null {
    const windowStartSlot = startHour * SLOTS_PER_HOUR;
    const { startSlot: absStart, endSlot: absEnd } = getBarSlotRange(bar);

    if (absEnd < windowStartSlot || absStart >= windowStartSlot + visibleSlots) {
        return null;
    }

    return {
        startSlot: Math.max(0, absStart - windowStartSlot),
        endSlot: Math.min(visibleSlots - 1, absEnd - windowStartSlot),
    };
}
function getBarCellText(title: string, members: TimetableBarMember[]): { title: string; participants: string } {
    const participants = formatParticipantLines(members);
    const titleText = members.some((member) => member.isLeader) ? `★ ${title}` : title;
    return { title: titleText, participants };
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function buildEventTasksSheet(XLSX: any, days: Date[], tasks: EventTaskRef[]): BuiltSheetResult {
    const minuteWidth = getDefaultMinuteWidth();
    const daySections = buildDaySections(days, tasks, minuteWidth);
    const richTextCells: InlineRichTextCell[] = [];
    const dataRows = daySections.flatMap((section) =>
        section.rows
            .filter((row) => !row.isPlaceholder)
            .flatMap((row) =>
                Array.from({ length: row.laneCount }, (_, lane) => ({
                    section,
                    row,
                    lane,
                    bars: row.bars.filter((bar) => bar.lane === lane),
                })),
            ),
    );

    if (dataRows.length === 0) {
        const sheet = XLSX.utils.aoa_to_sheet([['No tasks scheduled for this event.']]);
        applySheetCellStyle(sheet.A1, {
            fill: '#4c1d95',
            fontColor: '#ffffff',
            bold: true,
            align: 'center',
            wrapText: true,
        });
        sheet['!cols'] = [{ wch: 40 }];
        sheet['!rows'] = [{ hpt: 28 }];
        return { sheet, richTextCells };
    }

    const startHour = resolveTimetableStartHour(tasks);
    const visibleHourCount = HOURS_PER_DAY - startHour;
    const visibleSlots = visibleHourCount * SLOTS_PER_HOUR;
    const totalCols = TIME_COL_START + visibleSlots;
    const totalRows = DATA_ROW_START + dataRows.length;
    const matrix = Array.from({ length: totalRows }, () => Array(totalCols).fill(''));
    const merges: Array<{ s: { r: number; c: number }; e: { r: number; c: number } }> = [];

    matrix[0][0] = 'Date';
    matrix[1][0] = '';
    matrix[0][LOCATION_COL] = 'Location';
    matrix[1][LOCATION_COL] = '';
    for (let hour = startHour; hour < HOURS_PER_DAY; hour++) {
        matrix[0][TIME_COL_START + (hour - startHour) * SLOTS_PER_HOUR] = formatHourLabel(hour);
    }
    for (let slot = 0; slot < visibleSlots; slot++) {
        matrix[1][TIME_COL_START + slot] = QUARTER_LABELS[slot % 4];
    }

    merges.push({ s: { r: 0, c: 0 }, e: { r: 1, c: 0 } });
    merges.push({ s: { r: 0, c: LOCATION_COL }, e: { r: 1, c: LOCATION_COL } });
    for (let hour = startHour; hour < HOURS_PER_DAY; hour++) {
        const startCol = TIME_COL_START + (hour - startHour) * SLOTS_PER_HOUR;
        if (startCol < TIME_COL_START + visibleSlots - 1) {
            merges.push({ s: { r: 0, c: startCol }, e: { r: 0, c: startCol + 3 } });
        }
    }
    dataRows.forEach((entry, index) => {
        const sheetRow = DATA_ROW_START + index;
        matrix[sheetRow][0] = entry.section.label;
        matrix[sheetRow][LOCATION_COL] = entry.row.location;
    });

    let dayMergeStart = DATA_ROW_START;
    for (let index = 0; index < dataRows.length; index++) {
        const current = dataRows[index];
        const next = dataRows[index + 1];
        const dayChanged = !next || next.section.key !== current.section.key;
        if (dayChanged) {
            const sheetRowEnd = DATA_ROW_START + index;
            if (sheetRowEnd > dayMergeStart) {
                merges.push({ s: { r: dayMergeStart, c: 0 }, e: { r: sheetRowEnd, c: 0 } });
            }
            dayMergeStart = sheetRowEnd + 1;
        }
    }

    let locationMergeStart = DATA_ROW_START;
    for (let index = 0; index < dataRows.length; index++) {
        const current = dataRows[index];
        const next = dataRows[index + 1];
        const locationChanged = !next
            || next.section.key !== current.section.key
            || next.row.location !== current.row.location;
        if (locationChanged) {
            const sheetRowEnd = DATA_ROW_START + index;
            if (sheetRowEnd > locationMergeStart) {
                merges.push({ s: { r: locationMergeStart, c: LOCATION_COL }, e: { r: sheetRowEnd, c: LOCATION_COL } });
            }
            locationMergeStart = sheetRowEnd + 1;
        }
    }

    const sheet = XLSX.utils.aoa_to_sheet(matrix);

    const cellBorder = {
        top: { style: 'thin', color: { rgb: hexToArgb('#E5E7EB') } },
        bottom: { style: 'thin', color: { rgb: hexToArgb('#E5E7EB') } },
        left: { style: 'thin', color: { rgb: hexToArgb('#E5E7EB') } },
        right: { style: 'thin', color: { rgb: hexToArgb('#E5E7EB') } },
    };

    const hourHeaderBorder = {
        top: { style: 'thin', color: { rgb: hexToArgb('#E5E7EB') } },
        bottom: { style: 'medium', color: { rgb: hexToArgb('#7c3aed') } },
        left: { style: 'thin', color: { rgb: hexToArgb('#E5E7EB') } },
        right: { style: 'thin', color: { rgb: hexToArgb('#E5E7EB') } },
    };

    const styleCell = (rowIndex: number, colIndex: number, styles: SheetCellStyleOptions, value = '') => {
        const cellRef = XLSX.utils.encode_cell({ r: rowIndex, c: colIndex });
        const cell = sheet[cellRef] || (sheet[cellRef] = { t: 's', v: value });
        if (value) cell.v = value;
        applySheetCellStyle(cell, styles);
        return cell;
    };

    styleCell(0, 0, {
        fill: '#4c1d95',
        fontColor: '#ffffff',
        bold: true,
        align: 'center',
        wrapText: true,
        border: cellBorder,
    }, 'Date');

    styleCell(1, 0, {
        fill: '#4c1d95',
        fontColor: '#ffffff',
        bold: true,
        align: 'center',
        border: cellBorder,
    });

    styleCell(0, LOCATION_COL, {
        fill: '#4c1d95',
        fontColor: '#ffffff',
        bold: true,
        align: 'center',
        wrapText: true,
        border: cellBorder,
    }, 'Location');

    styleCell(1, LOCATION_COL, {
        fill: '#4c1d95',
        fontColor: '#ffffff',
        bold: true,
        align: 'center',
        border: cellBorder,
    });

    for (let hour = startHour; hour < HOURS_PER_DAY; hour++) {
        const relHour = hour - startHour;
        const startCol = TIME_COL_START + relHour * SLOTS_PER_HOUR;
        for (let offset = 0; offset < SLOTS_PER_HOUR; offset++) {
            const colIndex = startCol + offset;
            styleCell(0, colIndex, {
                fill: '#4c1d95',
                fontColor: '#ffffff',
                bold: true,
                align: 'center',
                wrapText: true,
                border: hourHeaderBorder,
            }, offset === 0 ? formatHourLabel(hour) : '');
            styleCell(1, colIndex, {
                fill: '#ede9fe',
                fontColor: '#4c1d95',
                bold: false,
                align: 'center',
                wrapText: true,
                border: cellBorder,
            }, QUARTER_LABELS[offset]);
        }
    }
    dataRows.forEach((entry, index) => {
        const sheetRow = DATA_ROW_START + index;
        const rowFill = index % 2 === 0 ? '#ffffff' : '#f8fafc';

        styleCell(sheetRow, 0, {
            fill: '#f3edff',
            fontColor: '#111827',
            bold: true,
            align: 'center',
            wrapText: true,
            valign: 'center',
            border: cellBorder,
        }, entry.section.label);

        styleCell(sheetRow, LOCATION_COL, {
            fill: '#eff6ff',
            fontColor: '#1e3a8a',
            bold: true,
            align: 'center',
            wrapText: true,
            valign: 'center',
            border: cellBorder,
        }, entry.row.location);

        for (let slot = 0; slot < visibleSlots; slot++) {
            styleCell(sheetRow, TIME_COL_START + slot, {
                fill: rowFill,
                fontColor: '#111827',
                align: 'left',
                valign: 'top',
                wrapText: true,
                border: cellBorder,
            });
        }

        for (const bar of entry.bars) {
            const hasLeader = bar.members.some((member) => member.isLeader);
            const fillColor = hasLeader ? '#d97706' : '#7a47a3';
            const exportRange = getBarExportSlotRange(bar, startHour, visibleSlots);
            if (!exportRange) continue;

            const { startSlot, endSlot } = exportRange;
            const { title, participants } = getBarCellText(bar.title, bar.members);

            for (let slot = startSlot; slot <= endSlot; slot++) {
                const colIndex = TIME_COL_START + slot;
                const cellRef = XLSX.utils.encode_cell({ r: sheetRow, c: colIndex });
                styleCell(sheetRow, colIndex, {
                    fill: fillColor,
                    fontColor: '#ffffff',
                    align: 'left',
                    valign: 'top',
                    wrapText: true,
                    border: cellBorder,
                }, slot === startSlot ? (participants ? `${title}\n${participants}` : title) : '');

                if (slot === startSlot) {
                    richTextCells.push({ cellRef, title, participants });
                }
            }

            if (endSlot > startSlot) {
                merges.push({
                    s: { r: sheetRow, c: TIME_COL_START + startSlot },
                    e: { r: sheetRow, c: TIME_COL_START + endSlot },
                });
            }
        }    });

    sheet['!merges'] = merges;

    const dateSamples = ['Date', ...dataRows.map((entry) => entry.section.label)];
    const locationSamples = ['Location', ...dataRows.map((entry) => entry.row.location)];

    sheet['!cols'] = [
        { wch: getExportContentWidth(dateSamples, { minWidth: 12, maxWidth: 18 }) },
        { wch: getExportContentWidth(locationSamples, { minWidth: 14, maxWidth: 24 }) },
        ...Array.from({ length: visibleSlots }, () => ({ wch: 2.75 })),
    ];
    sheet['!rows'] = [
        { hpt: 22 },
        { hpt: 18 },
        ...dataRows.map((entry) => ({
            hpt: Math.max(36, entry.bars.reduce((max, bar) => {
                const lineCount = 1 + bar.members.length;
                return Math.max(max, 14 + lineCount * 12);
            }, 36)),
        })),
    ];

    return { sheet, richTextCells };
}

export interface ExportEventTasksExcelOptions {
    days: Date[];
    tasks: EventTaskRef[];
    fileName: string;
}

export async function exportEventTasksExcel({ days, tasks, fileName }: ExportEventTasksExcelOptions): Promise<void> {
    const xlsxModule = await import('xlsx-js-style');
    const XLSX = xlsxModule.default || xlsxModule;
    const { sheet, richTextCells } = buildEventTasksSheet(XLSX, days, tasks);

    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, sheet, 'Tasks');

    const workbookBytes = XLSX.write(workbook, { bookType: 'xlsx', type: 'array', cellStyles: true }) as ArrayBuffer;

    const jszipModule = await import('jszip');
    const JSZip = jszipModule.default;
    const workbookZip = await JSZip.loadAsync(workbookBytes);

    const sheetPath = 'xl/worksheets/sheet1.xml';
    const sheetFile = workbookZip.file(sheetPath);
    if (sheetFile) {
        let sheetXml = await sheetFile.async('string');
        if (richTextCells.length > 0) {
            sheetXml = patchInlineRichTextCells(sheetXml, richTextCells, hexToArgb('#FFFFFF'));
        }
        sheetXml = withFrozenPaneInWorksheetXml(sheetXml, {
            xSplit: 2,
            ySplit: HEADER_ROWS,
            topLeftCell: 'C3',
        });        workbookZip.file(sheetPath, sheetXml);
    }

    const workbookBlob = await workbookZip.generateAsync({ type: 'blob' });
    downloadBlob(workbookBlob, `${sanitizeFileName(fileName)}-tasks.xlsx`);
}
