import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import PieChart from './PieChart.jsx';

const DATA = [
    { label: 'На складе', value: 6, color: '#0f766e' },
    { label: 'Выдан', value: 3, color: '#b45309' },
    { label: 'В ремонте', value: 1, color: '#b91c1c' },
];

describe('PieChart', () => {
    it('draws one slice per non-zero item and repeats values as text', () => {
        const { container } = render(<PieChart title="Парк" data={DATA} />);
        expect(container.querySelectorAll('path')).toHaveLength(3);
        expect(screen.getByRole('img')).toHaveAccessibleName(/На складе: 6 \(60%\).*Выдан: 3 \(30%\).*В ремонте: 1 \(10%\)/);
        expect(screen.getByText('Всего: 10')).toBeInTheDocument();
    });

    it('keeps a zero item in the legend but does not draw it', () => {
        const { container } = render(<PieChart title="Парк" data={[...DATA, { label: 'Списан', value: 0, color: '#64748b' }]} />);
        expect(container.querySelectorAll('path')).toHaveLength(3);
        expect(screen.getByText((_, el) => el.tagName === 'SPAN' && el.textContent === 'Списан: 0 (0%)')).toBeInTheDocument();
    });

    it('draws a circle when one item is the whole', () => {
        const { container } = render(<PieChart title="Парк" data={[{ label: 'Выдан', value: 4, color: '#b45309' }]} />);
        expect(container.querySelectorAll('circle')).toHaveLength(1);
        expect(container.querySelectorAll('path')).toHaveLength(0);
    });

    it('shows a message instead of an empty chart when all values are zero', () => {
        render(<PieChart title="Парк" data={DATA.map((d) => ({ ...d, value: 0 }))} />);
        expect(screen.getByText('Нет данных для диаграммы')).toBeInTheDocument();
        expect(screen.queryByRole('img')).not.toBeInTheDocument();
    });
});
