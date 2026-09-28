import { apiClient } from './client';

/**
 * Módulo API de conteo (FF003) - espejo del contrato REAL
 * (app/api/counting.py + app/services/counting/*.py).
 *
 * Blind-safe: este módulo no declara ni traduce cantidades esperadas,
 * diferencias ni costos porque el backend jamás los devuelve al operador.
 */

export const COUNT_SESSION_STATUS_VALUES = [
  'PENDING',
  'IN_PROGRESS',
  'SUBMITTED',
  'CANCELLED',
] as const;
export type CountSessionStatus = (typeof COUNT_SESSION_STATUS_VALUES)[number];

export const COUNT_SESSION_TYPE_VALUES = [
  'INITIAL',
  'REASSIGNMENT',
  'RECOUNT',
  'SUPERVISOR_CHECK',
] as const;
export type CountSessionType = (typeof COUNT_SESSION_TYPE_VALUES)[number];

/** Tipos que el frontend puede ENVIAR (SUPPORTED_TYPES del backend). */
export const SENDABLE_EVENT_TYPES = [
  'QR_SCAN',
  'MULTI_QR_SCAN',
  'MANUAL_ADD',
  'MANUAL_SUBTRACT',
  'MANUAL_SET',
] as const;
export type SendableCountEventType = (typeof SENDABLE_EVENT_TYPES)[number];

/** Tipos que el backend puede DEVOLVER (incluye UNDO/damage de otras fases). */
export type CountEventType = SendableCountEventType | 'UNDO' | 'DAMAGE_ADD' | 'DAMAGE_SUBTRACT';

export type CountEventSource = 'CAMERA' | 'MANUAL' | 'OFFLINE_SYNC' | 'SYSTEM';

export type CountItemKind = 'PRODUCT' | 'UNKNOWN';

/** Sesión de conteo (GET /count-sessions/{id} y payload de start/submit). */
export interface CountSession {
  id: string;
  campaign_id: string;
  assignment_id: string | null;
  user_id: string;
  session_number: number;
  session_type: CountSessionType;
  status: CountSessionStatus;
  started_at: string | null;
  submitted_at: string | null;
  last_activity_at: string | null;
  version: number;
  /** Unidades registradas por el propio operador (SIEMPRE como texto). */
  actual_units_registered: string;
  distinct_products_registered: number;
  event_count: number;
}

/** POST /campaigns/{id}/count-sessions/start (idempotente). */
export interface StartCountSessionResponse extends CountSession {
  already_started: boolean;
}

/** POST /count-sessions/{id}/submit. */
export interface SubmitCountSessionResponse extends CountSession {
  already_submitted: boolean;
}

/**
 * GET /count-sessions/{id}/items (blind-safe).
 * `quantity` es el conteo ACTUAL registrado, nunca una expectativa.
 */
export interface CountItem {
  kind: CountItemKind;
  product_id: string | null;
  internal_reference: string | null;
  name: string | null;
  quantity: string;
  damaged_quantity: string;
}

/** Evento de conteo tal cual lo devuelve el backend. */
export interface CountEvent {
  event_id: string;
  client_event_uuid: string;
  server_sequence: number;
  product_id: string | null;
  event_type: CountEventType;
  quantity: string | null;
  previous_quantity: string | null;
  resulting_quantity: string | null;
  damage_delta_quantity: string | null;
  previous_damaged_quantity: string | null;
  resulting_damaged_quantity: string | null;
  scanned_code: string | null;
  occurred_at: string | null;
  received_at: string | null;
  reverses_event_id: string | null;
  already_processed: boolean;
}

export interface CountEventPage {
  session_id: string;
  limit: number;
  offset: number;
  items: CountEvent[];
}

/** Intención de evento: el UUID se genera ANTES del request y NO cambia en reintentos. */
export interface CountEventRequest {
  client_event_uuid: string;
  event_type: SendableCountEventType;
  scanned_code?: string;
  product_id?: string;
  quantity?: number;
  occurred_at?: string;
  source?: CountEventSource;
}

