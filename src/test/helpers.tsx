import { render } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { StrictMode, type ReactElement } from 'react';
import { vi } from 'vitest';
import { App } from '@/app/App';

export const REFRESH_TOKEN_KEY = 'dedalo.auth.refresh';

export const TEST_ACCESS_TOKEN = 'access-token-test';
export const TEST_REFRESH_TOKEN = 'refresh-token-test';
export const REFRESHED_ACCESS_TOKEN = 'access-token-refreshed';
export const ROTATED_REFRESH_TOKEN = 'refresh-token-rotated';

export const TEST_USER = {
  id: 'usr-test',
  email: 'tester@dedalo.local',
  display_name: 'Tester Dedalo',
  is_active: true,
  roles: ['SUPERVISOR'],
};

/** Permisos oficiales que devolvería GET /auth/me para la cuenta de prueba. */
export const TEST_PERMISSIONS = [
  'auth.self.read',
  'inventory.read',
  'inventory.count',
  'inventory.recount',
  'inventory.reconcile',
  'exports.read',
  'system.manage',
];

export const TEST_ME = {
  ...TEST_USER,
  permissions: TEST_PERMISSIONS,
};

export function seedRefreshToken(token: string | null = TEST_REFRESH_TOKEN): void {
  if (token) {
    window.sessionStorage.setItem(REFRESH_TOKEN_KEY, token);
  } else {
    window.sessionStorage.removeItem(REFRESH_TOKEN_KEY);
  }
}

export function readSeededRefreshToken(): string | null {
  return window.sessionStorage.getItem(REFRESH_TOKEN_KEY);
}

export interface AuthStubOptions {
  me?: typeof TEST_ME;
  loginStatus?: number;
  refreshStatus?: number;
  logoutStatus?: number;
  rotatedRefreshToken?: string;
  refreshedAccessToken?: string;
  /** Simula backend caído: fetch rechaza como en una red real. */
  networkError?: boolean;
  /** El refresh nunca resuelve (para observar el estado de carga). */
  pendingRefresh?: boolean;
  /** Tras N refresh exitosos, el backend empieza a responder 401. */
  refreshFailAfter?: number;
  /** Status para endpoints no registrados (por defecto 404). */
  unknownStatus?: number;
}

export interface RecordedCall {
  url: string;
  method: string;
  headers: Record<string, string>;
  body?: unknown;
}

function jsonResponse(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'content-type': 'application/json' },
  });
}

/**
 * Stub del contrato real de autenticación (backend congelado dcf09b5):
 * login / refresh / me / logout. Cualquier otra URL responde 404.
 */
export function stubAuthBackend(options: AuthStubOptions = {}) {
  const {
    me = TEST_ME,
    loginStatus = 200,
    refreshStatus = 200,
    logoutStatus = 200,
    rotatedRefreshToken = ROTATED_REFRESH_TOKEN,
    refreshedAccessToken = REFRESHED_ACCESS_TOKEN,
    networkError = false,
    pendingRefresh = false,
    refreshFailAfter,
    unknownStatus = 404,
  } = options;

  const calls: RecordedCall[] = [];
  let refreshCount = 0;

  const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const url =
      typeof input === 'string'
        ? input
        : input instanceof URL
          ? input.href
          : (input as Request).url;
    const method = (init?.method ?? 'GET').toUpperCase();
    const headers = { ...(init?.headers as Record<string, string> | undefined) };
    const body = typeof init?.body === 'string' ? (JSON.parse(init.body) as unknown) : undefined;
    calls.push({ url, method, headers, body });

    if (networkError) throw new TypeError('Failed to fetch');

    if (url.endsWith('/auth/login')) {
      if (loginStatus !== 200) return jsonResponse({ detail: 'Credenciales invalidas' }, 401);
      return jsonResponse({
        access_token: TEST_ACCESS_TOKEN,
        refresh_token: TEST_REFRESH_TOKEN,
        expires_in: 900,
        token_type: 'bearer',
        user: me,
      });
    }

    if (url.endsWith('/auth/refresh')) {
      if (pendingRefresh) return new Promise<Response>(() => undefined);
      refreshCount += 1;
      if (refreshFailAfter !== undefined && refreshCount > refreshFailAfter) {
        return jsonResponse({ detail: 'Sesion invalida' }, 401);
      }
      if (refreshStatus !== 200) return jsonResponse({ detail: 'Sesion invalida' }, 401);
      return jsonResponse({
        access_token: refreshedAccessToken,
        refresh_token: rotatedRefreshToken,
        expires_in: 900,
        token_type: 'bearer',
      });
    }

    if (url.endsWith('/auth/me')) {
      return jsonResponse(me);
    }

    if (url.endsWith('/auth/logout')) {
      if (logoutStatus !== 200) {
        return jsonResponse({ detail: 'No se pudo cerrar la sesion' }, 502);
      }
      return jsonResponse({ status: 'ok' });
    }

    return jsonResponse({ detail: 'Not found' }, unknownStatus);
  });

  vi.stubGlobal('fetch', fetchMock);
  return { fetchMock, calls };
}

/** App completa (auth + toasts + rutas) dentro de un router de memoria. */
export function renderApp(initialPath = '/app/dashboard', options: { strict?: boolean } = {}) {
  const tree = (
    <MemoryRouter initialEntries={[initialPath]}>
      <App />
    </MemoryRouter>
  );
  return render(options.strict ? <StrictMode>{tree}</StrictMode> : tree);
}

export function renderWithRouter(ui: ReactElement, initialPath = '/') {
  return render(<MemoryRouter initialEntries={[initialPath]}>{ui}</MemoryRouter>);
}
