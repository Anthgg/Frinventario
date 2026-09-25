import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { renderApp, seedSession } from './helpers';

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
