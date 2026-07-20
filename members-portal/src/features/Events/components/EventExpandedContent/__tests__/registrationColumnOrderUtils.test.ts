import { describe, expect, it } from 'vitest';
import type { EventCustomFieldRef } from '@/types/backend-contracts';
import {
    buildMiddleColumns,
    extractColumnOrderState,
    swapMiddleColumnOrders,
} from '../registrationColumnOrderUtils';

function customField(id: number, order: number): EventCustomFieldRef {
    return {
        id,
        eventId: 1,
        label: `Field ${id}`,
        type: 'text',
        order,
    };
}

describe('registrationColumnOrderUtils', () => {
    it('buildMiddleColumns sorts sessions, tier, and custom fields by order', () => {
        const columns = buildMiddleColumns(
            [customField(1, 3), customField(2, 2)],
            0,
            1,
        );

        expect(columns.map((column) => column.kind)).toEqual(['sessions', 'tier', 'custom', 'custom']);
        expect(columns[2].kind === 'custom' ? columns[2].field.id : null).toBe(2);
        expect(columns[3].kind === 'custom' ? columns[3].field.id : null).toBe(1);
    });

    it('swapMiddleColumnOrders swaps order values between adjacent columns', () => {
        const initial = buildMiddleColumns([customField(1, 2)], 0, 1);
        const swapped = swapMiddleColumnOrders(initial, 0, 'right');
        expect(swapped).not.toBeNull();

        const state = extractColumnOrderState(swapped!);
        expect(state.sessionFieldOrder).toBe(1);
        expect(state.tierFieldOrder).toBe(0);
    });

    it('extractColumnOrderState returns updated custom field orders', () => {
        const columns = buildMiddleColumns([customField(1, 5)], 2, 3);
        const state = extractColumnOrderState(columns);
        expect(state.sessionFieldOrder).toBe(2);
        expect(state.tierFieldOrder).toBe(3);
        expect(state.fields[0].order).toBe(5);
    });
});
