/** Semantic priority rank: Urgent/Critical first, then High → Medium → Low. */
const PRIORITY_RANK: Record<string, number> = {
    CRITICAL: 0,
    URGENT: 0,
    HIGH: 1,
    MEDIUM: 2,
    LOW: 3,
};

export function getPriorityRank(priority: string | null | undefined): number {
    if (!priority) return 99;
    return PRIORITY_RANK[String(priority).toUpperCase()] ?? 99;
}

type PriorityDateItem = {
    priority?: string | null;
    date?: string | Date | null;
};

/** Ascending by priority rank, then newer date first. */
export function compareByPriorityThenDate(a: PriorityDateItem, b: PriorityDateItem): number {
    const rankDiff = getPriorityRank(a.priority) - getPriorityRank(b.priority);
    if (rankDiff !== 0) return rankDiff;
    const dateA = a.date ? new Date(a.date).getTime() : 0;
    const dateB = b.date ? new Date(b.date).getTime() : 0;
    return dateB - dateA;
}

/**
 * Filter matching: UI "Urgent" (URGENT) matches stored CRITICAL (and vice versa).
 * Other priorities require an exact match.
 */
export function matchesPriorityFilter(
    itemPriority: string | null | undefined,
    filterPriority: string | null | undefined,
): boolean {
    if (!filterPriority) return true;
    const filter = String(filterPriority).toUpperCase();
    const item = String(itemPriority || '').toUpperCase();
    if (filter === 'URGENT' || filter === 'CRITICAL') {
        return item === 'URGENT' || item === 'CRITICAL';
    }
    return item === filter;
}
