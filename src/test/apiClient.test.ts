import { afterEach, describe, expect, it, vi } from 'vitest';
import { ApiClient, joinUrl, resolveBaseUrl, setAccessToken } from '@/api/client';
import { ApiError } from '@/api/errors';

describe('resolveBaseUrl (env)', () => {
  it('usa VITE_API_BASE_URL cuando existe', () => {
    expect(
      resolveBaseUrl({
        VITE_API_BASE_URL: 'https://api.ejemplo.com/api/v1/',
        VITE_API_URL: 'http://localhost:8000',
      }),
    ).toBe('https://api.ejemplo.com/api/v1');
  });

  it('compone VITE_API_URL + VITE_API_PREFIX', () => {
    expect(
      resolveBaseUrl({ VITE_API_URL: 'http://localhost:8000', VITE_API_PREFIX: '/api/v1' }),
    ).toBe('http://localhost:8000/api/v1');
  });

  it('sin variables cae al prefijo por defecto', () => {
    expect(resolveBaseUrl({})).toBe('/api/v1');
  });

  it('no duplica barras', () => {
    expect(joinUrl('/api/v1/', '/auth/login')).toBe('/api/v1/auth/login');
    expect(joinUrl('https://host', 'auth/me')).toBe('https://host/auth/me');
  });
});

describe('ApiClient', () => {
  afterEach(() => {
    setAccessToken(null);
    vi.unstubAllGlobals();
  });

  function stubFetch(payload: unknown, status = 200) {
    const mock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify(payload), {
        status,
        headers: { 'content-type': 'application/json' },
      }),
    );
    vi.stubGlobal('fetch', mock);
    return mock;
  }

  it('respeta la base URL inyectada y el prefijo del endpoint', async () => {
    const fetchMock = stubFetch({ status: 'ok' });
    const client = new ApiClient('http://localhost:8000/api/v1');

    await client.get('/health');

    expect(fetchMock).toHaveBeenCalledWith(
      'http://localhost:8000/api/v1/health',
      expect.objectContaining({ method: 'GET' }),
    );
  });

  it('adjunta el token de sesión como bearer', async () => {
    const fetchMock = stubFetch({});
    setAccessToken('token-123');
    const client = new ApiClient('/api/v1');

    await client.get('/auth/me');

    const [, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect((init.headers as Record<string, string>).Authorization).toBe('Bearer token-123');
  });

  it('convierte respuestas fallidas en ApiError normalizado', async () => {
    stubFetch({ detail: 'No autorizado' }, 401);
    const client = new ApiClient('/api/v1');

    await expect(client.get('/auth/me')).rejects.toMatchObject({
      name: 'ApiError',
      status: 401,
      code: 'UNAUTHORIZED',
      message: 'No autorizado',
    });
  });

  it('sin connectivity lanza NETWORK_ERROR (sin stack al usuario)', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new TypeError('Failed to fetch')));
    const client = new ApiClient('/api/v1');

    const error = await client.get('/auth/me').catch((caught: unknown) => caught);
    expect(error).toBeInstanceOf(ApiError);
    expect((error as ApiError).code).toBe('NETWORK_ERROR');
  });
});
