export function normalizeSearchQuery(query: string): string {
    return query.trim().toLowerCase();
}

export function buildSearchText(...values: Array<string | number | boolean | null | undefined>): string {
    return values
        .filter((value) => value != null && `${value}`.trim() !== '')
        .map((value) => `${value}`.toLowerCase())
        .join(' ');
}

export function matchesSearchQuery(text: string, query: string): boolean {
    const normalizedQuery = normalizeSearchQuery(query);
    if (!normalizedQuery) return true;
    return text.includes(normalizedQuery);
}