// Pure geometry for the pie chart (kept out of the component so it is easy to unit-test).

const CENTER = 50;
const RADIUS = 48;

const point = (angle) => [
    +(CENTER + RADIUS * Math.cos(angle)).toFixed(3),
    +(CENTER + RADIUS * Math.sin(angle)).toFixed(3),
];

/**
 * Turn [{ label, value, color }] into slices of a 100x100 SVG pie.
 * Items with a non-positive or non-numeric value are dropped; no data -> [].
 * A slice that covers the whole circle has `full: true` and no path (an SVG arc cannot draw 360°).
 */
export function pieSlices(items) {
    const valid = items.filter((i) => Number.isFinite(i.value) && i.value > 0);
    const total = valid.reduce((sum, i) => sum + i.value, 0);
    if (total === 0) return [];

    let angle = -Math.PI / 2; // start at 12 o'clock
    return valid.map((item) => {
        const share = item.value / total;
        const start = angle;
        angle += share * 2 * Math.PI;
        if (share === 1) return { ...item, share, full: true };
        const [x1, y1] = point(start);
        const [x2, y2] = point(angle);
        const large = share > 0.5 ? 1 : 0;
        return { ...item, share, full: false, d: `M ${CENTER} ${CENTER} L ${x1} ${y1} A ${RADIUS} ${RADIUS} 0 ${large} 1 ${x2} ${y2} Z` };
    });
}

/** Whole-number percent of a total; 0 when the total is 0. */
export function percentOf(value, total) {
    return total > 0 ? Math.round((value / total) * 100) : 0;
}
