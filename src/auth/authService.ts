import { authApi } from '@/api/auth';
import { setAccessToken } from '@/api/client';
import { ApiError } from '@/api/errors';
import type { MeResponse } from '@/types/auth';
import { clearTokens, writeRefreshToken } from './tokenStorage';

/**
 * Casos de uso de autenticación contra el backend real.
 *
 * REGLA: la identidad oficial SIEMPRE sale de GET /auth/me.
 * `login.user` es solo informativo; roles y permisos no se derivan de él.
 */

export const SESSION_UNAVAILABLE_MESSAGE =
  'Tu sesión no está disponible o tu usuario no tiene acceso.';

/** POST /auth/login -> tokens -> GET /auth/me -> identidad oficial. */
export async function loginWithCredentials(
  email: string,
  password: string,
): Promise<MeResponse> {
  const session = await authApi.login(email, password);

  setAccessToken(session.access_token);
  if (!session.refresh_token) {
    clearTokens();
    throw ApiError.unknown();
  }
  writeRefreshToken(session.refresh_token);

  try {
    const me = await authApi.me();
    if (!me.is_active) {
      throw new ApiError(403, 'FORBIDDEN', SESSION_UNAVAILABLE_MESSAGE);
    }
    return me;
  } catch (error) {
    const apiError = ApiError.from(error);
    clearTokens();
    if (apiError.status === 401 || apiError.status === 403) {
      throw new ApiError(apiError.status, 'FORBIDDEN', SESSION_UNAVAILABLE_MESSAGE);
    }
    throw apiError;
  }
}

/** GET /auth/me con el access token vigente. */
export function fetchMe(): Promise<MeResponse> {
  return authApi.me();
}

/**
 * POST /auth/logout con el access token vigente.
 * NO limpia la sesión local: si el backend responde 502 la UI ofrece
 * reintento y el usuario nunca ve un "sesión cerrada" falso.
 */
export async function logoutRemote(): Promise<void> {
  await authApi.logout();
}
