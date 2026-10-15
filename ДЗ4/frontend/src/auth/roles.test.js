import { describe, expect, it } from 'vitest';
import { ROLE_IDS, SECTIONS, can, firstAllowedPath } from './roles.js';

describe('roles', () => {
    it('defines three roles', () => {
        expect(ROLE_IDS).toEqual(['storekeeper', 'manager', 'employee']);
    });

    it('lets only the storekeeper change data', () => {
        expect(can('storekeeper', 'tools:write')).toBe(true);
        expect(can('storekeeper', 'issues:write')).toBe(true);
        expect(can('manager', 'tools:write')).toBe(false);
        expect(can('manager', 'issues:write')).toBe(false);
        expect(can('employee', 'tools:write')).toBe(false);
    });

    it('limits the employee to the tools catalogue', () => {
        const open = SECTIONS.filter((s) => can('employee', s.permission)).map((s) => s.path);
        expect(open).toEqual(['/tools']);
    });

    it('hides the issue history (it names other employees) from the employee only', () => {
        expect(can('storekeeper', 'history:read')).toBe(true);
        expect(can('manager', 'history:read')).toBe(true);
        expect(can('employee', 'history:read')).toBe(false);
    });

    it('lets the manager read every section', () => {
        expect(SECTIONS.every((s) => can('manager', s.permission))).toBe(true);
    });

    it('denies everything to an unknown or missing role', () => {
        expect(can('hacker', 'tools:read')).toBe(false);
        expect(can(null, 'report:read')).toBe(false);
        expect(firstAllowedPath(null)).toBeNull();
    });

    it('lands every role on its first allowed section', () => {
        expect(firstAllowedPath('storekeeper')).toBe('/tools');
        expect(firstAllowedPath('employee')).toBe('/tools');
    });
});
