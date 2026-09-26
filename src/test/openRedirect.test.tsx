import { screen, render } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { LoginPage } from '@/features/auth/LoginPage';
import { AuthProvider } from '@/auth/AuthProvider';
import { sanitizeReturnTo, isSafeReturnUrl } from '@/auth/returnUrl';
import { renderApp, seedRefreshToken, stubAuthBackend } from './helpers';

describe('sanitizeReturnTo (anti open-redirect)', () => {
  it('rechaza destinos externos', () => {
    expect(sanitizeReturnTo('https://evil.example')).toBe('/app/dashboard');
    expect(sanitizeReturnTo('http://evil.example/path')).toBe('/app/dashboard');
    expect(sanitizeReturnTo('//evil.example')).toBe('/app/dashboard');
    expect(sanitizeReturnTo('/\\evil.example')).toBe('/app/dashboard');
    expect(sanitizeReturnTo('javascript:alert(1)')).toBe('/app/dashboard');
    expect(sanitizeReturnTo('/https:evil.example')).toBe('/app/dashboard');
  });

  it('rechaza valores no navegables', () => {
    expect(sanitizeReturnTo(undefined)).toBe('/app/dashboard');
    expect(sanitizeReturnTo(null)).toBe('/app/dashboard');
    expect(sanitizeReturnTo(42)).toBe('/app/dashboard');
    expect(sanitizeReturnTo('')).toBe('/app/dashboard');
    expect(sanitizeReturnTo('app/dashboard')).toBe('/app/dashboard');
    expect(sanitizeReturnTo('/login')).toBe('/app/dashboard');
  });

  it('acepta rutas internas', () => {
    expect(sanitizeReturnTo('/app/documentos')).toBe('/app/documentos');
    expect(sanitizeReturnTo('/app/inventarios?tab=resumen')).toBe(
      '/app/inventarios?tab=resumen',
    );
    expect(isSafeReturnUrl('/app/conteo/ses-001')).toBe(true);
    expect(isSafeReturnUrl('//evil')).toBe(false);
  });
});

describe('navegación con returnUrl', () => {
  it('preserva la ruta interna solicitada y vuelve a ella tras el login', async () => {
    stubAuthBackend();
    seedRefreshToken(null);
    const user = userEvent.setup();
    renderApp('/app/documentos');

    expect(await screen.findByRole('heading', { name: 'Iniciar sesión' })).toBeInTheDocument();

    await user.type(screen.getByLabelText(/correo/i), 'tester@dedalo.local');
    await user.type(screen.getByLabelText(/^contraseña$/i), 'secreto');
    await user.click(screen.getByRole('button', { name: /ingresar/i }));

    expect(await screen.findByRole('heading', { name: 'Documentos', level: 1 })).toBeInTheDocument();
  });

  it('un returnUrl externo nunca navega fuera de la aplicación', async () => {
    stubAuthBackend();
    seedRefreshToken(null);
    const user = userEvent.setup();

    render(
      <MemoryRouter
        initialEntries={[{ pathname: '/login', state: { from: 'https://evil.example' } }]}
      >
        <AuthProvider>
          <Routes>
            <Route path="/login" element={<LoginPage />} />
            <Route path="/app/dashboard" element={<p>dashboard seguro</p>} />
            <Route path="*" element={<p>ruta inesperada</p>} />
          </Routes>
        </AuthProvider>
      </MemoryRouter>,
    );

    await screen.findByRole('heading', { name: 'Iniciar sesión' });
    await user.type(screen.getByLabelText(/correo/i), 'tester@dedalo.local');
    await user.type(screen.getByLabelText(/^contraseña$/i), 'secreto');
    await user.click(screen.getByRole('button', { name: /ingresar/i }));

    expect(await screen.findByText('dashboard seguro')).toBeInTheDocument();
    expect(screen.queryByText('ruta inesperada')).not.toBeInTheDocument();
  });

  it('ya autenticado en /login redirige al dashboard', async () => {
    stubAuthBackend();
    seedRefreshToken();
    renderApp('/login');

    expect(await screen.findByRole('heading', { name: 'Dashboard' })).toBeInTheDocument();
  });
});
