import { describe, expect, it } from 'vitest';
import { percentOf, pieSlices } from './chart.js';

const item = (label, value) => ({ label, value, color: '#000' });

describe('pieSlices', () => {
    it('gives each non-zero item a share proportional to its value', () => {
        const slices = pieSlices([item('a', 1), item('b', 3)]);
        expect(slices.map((s) => s.share)).toEqual([0.25, 0.75]);
        expect(slices.every((s) => s.d.startsWith('M 50 50 L'))).toBe(true);
    });

    it('drops zero, negative and non-numeric values', () => {
        const slices = pieSlices([item('a', 2), item('b', 0), item('c', -1), item('d', NaN), item('e', undefined)]);
        expect(slices.map((s) => s.label)).toEqual(['a']);
    });

    it('returns no slices when there is nothing to draw', () => {
        expect(pieSlices([])).toEqual([]);
        expect(pieSlices([item('a', 0)])).toEqual([]);
    });

    it('marks a single 100% slice as a full circle without a path', () => {
        const [slice] = pieSlices([item('a', 5), item('b', 0)]);
        expect(slice.full).toBe(true);
        expect(slice.d).toBeUndefined();
    });

    it('uses the large-arc flag only for slices over half of the circle', () => {
        const [big, small] = pieSlices([item('a', 3), item('b', 1)]);
        expect(big.d).toMatch(/ 0 1 1 /);
        expect(small.d).toMatch(/ 0 0 1 /);
    });
});

describe('percentOf', () => {
    it('rounds to whole percents', () => {
        expect(percentOf(1, 3)).toBe(33);
        expect(percentOf(2, 3)).toBe(67);
    });

    it('is 0 for an empty total', () => {
        expect(percentOf(0, 0)).toBe(0);
    });
});
