import { screen } from '@testing-library/react';
import { Route, Routes } from 'react-router-dom';
import { describe, expect, it } from 'vitest';
import { AuthProvider } from '@/auth/AuthProvider';
import { RequireAuth, RequirePermission } from '@/auth/guards';
import { renderWithRouter, seedRefreshToken, stubAuthBackend, TEST_ME } from './helpers';

function seedAuthenticated(): void {
  stubAuthBackend();
  seedRefreshToken();
}

function GuardsTree() {
  return (
    <AuthProvider>
      <Routes>
        <Route path="/login" element={<p>pantalla de login</p>} />
        <Route
          path="/privado"
          element={
            <RequireAuth>
              <p>area privada</p>
            </RequireAuth>
          }
        />
        <Route
          path="/con-permiso"
          element={
            <RequirePermission permission="inventory.read">
              <p>modulo con permiso</p>
            </RequirePermission>
          }
        />
        <Route
          path="/sin-permiso"
          element={
            <RequirePermission permission="inventory.close">
              <p>modulo restringido</p>
            </RequirePermission>
          }
        />
        <Route
          path="/permiso-auxiliar"
          element={
            <RequirePermission anyOf={['inventory.approve', 'inventory.read']}>
              <p>modulo auxiliar</p>
            </RequirePermission>
          }
        />
      </Routes>
    </AuthProvider>
  );
}

describe('RequireAuth', () => {
  it('redirige al login sin sesión', async () => {
    seedRefreshToken(null);
    renderWithRouter(<GuardsTree />, '/privado');

    expect(await screen.findByText('pantalla de login')).toBeInTheDocument();
    expect(screen.queryByText('area privada')).not.toBeInTheDocument();
  });

  it('permite el paso con sesión restaurada (refresh + me)', async () => {
    seedAuthenticated();
    renderWithRouter(<GuardsTree />, '/privado');

    expect(await screen.findByText('area privada')).toBeInTheDocument();
  });

  it('muestra estado de carga mientras resuelve el bootstrap', () => {
    seedRefreshToken();
    stubAuthBackend({ pendingRefresh: true });

    renderWithRouter(<GuardsTree />, '/privado');

    expect(screen.getByRole('status')).toHaveTextContent(/cargando sesión/i);
    expect(screen.queryByText('pantalla de login')).not.toBeInTheDocument();
  });
});

describe('RequirePermission', () => {
  it('permite el módulo cuando /auth/me concedió el permiso', async () => {
    seedAuthenticated();
    renderWithRouter(<GuardsTree />, '/con-permiso');

    expect(await screen.findByText('modulo con permiso')).toBeInTheDocument();
  });

  it('muestra acceso restringido sin el permiso (403, no login)', async () => {
    seedAuthenticated();
    renderWithRouter(<GuardsTree />, '/sin-permiso');

    expect(await screen.findByRole('alert')).toHaveTextContent(/acceso restringido/i);
    expect(screen.queryByText('modulo restringido')).not.toBeInTheDocument();
    expect(screen.queryByText('pantalla de login')).not.toBeInTheDocument();
  });

  it('anyOf acepta cualquiera de la lista', async () => {
    seedAuthenticated();
    renderWithRouter(<GuardsTree />, '/permiso-auxiliar');

    expect(await screen.findByText('modulo auxiliar')).toBeInTheDocument();
  });

  it('sin sesión va al login antes de evaluar permisos', async () => {
    seedRefreshToken(null);
    renderWithRouter(<GuardsTree />, '/sin-permiso');

    expect(await screen.findByText('pantalla de login')).toBeInTheDocument();
  });

  it('una sesión sin permisos no pasa', async () => {
    stubAuthBackend({ me: { ...TEST_ME, permissions: [] } });
    seedRefreshToken();
    renderWithRouter(<GuardsTree />, '/con-permiso');

    expect(await screen.findByRole('alert')).toHaveTextContent(/acceso restringido/i);
  });
});
