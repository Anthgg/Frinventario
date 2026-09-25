import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { ApiError } from '@/api/errors';
import { EmptyState, ErrorState } from '@/components/ui/State';
import { renderWithRouter } from './helpers';

describe('ErrorState', () => {
  it('muestra mensaje legible y código para un ApiError', () => {
    const error = ApiError.fromResponse(404, { detail: 'La campaña no existe' });

    renderWithRouter(<ErrorState error={error} />);

    const alert = screen.getByRole('alert');
    expect(alert).toHaveTextContent('La campaña no existe');
    expect(alert).toHaveTextContent('HTTP 404');
  });

  it('nunca muestra stack traces ni rutas internas', () => {
    const error = ApiError.fromResponse(500);

    renderWithRouter(<ErrorState error={error} />);

    const alert = screen.getByRole('alert');
    expect(alert).toHaveTextContent('Ocurrió un error en el servidor');
    expect(alert.textContent).not.toMatch(/\bat\s+\w+\.(tsx?|jsx?):\d+/);
    expect(alert.textContent).not.toContain('Error:');
  });

  it('ofrece reintento cuando se pasa onRetry', async () => {
    const onRetry = vi.fn();
    const user = userEvent.setup();

    renderWithRouter(<ErrorState error={ApiError.network()} onRetry={onRetry} />);
    await user.click(screen.getByRole('button', { name: /reintentar/i }));

    expect(onRetry).toHaveBeenCalledTimes(1);
  });

  it('describe el error genérico sin lanzar', () => {
    renderWithRouter(<ErrorState error={new Error('algo falló')} />);

    expect(screen.getByRole('alert')).toHaveTextContent('algo falló');
  });
});

describe('EmptyState', () => {
  it('explica el vacío y ofrece acción', () => {
    renderWithRouter(
      <EmptyState
        title="Sin campañas"
        description="Todavía no se han creado campañas."
        action={<button type="button">Crear campaña</button>}
      />,
    );

    expect(screen.getByText('Sin campañas')).toBeInTheDocument();
    expect(screen.getByText('Todavía no se han creado campañas.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Crear campaña' })).toBeInTheDocument();
  });
});
