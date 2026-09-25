import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { renderApp, seedSession } from './helpers';

describe('AppLayout', () => {
  it('muestra barra lateral, topbar y contenido', async () => {
    seedSession();
    renderApp('/app/dashboard');

    const nav = await screen.findByRole('navigation', { name: /navegación principal$/i });
    expect(nav).toBeInTheDocument();
    expect(
      await screen.findByRole('heading', { name: 'Dashboard', level: 1 }),
    ).toBeInTheDocument();
    expect(screen.getByRole('main')).toBeInTheDocument();
    expect(screen.getAllByText('UI_MOCK').length).toBeGreaterThan(0);
  });

  it('marca la ruta activa con aria-current', async () => {
    seedSession();
    renderApp('/app/inventarios');

    const link = await screen.findByRole('link', { name: 'Inventarios' });
    expect(link).toHaveAttribute('aria-current', 'page');
  });

  it('enlaza todas las secciones del sistema', async () => {
    seedSession();
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

  it('ofrece enlace para saltar al contenido', async () => {
    seedSession();
    renderApp('/app/dashboard');

    expect(await screen.findByRole('link', { name: /saltar al contenido/i })).toHaveAttribute(
      'href',
      '#contenido',
    );
  });
});

describe('navegación mobile', () => {
  it('renderiza la barra inferior con los destinos primarios', async () => {
    seedSession();
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
    seedSession();
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

  it('desde el cajón se puede navegar a una sección', async () => {
    seedSession();
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
