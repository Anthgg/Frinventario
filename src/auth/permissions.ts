/**
 * Catálogo canónico de permisos — espejo de app/auth/permissions.py (backend
 * congelado). El frontend solo CONSULTA permisos; nunca los calcula ni asigna.
 */

export const PERMISSIONS = {
  AUTH_SELF_READ: 'auth.self.read',

  IMPORTS_READ: 'imports.read',
  IMPORTS_PREVIEW: 'imports.preview',
  IMPORTS_EXECUTE: 'imports.execute',

  USERS_READ: 'users.read',
  USERS_MANAGE: 'users.manage',
  USERS_MANAGE_ROLES: 'users.manage_roles',

  INVENTORY_READ: 'inventory.read',
  INVENTORY_CREATE: 'inventory.create',
  INVENTORY_ASSIGN: 'inventory.assign',
  INVENTORY_COUNT: 'inventory.count',
  INVENTORY_MONITOR: 'inventory.monitor',
  INVENTORY_RECOUNT: 'inventory.recount',
  INVENTORY_RECONCILE: 'inventory.reconcile',
  INVENTORY_APPROVE: 'inventory.approve',
  INVENTORY_CLOSE: 'inventory.close',
  INVENTORY_REOPEN: 'inventory.reopen',
  INVENTORY_EXPECTED_READ: 'inventory.expected.read',

  DAMAGE_REPORT: 'damage.report',
  DAMAGE_REVIEW: 'damage.review',

  EXPORTS_CREATE: 'exports.create',
  EXPORTS_READ: 'exports.read',

  AUDIT_READ: 'audit.read',
  SYSTEM_MANAGE: 'system.manage',
} as const;

export type Permission = (typeof PERMISSIONS)[keyof typeof PERMISSIONS];

export type PermissionInput = Permission | (string & {});

export function hasPermission(
  granted: readonly string[] | undefined,
  required: PermissionInput,
): boolean {
  if (!granted || granted.length === 0) return false;
  return new Set(granted).has(required);
}

export function hasAnyPermission(
  granted: readonly string[] | undefined,
  required: readonly PermissionInput[],
): boolean {
  if (!granted || granted.length === 0) return false;
  const grantedSet = new Set(granted);
  return required.some((permission) => grantedSet.has(permission));
}

export function hasAllPermissions(
  granted: readonly string[] | undefined,
  required: readonly PermissionInput[],
): boolean {
  if (!granted || granted.length === 0) return false;
  const grantedSet = new Set(granted);
  return required.every((permission) => grantedSet.has(permission));
}
