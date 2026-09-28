import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { renderApp, seedRefreshToken, stubAuthBackend, type StubRoute, type StubRouteContext } from './helpers';

const SESSION_ID = 'ses-ff003';
const SESSION_URL = `/inventory/count-sessions/${SESSION_ID}`;

function sessionPayload(overrides: Record<string, unknown> = {}) {
  return {
    id: SESSION_ID,
    campaign_id: 'cmp-1',
    assignment_id: 'asg-1',
    user_id: 'usr-test',
    session_number: 1,
    session_type: 'INITIAL',
    status: 'IN_PROGRESS',
    started_at: '2026-09-27T10:00:00Z',
    submitted_at: null,
    last_activity_at: '2026-09-27T10:05:00Z',
    version: 1,
    actual_units_registered: '2.0000',
    distinct_products_registered: 1,
    event_count: 2,
    ...overrides,
  };
}

function productItem(overrides: Record<string, unknown> = {}) {
  return {
    kind: 'PRODUCT',
    product_id: 'prd-1',
    internal_reference: 'REF-1',
    name: 'Producto uno',
    quantity: '2.0000',
    damaged_quantity: '0.0000',
    ...overrides,
  };
}

function eventPayload(overrides: Record<string, unknown> = {}) {
  return {
    event_id: 'evt-new',
    client_event_uuid: 'uuid-new',
    server_sequence: 3,
    product_id: 'prd-1',
    event_type: 'MANUAL_ADD',
    quantity: '1.0000',
    previous_quantity: '2.0000',
    resulting_quantity: '3.0000',
    damage_delta_quantity: null,
    previous_damaged_quantity: null,
    resulting_damaged_quantity: null,
    scanned_code: null,
    occurred_at: '2026-09-27T10:06:00Z',
    received_at: '2026-09-27T10:06:01Z',
    reverses_event_id: null,
    already_processed: false,
    ...overrides,
  };
}

interface RouteOverrides {
  items?: Partial<StubRoute>;
  events?: Partial<StubRoute>;
  finishCheck?: Partial<StubRoute>;
  submit?: Partial<StubRoute>;
  postEvent?: Partial<StubRoute>;
  session?: Partial<StubRoute>;
}

/** Rutas del contrato real de conteo, en el orden en que las resuelve el stub. */
function countRoutes(overrides: RouteOverrides = {}): StubRoute[] {
  return [
    {
      match: `${SESSION_URL}/items`,
      method: 'GET',
      body: [productItem()],
      ...overrides.items,
    },
    {
      match: `${SESSION_URL}/events`,
      method: 'GET',
      body: { session_id: SESSION_ID, limit: 200, offset: 0, items: [] },
      ...overrides.events,
    },
    {
      match: `${SESSION_URL}/finish-check`,
      method: 'GET',
      body: { has_missing: false, missing_products: [] },
      ...overrides.finishCheck,
    },
    {
      match: `${SESSION_URL}/submit`,
      method: 'POST',
      body: sessionPayload({ status: 'SUBMITTED', submitted_at: '2026-09-27T11:00:00Z' }),
      ...overrides.submit,
    },
    {
      match: `${SESSION_URL}/events/batch`,
      method: 'POST',
      body: { processed: 1, items: [eventPayload()] },
    },
    {
      match: `${SESSION_URL}/events`,
      method: 'POST',
      body: eventPayload(),
      ...overrides.postEvent,
    },
    { match: SESSION_URL, method: 'GET', body: sessionPayload(), ...overrides.session },
  ];
}

function start(path: string, overrides: RouteOverrides = {}) {
  const routes = countRoutes(overrides);
  seedRefreshToken();
  const stub = stubAuthBackend({ routes });
  const view = renderApp(path);
  return { ...stub, ...view };
}

function postEvents(stub: { calls: { method: string; url: string; body?: unknown }[] }) {
  return stub.calls.filter((call) => call.method === 'POST' && call.url.includes('/events'));
}

const COUNT_PATH = `/app/conteo/${SESSION_ID}`;

