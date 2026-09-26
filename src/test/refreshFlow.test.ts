import { describe, expect, it, vi } from 'vitest';
import { ApiClient, getAccessToken, setApiAuthHandler } from '@/api/client';
import { refreshSession } from '@/auth/refreshController';
import { readSeededRefreshToken, seedRefreshToken } from './helpers';

function jsonResponse(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'content-type': 'application/json' },
  });
}

interface Harness {
  client: ApiClient;
  state: { refreshCalls: number; expired: number; protectedCalls: number };
}

interface HarnessOptions {
  /** Si el reintento con el token nuevo sigue sin ser válido (segundo 401). */
  protectedOkAfterRefresh?: boolean;
  /** /auth/refresh falla por red en lugar de responder. */
  refreshNetworkError?: boolean;
  /** /auth/refresh responde 401 (token vencido del cuerpo). */
  refreshRejects?: boolean;
}

function setupApi(options: HarnessOptions = {}): Harness {
  const {
    protectedOkAfterRefresh = true,
    refreshNetworkError = false,
    refreshRejects = false,
  } = options;
  const state = { refreshCalls: 0, expired: 0, protectedCalls: 0 };

  vi.stubGlobal(
    'fetch',
    vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = typeof input === 'string' ? input : (input as Request).url;
      const headers = { ...(init?.headers as Record<string, string> | undefined) };

      if (url.endsWith('/auth/refresh')) {
        state.refreshCalls += 1;
        if (refreshNetworkError) throw new TypeError('Failed to fetch');
        if (refreshRejects) return jsonResponse({ detail: 'Sesion invalida' }, 401);
        return jsonResponse({
          access_token: 'access-nuevo',
          refresh_token: 'refresh-nuevo',
          expires_in: 900,
          token_type: 'bearer',
        });
      }

      state.protectedCalls += 1;
      if (headers.Authorization === 'Bearer access-nuevo' && protectedOkAfterRefresh) {
        return jsonResponse({ ok: true });
      }
      return jsonResponse({ detail: 'Token expirado' }, 401);
    }),
  );

  setApiAuthHandler({
    getAccessToken,
    refreshAccessToken: refreshSession,
    onSessionExpired: () => {
      state.expired += 1;
    },
  });

  seedRefreshToken('refresh-origen');
  return { client: new ApiClient('/api/v1'), state };
}

describe('401 -> refresh -> retry', () => {
  it('reintenta UNA sola vez tras un refresh exitoso', async () => {
    const { client, state } = setupApi();

    const result = await client.get<{ ok: boolean }>('/inventory/campaigns');

    expect(result).toEqual({ ok: true });
    expect(state.refreshCalls).toBe(1);
    expect(state.expired).toBe(0);
    expect(state.protectedCalls).toBe(2); // 401 + reintento
    expect(readSeededRefreshToken()).toBe('refresh-nuevo');
  });

  it('SINGLE-FLIGHT: 6 requests 401 comparten UN solo refresh', async () => {
    const { client, state } = setupApi();

    const results = await Promise.all(
      Array.from({ length: 6 }, () => client.get<{ ok: boolean }>('/inventory/campaigns')),
    );

    expect(results).toHaveLength(6);
    expect(results.every((item) => item.ok)).toBe(true);
    expect(state.refreshCalls).toBe(1); // no 6
    expect(state.expired).toBe(0);
  });

  it('segundo 401 tras el refresh termina la sesión: sin bucles', async () => {
    const { client, state } = setupApi({ protectedOkAfterRefresh: false });

    const error = await client.get('/inventory/campaigns').catch((caught: unknown) => caught);

    expect(error).toMatchObject({ name: 'ApiError', status: 401 });
    expect(state.refreshCalls).toBe(1);
    expect(state.expired).toBe(1);
    expect(state.protectedCalls).toBe(2); // inicial + retry, nada más
  });

  it('si el refresh no está disponible no se destruye la sesión', async () => {
    const { client, state } = setupApi({ refreshNetworkError: true });

    const error = await client.get('/inventory/campaigns').catch((caught: unknown) => caught);

    expect(error).toMatchObject({ status: 401 });
    expect(state.refreshCalls).toBe(1);
    expect(state.expired).toBe(0);
    expect(state.protectedCalls).toBe(1); // sin reintento
    expect(readSeededRefreshToken()).toBe('refresh-origen');
  });
});

describe('sin refresh sobre rutas de auth', () => {
  it('un 401 de /auth/login no dispara refresh ni cierra sesión', async () => {
    const { client, state } = setupApi();

    const error = await client
      .post('/auth/login', { email: 'a@b.c', password: 'x' })
      .catch((caught: unknown) => caught);

    expect(error).toMatchObject({ status: 401 });
    expect(state.refreshCalls).toBe(0);
    expect(state.expired).toBe(0);
  });

  it('un 401 de /auth/refresh no se refresca a sí mismo', async () => {
    const { client, state } = setupApi({ refreshRejects: true });

    const error = await client
      .post('/auth/refresh', { refresh_token: 'vencido' })
      .catch((caught: unknown) => caught);

    expect(error).toMatchObject({ status: 401 });
    expect(state.refreshCalls).toBe(1); // solo la llamada directa, sin anidamiento
    expect(state.expired).toBe(0);
  });
});
