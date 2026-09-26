import { reportConnection } from './connection';
import { ApiError } from './errors';

/**
 * Cliente API centralizado.
 * Única fuente de URL: variables de entorno Vite. Ninguna componente conoce
 * host ni prefijo.
 *
 * Integración de auth sin ciclos: el cliente NUNCA importa React ni el
 * AuthProvider. El proveedor de tokens se inyecta con `setApiAuthHandler`.
 */

export interface ViteEnvLike {
  VITE_API_BASE_URL?: string;
  VITE_API_URL?: string;
  VITE_API_PREFIX?: string;
}

const DEFAULT_PREFIX = '/api/v1';

/** Paths donde NUNCA se intenta refresh automático (evita bucles). */
const NO_REFRESH_PATHS = ['/auth/login', '/auth/refresh'];

function trimTrailingSlash(value: string): string {
  return value.replace(/\/+$/, '');
}

/** Une por segmentos evitando dobles barras: joinUrl('/api/v1', '/auth/login'). */
export function joinUrl(base: string, path: string): string {
  const left = trimTrailingSlash(base);
  const right = path.startsWith('/') ? path : `/${path}`;
  return `${left}${right}`;
}

/**
 * true si la URL absoluta ya trae ruta propia (p. ej. .../api/v1).
 * Una URL solo-host (http://127.0.0.1:8000) no la trae: hay que añadir el
 * prefijo para no terminar en /auth/login sin /api/v1.
 */
function hasExplicitPath(value: string): boolean {
  try {
    const pathname = new URL(value).pathname.replace(/\/+$/, '');
    return pathname.length > 0;
  } catch {
    // Relativa (p. ej. "/api/v1"): ya incluye el prefijo.
    return true;
  }
}

/**
 * Orden de precedencia:
 * 1. VITE_API_BASE_URL (absoluto; si es solo-host se le añade el prefijo)
 * 2. VITE_API_URL + VITE_API_PREFIX
 * 3. /api/v1 (proxy del bundler)
 */
export function resolveBaseUrl(env: ViteEnvLike = import.meta.env): string {
  const explicit = env.VITE_API_BASE_URL?.trim();
  if (explicit) {
    const base = trimTrailingSlash(explicit);
    if (hasExplicitPath(base)) return base;
    const prefix = env.VITE_API_PREFIX?.trim();
    const effectivePrefix = prefix && prefix !== '/' ? prefix : DEFAULT_PREFIX;
    return trimTrailingSlash(joinUrl(base, effectivePrefix));
  }

  const origin = env.VITE_API_URL?.trim();
  const prefix = env.VITE_API_PREFIX?.trim();
  if (origin) {
    return trimTrailingSlash(joinUrl(origin, prefix && prefix !== '/' ? prefix : ''));
  }
  return DEFAULT_PREFIX;
}

export interface RequestOptions {
  method?: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
  body?: unknown;
  query?: Record<string, string | number | boolean | undefined>;
  signal?: AbortSignal;
  /** Token explícito; si se omite se usa el token global de la sesión. */
  token?: string | null;
  headers?: Record<string, string>;
  /** Excluye el refresco automático tras 401 (uso interno del retry). */
  skipAutoRefresh?: boolean;
}

/** Resultado del refresh compartido (single-flight) inyectado por auth. */
export type ApiRefreshOutcome =
  | { status: 'ok'; accessToken: string }
  | { status: 'expired' }
  | { status: 'unavailable' };

export interface ApiAuthHandler {
  /** Access token vigente en memoria (null si no hay sesión). */
  getAccessToken(): string | null;
  /** Refresca la sesión. Varias requests 401 comparten UNA sola operación. */
  refreshAccessToken(): Promise<ApiRefreshOutcome>;
  /** La sesión terminó definitivamente: limpiar estado local de auth. */
  onSessionExpired(): void;
}

type QueryValue = string | number | boolean | undefined;

function buildQuery(query: Record<string, QueryValue> | undefined): string {
  if (!query) return '';
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(query)) {
    if (value !== undefined) params.append(key, String(value));
  }
  const serialized = params.toString();
  return serialized ? `?${serialized}` : '';
}

let accessToken: string | null = null;
let authHandler: ApiAuthHandler | null = null;

export function setAccessToken(token: string | null): void {
  accessToken = token;
}

export function getAccessToken(): string | null {
  return accessToken;
}

