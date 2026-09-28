import { act, renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { countingApi, type CountEvent, type CountSession } from '@/api/counting';
import { toLocalItems, type LocalItem } from '@/features/conteo/countModel';
import { useCountSession } from '@/features/conteo/useCountSession';

vi.mock('@/api/counting', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/api/counting')>();
  return {
    ...actual,
    countingApi: {
      ...actual.countingApi,
      getSession: vi.fn(),
      getItems: vi.fn(),
      getEvents: vi.fn(),
      postEvent: vi.fn(),
      postBatch: vi.fn(),
      undo: vi.fn(),
      finishCheck: vi.fn(),
      submit: vi.fn(),
      start: vi.fn(),
    },
  };
});

const SESSION_ID = 'ses-queue';

function sessionPayload(overrides: Partial<CountSession> = {}): CountSession {
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

function productItem(): LocalItem {
  return toLocalItems([
    {
      kind: 'PRODUCT',
      product_id: 'prd-1',
      internal_reference: 'REF-1',
      name: 'Producto uno',
      quantity: '2.0000',
      damaged_quantity: '0.0000',
    },
  ])[0]!;
}

function makeEvent(overrides: Partial<CountEvent> = {}): CountEvent {
  return {
    event_id: `evt-${Math.random().toString(16).slice(2)}`,
    client_event_uuid: 'uuid-server',
    server_sequence: 3,
    product_id: 'prd-1',
    event_type: 'MANUAL_ADD',
    quantity: '1.0000',
    previous_quantity: '2.0000',
    resulting_quantity: '3.0000',
    damage_delta_quantity: null,
    previous_damaged_quantity: null,
    resulting_damaged_quantity: null,
    scanned_code: 'REF-1',
    occurred_at: '2026-09-27T10:06:00Z',
    received_at: '2026-09-27T10:06:01Z',
    reverses_event_id: null,
    already_processed: false,
    ...overrides,
  };
}

beforeEach(() => {
  vi.mocked(countingApi.getSession).mockResolvedValue(sessionPayload());
  vi.mocked(countingApi.getItems).mockResolvedValue([]);
  vi.mocked(countingApi.getEvents).mockResolvedValue({
    session_id: SESSION_ID,
    limit: 200,
    offset: 0,
    items: [],
  });
  vi.mocked(countingApi.postEvent).mockResolvedValue(makeEvent());
  vi.mocked(countingApi.postBatch).mockResolvedValue({ processed: 0, items: [] });
  vi.mocked(countingApi.undo).mockResolvedValue(makeEvent({ event_type: 'UNDO' }));
});

function renderCount() {
  return renderHook(() => useCountSession({ sessionId: SESSION_ID }));
}

describe('cola de eventos de conteo', () => {
  it('el escaneo QR nunca envía quantity (el backend decide +1)', async () => {
    const view = renderCount();
    await waitFor(() => expect(view.result.current.loading).toBe(false));

    act(() => view.result.current.scanCodes(['REF-1']));

    await waitFor(() => expect(countingApi.postEvent).toHaveBeenCalledTimes(1));
    const body = vi.mocked(countingApi.postEvent).mock.calls[0]![1];

    expect(body.event_type).toBe('QR_SCAN');
    expect(body.scanned_code).toBe('REF-1');
    expect(body.source).toBe('CAMERA');
    expect('quantity' in body).toBe(false);
    expect(body.client_event_uuid).toBeTruthy();
  });

  it('varios QR en el mismo frame salen como lote MULTI_QR_SCAN con UUIDs distintos', async () => {
    const view = renderCount();
    await waitFor(() => expect(view.result.current.loading).toBe(false));

    act(() => view.result.current.scanCodes(['REF-1', 'REF-2', 'REF-3']));

    await waitFor(() => expect(countingApi.postBatch).toHaveBeenCalledTimes(1));
    const body = vi.mocked(countingApi.postBatch).mock.calls[0]![1];
    const uuids = body.events.map((event) => event.client_event_uuid);

    expect(body.events).toHaveLength(3);
    expect(body.events.every((event) => event.event_type === 'MULTI_QR_SCAN')).toBe(true);
    expect(new Set(uuids).size).toBe(3);
    expect(countingApi.postEvent).not.toHaveBeenCalled();
  });

  it('las ráfagas de "+" salen en serie y conservan el orden', async () => {
    const pending: Array<() => void> = [];
    vi.mocked(countingApi.postEvent).mockImplementation(
      () =>
        new Promise((resolve) => {
          pending.push(() => resolve(makeEvent()));
        }),
    );

    const view = renderCount();
    await waitFor(() => expect(view.result.current.loading).toBe(false));
    const item = productItem();

    act(() => {
      view.result.current.addOne(item);
      view.result.current.addOne(item);
      view.result.current.addOne(item);
    });

    // Solo la primera sale: nada de requests paralelas.
    expect(countingApi.postEvent).toHaveBeenCalledTimes(1);

    await act(async () => {
      pending.shift()?.();
      await Promise.resolve();
    });
    await waitFor(() => expect(countingApi.postEvent).toHaveBeenCalledTimes(2));

    await act(async () => {
      pending.shift()?.();
      await Promise.resolve();
    });
    await waitFor(() => expect(countingApi.postEvent).toHaveBeenCalledTimes(3));

    await act(async () => {
      pending.shift()?.();
      await Promise.resolve();
    });
    await waitFor(() => expect(view.result.current.queued).toBe(0));

    const uuids = vi
      .mocked(countingApi.postEvent)
      .mock.calls.map((call) => call[1].client_event_uuid);
    expect(new Set(uuids).size).toBe(3);
    expect(view.result.current.saveState).toBe('saved');
  });

  it('tras un fallo reintenta con el MISMO UUID y jamás con otro', async () => {
    vi.mocked(countingApi.postEvent)
      .mockRejectedValueOnce(Object.assign(new TypeError('Failed to fetch'), { name: 'TypeError' }))
      .mockResolvedValueOnce(makeEvent());

    const view = renderCount();
    await waitFor(() => expect(view.result.current.loading).toBe(false));

    act(() => view.result.current.addOne(productItem()));

    await waitFor(() => expect(view.result.current.failure).not.toBeNull());
    expect(view.result.current.failure?.network).toBe(true);
    expect(view.result.current.saveState).toBe('offline');

    const firstUuid = vi.mocked(countingApi.postEvent).mock.calls[0]![1].client_event_uuid;

    act(() => view.result.current.retryFailure());

    await waitFor(() => expect(view.result.current.failure).toBeNull());
    expect(vi.mocked(countingApi.postEvent)).toHaveBeenCalledTimes(2);

    const secondUuid = vi.mocked(countingApi.postEvent).mock.calls[1]![1].client_event_uuid;
    expect(secondUuid).toBe(firstUuid);
    await waitFor(() => expect(view.result.current.saveState).toBe('saved'));
  });

  it('concilia un QR desconocido sin marcar error (lo clasifica el backend)', async () => {
    vi.mocked(countingApi.postEvent).mockResolvedValue(
      makeEvent({
        product_id: null,
        scanned_code: 'QR-RARO',
        event_type: 'QR_SCAN',
        previous_quantity: '0.0000',
        resulting_quantity: '1.0000',
      }),
    );

    const view = renderCount();
    await waitFor(() => expect(view.result.current.loading).toBe(false));

    act(() => view.result.current.scanCodes(['QR-RARO']));

    await waitFor(() => expect(view.result.current.events).toHaveLength(1));
    expect(view.result.current.failure).toBeNull();
    expect(view.result.current.items[0]?.key).toBe('code:QR-RARO');
    expect(view.result.current.items[0]?.quantity).toBe(1);
  });

  it('una sesión cancelada no acepta más eventos', async () => {
    vi.mocked(countingApi.getSession).mockResolvedValue(
      sessionPayload({ status: 'CANCELLED' }),
    );

    const view = renderCount();
    await waitFor(() => expect(view.result.current.loading).toBe(false));

    expect(view.result.current.interactive).toBe(false);
    act(() => view.result.current.addOne(productItem()));
    expect(countingApi.postEvent).not.toHaveBeenCalled();
  });

  it('deshacer llama al undo con un UUID nuevo para el evento elegido', async () => {
    const event = makeEvent({ event_id: 'evt-target', server_sequence: 7 });
    const view = renderCount();
    await waitFor(() => expect(view.result.current.loading).toBe(false));

    act(() => view.result.current.undo(event));

    await waitFor(() => expect(countingApi.undo).toHaveBeenCalledTimes(1));
    const [sessionId, eventId, uuid] = vi.mocked(countingApi.undo).mock.calls[0]!;

    expect(sessionId).toBe(SESSION_ID);
    expect(eventId).toBe('evt-target');
    expect(uuid).toMatch(/^[0-9a-f-]{36}$/i);
  });
});
