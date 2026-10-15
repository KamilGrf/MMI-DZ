import { Link, Navigate, Outlet, useLocation } from 'react-router-dom';
import { useAuth } from './AuthContext.jsx';
import { firstAllowedPath } from './roles.js';

/** Layout route: anonymous visitors are sent to the login page and brought back afterwards. */
export function RequireAuth() {
    const { role } = useAuth();
    const location = useLocation();
    if (!role) return <Navigate to="/login" state={{ from: location }} replace />;
    return <Outlet />;
}

/** Shows the section only to roles that have the permission. */
export function RequirePermission({ permission, children }) {
    const { can, roleLabel } = useAuth();
    if (can(permission)) return children;
    return (
        <div role="alert" className="rounded border border-red-300 bg-red-50 p-4 text-red-800">
            <h2 className="font-semibold">Доступ запрещён</h2>
            <p className="mt-1 text-sm">Роль «{roleLabel}» не имеет доступа к этому разделу.</p>
            <p className="mt-2 text-sm"><Link to="/" className="text-blue-700 underline">Перейти в доступный раздел</Link></p>
        </div>
    );
}

/** Index route: lands on the first section the current role may open. */
export function HomeRedirect() {
    const { role } = useAuth();
    const path = firstAllowedPath(role);
    return path ? <Navigate to={path} replace /> : <p className="p-4">Для этой роли нет доступных разделов</p>;
}