describe('sesión de conteo real', () => {
  it('carga sesión + items y registra una suma con UUID idempotente', async () => {
    const stub = start(COUNT_PATH, {
      postEvent: { body: eventPayload({ resulting_quantity: '5.0000' }) },
    });
    const user = userEvent.setup();

    expect((await screen.findAllByText('Producto uno')).length).toBeGreaterThan(0);

    await user.click(screen.getByRole('button', { name: 'Sumar una unidad' }));

    await waitFor(() => expect(postEvents(stub)).toHaveLength(1));
    const body = postEvents(stub)[0]!.body as Record<string, unknown>;

    expect(body).toMatchObject({
      event_type: 'MANUAL_ADD',
      product_id: 'prd-1',
      quantity: 1,
      source: 'MANUAL',
    });
    expect(String(body.client_event_uuid)).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i,
    );

    // Conciliación desde resulting_quantity del backend (5), no el óptimo local (3).
    await waitFor(() => expect(screen.getByTestId('focus-quantity')).toHaveTextContent('5'));
  });

  it('ante un fallo marca "Sin conexión" y reintenta con el MISMO UUID', async () => {
    const stub = start(COUNT_PATH, {
      postEvent: {
        body: (context: StubRouteContext) => {
          if (context.attempt === 0) throw new TypeError('Failed to fetch');
          return eventPayload();
        },
      },
    });
    const user = userEvent.setup();

    expect((await screen.findAllByText('Producto uno')).length).toBeGreaterThan(0);
    await user.click(screen.getByRole('button', { name: 'Sumar una unidad' }));

    expect((await screen.findAllByText(/Sin conexión con el servidor/i)).length).toBeGreaterThan(0);
    expect(document.querySelector('[data-state="offline"]')).not.toBeNull();

    const attempts = postEvents(stub);
    expect(attempts).toHaveLength(1);
    const firstUuid = (attempts[0]!.body as Record<string, unknown>).client_event_uuid;

    await user.click(screen.getByRole('button', { name: 'Reintentar' }));

    await waitFor(() => expect(postEvents(stub)).toHaveLength(2));
    const retry = postEvents(stub)[1]!.body as Record<string, unknown>;
    expect(retry.client_event_uuid).toBe(firstUuid);

    await waitFor(() => expect(document.querySelector('[data-state="saved"]')).not.toBeNull());
    expect(screen.queryAllByText(/Sin conexión con el servidor/i)).toHaveLength(0);
  });

  it('la sesión cancelada queda en solo lectura', async () => {
    start(COUNT_PATH, { session: { body: sessionPayload({ status: 'CANCELLED' }) } });

    expect((await screen.findAllByText('Producto uno')).length).toBeGreaterThan(0);
    expect((await screen.findAllByText(/Esta sesión fue cancelada/i)).length).toBeGreaterThan(0);

    expect(screen.getByRole('button', { name: 'Sumar una unidad' })).toBeDisabled();
    expect(screen.getByRole('button', { name: /Finalizar sesión/i })).toBeDisabled();
  });

  it('muestra los códigos desconocidos sin inventar descripción ni romper la vista', async () => {
    start(COUNT_PATH, {
      items: {
        body: [
          productItem(),
          {
            kind: 'UNKNOWN',
            product_id: null,
            internal_reference: 'QR-RARO',
            name: null,
            quantity: '1.0000',
            damaged_quantity: '0.0000',
          },
        ],
      },
    });

    expect(await screen.findByText('QR-RARO')).toBeInTheDocument();
    expect(screen.getAllByText('Desconocido').length).toBeGreaterThan(0);
    expect(screen.queryByText(/No se pudo guardar/i)).not.toBeInTheDocument();
  });

  it('finaliza con finish-check y envía expected_version + confirm_missing', async () => {
    const stub = start(COUNT_PATH, {
      finishCheck: {
        body: {
          has_missing: true,
          missing_products: [
            { product_id: 'prd-2', internal_reference: 'REF-2', name: 'Producto dos' },
          ],
        },
      },
    });
    const user = userEvent.setup();

    expect((await screen.findAllByText('Producto uno')).length).toBeGreaterThan(0);
    await user.click(screen.getByRole('button', { name: /Finalizar sesión/i }));

    expect((await screen.findAllByText(/Faltan 1 productos/i)).length).toBeGreaterThan(0);

    // Sin confirmación no se envía: el backend lo rechazaría igual.
    await user.click(screen.getByRole('button', { name: /Confirmar y enviar/i }));
    expect(
      stub.calls.some((call) => call.method === 'POST' && call.url.includes('/submit')),
    ).toBe(false);

    await user.click(screen.getByRole('checkbox'));
    await user.click(screen.getByRole('button', { name: /enviar conteo/i }));

    await waitFor(() =>
      expect(stub.calls.some((call) => call.method === 'POST' && call.url.includes('/submit'))).toBe(
        true,
      ),
    );
    const submit = stub.calls.find(
      (call) => call.method === 'POST' && call.url.includes('/submit'),
    );
    expect(submit?.body).toEqual({ expected_version: 1, confirm_missing: true });

    expect((await screen.findAllByText(/Conteo enviado/i)).length).toBeGreaterThan(0);
    expect((await screen.findAllByText(/Esta sesión ya fue enviada/i)).length).toBeGreaterThan(0);
  });
});
