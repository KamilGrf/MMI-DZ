// Dependency-free SVG pie chart. Values are always repeated as text in the legend (never colour alone).
import { percentOf, pieSlices } from '../utils/chart.js';

/** @param {{ title: string, data: { label: string, value: number, color: string }[] }} props */
export default function PieChart({ title, data }) {
    const slices = pieSlices(data);
    const total = slices.reduce((sum, s) => sum + s.value, 0);
    if (total === 0) return <p className="text-sm text-slate-500">Нет данных для диаграммы</p>;

    const summary = data.map((d) => `${d.label}: ${d.value} (${percentOf(d.value, total)}%)`).join(', ');
    return (
        <figure className="flex flex-wrap items-center gap-4">
            <svg viewBox="0 0 100 100" role="img" aria-label={`${title}. ${summary}`} className="h-44 w-44 shrink-0">
                {slices.map((s) => (s.full
                    ? <circle key={s.label} cx="50" cy="50" r="48" fill={s.color} />
                    : <path key={s.label} d={s.d} fill={s.color} stroke="#fff" strokeWidth="0.6" />))}
            </svg>
            <figcaption>
                <ul className="space-y-1 text-sm">
                    {data.map((d) => (
                        <li key={d.label} className="flex items-center gap-2">
                            <span aria-hidden="true" className="inline-block h-3 w-3 shrink-0 rounded-sm" style={{ backgroundColor: d.color }} />
                            <span>{d.label}: <strong>{d.value}</strong> ({percentOf(d.value, total)}%)</span>
                        </li>
                    ))}
                </ul>
                <p className="mt-2 text-xs text-slate-500">Всего: {total}</p>
            </figcaption>
        </figure>
    );
}
