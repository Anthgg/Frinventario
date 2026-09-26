import { screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import {
  readSeededRefreshToken,
  renderApp,
  seedRefreshToken,
  stubAuthBackend,
  TEST_ME,
} from './helpers';

describe('restauración de sesión (F5)', () => {
  it('sessionStorage -> refresh -> /auth/me -> autenticado', async () => {
    seedRefreshToken();
    const { calls } = stubAuthBackend();

    renderApp('/app/dashboard');

    expect(await screen.findByRole('heading', { name: 'Dashboard' })).toBeInTheDocument();

    const refreshCall = calls.find((call) => call.url.endsWith('/auth/refresh'));
    expect(refreshCall?.body).toEqual({ refresh_token: 'refresh-token-test' });

    const meCall = calls.find((call) => call.url.endsWith('/auth/me'));
    expect(meCall?.headers.Authorization).toBe('Bearer access-token-refreshed');

    // Rotación aplicada en el arranque.
    expect(readSeededRefreshToken()).toBe('refresh-token-rotated');
    expect(screen.getAllByText(TEST_ME.display_name).length).toBeGreaterThan(0);
  });

  it('sin refresh token en sessionStorage no pide nada y muestra login', async () => {
    seedRefreshToken(null);
    const { fetchMock } = stubAuthBackend();

    renderApp('/app/dashboard');

    expect(await screen.findByRole('heading', { name: 'Iniciar sesión' })).toBeInTheDocument();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('refresh 401: limpia storage, queda anónimo y va al login', async () => {
    seedRefreshToken('refresh-vencido');
    const { fetchMock } = stubAuthBackend({ refreshStatus: 401 });

    renderApp('/app/dashboard');

    expect(await screen.findByRole('heading', { name: 'Iniciar sesión' })).toBeInTheDocument();
    expect(readSeededRefreshToken()).toBeNull();
    expect(fetchMock.mock.calls.every((call) => !String(call[0]).endsWith('/auth/me'))).toBe(true);
  });

  it('sin conexión durante el bootstrap: anónimo y conserva el refresh token', async () => {
    seedRefreshToken();
    stubAuthBackend({ networkError: true });

    renderApp('/app/dashboard');

    expect(await screen.findByRole('heading', { name: 'Iniciar sesión' })).toBeInTheDocument();
    expect(screen.getByText(/no se pudo conectar con el servidor/i)).toBeInTheDocument();
    expect(readSeededRefreshToken()).toBe('refresh-token-test');
  });

  it('con <StrictMode> el bootstrap no queda colgado (doble montaje del efecto)', async () => {
    seedRefreshToken();
    stubAuthBackend();

    renderApp('/app/dashboard', { strict: true });

    expect(await screen.findByRole('heading', { name: 'Dashboard' })).toBeInTheDocument();
    expect(screen.getAllByText(TEST_ME.display_name).length).toBeGreaterThan(0);
  });
});
