import { setAccessToken } from '@/api/client';

/**
 * Persistencia mínima de sesión.
 *
 * - access_token: SOLO en memoria (módulo api/client). Nunca se serializa.
 * - refresh_token: sessionStorage — permite restaurar la sesión tras F5, pero
 *   cerrar la pestaña del navegador termina la permanencia.
 *
 * No se usa localStorage: FF001 no necesita "recordarme".
 */

export const REFRESH_TOKEN_KEY = 'dedalo.auth.refresh';

export function readRefreshToken(): string | null {
  try {
    const value = window.sessionStorage.getItem(REFRESH_TOKEN_KEY);
    return value && value.length > 0 ? value : null;
  } catch {
    return null;
  }
}

export function writeRefreshToken(token: string): void {
  try {
    window.sessionStorage.setItem(REFRESH_TOKEN_KEY, token);
  } catch {
    /* storage no disponible: la sesión vive solo en memoria */
  }
}

export function clearRefreshToken(): void {
  try {
    window.sessionStorage.removeItem(REFRESH_TOKEN_KEY);
  } catch {
    /* storage no disponible */
  }
}

/** Limpia ambos tokens: memoria + sessionStorage. */
export function clearTokens(): void {
  setAccessToken(null);
  clearRefreshToken();
}
