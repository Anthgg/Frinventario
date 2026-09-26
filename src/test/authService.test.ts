import { afterEach, describe, expect, it, vi } from 'vitest';
import { ApiError } from '@/api/errors';
import { getAccessToken, setAccessToken } from '@/api/client';
import { loginWithCredentials, logoutRemote, SESSION_UNAVAILABLE_MESSAGE } from '@/auth/authService';
import { clearTokens, readRefreshToken } from '@/auth/tokenStorage';
import { refreshSession } from '@/auth/refreshController';
import {
  REFRESH_TOKEN_KEY,
  seedRefreshToken,
  TEST_ACCESS_TOKEN,
  TEST_REFRESH_TOKEN,
  TEST_ME,
} from './helpers';

function jsonResponse(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'content-type': 'application/json' },
  });
}

interface Call {
  url: string;
  method: string;
  headers: Record<string, string>;
  body?: unknown;
}

function stub(fetchImpl: (call: Call) => Response | Promise<Response>): Call[] {
  const calls: Call[] = [];
  vi.stubGlobal(
    'fetch',
    vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = typeof input === 'string' ? input : (input as Request).url;
      const call: Call = {
        url,
        method: (init?.method ?? 'GET').toUpperCase(),
        headers: { ...(init?.headers as Record<string, string> | undefined) },
        body: typeof init?.body === 'string' ? JSON.parse(init.body) : undefined,
      };
      calls.push(call);
      return fetchImpl(call);
    }),
  );
  return calls;
}

afterEach(() => {
  clearTokens();
});

describe('authService.loginWithCredentials', () => {
  it('POST /auth/login con credenciales y luego GET /auth/me con bearer', async () => {
    const calls = stub((call) =>
      call.url.endsWith('/auth/login')
        ? jsonResponse({
            access_token: TEST_ACCESS_TOKEN,
            refresh_token: TEST_REFRESH_TOKEN,
            expires_in: 900,
            token_type: 'bearer',
            user: { id: 'otro', email: 'x@y.z', display_name: 'x', is_active: true, roles: [] },
          })
        : jsonResponse(TEST_ME),
    );

    const me = await loginWithCredentials('tester@dedalo.local', 'secreto');

    expect(calls[0]).toMatchObject({
      method: 'POST',
      body: { email: 'tester@dedalo.local', password: 'secreto' },
    });
    expect(calls[0]!.headers.Authorization).toBeUndefined();
    expect(calls[1]!.url).toMatch(/\/auth\/me$/);
    expect(calls[1]!.method).toBe('GET');
    expect(calls[1]!.headers.Authorization).toBe(`Bearer ${TEST_ACCESS_TOKEN}`);

    // La identidad oficial viene de /auth/me, no de login.user.
    expect(me.permissions).toEqual(TEST_ME.permissions);
    expect(me.roles).toEqual(TEST_ME.roles);
    expect(getAccessToken()).toBe(TEST_ACCESS_TOKEN);
    expect(readRefreshToken()).toBe(TEST_REFRESH_TOKEN);
  });

  it('credenciales inválidas: 401 sin tocar el storage', async () => {
    stub(() => jsonResponse({ detail: 'Credenciales invalidas' }, 401));

    const error = await loginWithCredentials('a@b.c', 'mala').catch((e: unknown) => e);

    expect(error).toBeInstanceOf(ApiError);
    expect((error as ApiError).status).toBe(401);
    expect(readRefreshToken()).toBeNull();
    expect(getAccessToken()).toBeNull();
  });

  it('sin backend: NETWORK_ERROR (nunca se confunde con credenciales)', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new TypeError('Failed to fetch')));

    const error = await loginWithCredentials('a@b.c', 'ok').catch((e: unknown) => e);

    expect((error as ApiError).code).toBe('NETWORK_ERROR');
    expect((error as ApiError).status).toBe(0);
  });

  it('usuario desactivado: /auth/me 403 con mensaje de sesión no disponible', async () => {
    stub((call) =>
      call.url.endsWith('/auth/login')
        ? jsonResponse({
            access_token: TEST_ACCESS_TOKEN,
            refresh_token: TEST_REFRESH_TOKEN,
            expires_in: 900,
            token_type: 'bearer',
            user: TEST_ME,
          })
        : jsonResponse({ ...TEST_ME, is_active: false }, 200),
    );

    const error = await loginWithCredentials('a@b.c', 'ok').catch((e: unknown) => e);

    expect((error as ApiError).message).toBe(SESSION_UNAVAILABLE_MESSAGE);
    expect(readRefreshToken()).toBeNull();
    expect(getAccessToken()).toBeNull();
  });
});

describe('refresh con rotación', () => {
  it('reemplaza el refresh token anterior y devuelve el nuevo access token', async () => {
    seedRefreshToken('refresh-origen');
    const calls = stub(() =>
      jsonResponse({
        access_token: 'access-nuevo',
        refresh_token: 'refresh-nuevo',
        expires_in: 900,
        token_type: 'bearer',
      }),
    );

    const outcome = await refreshSession();

    expect(outcome).toEqual({ status: 'ok', accessToken: 'access-nuevo' });
    expect(calls[0]!.body).toEqual({ refresh_token: 'refresh-origen' });
    expect(window.sessionStorage.getItem(REFRESH_TOKEN_KEY)).toBe('refresh-nuevo');
    expect(getAccessToken()).toBe('access-nuevo');
  });

  it('refresh 401: limpia storage y no deja tokens huérfanos', async () => {
    seedRefreshToken('refresh-vencido');
    setAccessToken('access-vencido');
    stub(() => jsonResponse({ detail: 'Sesion invalida' }, 401));

    const outcome = await refreshSession();

    expect(outcome.status).toBe('expired');
    expect(readRefreshToken()).toBeNull();
    expect(getAccessToken()).toBeNull();
  });

  it('sin refresh token almacenado no llama a la API', async () => {
    seedRefreshToken(null);
    const calls = stub(() => jsonResponse({}));

    const outcome = await refreshSession();

    expect(outcome.status).toBe('expired');
    expect(calls).toHaveLength(0);
  });
});

describe('logout real', () => {
  it('POST /auth/logout con el access token vigente', async () => {
    setAccessToken(TEST_ACCESS_TOKEN);
    const calls = stub(() => jsonResponse({ status: 'ok' }));

    await logoutRemote();

    expect(calls[0]).toMatchObject({ method: 'POST' });
    expect(calls[0]!.url).toMatch(/\/auth\/logout$/);
    expect(calls[0]!.headers.Authorization).toBe(`Bearer ${TEST_ACCESS_TOKEN}`);
  });

  it('502 del backend: la sesión local NO se limpia (la UI ofrece reintento)', async () => {
    setAccessToken(TEST_ACCESS_TOKEN);
    seedRefreshToken();
    stub(() => jsonResponse({ detail: 'No se pudo cerrar la sesion' }, 502));

    const error = await logoutRemote().catch((e: unknown) => e);

    expect((error as ApiError).status).toBe(502);
    expect(readRefreshToken()).toBe(TEST_REFRESH_TOKEN);
    expect(getAccessToken()).toBe(TEST_ACCESS_TOKEN);
  });
});
