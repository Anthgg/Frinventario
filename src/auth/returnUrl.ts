/**
 * Return URL segura (anti open-redirect).
 * Solo se aceptan rutas INTERNAS: deben empezar con "/" y no pueden
 * convertirse en URL de otro origen (//host, /\host, /http:...).
 */

export const DEFAULT_RETURN_URL = '/app/dashboard';

export function isSafeReturnUrl(value: unknown): value is string {
  if (typeof value !== 'string') return false;
  const candidate = value.trim();
  if (!candidate.startsWith('/')) return false;
  if (candidate.startsWith('//') || candidate.startsWith('/\\')) return false;
  if (candidate.includes('\\')) return false;
  // "/https:" y similares: esquema disfrazado de ruta.
  if (/^\/[a-zA-Z][a-zA-Z\d+.-]*:/.test(candidate)) return false;
  return true;
}

export function sanitizeReturnTo(value: unknown, fallback: string = DEFAULT_RETURN_URL): string {
  if (!isSafeReturnUrl(value)) return fallback;
  const candidate = (value as string).trim();
  // Volver al login desde el login solo genera un bucle.
  if (candidate === '/login' || candidate.startsWith('/login?')) return fallback;
  return candidate;
}
