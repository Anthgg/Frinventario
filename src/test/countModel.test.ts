import { describe, expect, it } from 'vitest';
import type { CountEvent, CountItem } from '@/api/counting';
import {
  canUndo,
  displayQuantity,
  itemKey,
  manualRequest,
  parseQuantity,
  qrBatchRequest,
  qrRequest,
  reconcileLocalItems,
  summarizeEvent,
  toLocalItems,
} from '@/features/conteo/countModel';
import { toOperationalCode } from '@/features/conteo/qr/detector';

function productEvent(overrides: Partial<CountEvent> = {}): CountEvent {
  return {
    event_id: 'evt-1',
    client_event_uuid: 'uuid-1',
    server_sequence: 1,
    product_id: 'prd-1',
    event_type: 'QR_SCAN',
    quantity: '1.0000',
    previous_quantity: '0.0000',
    resulting_quantity: '1.0000',
    damage_delta_quantity: null,
    previous_damaged_quantity: null,
    resulting_damaged_quantity: null,
    scanned_code: 'REF-1',
    occurred_at: '2026-09-27T10:00:00Z',
    received_at: '2026-09-27T10:00:01Z',
    reverses_event_id: null,
    already_processed: false,
    ...overrides,
  };
}

function item(overrides: Partial<CountItem> = {}): CountItem {
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

describe('cantidades y conciliación', () => {
  it('lee las cantidades que el backend entrega como texto con 4 decimales', () => {
    expect(parseQuantity('12.0000')).toBe(12);
    expect(parseQuantity(null)).toBe(0);
    expect(parseQuantity('no-numerico')).toBe(0);
    expect(parseQuantity(3)).toBe(3);
  });

  it('aplica resulting_quantity del servidor en lugar de recalcular', () => {
    const local = toLocalItems([item({ quantity: '4.0000' })]);
    const reconciled = reconcileLocalItems(local, [
      productEvent({ previous_quantity: '4.0000', resulting_quantity: '9.0000' }),
    ]);

    expect(reconciled).toHaveLength(1);
    expect(reconciled[0]!.quantity).toBe(9);
  });

  it('crea el item cuando el evento llega antes que el refetch de items', () => {
    const reconciled = reconcileLocalItems([], [
      productEvent({ product_id: 'prd-9', scanned_code: 'REF-9' }),
    ]);

    expect(reconciled).toHaveLength(1);
    expect(reconciled[0]!.key).toBe('product:prd-9');
    expect(reconciled[0]!.quantity).toBe(1);
  });

  it('concilia por código los UNKNOWN (product_id nulo)', () => {
    const local = toLocalItems([
      item({ kind: 'UNKNOWN', product_id: null, internal_reference: 'QR-RARO', name: null }),
    ]);
    const reconciled = reconcileLocalItems(local, [
      productEvent({ product_id: null, scanned_code: 'QR-RARO' }),
    ]);

    expect(reconciled).toHaveLength(1);
    expect(reconciled[0]!.key).toBe('code:QR-RARO');
    expect(reconciled[0]!.quantity).toBe(1);
  });

  it('suma las intenciones pendientes sobre la cantidad confirmada', () => {
    const local = toLocalItems([item({ quantity: '5.0000' })])[0]!;
    expect(displayQuantity(local, 2)).toBe(7);
    expect(displayQuantity(local, -2)).toBe(3);
    expect(itemKey('prd-1', 'REF-1')).toBe('product:prd-1');
    expect(itemKey(null, 'QR-RARO')).toBe('code:QR-RARO');
  });
});

describe('intenciones de evento', () => {
  it('un escaneo QR jamás envía quantity (el backend decide +1)', () => {
    const request = qrRequest('REF-1', 'uuid-a');

    expect(request.event_type).toBe('QR_SCAN');
    expect(request.scanned_code).toBe('REF-1');
    expect(request).not.toHaveProperty('quantity');
    expect(request.source).toBe('CAMERA');
    expect(request.client_event_uuid).toBe('uuid-a');
  });

  it('multi-QR genera un evento por código con su propio UUID', () => {
    const requests = qrBatchRequest(['REF-1', 'REF-2'], ['u-1', 'u-2']);

    expect(requests).toHaveLength(2);
    expect(requests[0]!.event_type).toBe('MULTI_QR_SCAN');
    expect(requests[0]!.client_event_uuid).toBe('u-1');
    expect(requests[1]!.client_event_uuid).toBe('u-2');
  });

  it('las sumas/restas/ajustes manuales llevan product_id y cantidad', () => {
    const target = { productId: 'prd-1', internalReference: 'REF-1' };

    expect(manualRequest('MANUAL_ADD', target, 1, 'u-a')).toMatchObject({
      event_type: 'MANUAL_ADD',
      product_id: 'prd-1',
      quantity: 1,
      source: 'MANUAL',
    });
    expect(manualRequest('MANUAL_SUBTRACT', target, 2, 'u-b')).toMatchObject({
      event_type: 'MANUAL_SUBTRACT',
      quantity: 2,
    });
    expect(manualRequest('MANUAL_SET', target, 7, 'u-c')).toMatchObject({
      event_type: 'MANUAL_SET',
      quantity: 7,
    });
  });

  it('un item sin product_id usa el código interno (UNKNOWN)', () => {
    const request = manualRequest(
      'MANUAL_ADD',
      { productId: null, internalReference: 'QR-RARO' },
      1,
      'u-x',
    );

    expect(request.product_id).toBeUndefined();
    expect(request.scanned_code).toBe('QR-RARO');
  });
});

describe('undo y etiquetas', () => {
  it('solo permite deshacer el último evento efectivo del objetivo', () => {
    const first = productEvent({ event_id: 'evt-1', server_sequence: 1 });
    const second = productEvent({
      event_id: 'evt-2',
      server_sequence: 2,
      event_type: 'MANUAL_ADD',
      quantity: '1.0000',
      previous_quantity: '1.0000',
      resulting_quantity: '2.0000',
    });

    expect(canUndo(first, [first, second])).toBe(false);
    expect(canUndo(second, [first, second])).toBe(true);
  });

  it('el UNDO del backend y los eventos revertidos quedan fuera', () => {
    const target = productEvent({ event_id: 'evt-1' });
    const undo = productEvent({
      event_id: 'evt-2',
      event_type: 'UNDO',
      reverses_event_id: 'evt-1',
      product_id: 'prd-1',
    });
    const events = [target, undo];

    expect(canUndo(target, events)).toBe(false);
    expect(canUndo(undo, events)).toBe(false);
  });

  it('resume el evento con etiqueta legible y total resultante', () => {
    const events = [productEvent()];
    const summary = summarizeEvent(events[0]!, events);

    expect(summary.label).toBe('Escaneo QR');
    expect(summary.detail).toBe('+1');
    expect(summary.resulting).toBe(1);
    expect(summary.target).toBe('REF-1');
    expect(summary.reversible).toBe(true);
  });
});

describe('normalización de código QR', () => {
  it('deja solo el último segmento cuando el QR es una URL', () => {
    expect(toOperationalCode('https://inventario.local/p/REF-123')).toBe('REF-123');
    expect(toOperationalCode('REF-123')).toBe('REF-123');
    expect(toOperationalCode('  REF-456  ')).toBe('REF-456');
  });
});
