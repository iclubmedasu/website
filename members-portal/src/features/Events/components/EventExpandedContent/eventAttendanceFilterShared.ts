export type CountFilterOperator =
    | 'hasAny'
    | 'hasNone'
    | 'equals'
    | 'greaterThan'
    | 'lessThan';

export type IdSetFilterOperator = 'includesAll' | 'includesAny';

export function matchesCountFilter(
    count: number,
    operator: CountFilterOperator,
    value?: number,
): boolean {
    if (operator === 'hasAny') return count > 0;
    if (operator === 'hasNone') return count === 0;
    if (operator === 'equals') return count === (value ?? 0);
    if (operator === 'greaterThan') return count > (value ?? 0);
    return count < (value ?? 0);
}

export function matchesIdSetFilter(
    values: string[],
    operator: IdSetFilterOperator,
    selected: string[],
): boolean {
    if (selected.length === 0) return true;
    if (operator === 'includesAny') {
        return selected.some((value) => values.includes(value));
    }
    return selected.every((value) => values.includes(value));
}
