import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import {
  renderApp,
  REFRESH_TOKEN_KEY,
  seedRefreshToken,
  stubAuthBackend,
  TEST_ACCESS_TOKEN,
} from './helpers';
import {
  inventoryRoutes,
  TEST_HISTORY,
  TEST_LOCATION,
  TEST_SOURCES,
  testCampaignDetail,
  testCampaignPage,
} from './inventoryFixtures';

describe('routing con sesión real', () => {
  it('redirige /app sin sesión hacia /login', async () => {
    seedRefreshToken(null);
    renderApp('/app/dashboard');

    expect(await screen.findByRole('heading', { name: 'Iniciar sesión' })).toBeInTheDocument();
  });

  it('la raíz lleva al dashboard de la sesión activa', async () => {
    stubAuthBackend();
    seedRefreshToken();
    renderApp('/');

    expect(await screen.findByRole('heading', { name: 'Dashboard' })).toBeInTheDocument();
  });

  it('ignora sesiones persistidas en localStorage (solo cuenta refresh en sessionStorage)', async () => {
    window.localStorage.setItem(
      'dedalo.auth.session',
      JSON.stringify({ user: { id: 'x' }, permissions: ['inventory.read'], demo: true }),
    );
    seedRefreshToken(null);
    renderApp('/app/dashboard');

    expect(await screen.findByRole('heading', { name: 'Iniciar sesión' })).toBeInTheDocument();
  });
});

describe('login real', () => {
  it('muestra el formulario y no ofrece acceso demo', async () => {
    seedRefreshToken(null);
    renderApp('/login');

    expect(await screen.findByRole('heading', { name: 'Iniciar sesión' })).toBeInTheDocument();
    expect(screen.getByLabelText(/correo/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/^contraseña$/i)).toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: /modo demostración/i }),
    ).not.toBeInTheDocument();
  });

  it('envía credenciales, confirma identidad con /auth/me y entra al dashboard', async () => {
    seedRefreshToken(null);
    const { calls } = stubAuthBackend();
    const user = userEvent.setup();
    renderApp('/login');

    await user.type(screen.getByLabelText(/correo/i), 'tester@dedalo.local');
    await user.type(screen.getByLabelText(/^contraseña$/i), 'secreto-correcto');
    await user.click(screen.getByRole('button', { name: /ingresar/i }));

    expect(await screen.findByRole('heading', { name: 'Dashboard' })).toBeInTheDocument();

    const loginCall = calls.find((call) => call.url.endsWith('/auth/login'));
    expect(loginCall).toMatchObject({
      method: 'POST',
      body: { email: 'tester@dedalo.local', password: 'secreto-correcto' },
    });

    // La identidad oficial siempre se confirma con /auth/me + bearer.
    const meCall = calls.find((call) => call.url.endsWith('/auth/me'));
    expect(meCall?.headers.Authorization).toBe(`Bearer ${TEST_ACCESS_TOKEN}`);

    // Ninguna petición de autenticación duplicada inesperada.
    const authCalls = calls.filter((call) => call.url.includes('/auth/'));
    expect(authCalls.length).toBe(2);

    // El access token jamás se persiste; solo el refresh token.
    expect(window.sessionStorage.getItem(REFRESH_TOKEN_KEY)).toBeTruthy();
    expect(window.sessionStorage.getItem('dedalo.auth.access')).toBeNull();
    expect(window.localStorage.length).toBe(0);
  });

  it('credenciales inválidas: mensaje genérico, sin enumerar usuarios', async () => {
    seedRefreshToken(null);
    stubAuthBackend({ loginStatus: 401 });
    const user = userEvent.setup();
    renderApp('/login');

    await user.type(screen.getByLabelText(/correo/i), 'alguien@empresa.com');
    await user.type(screen.getByLabelText(/^contraseña$/i), 'mal');
    await user.click(screen.getByRole('button', { name: /ingresar/i }));

    expect(await screen.findByText('Correo o contraseña incorrectos.')).toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: 'Dashboard' })).not.toBeInTheDocument();
    expect(screen.getByLabelText(/correo/i)).toHaveValue('alguien@empresa.com');
  });

  it('sin backend muestra error de conexión, no credenciales inválidas', async () => {
    seedRefreshToken(null);
    stubAuthBackend({ networkError: true });
    const user = userEvent.setup();
    renderApp('/login');

    await user.type(screen.getByLabelText(/correo/i), 'tester@dedalo.local');
    await user.type(screen.getByLabelText(/^contraseña$/i), 'secreto');
    await user.click(screen.getByRole('button', { name: /ingresar/i }));

    expect(await screen.findByText('No se pudo conectar con el servidor.')).toBeInTheDocument();
    expect(screen.queryByText(/incorrectos/i)).not.toBeInTheDocument();
  });

  it('valida campos vacíos sin llamar a la API', async () => {
    seedRefreshToken(null);
    const { fetchMock } = stubAuthBackend();
    const user = userEvent.setup();
    renderApp('/login');

    await user.click(screen.getByRole('button', { name: /ingresar/i }));

    expect(await screen.findByText('Ingresa tu correo.')).toBeInTheDocument();
    expect(screen.getByText('Ingresa tu contraseña.')).toBeInTheDocument();
    expect(fetchMock).not.toHaveBeenCalled();
  });
});

