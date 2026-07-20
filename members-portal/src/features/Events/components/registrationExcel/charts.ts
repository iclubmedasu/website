import type { Workbook, Worksheet } from 'exceljs';
import type { OverviewKpis, SessionMetricRow, TierMetricRow } from './builders';

const PIE_COLORS = ['#561789', '#16a34a', '#9ca3af'];
const BAR_COLORS = ['#561789', '#16a34a', '#9ca3af'];

export interface ChartAnchor {
    col: number;
    row: number;
    colSpan?: number;
    rowSpan?: number;
}

interface ChartSeries {
    name: string;
    values: number[];
    color: string;
}

function createCanvas(width: number, height: number): HTMLCanvasElement {
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    return canvas;
}

function canvasToBase64(canvas: HTMLCanvasElement): string {
    const dataUrl = canvas.toDataURL('image/png');
    return dataUrl.replace(/^data:image\/png;base64,/, '');
}

function truncateLabel(label: string, maxLength = 18): string {
    if (label.length <= maxLength) return label;
    return `${label.slice(0, maxLength - 1)}…`;
}

function renderPieChart(labels: string[], values: number[], colors: string[]): string {
    const width = 480;
    const height = 320;
    const canvas = createCanvas(width, height);
    const ctx = canvas.getContext('2d');
    if (!ctx) return '';

    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, width, height);

    const total = values.reduce((sum, value) => sum + value, 0);
    const centerX = width * 0.38;
    const centerY = height * 0.52;
    const radius = Math.min(width, height) * 0.28;
    let startAngle = -Math.PI / 2;

    if (total <= 0) {
        ctx.fillStyle = '#6b7280';
        ctx.font = '14px Arial';
        ctx.textAlign = 'center';
        ctx.fillText('No attendance data yet', centerX, centerY);
        return canvasToBase64(canvas);
    }

    values.forEach((value, index) => {
        const sliceAngle = (value / total) * Math.PI * 2;
        ctx.beginPath();
        ctx.moveTo(centerX, centerY);
        ctx.arc(centerX, centerY, radius, startAngle, startAngle + sliceAngle);
        ctx.closePath();
        ctx.fillStyle = colors[index] ?? '#561789';
        ctx.fill();
        startAngle += sliceAngle;
    });

    ctx.font = '12px Arial';
    ctx.textAlign = 'left';
    labels.forEach((label, index) => {
        const legendY = 48 + index * 24;
        ctx.fillStyle = colors[index] ?? '#561789';
        ctx.fillRect(width * 0.68, legendY - 10, 14, 14);
        ctx.fillStyle = '#111827';
        ctx.fillText(`${label}: ${values[index]}`, width * 0.68 + 22, legendY);
    });

    return canvasToBase64(canvas);
}

function renderGroupedBarChart(categories: string[], series: ChartSeries[]): string {
    const width = 720;
    const height = 360;
    const canvas = createCanvas(width, height);
    const ctx = canvas.getContext('2d');
    if (!ctx) return '';

    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, width, height);

    const margin = { top: 36, right: 24, bottom: 72, left: 48 };
    const plotWidth = width - margin.left - margin.right;
    const plotHeight = height - margin.top - margin.bottom;
    const maxValue = Math.max(1, ...series.flatMap((entry) => entry.values));
    const groupCount = categories.length;
    const barGroupWidth = groupCount > 0 ? plotWidth / groupCount : plotWidth;
    const barWidth = Math.min(18, barGroupWidth / (series.length + 1));

    ctx.strokeStyle = '#e5e7eb';
    ctx.lineWidth = 1;
    for (let tick = 0; tick <= 4; tick += 1) {
        const y = margin.top + plotHeight - (plotHeight * tick) / 4;
        ctx.beginPath();
        ctx.moveTo(margin.left, y);
        ctx.lineTo(width - margin.right, y);
        ctx.stroke();
    }

    categories.forEach((category, groupIndex) => {
        const groupStart = margin.left + groupIndex * barGroupWidth;
        series.forEach((entry, seriesIndex) => {
            const value = entry.values[groupIndex] ?? 0;
            const barHeight = (value / maxValue) * plotHeight;
            const x = groupStart + seriesIndex * (barWidth + 4) + 8;
            const y = margin.top + plotHeight - barHeight;
            ctx.fillStyle = entry.color;
            ctx.fillRect(x, y, barWidth, barHeight);
        });

        ctx.save();
        ctx.fillStyle = '#6b7280';
        ctx.font = '10px Arial';
        ctx.textAlign = 'right';
        ctx.translate(groupStart + barGroupWidth / 2, height - margin.bottom + 12);
        ctx.rotate(-Math.PI / 4);
        ctx.fillText(truncateLabel(category), 0, 0);
        ctx.restore();
    });

    ctx.font = '11px Arial';
    series.forEach((entry, index) => {
        const legendX = margin.left + index * 120;
        ctx.fillStyle = entry.color;
        ctx.fillRect(legendX, 12, 12, 12);
        ctx.fillStyle = '#111827';
        ctx.fillText(entry.name, legendX + 18, 22);
    });

    return canvasToBase64(canvas);
}

function renderColumnChart(categories: string[], values: number[], color: string): string {
    return renderGroupedBarChart(
        categories,
        [{ name: 'Registrations', values, color }],
    );
}

function addChartImage(
    workbook: Workbook,
    worksheet: Worksheet,
    base64: string,
    anchor: ChartAnchor,
) {
    if (!base64) return;

    const imageId = workbook.addImage({
        base64,
        extension: 'png',
    });

    worksheet.addImage(imageId, {
        tl: { col: anchor.col, row: anchor.row },
        ext: {
            width: (anchor.colSpan ?? 8) * 64,
            height: (anchor.rowSpan ?? 14) * 20,
        },
    });
}

export function addOverviewPieChart(
    workbook: Workbook,
    worksheet: Worksheet,
    kpis: OverviewKpis,
) {
    const base64 = renderPieChart(
        ['Checked in', 'Walk-ins', 'No-shows'],
        [kpis.checkedIn, kpis.walkIns, kpis.noShows],
        PIE_COLORS,
    );
    addChartImage(workbook, worksheet, base64, { col: 3, row: 1, colSpan: 8, rowSpan: 12 });
}

export function addSessionSummaryBarChart(
    workbook: Workbook,
    worksheet: Worksheet,
    metrics: SessionMetricRow[],
    dataRowCount: number,
) {
    if (metrics.length === 0) return;

    const base64 = renderGroupedBarChart(
        metrics.map((row) => row.label),
        [
            { name: 'Registered', values: metrics.map((row) => row.registered), color: BAR_COLORS[0] },
            { name: 'Attended', values: metrics.map((row) => row.attended), color: BAR_COLORS[1] },
            { name: 'Missed', values: metrics.map((row) => row.missed), color: BAR_COLORS[2] },
        ],
    );

    addChartImage(workbook, worksheet, base64, {
        col: 0,
        row: dataRowCount + 2,
        colSpan: 10,
        rowSpan: 16,
    });
}

export function addTierSummaryBarChart(
    workbook: Workbook,
    worksheet: Worksheet,
    metrics: TierMetricRow[],
    dataRowCount: number,
) {
    if (metrics.length === 0) return;

    const base64 = renderColumnChart(
        metrics.map((row) => row.tierName),
        metrics.map((row) => row.registrations),
        BAR_COLORS[0],
    );

    addChartImage(workbook, worksheet, base64, {
        col: 0,
        row: dataRowCount + 2,
        colSpan: 8,
        rowSpan: 14,
    });
}
