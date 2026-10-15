import { createContext, useCallback, useContext, useMemo, useState } from 'react';
import { ROLES, can as roleCan } from './roles.js';

const STORAGE_KEY = 'tool-accounting.role';

// Outside a provider (isolated component tests) every action is allowed.
// The app root always mounts <AuthProvider> and gates routes with <RequireAuth>.
const AuthContext = createContext({
    role: null, roleLabel: '', can: () => true, login: () => false, logout: () => {},
});

function readStoredRole() {
    try {
        const value = sessionStorage.getItem(STORAGE_KEY);
        return ROLES[value] ? value : null;
    } catch {
        return null; // storage can be blocked (private mode)
    }
}

function writeStoredRole(role) {
    try {
        if (role) sessionStorage.setItem(STORAGE_KEY, role);
        else sessionStorage.removeItem(STORAGE_KEY);
    } catch {
        // the session still works in memory
    }
}

/** `initialRole` (including null) overrides the stored role; used by tests. */
export function AuthProvider({ children, initialRole }) {
    const [role, setRole] = useState(() => (initialRole !== undefined ? initialRole : readStoredRole()));

    const login = useCallback((next) => {
        if (!ROLES[next]) return false;
        writeStoredRole(next);
        setRole(next);
        return true;
    }, []);

    const logout = useCallback(() => {
        writeStoredRole(null);
        setRole(null);
    }, []);

    const value = useMemo(() => ({
        role,
        roleLabel: ROLES[role]?.label ?? '',
        can: (permission) => roleCan(role, permission),
        login,
        logout,
    }), [role, login, logout]);

    return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
    return useContext(AuthContext);
}
