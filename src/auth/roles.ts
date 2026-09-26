const ROLE_LABELS: Record<string, string> = {
  OPERATOR: 'Operador',
  SUPERVISOR: 'Supervisor',
  MANAGER: 'Gerente',
  ADMIN: 'Administrador',
};

/** Label informativo de un rol del backend (nunca decide permisos). */
export function roleLabel(role: string): string {
  return ROLE_LABELS[role] ?? role;
}

export function primaryRoleLabel(roles: readonly string[]): string | null {
  const [first] = roles;
  return first ? roleLabel(first) : null;
}
