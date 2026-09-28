import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { renderApp, seedRefreshToken, stubAuthBackend, TEST_ME } from './helpers';

function seedAuthenticated(): void {
  stubAuthBackend();
  seedRefreshToken();
}

describe('AppLayout', () => {
  it('muestra barra lateral, topbar y contenido', async () => {
    seedAuthenticated();
    renderApp('/app/dashboard');

    const nav = await screen.findByRole('navigation', { name: /navegación principal$/i });
    expect(nav).toBeInTheDocument();
    expect(
      await screen.findByRole('heading', { name: 'Dashboard', level: 1 }),
    ).toBeInTheDocument();
    expect(screen.getByRole('main')).toBeInTheDocument();
    // FF002: la barra global de UI_MOCK ya no existe; el dashboard consume el backend.
    expect(screen.queryByText('UI_MOCK')).not.toBeInTheDocument();
  });

  it('identidad real en la cabecera: display_name y rol, sin IDs internos', async () => {
    seedAuthenticated();
    renderApp('/app/dashboard');

    expect(await screen.findByRole('heading', { name: 'Dashboard', level: 1 })).toBeInTheDocument();
    expect(screen.getAllByText(TEST_ME.display_name).length).toBeGreaterThan(0);
    expect(screen.getAllByText('Supervisor').length).toBeGreaterThan(0);
    expect(screen.queryByText(/operador demo/i)).not.toBeInTheDocument();
    expect(screen.queryByText(TEST_ME.id)).not.toBeInTheDocument();
    expect(screen.queryByText(/sesión demo/i)).not.toBeInTheDocument();
  });

  it('marca la ruta activa con aria-current', async () => {
    seedAuthenticated();
    renderApp('/app/inventarios');

    const link = await screen.findByRole('link', { name: 'Inventarios' });
    expect(link).toHaveAttribute('aria-current', 'page');
  });

  it('enlaza todas las secciones concedidas por /auth/me', async () => {
    seedAuthenticated();
    renderApp('/app/dashboard');

    const nav = await screen.findByRole('navigation', { name: /navegación principal$/i });
    for (const label of [
      'Dashboard',
      'Inventarios',
      'Conteo',
      'Reconteos',
      'Conciliación',
      'Documentos',
      'Configuración',
    ]) {
      expect(within(nav).getByRole('link', { name: label })).toBeInTheDocument();
    }
  });

  it('oculta secciones cuyo permiso /auth/me no concedió', async () => {
    stubAuthBackend({ me: { ...TEST_ME, permissions: ['inventory.read'] } });
    seedRefreshToken();
    renderApp('/app/dashboard');

    const nav = await screen.findByRole('navigation', { name: /navegación principal$/i });
    expect(within(nav).getByRole('link', { name: 'Inventarios' })).toBeInTheDocument();
    expect(within(nav).queryByRole('link', { name: 'Configuración' })).not.toBeInTheDocument();
    expect(within(nav).queryByRole('link', { name: 'Documentos' })).not.toBeInTheDocument();
    expect(within(nav).queryByRole('link', { name: 'Conteo' })).not.toBeInTheDocument();
  });

  it('ofrece enlace para saltar al contenido', async () => {
    seedAuthenticated();
    renderApp('/app/dashboard');

    expect(await screen.findByRole('link', { name: /saltar al contenido/i })).toHaveAttribute(
      'href',
      '#contenido',
    );
  });
});

describe('navegación mobile', () => {
  it('renderiza la barra inferior con los destinos primarios', async () => {
    seedAuthenticated();
    renderApp('/app/dashboard');

    const bottom = await screen.findByRole('navigation', {
      name: /navegación principal \(móvil\)/i,
    });
    expect(within(bottom).getByRole('link', { name: 'Inicio' })).toBeInTheDocument();
    expect(within(bottom).getByRole('link', { name: 'Campañas' })).toBeInTheDocument();
    expect(within(bottom).getByRole('link', { name: 'Conteo' })).toBeInTheDocument();
    expect(within(bottom).getByRole('button', { name: 'Más' })).toBeInTheDocument();
  });

  it('el botón Más abre el cajón con el resto de secciones', async () => {
    seedAuthenticated();
    const user = userEvent.setup();
    renderApp('/app/dashboard');

    const bottom = await screen.findByRole('navigation', {
      name: /navegación principal \(móvil\)/i,
    });
    await user.click(within(bottom).getByRole('button', { name: 'Más' }));

    const dialog = await screen.findByRole('dialog', { name: /más secciones/i });
    expect(within(dialog).getByRole('link', { name: 'Documentos' })).toBeInTheDocument();
    expect(within(dialog).getByRole('link', { name: 'Configuración' })).toBeInTheDocument();
  });

  it('asocia la descripción del cajón y devuelve el foco al activador tras Escape', async () => {
    seedAuthenticated();
    const user = userEvent.setup();
    renderApp('/app/dashboard');

    await screen.findByRole('heading', { name: 'Dashboard', level: 1 });
    const trigger = screen.getByRole('button', { name: 'Abrir más secciones' });
    await user.click(trigger);

    const dialog = await screen.findByRole('dialog', { name: 'Más secciones' });
    const descriptionId = dialog.getAttribute('aria-describedby');
    expect(descriptionId).toBeTruthy();
    expect(document.getElementById(descriptionId!)).toHaveTextContent(
      'Operación y control fuera de la barra principal.',
    );

    await user.keyboard('{Escape}');

    expect(await screen.findByRole('heading', { name: 'Dashboard', level: 1 })).toBeInTheDocument();
    expect(trigger).toHaveFocus();
  });

  it('desde el cajón se puede navegar a una sección', async () => {
    seedAuthenticated();
    const user = userEvent.setup();
    renderApp('/app/dashboard');

    const bottom = await screen.findByRole('navigation', {
      name: /navegación principal \(móvil\)/i,
    });
    await user.click(within(bottom).getByRole('button', { name: 'Más' }));
    const dialog = await screen.findByRole('dialog', { name: /más secciones/i });

    await user.click(within(dialog).getByRole('link', { name: 'Configuración' }));

    expect(await screen.findByRole('heading', { name: 'Configuración', level: 1 })).toBeInTheDocument();
  });
});
