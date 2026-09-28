import { MemoryRouter, useLocation } from 'react-router-dom';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ApiError } from '@/api/errors';
import { countingApi } from '@/api/counting';
import { ToastProvider } from '@/components/ui/Toast';
import { StartCountButton } from '@/features/conteo/StartCountButton';

vi.mock('@/api/counting', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/api/counting')>();
  return { ...actual, countingApi: { ...actual.countingApi, start: vi.fn() } };
});

function Probe() {
  const location = useLocation();
  return <div data-testid="path">{location.pathname}</div>;
}

function buttonTree() {
  return (
    <MemoryRouter initialEntries={['/app/inventarios/cmp-1']}>
      <ToastProvider>
        <Probe />
        <StartCountButton campaignId="cmp-1" />
      </ToastProvider>
    </MemoryRouter>
  );
}

beforeEach(() => {
  vi.mocked(countingApi.start).mockResolvedValue({
    id: 'ses-nueva',
    campaign_id: 'cmp-1',
    assignment_id: 'asg-1',
    user_id: 'usr-test',
    session_number: 2,
    session_type: 'INITIAL',
    status: 'IN_PROGRESS',
    started_at: '2026-09-27T10:00:00Z',
    submitted_at: null,
    last_activity_at: '2026-09-27T10:05:00Z',
    version: 1,
    actual_units_registered: '0.0000',
    distinct_products_registered: 0,
    event_count: 0,
    already_started: true,
  });
});

describe('punto de entrada al conteo', () => {
  it('abre la sesión con start (idempotente) y navega al contador', async () => {
    const user = userEvent.setup();
    render(buttonTree());

    await user.click(screen.getByRole('button', { name: /Iniciar\/Continuar conteo/i }));

    expect(countingApi.start).toHaveBeenCalledWith('cmp-1');
    await waitFor(() =>
      expect(screen.getByTestId('path')).toHaveTextContent('/app/conteo/ses-nueva'),
    );
  });

  it('si el backend no permite abrir la sesión, no navega y avisa', async () => {
    vi.mocked(countingApi.start).mockRejectedValue(
      new ApiError(403, 'FORBIDDEN', 'No eres el responsable activo de esta campana'),
    );
    const user = userEvent.setup();
    render(buttonTree());

    await user.click(screen.getByRole('button', { name: /Iniciar\/Continuar conteo/i }));

    const toasts = await screen.findAllByText(/No pudimos abrir el conteo/i);
    expect(toasts.length).toBeGreaterThan(0);
    expect(screen.getByTestId('path')).toHaveTextContent('/app/inventarios/cmp-1');
  });
});