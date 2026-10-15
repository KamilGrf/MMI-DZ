// Role model of the UI. NOTE: this is client-side only (it hides sections and buttons);
// the backend has no authentication yet, so real access control must be added there.

export const ROLES = {
    storekeeper: {
        label: 'Кладовщик',
        description: 'Ведёт каталог, выдаёт и принимает инструмент, смотрит отчёт',
        permissions: ['tools:read', 'tools:write', 'issues:read', 'issues:write', 'history:read', 'report:read'],
    },
    manager: {
        label: 'Руководитель',
        description: 'Просматривает инструменты, выдачи и отчёт, ничего не изменяет',
        permissions: ['tools:read', 'issues:read', 'history:read', 'report:read'],
    },
    employee: {
        label: 'Сотрудник',
        description: 'Ищет свободный инструмент в каталоге; история выдач скрыта (только просмотр)',
        permissions: ['tools:read'],
    },
};

export const ROLE_IDS = Object.keys(ROLES);

/** Sections of the app; the permission is what a role needs to open the section. */
export const SECTIONS = [
    { path: '/tools', label: 'Инструменты', permission: 'tools:read' },
    { path: '/issues', label: 'Выдача и возврат', permission: 'issues:read' },
    { path: '/report', label: 'Отчёт', permission: 'report:read' },
];

export function can(roleId, permission) {
    return Boolean(ROLES[roleId]?.permissions.includes(permission));
}

/** First section the role may open: where to land after login. */
export function firstAllowedPath(roleId) {
    return SECTIONS.find((s) => can(roleId, s.permission))?.path ?? null;
}
