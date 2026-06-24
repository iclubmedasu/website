import type { MemberRoleHistoryTimelineEntry } from '@iclub/shared';

export function getChangeTypeColor(changeType: string): string {
    const colors: Record<string, string> = {
        New: 'change-type-new',
        Promotion: 'change-type-promotion',
        Demotion: 'change-type-demotion',
        Transfer: 'change-type-transfer',
        Resignation: 'change-type-resignation',
        Expelled: 'change-type-expelled',
        Graduated: 'change-type-graduated',
    };
    return colors[changeType] || 'change-type-default';
}

export function formatRoleHistoryDate(date: string | null | undefined): string {
    if (!date) return '—';
    const parsedDate = new Date(date);
    if (Number.isNaN(parsedDate.getTime())) return '—';
    return parsedDate.toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
    });
}

export function getDurationText(duration: number | string | null | undefined): string {
    if (duration === 'Ongoing') return 'Ongoing';
    if (duration === 0) return 'Less than a day';
    if (duration === 1) return '1 day';
    if (typeof duration === 'number') return `${duration} days`;
    return '—';
}

export function getTimelineLineClass(items: MemberRoleHistoryTimelineEntry[]): string {
    if (!Array.isArray(items) || items.length < 2) return 'timeline-line--ascending';

    const firstStart = new Date(items[0]?.period?.start).getTime();
    const lastStart = new Date(items[items.length - 1]?.period?.start).getTime();

    if (Number.isNaN(firstStart) || Number.isNaN(lastStart)) return 'timeline-line--ascending';
    return firstStart <= lastStart ? 'timeline-line--ascending' : 'timeline-line--descending';
}
