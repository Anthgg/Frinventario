import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { renderApp, seedSession, TEST_SESSION } from './helpers';

describe('routing', () => {
  it('redirige /app sin sesión hacia /login', async () => {
    seedSession(null);
    renderApp('/app/dashboard');

    expect(await screen.findByRole('heading', { name: 'Iniciar sesión' })).toBeInTheDocument();
  });

  it('la raíz lleva al dashboard de la sesión activa', async () => {
    seedSession();
    renderApp('/');

    expect(await screen.findByRole('heading', { name: 'Dashboard' })).toBeInTheDocument();
  });

  it('ignora una sesión real persistida antes de FF001', async () => {
    seedSession({ ...TEST_SESSION, demo: false });
    renderApp('/app/dashboard');

    expect(await screen.findByRole('heading', { name: 'Iniciar sesión' })).toBeInTheDocument();
  });

  it('el login muestra el formulario y el acceso demo', () => {
    seedSession(null);
    renderApp('/login');

    expect(screen.getByLabelText(/correo/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/^contraseña$/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /modo demostración/i })).toBeInTheDocument();
  });

  it('la sesión demo entra y navega al dashboard', async () => {
    seedSession(null);
    const user = userEvent.setup();
    renderApp('/login');

    await user.click(screen.getByRole('button', { name: /modo demostración/i }));

    expect(await screen.findByRole('heading', { name: 'Dashboard' })).toBeInTheDocument();
  });

  it('el formulario usa sesión UI_MOCK y no envía credenciales a la API', async () => {
    seedSession(null);
    const fetchSpy = vi.spyOn(globalThis, 'fetch');
    const user = userEvent.setup();
    renderApp('/login');

    await user.type(screen.getByLabelText(/correo/i), 'mock@example.test');
    await user.type(screen.getByLabelText(/^contraseña$/i), 'not-a-real-secret');
    await user.click(screen.getByRole('button', { name: /ingresar/i }));

    expect(await screen.findByRole('heading', { name: 'Dashboard' })).toBeInTheDocument();
    expect(screen.getAllByText('Sesión demo · UI_MOCK')).not.toHaveLength(0);
    expect(fetchSpy).not.toHaveBeenCalled();

    await user.click(screen.getAllByRole('button', { name: 'Cerrar sesión' })[0]!);
    expect(await screen.findByRole('heading', { name: 'Iniciar sesión' })).toBeInTheDocument();
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  const rutas: Array<[string, string]> = [
    ['/app/inventarios', 'Inventarios'],
    ['/app/inventarios/camp-001', 'Almacén central — línea A'],
    ['/app/conteo/ses-001', 'Conteo'],
    ['/app/reconteos', 'Reconteos'],
    ['/app/conciliacion/camp-001', 'Conciliación'],
    ['/app/documentos', 'Documentos'],
    ['/app/configuracion', 'Configuración'],
  ];

  it.each(rutas)('renderiza %s con sesión activa', async (path, heading) => {
    seedSession();
    renderApp(path);

    expect(await screen.findByRole('heading', { name: heading, level: 1 })).toBeInTheDocument();
  });
});
