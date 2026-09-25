import { describe, expect, it } from 'vitest';
import {
  hasAllPermissions,
  hasAnyPermission,
  hasPermission,
  PERMISSIONS,
} from '@/auth/permissions';

describe('permission helpers', () => {
  it('un permiso concedido permite; uno ausente, no', () => {
    const granted = [PERMISSIONS.INVENTORY_READ, PERMISSIONS.INVENTORY_COUNT];

    expect(hasPermission(granted, PERMISSIONS.INVENTORY_COUNT)).toBe(true);
    expect(hasPermission(granted, PERMISSIONS.INVENTORY_APPROVE)).toBe(false);
  });

  it('sin sesión no hay permisos', () => {
    expect(hasPermission(undefined, PERMISSIONS.INVENTORY_READ)).toBe(false);
    expect(hasPermission([], PERMISSIONS.INVENTORY_READ)).toBe(false);
    expect(hasAnyPermission(undefined, [PERMISSIONS.INVENTORY_READ])).toBe(false);
    expect(hasAllPermissions([], [PERMISSIONS.INVENTORY_READ])).toBe(false);
  });

  it('hasAnyPermission basta con uno', () => {
    const granted = [PERMISSIONS.DAMAGE_REPORT];

    expect(
      hasAnyPermission(granted, [PERMISSIONS.DAMAGE_REVIEW, PERMISSIONS.DAMAGE_REPORT]),
    ).toBe(true);
    expect(hasAnyPermission(granted, [PERMISSIONS.DAMAGE_REVIEW])).toBe(false);
  });

  it('hasAllPermissions exige todos', () => {
    const granted = [PERMISSIONS.INVENTORY_READ, PERMISSIONS.INVENTORY_COUNT];

    expect(hasAllPermissions(granted, [PERMISSIONS.INVENTORY_READ])).toBe(true);
    expect(
      hasAllPermissions(granted, [PERMISSIONS.INVENTORY_READ, PERMISSIONS.INVENTORY_CLOSE]),
    ).toBe(false);
  });

  it('el catálogo espeja al backend congelado', () => {
    expect(PERMISSIONS.INVENTORY_EXPECTED_READ).toBe('inventory.expected.read');
    expect(PERMISSIONS.SYSTEM_MANAGE).toBe('system.manage');
    expect(Object.values(PERMISSIONS)).not.toContain(undefined);
  });
});
