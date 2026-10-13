import { NavLink, Outlet } from 'react-router-dom';

const LINKS = [
    { to: '/tools', label: 'Инструменты' },
    { to: '/issues', label: 'Выдача и возврат' },
    { to: '/report', label: 'Отчёт' },
];

/** Corporate layout (concept 3): sidebar on desktop, horizontal ribbon below the lg breakpoint. */
export default function Layout() {
    return (
        <div className="min-h-screen lg:grid lg:grid-cols-[13rem_1fr]">
            <aside className="bg-side text-slate-300 lg:py-4">
                <h1 className="px-4 py-3 text-sm font-semibold text-white lg:mb-4 lg:py-0">АС «Учёт инструментов»</h1>
                <nav aria-label="Разделы" className="flex overflow-x-auto lg:block">
                    {LINKS.map((l) => (
                        <NavLink
                            key={l.to}
                            to={l.to}
                            className={({ isActive }) =>
                                `block whitespace-nowrap border-b-4 px-4 py-2.5 hover:bg-side-hover lg:border-b-0 lg:border-l-4 ${
                                    isActive ? 'border-blue-300 bg-side-hover text-white' : 'border-transparent'}`}
                        >
                            {l.label}
                        </NavLink>
                    ))}
                </nav>
            </aside>
            <main className="min-w-0 p-3 sm:p-5">
                <Outlet />
            </main>
        </div>
    );
}
