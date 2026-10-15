import { NavLink, Outlet } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext.jsx';
import { SECTIONS } from '../auth/roles.js';

/** Corporate layout (concept 3): sidebar on desktop, horizontal ribbon below the lg breakpoint. */
export default function Layout() {
    const { can, roleLabel, logout } = useAuth();
    return (
        <div className="min-h-screen lg:grid lg:grid-cols-[13rem_1fr]">
            <aside className="bg-side text-slate-300 lg:py-4">
                <h1 className="px-4 py-3 text-sm font-semibold text-white lg:mb-4 lg:py-0">АС «Учёт инструментов»</h1>
                <nav aria-label="Разделы" className="flex overflow-x-auto lg:block">
                    {SECTIONS.filter((s) => can(s.permission)).map((l) => (
                        <NavLink
                            key={l.path}
                            to={l.path}
                            className={({ isActive }) =>
                                `block whitespace-nowrap border-b-4 px-4 py-2.5 hover:bg-side-hover lg:border-b-0 lg:border-l-4 ${
                                    isActive ? 'border-blue-300 bg-side-hover text-white' : 'border-transparent'}`}
                        >
                            {l.label}
                        </NavLink>
                    ))}
                </nav>
                <div className="flex items-center justify-between gap-2 border-t border-slate-600 px-4 py-2 text-sm lg:mt-4">
                    <span>Роль: <strong className="text-white">{roleLabel}</strong></span>
                    <button type="button" onClick={logout} className="rounded border border-slate-500 px-2 py-0.5 text-xs text-white hover:bg-side-hover">
                        Выйти
                    </button>
                </div>
            </aside>
            <main className="min-w-0 p-3 sm:p-5">
                <Outlet />
            </main>
        </div>
    );
}
