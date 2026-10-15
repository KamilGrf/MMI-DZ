import { afterEach, describe, expect, it, vi } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import App from '../App.jsx';
import { AuthProvider } from './AuthContext.jsx';
import { baseHandlers, mockFetch } from '../test/mockFetch.js';

afterEach(() => {
    vi.unstubAllGlobals();
    sessionStorage.clear();
});

const STATS = {
    counts: { in_stock: 1, issued: 0, repair: 0, written_off: 0 },
    overdue: 0, total_tools: 1, total_cost: 1000, byCategory: [], topEmployees: [],
};

function renderApp(path, initialRole) {
    const handlers = { ...baseHandlers(), 'GET /api/stats': { data: STATS } };
    const mock = mockFetch(handlers);
    const props = initialRole === undefined ? {} : { initialRole };
    render(
        <MemoryRouter initialEntries={[path]}>
            <AuthProvider {...props}><App /></AuthProvider>
        </MemoryRouter>,
    );
    return mock;
}

describe('role-based access', () => {
    it('sends an anonymous visitor to the login page and refuses sign-in without a role', async () => {
        renderApp('/report');
        expect(await screen.findByRole('radio', { name: /Кладовщик/ })).toBeInTheDocument();
        await userEvent.click(screen.getByRole('button', { name: 'Войти' }));
        expect(await screen.findByRole('alert')).toHaveTextContent('Выберите роль для входа');
        expect(screen.queryByRole('navigation')).not.toBeInTheDocument();
    });

    it('returns to the requested page after the manager signs in', async () => {
        renderApp('/report');
        await userEvent.click(await screen.findByRole('radio', { name: /Руководитель/ }));
        await userEvent.click(screen.getByRole('button', { name: 'Войти' }));
        expect(await screen.findByRole('heading', { name: 'Отчёт по инструментам' })).toBeInTheDocument();
        expect(screen.getByText(/Роль:/)).toHaveTextContent('Руководитель');
    });

    it('lets the storekeeper add tools', async () => {
        renderApp('/tools', 'storekeeper');
        expect(await screen.findByRole('button', { name: 'Добавить инструмент' })).toBeInTheDocument();
        const nav = within(screen.getByRole('navigation', { name: 'Разделы' }));
        expect(nav.getAllByRole('link').map((l) => l.textContent)).toEqual(['Инструменты', 'Выдача и возврат', 'Отчёт']);
    });

    it('shows the manager the data but no write actions', async () => {
        renderApp('/tools', 'manager');
        await screen.findByText('Шуруповёрт Makita DF330D');
        expect(screen.queryByRole('button', { name: 'Добавить инструмент' })).not.toBeInTheDocument();
        await userEvent.click(screen.getByText('Шуруповёрт Makita DF330D'));
        expect(screen.queryByRole('button', { name: 'Выдать' })).not.toBeInTheDocument();
    });

    it('shows the issue history to the manager', async () => {
        const { calls } = renderApp('/tools', 'manager');
        await userEvent.click(await screen.findByText('Шуруповёрт Makita DF330D'));
        expect(await screen.findByRole('heading', { name: 'История выдач' })).toBeInTheDocument();
        expect(calls.some((c) => c.url.includes('/api/issues?tool='))).toBe(true);
    });

    it('hides the issue history from the employee and never requests it', async () => {
        const { calls } = renderApp('/tools', 'employee');
        await userEvent.click(await screen.findByText('Шуруповёрт Makita DF330D'));
        expect(await screen.findByRole('heading', { name: 'Шуруповёрт Makita DF330D' })).toBeInTheDocument();
        expect(screen.queryByRole('heading', { name: 'История выдач' })).not.toBeInTheDocument();
        expect(screen.queryByText(/ещё не выдавался/)).not.toBeInTheDocument();
        expect(calls.some((c) => c.url.includes('/api/issues'))).toBe(false);
    });

    it('denies the employee the report page without requesting its data', async () => {
        const { calls } = renderApp('/report', 'employee');
        expect(await screen.findByRole('alert')).toHaveTextContent('Доступ запрещён');
        expect(calls.some((c) => c.url.includes('/api/stats'))).toBe(false);
        const nav = within(screen.getByRole('navigation', { name: 'Разделы' }));
        expect(nav.getAllByRole('link').map((l) => l.textContent)).toEqual(['Инструменты']);
    });

    it('signs out and asks for a role again', async () => {
        renderApp('/tools', 'storekeeper');
        await userEvent.click(await screen.findByRole('button', { name: 'Выйти' }));
        expect(await screen.findByRole('radio', { name: /Сотрудник/ })).toBeInTheDocument();
    });
});