/** Inyecta el proveedor de tokens (lo registra <AuthProvider>). */
export function setApiAuthHandler(handler: ApiAuthHandler | null): void {
  authHandler = handler;
}

export function getApiAuthHandler(): ApiAuthHandler | null {
  return authHandler;
}

function allowsAutoRefresh(path: string): boolean {
  if (!authHandler) return false;
  return !NO_REFRESH_PATHS.some((blocked) => path === blocked);
}

export class ApiClient {
  constructor(readonly baseUrl: string = resolveBaseUrl()) {}

  async request<T>(path: string, options: RequestOptions = {}): Promise<T> {
    try {
      return await this.send<T>(path, options);
    } catch (error) {
      const isUnauthorized = error instanceof ApiError && error.status === 401;
      const skipRefresh =
        options.skipAutoRefresh === true || !allowsAutoRefresh(path) || !authHandler;
      if (!isUnauthorized || skipRefresh) throw error;

      // UN solo intento de refresh, compartido entre requests concurrentes.
      let outcome: ApiRefreshOutcome;
      try {
        outcome = await (authHandler as ApiAuthHandler).refreshAccessToken();
      } catch {
        outcome = { status: 'unavailable' };
      }

      if (outcome.status !== 'ok') {
        if (outcome.status === 'expired') {
          (authHandler as ApiAuthHandler).onSessionExpired();
        }
        throw error;
      }

      try {
        return await this.send<T>(path, {
          ...options,
          token: outcome.accessToken,
          skipAutoRefresh: true,
        });
      } catch (retryError) {
        const retryUnauthorized = retryError instanceof ApiError && retryError.status === 401;
        if (retryUnauthorized) {
          // Segundo 401 tras refresh: fin de la sesión, sin loops.
          (authHandler as ApiAuthHandler).onSessionExpired();
        }
        throw retryError;
      }
    }
  }

  private async send<T>(path: string, options: RequestOptions): Promise<T> {
    const { method = 'GET', body, query, signal, headers = {} } = options;
    const token = options.token !== undefined ? options.token : accessToken;

    const requestHeaders: Record<string, string> = {
      Accept: 'application/json',
      ...headers,
    };
    if (body !== undefined && !(body instanceof FormData)) {
      requestHeaders['Content-Type'] = 'application/json';
    }
    if (token) {
      requestHeaders['Authorization'] = `Bearer ${token}`;
    }

    const url = `${this.baseUrl}${path}${buildQuery(query)}`;

    let response: Response;
    try {
      response = await fetch(url, {
        method,
        headers: requestHeaders,
        body:
          body === undefined
            ? undefined
            : body instanceof FormData
              ? body
              : JSON.stringify(body),
        signal,
      });
    } catch (error) {
      if (error instanceof DOMException && error.name === 'AbortError') throw error;
      reportConnection('offline');
      throw ApiError.network();
    }

    reportConnection('online');

    if (response.status === 204) return undefined as T;

    const payload = await readJson(response);

    if (!response.ok) {
      throw ApiError.fromResponse(response.status, payload);
    }

    return payload as T;
  }

  get<T>(path: string, options?: Omit<RequestOptions, 'method' | 'body'>): Promise<T> {
    return this.request<T>(path, { ...options, method: 'GET' });
  }

  post<T>(path: string, body?: unknown, options?: Omit<RequestOptions, 'method'>): Promise<T> {
    return this.request<T>(path, { ...options, method: 'POST', body });
  }

  put<T>(path: string, body?: unknown, options?: Omit<RequestOptions, 'method'>): Promise<T> {
    return this.request<T>(path, { ...options, method: 'PUT', body });
  }

  patch<T>(path: string, body?: unknown, options?: Omit<RequestOptions, 'method'>): Promise<T> {
    return this.request<T>(path, { ...options, method: 'PATCH', body });
  }

  delete<T>(path: string, options?: Omit<RequestOptions, 'method' | 'body'>): Promise<T> {
    return this.request<T>(path, { ...options, method: 'DELETE' });
  }
}

async function readJson(response: Response): Promise<unknown> {
  const contentType = response.headers.get('content-type') ?? '';
  if (!contentType.includes('json')) {
    const text = await response.text().catch(() => '');
    return text ? { detail: text } : undefined;
  }
  return response.json().catch(() => undefined);
}

export const apiClient = new ApiClient();
