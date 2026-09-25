import { ApiError } from './errors';

/**
 * Cliente API centralizado.
 * Única fuente de URL: variables de entorno Vite. Ninguna componente conoce
 * host ni prefijo.
 */

export interface ViteEnvLike {
  VITE_API_BASE_URL?: string;
  VITE_API_URL?: string;
  VITE_API_PREFIX?: string;
}

const DEFAULT_PREFIX = '/api/v1';

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
 * Orden de precedencia:
 * 1. VITE_API_BASE_URL (absoluto, prefijo incluido)
 * 2. VITE_API_URL + VITE_API_PREFIX
 * 3. /api/v1 (proxy del bundler)
 */
export function resolveBaseUrl(env: ViteEnvLike = import.meta.env): string {
  const explicit = env.VITE_API_BASE_URL?.trim();
  if (explicit) return trimTrailingSlash(explicit);

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

export function setAccessToken(token: string | null): void {
  accessToken = token;
}

export function getAccessToken(): string | null {
  return accessToken;
}

export class ApiClient {
  constructor(readonly baseUrl: string = resolveBaseUrl()) {}

  async request<T>(path: string, options: RequestOptions = {}): Promise<T> {
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
      throw ApiError.network();
    }

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

  delete<T>(path: string, options?: Omit<RequestOptions, 'method'>): Promise<T> {
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
