import { describe, expect, it } from 'vitest';
import { compareAlphanumeric } from '@/utils/compareAlphanumeric';

describe('compareAlphanumeric', () => {
    it('sorts numbers in natural order', () => {
        expect(compareAlphanumeric('file2', 'file10')).toBeLessThan(0);
        expect(compareAlphanumeric('file10', 'file2')).toBeGreaterThan(0);
    });

    it('is case-insensitive', () => {
        expect(compareAlphanumeric('Alpha', 'beta')).toBeLessThan(0);
        expect(compareAlphanumeric('alpha', 'Beta')).toBeLessThan(0);
    });
});
