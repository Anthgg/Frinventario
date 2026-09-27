import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { renderApp, seedRefreshToken, stubAuthBackend } from './helpers';

describe('404', () => {
  it('muestra la página NotFound en rutas desconocidas', async () => {
    seedRefreshToken(null);
    renderApp('/ruta-que-no-existe');

    expect(await screen.findByText(/404 — fuera del laberinto/)).toBeInTheDocument();
    expect(
      screen.getByText(/la ruta que pediste no existe en esta versión/i),
    ).toBeInTheDocument();
  });

  it('el 404 público permite volver al dashboard', async () => {
    seedRefreshToken(null);
    const user = userEvent.setup();
    renderApp('/ruta-que-no-existe');

    await user.click(await screen.findByRole('link', { name: /volver al dashboard/i }));

    expect(await screen.findByRole('heading', { name: 'Iniciar sesión' })).toBeInTheDocument();
  });

  it('las rutas internas de /app también tienen 404 con la barra visible', async () => {
    stubAuthBackend();
    seedRefreshToken();
    renderApp('/app/desconocida');

    expect(await screen.findByText(/404 — fuera del laberinto/)).toBeInTheDocument();
    expect(screen.getByRole('navigation', { name: /ubicación/i })).toHaveTextContent(
      'Página no encontrada',
    );
    expect(screen.getByRole('navigation', { name: /navegación principal$/i })).toBeInTheDocument();
  });
});
