import { authApi } from '@/api/auth';
import { setAccessToken } from '@/api/client';
import { ApiError } from '@/api/errors';
import { clearTokens, readRefreshToken, writeRefreshToken } from './tokenStorage';

/**
 * Refresh de sesión con SINGLE-FLIGHT.
 *
 * Si 5 requests reciben 401 a la vez, solo se emite UNA llamada a
 * POST /auth/refresh: los demás llamadores esperan la misma promesa.
 * Nunca se refresca sobre /auth/login ni /auth/refresh (el cliente HTTP
 * excluye esos paths; aquí además no hay recursión posible).
 */

export type RefreshOutcome =
  | { status: 'ok'; accessToken: string }
  /** Refresh rechazado por el backend (401): la sesión terminó. */
  | { status: 'expired' }
  /** Backend inaccesible (red/5xx): la sesión local no se toca. */
  | { status: 'unavailable' };

let inFlight: Promise<RefreshOutcome> | null = null;

export function refreshSession(): Promise<RefreshOutcome> {
  if (!inFlight) {
    const promise: Promise<RefreshOutcome> = performRefresh().finally(() => {
      if (inFlight === promise) inFlight = null;
    });
    inFlight = promise;
  }
  return inFlight;
}

/** Visible solo para tests: comprueba que no haya refresh concurrentes. */
export function isRefreshInFlight(): boolean {
  return inFlight !== null;
}

/** Reinicia el single-flight (aislamiento entre tests). */
export function resetRefreshController(): void {
  inFlight = null;
}

async function performRefresh(): Promise<RefreshOutcome> {
  const refreshToken = readRefreshToken();
  if (!refreshToken) return { status: 'expired' };

  try {
    const session = await authApi.refresh(refreshToken);
    if (!session || typeof session.access_token !== 'string' || !session.access_token) {
      clearTokens();
      return { status: 'expired' };
    }
    // ROTACIÓN: reemplazar SIEMPRE el refresh token anterior.
    if (typeof session.refresh_token === 'string' && session.refresh_token) {
      writeRefreshToken(session.refresh_token);
    } else {
      clearTokens();
      return { status: 'expired' };
    }
    setAccessToken(session.access_token);
    return { status: 'ok', accessToken: session.access_token };
  } catch (error) {
    const apiError = ApiError.from(error);
    if (apiError.status === 401) {
      clearTokens();
      return { status: 'expired' };
    }
    // 403: usuario desactivado / sin acceso → también cierra la sesión local.
    if (apiError.status === 403) {
      clearTokens();
      return { status: 'expired' };
    }
    return { status: 'unavailable' };
  }
}
