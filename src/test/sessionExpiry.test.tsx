import { screen, render } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { describe, expect, it } from 'vitest';
import { apiClient } from '@/api/client';
import { AuthProvider } from '@/auth/AuthProvider';
import { RequireAuth } from '@/auth/guards';
import { LoginPage } from '@/features/auth/LoginPage';
import { readSeededRefreshToken, seedRefreshToken, stubAuthBackend } from './helpers';

function Probe() {
  const [state, setState] = useState('listo');
  return (
    <button
      type="button"
      onClick={() => {
        setState('pidiendo');
        void apiClient
          .get('/inventory/campaigns')
          .then(() => setState('ok'))
          .catch((error: unknown) => setState(`fallo-${(error as { status?: number }).status}`));
      }}
    >
      {state}
    </button>
  );
}

function renderExpiryHarness() {
  return render(
    <MemoryRouter initialEntries={['/privado']}>
      <AuthProvider>
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route
            path="/privado"
            element={
              <RequireAuth>
                <Probe />
              </RequireAuth>
            }
          />
        </Routes>
      </AuthProvider>
    </MemoryRouter>,
  );
}

describe('expiración de sesión en uso', () => {
  it('refresh definitivo: limpia sesión, redirige y avisa UNA vez', async () => {
    seedRefreshToken();
    stubAuthBackend({ refreshFailAfter: 1, unknownStatus: 401 });
    const user = userEvent.setup();
    renderExpiryHarness();

    const probe = await screen.findByRole('button', { name: 'listo' });
    await user.click(probe);

    expect(await screen.findByRole('heading', { name: 'Iniciar sesión' })).toBeInTheDocument();
    expect(screen.getByText('Tu sesión ha expirado.')).toBeInTheDocument();
    expect(screen.getByText('Inicia sesión nuevamente.')).toBeInTheDocument();
    expect(readSeededRefreshToken()).toBeNull();

    // Sin loops: la página de login queda estable.
    expect(screen.getAllByText('Tu sesión ha expirado.')).toHaveLength(1);
  });

  it('segundo 401 tras el retry termina la sesión sin refrescar en bucle', async () => {
    seedRefreshToken();
    const { calls } = stubAuthBackend({ unknownStatus: 401 });
    const user = userEvent.setup();
    renderExpiryHarness();

    const probe = await screen.findByRole('button', { name: 'listo' });
    await user.click(probe);

    expect(await screen.findByRole('heading', { name: 'Iniciar sesión' })).toBeInTheDocument();
    expect(screen.getByText('Tu sesión ha expirado.')).toBeInTheDocument();

    const refreshCalls = calls.filter((call) => call.url.endsWith('/auth/refresh'));
    // 1 del bootstrap + 1 del reintento. No 5, no bucle.
    expect(refreshCalls).toHaveLength(2);
    expect(readSeededRefreshToken()).toBeNull();
  });

  it('el aviso de expiración desaparece al iniciar sesión de nuevo', async () => {
    seedRefreshToken();
    stubAuthBackend({ refreshFailAfter: 1, unknownStatus: 401 });
    const user = userEvent.setup();
    renderExpiryHarness();

    await user.click(await screen.findByRole('button', { name: 'listo' }));
    await screen.findByText('Tu sesión ha expirado.');

    await user.type(screen.getByLabelText(/correo/i), 'tester@dedalo.local');
    await user.type(screen.getByLabelText(/^contraseña$/i), 'secreto');
    await user.click(screen.getByRole('button', { name: /ingresar/i }));

    expect(screen.queryByText('Tu sesión ha expirado.')).not.toBeInTheDocument();
  });
});
