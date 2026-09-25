/**
 * Tipos derivados del contrato real del backend (lectura de
 * `app/api/auth.py` y `app/auth/permissions.py`, commit dcf09b5).
 * No se inventan campos: solo lo que el backend devuelve.
 */

export type RoleCode = 'OPERATOR' | 'SUPERVISOR' | 'MANAGER' | 'ADMIN' | (string & {});

export interface AuthSessionUser {
  id: string;
  email: string;
  display_name: string | null;
  is_active: boolean;
  roles: RoleCode[];
}

export interface SessionPayload {
  access_token: string;
  refresh_token: string;
  expires_in: number;
  token_type: string;
}

export interface LoginResponse extends SessionPayload {
  user: AuthSessionUser;
}

export type RefreshResponse = SessionPayload;

export interface MeResponse extends AuthSessionUser {
  permissions: string[];
}

export interface LogoutResponse {
  status: string;
}