describe('logout real', () => {
  it('cierra en el servidor, limpia storage y vuelve al login', async () => {
    stubAuthBackend();
    seedRefreshToken();
    const user = userEvent.setup();
    renderApp('/app/dashboard');

    await screen.findByRole('heading', { name: 'Dashboard' });
    await user.click(screen.getAllByRole('button', { name: 'Cerrar sesión' })[0]!);

    expect(await screen.findByRole('heading', { name: 'Iniciar sesión' })).toBeInTheDocument();
    expect(window.sessionStorage.getItem(REFRESH_TOKEN_KEY)).toBeNull();
    expect(window.localStorage.length).toBe(0);
  });

  it('tras cerrar sesión, un render nuevo sigue anónimo (equivalente a F5)', async () => {
    stubAuthBackend();
    seedRefreshToken();
    const user = userEvent.setup();
    const first = renderApp('/app/dashboard');

    await screen.findByRole('heading', { name: 'Dashboard' });
    await user.click(screen.getAllByRole('button', { name: 'Cerrar sesión' })[0]!);
    await screen.findByRole('heading', { name: 'Iniciar sesión' });
    first.unmount();

    renderApp('/app/dashboard');

    expect(await screen.findByRole('heading', { name: 'Iniciar sesión' })).toBeInTheDocument();
  });

  it('si el backend responde 502 ofrece reintento y NO afirma sesión cerrada', async () => {
    stubAuthBackend({ logoutStatus: 502 });
    seedRefreshToken();
    const user = userEvent.setup();
    renderApp('/app/dashboard');

    await screen.findByRole('heading', { name: 'Dashboard' });
    await user.click(screen.getAllByRole('button', { name: 'Cerrar sesión' })[0]!);

    const alert = (await screen.findAllByRole('alert')).find((node) =>
      /no se pudo cerrar la sesión en el servidor/i.test(node.textContent ?? ''),
    );
    expect(alert).toBeDefined();
    expect(within(alert!).getByRole('button', { name: /reintentar/i })).toBeInTheDocument();
    // La sesión local sigue viva: no se muestra un login falso.
    expect(screen.queryByRole('heading', { name: 'Iniciar sesión' })).not.toBeInTheDocument();
    expect(window.sessionStorage.getItem(REFRESH_TOKEN_KEY)).toBeTruthy();
  });
});

const rutas: Array<[string, string]> = [
  ['/app/inventarios', 'Inventarios'],
  ['/app/inventarios/camp-001', 'Inventario almacén central'],
  ['/app/conteo/ses-001', 'Conteo'],
  ['/app/conteo/mock', 'Conteo'],
  ['/app/reconteos', 'Reconteos'],
  ['/app/conciliacion/camp-001', 'Conciliación'],
  ['/app/documentos', 'Documentos'],
  ['/app/configuracion', 'Configuración'],
];

describe('módulos con sesión', () => {
  it.each(rutas)('renderiza %s con sesión activa', async (path, heading) => {
    stubAuthBackend({
      routes: inventoryRoutes({
        list: testCampaignPage([testCampaignDetail({ id: 'camp-001' })]),
        detail: testCampaignDetail({ id: 'camp-001' }),
        locations: [TEST_LOCATION],
        myAssignments: [],
        history: TEST_HISTORY,
        sources: TEST_SOURCES,
      }),
    });
    seedRefreshToken();
    renderApp(path);

    expect(await screen.findByRole('heading', { name: heading, level: 1 })).toBeInTheDocument();
    expect(screen.queryByText(/página no encontrada/i)).not.toBeInTheDocument();
  });
});
