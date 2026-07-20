import type { EventCustomFieldRef } from '@/types/backend-contracts';

export type MiddleColumn =
    | { kind: 'sessions'; order: number }
    | { kind: 'tier'; order: number }
    | { kind: 'custom'; field: EventCustomFieldRef; order: number };

const KIND_RANK: Record<MiddleColumn['kind'], number> = {
    sessions: 0,
    tier: 1,
    custom: 2,
};

function compareMiddleColumns(a: MiddleColumn, b: MiddleColumn): number {
    if (a.order !== b.order) return a.order - b.order;
    return KIND_RANK[a.kind] - KIND_RANK[b.kind];
}

export function buildMiddleColumns(
    fields: EventCustomFieldRef[],
    sessionFieldOrder: number,
    tierFieldOrder: number,
): MiddleColumn[] {
    const sortedFields = [...fields].sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
    const columns: MiddleColumn[] = [
        { kind: 'sessions', order: sessionFieldOrder },
        { kind: 'tier', order: tierFieldOrder },
        ...sortedFields.map((field) => ({
            kind: 'custom' as const,
            field,
            order: field.order ?? 0,
        })),
    ];
    return columns.sort(compareMiddleColumns);
}

export function extractColumnOrderState(columns: MiddleColumn[]): {
    sessionFieldOrder: number;
    tierFieldOrder: number;
    fields: EventCustomFieldRef[];
} {
    const sessionsCol = columns.find((column) => column.kind === 'sessions');
    const tierCol = columns.find((column) => column.kind === 'tier');
    const fields = columns
        .filter((column): column is Extract<MiddleColumn, { kind: 'custom' }> => column.kind === 'custom')
        .map((column) => ({ ...column.field, order: column.order }));

    return {
        sessionFieldOrder: sessionsCol?.order ?? 0,
        tierFieldOrder: tierCol?.order ?? 1,
        fields,
    };
}

export function swapMiddleColumnOrders(
    columns: MiddleColumn[],
    index: number,
    direction: 'left' | 'right',
): MiddleColumn[] | null {
    const targetIndex = direction === 'left' ? index - 1 : index + 1;
    if (targetIndex < 0 || targetIndex >= columns.length) return null;

    const next = columns.map((column) => ({ ...column }));
    const current = next[index];
    const adjacent = next[targetIndex];
    const currentOrder = current.order;
    current.order = adjacent.order;
    adjacent.order = currentOrder;

    if (current.kind === 'custom') {
        current.field = { ...current.field, order: current.order };
    }
    if (adjacent.kind === 'custom') {
        adjacent.field = { ...adjacent.field, order: adjacent.order };
    }

    return next.sort(compareMiddleColumns);
}