export interface CountBatchRequest {
  events: CountEventRequest[];
}

export interface CountBatchResponse {
  processed: number;
  items: CountEvent[];
}

export interface MissingProduct {
  product_id: string;
  internal_reference: string;
  name: string;
}

export interface FinishCheck {
  has_missing: boolean;
  missing_products: MissingProduct[];
}

export interface SubmitCountRequest {
  expected_version: number;
  confirm_missing: boolean;
}

/** Máximo de eventos por lote (MAX_BATCH_EVENTS del backend). */
export const MAX_BATCH_EVENTS = 100;

const BASE = '/inventory';
const ITEMS_PAGE_SIZE = 200;
const EVENTS_PAGE_SIZE = 500;

export const countingApi = {
  start(campaignId: string, signal?: AbortSignal): Promise<StartCountSessionResponse> {
    return apiClient.post<StartCountSessionResponse>(
      `${BASE}/campaigns/${campaignId}/count-sessions/start`,
      undefined,
      { signal },
    );
  },

  getSession(sessionId: string, signal?: AbortSignal): Promise<CountSession> {
    return apiClient.get<CountSession>(`${BASE}/count-sessions/${sessionId}`, { signal });
  },

  async getItems(sessionId: string, signal?: AbortSignal): Promise<CountItem[]> {
    const items: CountItem[] = [];
    let offset = 0;
    while (true) {
      const page = await apiClient.get<CountItem[]>(`${BASE}/count-sessions/${sessionId}/items`, {
        query: { limit: ITEMS_PAGE_SIZE, offset },
        signal,
      });
      items.push(...page);
      offset += page.length;
      if (page.length < ITEMS_PAGE_SIZE) return items;
    }
  },

  async getEvents(sessionId: string, signal?: AbortSignal): Promise<CountEventPage> {
    const items: CountEvent[] = [];
    let offset = 0;
    while (true) {
      const page = await apiClient.get<CountEventPage>(`${BASE}/count-sessions/${sessionId}/events`, {
        query: { limit: EVENTS_PAGE_SIZE, offset },
        signal,
      });
      items.push(...page.items);
      offset += page.items.length;
      if (page.items.length < EVENTS_PAGE_SIZE) {
        return { session_id: page.session_id, limit: items.length, offset: 0, items };
      }
    }
  },

  postEvent(sessionId: string, body: CountEventRequest): Promise<CountEvent> {
    return apiClient.post<CountEvent>(`${BASE}/count-sessions/${sessionId}/events`, body);
  },

  postBatch(sessionId: string, body: CountBatchRequest): Promise<CountBatchResponse> {
    return apiClient.post<CountBatchResponse>(`${BASE}/count-sessions/${sessionId}/events/batch`, body);
  },

  undo(sessionId: string, eventId: string, clientEventUuid: string): Promise<CountEvent> {
    return apiClient.post<CountEvent>(
      `${BASE}/count-sessions/${sessionId}/events/${eventId}/undo`,
      { client_event_uuid: clientEventUuid },
    );
  },

  finishCheck(sessionId: string, signal?: AbortSignal): Promise<FinishCheck> {
    return apiClient.get<FinishCheck>(`${BASE}/count-sessions/${sessionId}/finish-check`, { signal });
  },

  submit(sessionId: string, body: SubmitCountRequest): Promise<SubmitCountSessionResponse> {
    return apiClient.post<SubmitCountSessionResponse>(
      `${BASE}/count-sessions/${sessionId}/submit`,
      body,
    );
  },
};

/** UUID v4 para idempotencia. crypto.randomUUID en navegadores modernos. */
export function newClientEventUuid(): string {
  const cryptoRef = globalThis.crypto;
  if (cryptoRef && typeof cryptoRef.randomUUID === 'function') {
    return cryptoRef.randomUUID();
  }
  // Fallback solo si el entorno no expone randomUUID (nunca en browsers actuales).
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (char) => {
    const random = (Math.random() * 16) | 0;
    const value = char === 'x' ? random : (random & 0x3) | 0x8;
    return value.toString(16);
  });
}
