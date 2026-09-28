import type {
  CountEvent,
  CountEventRequest,
  CountItem,
  SendableCountEventType,
} from '@/api/counting';

/**
 * Modelo puro de conteo (FF003): cantidades, conciliación con el backend y
 * construcción de intenciones. Sin React y sin fetch para poder testearlo.
 *
 * BLIND-SAFE: aquí solo existen cantidades REGISTRADAS por el operador.
 * Nunca hay cantidades esperadas, diferencias ni costos (el contrato de
 * sesión/items/events no los trae).
 */

export interface LocalItem {
  key: string;
  kind: 'PRODUCT' | 'UNKNOWN';
  productId: string | null;
  internalReference: string | null;
  name: string | null;
  /** Cantidad ya confirmada por el backend. */
  quantity: number;
  damagedQuantity: number;
}

/** Backend entrega cantidades como texto con 4 decimales ("12.0000"). */
export function parseQuantity(raw: string | number | null | undefined): number {
  if (raw === null || raw === undefined) return 0;
  const value = typeof raw === 'number' ? raw : Number.parseFloat(raw);
  return Number.isFinite(value) ? value : 0;
}

export function formatQuantity(value: number): string {
  return String(Math.trunc(value));
}

/** Clave estable: producto conocido o código unknown (exactly one). */
export function itemKey(product_id: string | null, internalReference: string | null): string {
  return product_id ? `product:${product_id}` : `code:${internalReference ?? '?'}`;
}

export function toLocalItems(items: CountItem[]): LocalItem[] {
  return items.map((item) => ({
    key: itemKey(item.product_id, item.internal_reference),
    kind: item.kind,
    productId: item.product_id,
    internalReference: item.internal_reference,
    name: item.name,
    quantity: parseQuantity(item.quantity),
    damagedQuantity: parseQuantity(item.damaged_quantity),
  }));
}

function targetKeyOf(event: CountEvent): string | null {
  if (event.product_id) return `product:${event.product_id}`;
  if (event.scanned_code) return `code:${event.scanned_code}`;
  return null;
}

/**
 * Conciliación autoritativa: el backend devuelve `resulting_quantity`, así que
 * el frontend NO calcula nada, solo aplica lo que el servidor ya calculó.
 */
export function reconcileLocalItems(local: LocalItem[], events: CountEvent[]): LocalItem[] {
  if (events.length === 0) return local;
  const next = new Map(local.map((item) => [item.key, { ...item }]));

  for (const event of events) {
    if (event.event_type === 'DAMAGE_ADD' || event.event_type === 'DAMAGE_SUBTRACT') continue;
    const key = targetKeyOf(event);
    if (!key) continue;
    const resulting = event.resulting_quantity;
    if (resulting === null) continue;

    const current =
      next.get(key) ??
      ({
        key,
        kind: event.product_id ? 'PRODUCT' : 'UNKNOWN',
        productId: event.product_id,
        internalReference: event.scanned_code,
        name: null,
        quantity: 0,
        damagedQuantity: 0,
      } satisfies LocalItem);

    next.set(key, { ...current, quantity: parseQuantity(resulting) });
  }
  return [...next.values()];
}

/** Suma de intenciones aún no confirmadas por el servidor, por item. */
export function pendingDeltasBy(
  pending: ReadonlyArray<{ key: string | null; delta: number }>,
): Record<string, number> {
  const deltas: Record<string, number> = {};
  for (const entry of pending) {
    if (!entry.key) continue;
    deltas[entry.key] = (deltas[entry.key] ?? 0) + entry.delta;
  }
  return deltas;
}

export function displayQuantity(item: LocalItem, pendingDelta = 0): number {
  return Math.max(0, item.quantity + pendingDelta);
}

/* ------------------------------ intenciones ------------------------------- */

function baseRequest(uuid: string): Pick<CountEventRequest, 'client_event_uuid' | 'source'> {
  return { client_event_uuid: uuid, source: 'MANUAL' };
}

export function qrRequest(code: string, uuid: string): CountEventRequest {
  return { ...baseRequest(uuid), event_type: 'QR_SCAN', scanned_code: code, source: 'CAMERA' };
}

