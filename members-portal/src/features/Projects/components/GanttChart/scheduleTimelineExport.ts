interface SheetCellStyleOptions {
    fill?: string;
    fontColor?: string;
    bold?: boolean;
    italic?: boolean;
    align?: string;
    valign?: string;
    wrapText?: boolean;
    indent?: number;
    border?: any;
    fillPattern?: string;
}

function getDateOrNull(value: any): Date | null {
    if (!value) return null;
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? null : date;
}

function normalizeLabelValue(value: any) {
    return String(value ?? '').trim();
}

function startOfDay(d: any) {
    const r = new Date(d);
    r.setHours(0, 0, 0, 0);
    return r;
}

function addDays(d: any, n: number) {
    const r = new Date(d);
    r.setDate(r.getDate() + n);
    return r;
}

function hexToArgb(hex: any) {
    const value = String(hex || '').replace('#', '').trim();
    if (value.length === 6) return `FF${value.toUpperCase()}`;
    if (value.length === 8) return value.toUpperCase();
    return 'FFFFFFFF';
}

function formatExportShortDate(value: any) {
    const date = getDateOrNull(value);
    if (!date) return '';
    return date.toLocaleDateString('en-GB', { day: '2-digit', month: 'short' });
}

function getExportContentWidth(values: any[] = [], { minWidth = 8, maxWidth = 16, padding = 2 }: { minWidth?: number; maxWidth?: number; padding?: number } = {}) {
    const longest = values.reduce((max, value) => {
        const length = String(value ?? '').length;
        return Math.max(max, length);
    }, 0);

    return Math.min(maxWidth, Math.max(minWidth, longest + padding));
}

function formatScheduleClock(date: any) {
    const value = getDateOrNull(date);
    if (!value) return '—';
    return `${String(value.getHours()).padStart(2, '0')}:00`;
}

function formatScheduleClockRange(start: any, end: any) {
    const startDate = getDateOrNull(start);
    const endDate = getDateOrNull(end);
    if (!startDate || !endDate) return '—';

    const formatClock = (date: Date) => `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`;
    return `${formatClock(startDate)} - ${formatClock(endDate)}`;
}

function getLocalDateKey(date: Date) {
    return [date.getFullYear(), String(date.getMonth() + 1).padStart(2, '0'), String(date.getDate()).padStart(2, '0')].join('-');
}

function getScheduleTimelineMinuteOffset(date: any, timelineStart: Date | null) {
    const current = getDateOrNull(date);
    if (!current || !timelineStart) return null;
    return (current.getTime() - timelineStart.getTime()) / 60000;
}

