import { afterEach, describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import ReportPage from './ReportPage.jsx';
import { mockFetch } from '../test/mockFetch.js';

afterEach(() => vi.unstubAllGlobals());

const STATS = {
    counts: { in_stock: 5, issued: 2, repair: 1, written_off: 2 },
    overdue: 1,
    total_tools: 8,
    total_cost: 100000,
    byCategory: [{ name: 'Электроинструмент', n: 8, cost: 100000 }],
    topEmployees: [{ full_name: 'Иванов И. И.', n: 2 }],
};

describe('ReportPage pie chart', () => {
    it('shows the fleet structure by status with percentages', async () => {
        mockFetch({ 'GET /api/stats': { data: STATS }, 'GET /api/issues': { data: [] } });
        const { container } = render(<ReportPage />);
        const chart = await screen.findByRole('img', { name: /Структура парка по статусам/ });
        expect(chart).toHaveAccessibleName(/На складе: 5 \(50%\).*Выдан: 2 \(20%\).*В ремонте: 1 \(10%\).*Списан: 2 \(20%\)/);
        expect(container.querySelectorAll('svg path')).toHaveLength(4);
    });

    it('shows the error banner and no chart when the report cannot be loaded', async () => {
        mockFetch({
            'GET /api/stats': { status: 500, data: { error: 'Внутренняя ошибка сервера. Попробуйте позже' } },
            'GET /api/issues': { data: [] },
        });
        render(<ReportPage />);
        expect(await screen.findByRole('alert')).toHaveTextContent('Внутренняя ошибка сервера');
        expect(screen.queryByRole('img')).not.toBeInTheDocument();
    });
});