export function qrBatchRequest(codes: string[], uuids: string[]): CountEventRequest[] {
  return codes.flatMap((code, index) => {
    const uuid = uuids[index];
    if (!uuid) return [];
    return [{ client_event_uuid: uuid, event_type: 'MULTI_QR_SCAN', scanned_code: code, source: 'CAMERA' as const }];
  });
}

export function manualRequest(
  eventType: Extract<SendableCountEventType, 'MANUAL_ADD' | 'MANUAL_SUBTRACT' | 'MANUAL_SET'>,
  item: { productId: string | null; internalReference: string | null },
  quantity: number,
  uuid: string,
): CountEventRequest {
  const request: CountEventRequest = {
    ...baseRequest(uuid),
    event_type: eventType,
    quantity,
  };
  if (item.productId) request.product_id = item.productId;
  else if (item.internalReference) request.scanned_code = item.internalReference;
  return request;
}

/* --------------------------------- undo ----------------------------------- */

/**
 * Espejo de la regla del backend: solo el último evento efectivo del objetivo
 * puede deshacerse (los UNDO y los eventos ya revertidos quedan fuera).
 */
export function canUndo(event: CountEvent, events: CountEvent[]): boolean {
  if (event.event_type === 'UNDO') return false;
  if (event.reverses_event_id) return false;
  const reversedIds = new Set(
    events.filter((item) => item.reverses_event_id).map((item) => item.reverses_event_id),
  );
  if (reversedIds.has(event.event_id)) return false;

  const key = targetKeyOf(event);
  if (!key) return false;
  const isDamage = event.event_type === 'DAMAGE_ADD' || event.event_type === 'DAMAGE_SUBTRACT';
  const effective = events.filter((item) => {
    const itemKey = targetKeyOf(item);
    if (itemKey !== key) return false;
    if (item.event_type === 'UNDO') return false;
    if (reversedIds.has(item.event_id)) return false;
    const itemIsDamage = item.event_type === 'DAMAGE_ADD' || item.event_type === 'DAMAGE_SUBTRACT';
    return itemIsDamage === isDamage;
  });
  const last = effective[effective.length - 1];
  return last?.event_id === event.event_id;
}

/* ------------------------------- etiquetas -------------------------------- */

const EVENT_LABEL: Record<string, string> = {
  QR_SCAN: 'Escaneo QR',
  MULTI_QR_SCAN: 'Escaneo múltiple',
  MANUAL_ADD: 'Suma manual',
  MANUAL_SUBTRACT: 'Resta manual',
  MANUAL_SET: 'Ajuste manual',
  UNDO: 'Deshacer',
  DAMAGE_ADD: 'Daño registrado',
  DAMAGE_SUBTRACT: 'Daño corregido',
};

export interface EventSummary {
  id: string;
  label: string;
  target: string;
  detail: string;
  resulting: number | null;
  reversible: boolean;
  isUndo: boolean;
}

export function summarizeEvent(
  event: CountEvent,
  events: CountEvent[],
  lookup?: (key: string) => LocalItem | undefined,
): EventSummary {
  const key = targetKeyOf(event);
  const item = key && lookup ? lookup(key) : undefined;
  const target =
    item?.name ??
    item?.internalReference ??
    event.scanned_code ??
    (event.product_id ? event.product_id.slice(0, 8) : 'Sin producto');

  const delta = parseQuantity(event.quantity);
  let detail: string;
  if (event.event_type === 'QR_SCAN' || event.event_type === 'MULTI_QR_SCAN') {
    detail = '+1';
  } else if (event.event_type === 'MANUAL_SET') {
    detail = `fijado en ${formatQuantity(parseQuantity(event.resulting_quantity))}`;
  } else if (event.event_type === 'UNDO') {
    detail = 'reversa el evento anterior';
  } else {
    detail = `${delta > 0 ? '+' : ''}${formatQuantity(delta)}`;
  }

  return {
    id: event.event_id,
    label: EVENT_LABEL[event.event_type] ?? event.event_type,
    target,
    detail,
    resulting: event.resulting_quantity === null ? null : parseQuantity(event.resulting_quantity),
    reversible: canUndo(event, events),
    isUndo: event.event_type === 'UNDO',
  };
}