function applySheetCellStyle(cell: any, {
    fill,
    fontColor = '000000',
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

function uniqueSlots(slots: any[] = []) {
    const seen = new Set<any>();

    return slots.filter((slot) => {
        const key = slot?.id ?? `${slot?.member?.id ?? 'member'}-${slot?.task?.id ?? 'task'}-${slot?.startDateTime ?? ''}-${slot?.endDateTime ?? ''}-${slot?.title ?? ''}`;
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
    });
}

export function getScheduleMemberLabel(slot: any) {
    const fullName = normalizeLabelValue(slot?.member?.fullName);
    if (fullName) return fullName;

    return 'Unknown member';
}

export function getScheduleSlotLabel(slot: any) {
    return normalizeLabelValue(slot?.title || slot?.task?.title || 'Time slot');
}

export function collectScheduleTimelineSlots(projectDetail: any, allTaskNodes: any[] = []) {
    const slotSources = [
        ...(projectDetail?.scheduleSlots || []),
        ...allTaskNodes.flatMap((node) => node.data?.scheduleSlots || []),
    ];

    return uniqueSlots(slotSources).filter((slot) => getDateOrNull(slot?.startDateTime) && getDateOrNull(slot?.endDateTime));
}

export function groupScheduleSlotsByMember(slots: any[] = []) {
    const groups = new Map<any, any>();

    for (const slot of slots) {
        const key = slot?.member?.id ?? slot?.memberId ?? slot?.id ?? `slot-${slot?.id}`;
        const label = getScheduleMemberLabel(slot);

        if (!groups.has(key)) {
            groups.set(key, { key, label, slots: [] });
        }

        const group = groups.get(key);
        if (!group.label || group.label === 'Unknown member') {
            group.label = label;
        }

        group.slots.push(slot);
    }

    return [...groups.values()]
        .map((group) => ({
            ...group,
            slots: group.slots.sort((a: any, b: any) => {
                const startA = getDateOrNull(a.startDateTime)?.getTime() ?? 0;
                const startB = getDateOrNull(b.startDateTime)?.getTime() ?? 0;
                return startA - startB;
            }),
        }))
        .sort((a, b) => (a.label ?? '').localeCompare(b.label ?? ''));
}

function buildScheduleTimelineExport(slots: any[] = []) {
    const visibleDays = [];
    const seenDays = new Set();

    let timelineStart = null;
    let timelineEnd = null;

    for (const slot of slots) {
        const start = getDateOrNull(slot?.startDateTime);
        const end = getDateOrNull(slot?.endDateTime);
        if (!start || !end) continue;

        if (!timelineStart || start < timelineStart) timelineStart = start;
        if (!timelineEnd || end > timelineEnd) timelineEnd = end;
    }

    if (!timelineStart || !timelineEnd) return null;

    let cursor = startOfDay(timelineStart);
    const lastDay = startOfDay(timelineEnd);

    while (cursor <= lastDay) {
        const dayKey = getLocalDateKey(cursor);
        if (!seenDays.has(dayKey)) {
            seenDays.add(dayKey);
            visibleDays.push(new Date(cursor));
        }
        cursor = addDays(cursor, 1);
    }

    const columns = [];
    const dayGroups = [];

    for (const day of visibleDays) {
        const startIndex = columns.length;
        for (let hour = 0; hour < 24; hour++) {
            const hourDate = new Date(day);
            hourDate.setHours(hour, 0, 0, 0);
            columns.push({
                key: `${getLocalDateKey(day)}-${String(hour).padStart(2, '0')}`,
                date: hourDate,
                label: formatScheduleClock(hourDate),
                isWeekend: day.getDay() === 0 || day.getDay() === 6,
            });
        }

        dayGroups.push({
            key: getLocalDateKey(day),
            label: formatExportShortDate(day),
            startIndex,
            endIndex: columns.length - 1,
        });
    }

    return {
        visibleDays,
        columns,
        dayGroups,
        timelineStart: startOfDay(timelineStart),
        timelineEnd: startOfDay(timelineEnd),
    };
}

export function buildScheduleTimelineSheet(XLSX: any, slots: any[] = []) {
    const timeline = buildScheduleTimelineExport(slots);

    if (!timeline) {
        const sheet = XLSX.utils.aoa_to_sheet([
            ['No schedule slots available.'],
        ]);

        sheet['!merges'] = [];
        sheet['!cols'] = [{ wch: 34 }];
        sheet['!rows'] = [{ hpt: 24 }];

        applySheetCellStyle(sheet.A1, {
            fill: '#4c1d95',
            fontColor: '#ffffff',
            bold: true,
            align: 'left',
            wrapText: true,
        });

        return sheet;
    }

    const groupedSlots = groupScheduleSlotsByMember(slots);
    const totalColumns = 1 + timeline.columns.length;
    const totalRows = 2 + groupedSlots.length;
    const matrix = Array.from({ length: totalRows }, () => Array(totalColumns).fill(''));
    const merges = [];
    const dayRow = 0;
    const hourRow = 1;
    const dataRowStart = 2;

    matrix[dayRow][0] = 'Member Name';
    merges.push({ s: { r: dayRow, c: 0 }, e: { r: hourRow, c: 0 } });

    timeline.dayGroups.forEach((group) => {
        const startCol = 1 + group.startIndex;
        const endCol = 1 + group.endIndex;
        matrix[dayRow][startCol] = group.label;
        if (endCol > startCol) {
            merges.push({ s: { r: dayRow, c: startCol }, e: { r: dayRow, c: endCol } });
        }
    });

    timeline.columns.forEach((column, index) => {
        matrix[hourRow][1 + index] = column.label;
    });

    const dayHeaderBorder = {
        top: { style: 'thin', color: { rgb: hexToArgb('#E5E7EB') } },
        left: { style: 'thin', color: { rgb: hexToArgb('#E5E7EB') } },
        right: { style: 'thin', color: { rgb: hexToArgb('#E5E7EB') } },
        bottom: { style: 'medium', color: { rgb: hexToArgb('#7c3aed') } },
    };

    const cellBorder = {
        top: { style: 'thin', color: { rgb: hexToArgb('#E5E7EB') } },
        bottom: { style: 'thin', color: { rgb: hexToArgb('#E5E7EB') } },
        left: { style: 'thin', color: { rgb: hexToArgb('#E5E7EB') } },
        right: { style: 'thin', color: { rgb: hexToArgb('#E5E7EB') } },
    };

    const sheet = XLSX.utils.aoa_to_sheet(matrix);
    sheet['!merges'] = merges;
    const memberRowLabels = groupedSlots.map((group) => `${group.label}\n${group.slots.length} slot${group.slots.length === 1 ? '' : 's'}`);
    const memberColumnWidth = getExportContentWidth(['Member Name', ...memberRowLabels], { minWidth: 22, maxWidth: 34, padding: 2 });
    const timeColumnWidths = timeline.columns.map((column, index) => {
        const samples = [column.label];
        for (const group of groupedSlots) {
            for (const slot of group.slots) {
                const slotStart = getDateOrNull(slot.startDateTime);
                const slotEnd = getDateOrNull(slot.endDateTime);
                if (!slotStart || !slotEnd) continue;

                const startMinutes = getScheduleTimelineMinuteOffset(slotStart, timeline.timelineStart);
                const endMinutes = getScheduleTimelineMinuteOffset(slotEnd, timeline.timelineStart);
                if (startMinutes == null || endMinutes == null) continue;

                const startIndex = Math.max(0, Math.floor(startMinutes / 60));
                if (startIndex !== index) continue;

                const slotLabel = getScheduleSlotLabel(slot);
                const timeLabel = formatScheduleClockRange(slot.startDateTime, slot.endDateTime);
                samples.push(`${slotLabel}\n${timeLabel}`);
            }
        }

        return getExportContentWidth(samples, { minWidth: 8, maxWidth: 16, padding: 2 });
    });

    sheet['!cols'] = [
        { wch: memberColumnWidth },
        ...timeColumnWidths.map((wch) => ({ wch })),
    ];
    sheet['!rows'] = [
        { hpt: 24 },
        { hpt: 20 },
        ...groupedSlots.map(() => ({ hpt: 60 })),
    ];

    const styleCell = (rowIndex: number, colIndex: number, styles: any, value = '') => {
        const cellRef = XLSX.utils.encode_cell({ r: rowIndex, c: colIndex });
        const cell = sheet[cellRef] || (sheet[cellRef] = { t: 's', v: value });
        applySheetCellStyle(cell, styles);
        return cell;
    };

    const dayFill = '#6d28d9';
    const hourFill = '#ede9fe';
    const memberFill = '#f8fafc';

    styleCell(dayRow, 0, {
        fill: '#4c1d95',
        fontColor: '#ffffff',
        bold: true,
        align: 'center',
        wrapText: true,
        border: cellBorder,
    });
    styleCell(hourRow, 0, {
        fill: '#4c1d95',
        fontColor: '#ffffff',
        bold: true,
        align: 'center',
        wrapText: true,
        border: cellBorder,
    });

    timeline.dayGroups.forEach((group) => {
        for (let col = group.startIndex + 1; col <= group.endIndex + 1; col++) {
            styleCell(dayRow, col, {
                fill: dayFill,
                fontColor: '#ffffff',
                bold: true,
                align: 'center',
                wrapText: true,
                border: dayHeaderBorder,
            });
        }
    });

    timeline.columns.forEach((column, index) => {
        styleCell(hourRow, 1 + index, {
            fill: column.isWeekend ? '#f5f3ff' : hourFill,
            fontColor: '#4c1d95',
            bold: true,
            align: 'center',
            wrapText: true,
            border: cellBorder,
        });
    });

    groupedSlots.forEach((group, groupIndex) => {
        const sheetRow = dataRowStart + groupIndex;
        const rowFill = groupIndex % 2 === 0 ? '#ffffff' : '#f8fafc';
        const memberLabel = `${group.label}\n${group.slots.length} slot${group.slots.length === 1 ? '' : 's'}`;

        const memberCell = styleCell(sheetRow, 0, {
            fill: memberFill,
            fontColor: '#111827',
            bold: true,
            align: 'left',
            wrapText: true,
            border: cellBorder,
        });
        memberCell.v = memberLabel;
        memberCell.t = 's';

        timeline.columns.forEach((_column, index) => {
            styleCell(sheetRow, 1 + index, {
                fill: rowFill,
                fontColor: '#111827',
                align: 'center',
                border: cellBorder,
            });
        });

        for (const slot of group.slots) {
            const slotStart = getDateOrNull(slot.startDateTime);
            const slotEnd = getDateOrNull(slot.endDateTime);
            if (!slotStart || !slotEnd) continue;

            const startMinutes = getScheduleTimelineMinuteOffset(slotStart, timeline.timelineStart);
            const endMinutes = getScheduleTimelineMinuteOffset(slotEnd, timeline.timelineStart);
            if (startMinutes == null || endMinutes == null) continue;

            const startIndex = Math.max(0, Math.floor(startMinutes / 60));
            const endIndex = Math.max(startIndex, Math.ceil(endMinutes / 60) - 1);
            const fillColor = slot.isActive === false ? '#94a3b8' : '#7c3aed';
            const slotLabel = getScheduleSlotLabel(slot);
            const timeLabel = formatScheduleClockRange(slot.startDateTime, slot.endDateTime);

            for (let columnIndex = startIndex; columnIndex <= endIndex && columnIndex < timeline.columns.length; columnIndex++) {
                const cell = styleCell(sheetRow, 1 + columnIndex, {
                    fill: fillColor,
                    fontColor: '#ffffff',
                    bold: columnIndex === startIndex,
                    align: 'center',
                    wrapText: true,
                    border: cellBorder,
                });

                if (columnIndex === startIndex) {
                    cell.v = timeLabel ? `${slotLabel}\n${timeLabel}` : slotLabel;
                    cell.t = 's';
                }
            }
        }
    });

    applySheetCellStyle(sheet.A1, {
        fill: '#4c1d95',
        fontColor: '#ffffff',
        bold: true,
        align: 'center',
        wrapText: true,
        border: cellBorder,
    });

    return sheet;
}
