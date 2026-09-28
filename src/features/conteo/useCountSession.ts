import { useCallback, useEffect, useRef, useState } from 'react';
import { ApiError } from '@/api/errors';
import {
  countingApi,
  newClientEventUuid,
  type CountEvent,
  type CountEventRequest,
  type CountSession,
} from '@/api/counting';
import type { SaveState } from '@/components/layout/SaveIndicator';
import {
  manualRequest,
  qrBatchRequest,
  qrRequest,
  reconcileLocalItems,
  toLocalItems,
  type LocalItem,
} from './countModel';

/**
 * Motor de sesión de conteo (FF003).
 *
 * Garantías:
 * - UNA cola serial: los eventos salen en el orden en que el operador los hace
 *   (server_sequence es autoritativo en el backend).
 * - UUID de idempotencia generado ANTES del primer intento y JAMÁS cambiado en
 *   un reintento (misma intención ⇒ mismo UUID).
 * - Fallo de red ⇒ indicador "Sin conexión" + Reintentar con el MISMO UUID;
 *   nada se pierde ni se reenvía con otro identificador.
 * - Conciliación SIEMPRE desde `resulting_quantity` del backend: el frontend no
 *   recalcula cantidades.
 */

export interface CountFailure {
  uuid: string;
  label: string;
  message: string;
  code?: string;
  network: boolean;
}

interface QueueEntry {
  uuid: string;
  label: string;
  key: string | null;
  delta: number;
  send: () => Promise<CountEvent | CountEvent[]>;
}

export interface UseCountSessionResult {
  loading: boolean;
  loadError: unknown;
  session: CountSession | null;
  items: LocalItem[];
  events: CountEvent[];
  /** Suma de intenciones locales aún no confirmadas por el backend, por item. */
  pending: Record<string, number>;
  queued: number;
  saveState: SaveState;
  failure: CountFailure | null;
  sessionBlock: { message: string; code?: string } | null;
  lastScanned: string | null;
  /** true solo para sesiones abiertas que FF003 sabe operar. */
  interactive: boolean;
  addOne: (item: LocalItem) => void;
  subtractOne: (item: LocalItem) => void;
  setQuantity: (item: LocalItem, value: number) => void;
  scanCodes: (codes: string[]) => void;
  undo: (event: CountEvent) => void;
  retryFailure: () => void;
  dismissFailure: () => void;
  refresh: () => void;
  replaceSession: (session: CountSession) => void;
}

const TERMINAL_EVENT_ERROR_CODES = new Set([
  'SESSION_NOT_OPEN',
  'ASSIGNMENT_NOT_ACTIVE',
  'CAMPAIGN_EXPIRED',
  'CAMPAIGN_CLOSED',
  'CAMPAIGN_NOT_ACTIVE',
]);

function supportsLiveCount(session: CountSession): boolean {
  return (
    session.status === 'IN_PROGRESS' &&
    (session.session_type === 'INITIAL' || session.session_type === 'REASSIGNMENT')
  );
}

export interface UseCountSessionOptions {
  sessionId: string | undefined;
  enabled?: boolean;
}

const REFRESH_DEBOUNCE_MS = 350;

export function useCountSession({
  sessionId,
  enabled = true,
}: UseCountSessionOptions): UseCountSessionResult {
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<unknown>(null);
  const [session, setSession] = useState<CountSession | null>(null);
  const [items, setItems] = useState<LocalItem[]>([]);
  const [events, setEvents] = useState<CountEvent[]>([]);
  const [saveState, setSaveState] = useState<SaveState>('saved');
  const [failure, setFailure] = useState<CountFailure | null>(null);
  const [sessionBlock, setSessionBlock] = useState<{ message: string; code?: string } | null>(null);
  const [queued, setQueued] = useState(0);
  const [pending, setPending] = useState<Record<string, number>>({});
  const [lastScanned, setLastScanned] = useState<string | null>(null);
  const [reloadToken, setReloadToken] = useState(0);

  const queueRef = useRef<QueueEntry[]>([]);
  const failedRef = useRef<QueueEntry | null>(null);
  const failureRef = useRef<CountFailure | null>(null);
  const drainingRef = useRef(false);
  const itemsRef = useRef<LocalItem[]>([]);
  const eventsRef = useRef<CountEvent[]>([]);
  const mountedRef = useRef(true);
  const interactiveRef = useRef(false);
  const sessionBlockRef = useRef<{ message: string; code?: string } | null>(null);
  const loadedRef = useRef(false);
  const refreshTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      if (refreshTimerRef.current) clearTimeout(refreshTimerRef.current);
    };
  }, []);

  /** Única fuente de verdad del estado de la cola (evita estados desfasados). */
  const syncQueueState = useCallback((nextState?: SaveState) => {
    if (!mountedRef.current) return;
    setQueued(queueRef.current.length);
    const deltas: Record<string, number> = {};
    for (const entry of queueRef.current) {
      if (!entry.key) continue;
      deltas[entry.key] = (deltas[entry.key] ?? 0) + entry.delta;
    }
    setPending(deltas);
    if (nextState) setSaveState(nextState);
    else if (failureRef.current) setSaveState(failureRef.current.network ? 'offline' : 'error');
    else if (sessionBlockRef.current) setSaveState('error');
    else if (queueRef.current.length > 0) setSaveState('saving');
    else setSaveState('saved');
  }, []);

  const applyEvents = useCallback((incoming: CountEvent[]) => {
    if (incoming.length === 0) return;
    const nextItems = reconcileLocalItems(itemsRef.current, incoming);
    itemsRef.current = nextItems;
    if (mountedRef.current) setItems(nextItems);

    const known = new Map(eventsRef.current.map((event) => [event.event_id, event]));
    for (const event of incoming) known.set(event.event_id, event);
    const nextEvents = [...known.values()].sort((a, b) => a.server_sequence - b.server_sequence);
    eventsRef.current = nextEvents;
    if (mountedRef.current) setEvents(nextEvents);

    const scan = incoming.find(
      (event) => event.event_type === 'QR_SCAN' || event.event_type === 'MULTI_QR_SCAN',
    );
    if (scan?.scanned_code && mountedRef.current) setLastScanned(scan.scanned_code);
  }, []);

  const scheduleRefresh = useCallback(() => {
    if (refreshTimerRef.current) clearTimeout(refreshTimerRef.current);
    refreshTimerRef.current = setTimeout(() => {
      refreshTimerRef.current = null;
      setReloadToken((token) => token + 1);
    }, REFRESH_DEBOUNCE_MS);
  }, []);

  // Carga (y recarga) de sesión + items + historial.
  useEffect(() => {
    if (!sessionId || !enabled) return;
    const controller = new AbortController();
    let cancelled = false;
    if (!loadedRef.current) setLoading(true);

    void (async () => {
      try {
        const [nextSession, rawItems, page] = await Promise.all([
          countingApi.getSession(sessionId, controller.signal),
          countingApi.getItems(sessionId, controller.signal),
          countingApi.getEvents(sessionId, controller.signal),
        ]);
        if (cancelled) return;
        const local = toLocalItems(rawItems);
        const history = [...page.items].sort((a, b) => a.server_sequence - b.server_sequence);
        itemsRef.current = local;
        eventsRef.current = history;
        loadedRef.current = true;
        interactiveRef.current = !sessionBlockRef.current && supportsLiveCount(nextSession);
        setSession(nextSession);
        setItems(local);
        setEvents(history);
        setLoadError(null);
      } catch (error) {
        if (cancelled) return;
        setLoadError(error);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
      controller.abort();
    };
  }, [sessionId, enabled, reloadToken]);

  const drain = useCallback(async () => {
    if (drainingRef.current || !sessionId) return;
    drainingRef.current = true;
    try {
      while (queueRef.current.length > 0 && !failureRef.current) {
        const entry = queueRef.current[0];
        if (!entry) break;
        try {
          const result = await entry.send();
          if (!mountedRef.current) return;
          queueRef.current = queueRef.current.filter((item) => item.uuid !== entry.uuid);
          applyEvents(Array.isArray(result) ? result : [result]);
          syncQueueState();
        } catch (error) {
          if (!mountedRef.current) return;
          const apiError = ApiError.from(error);

          if (apiError.code === 'IDEMPOTENCY_CONFLICT') {
            // Mismo UUID ya aplicado en el servidor: no se reenvía nada, resync.
            queueRef.current = queueRef.current.filter((item) => item.uuid !== entry.uuid);
            syncQueueState();
            scheduleRefresh();
            continue;
          }

          if (apiError.code && TERMINAL_EVENT_ERROR_CODES.has(apiError.code)) {
            const block = {
              message: apiError.message,
              ...(apiError.code ? { code: apiError.code } : {}),
            };
            sessionBlockRef.current = block;
            interactiveRef.current = false;
            queueRef.current = [];
            failedRef.current = null;
            failureRef.current = null;
            setFailure(null);
            setSessionBlock(block);
            syncQueueState();
            scheduleRefresh();
            break;
          }

          const network = apiError.code === 'NETWORK_ERROR';
          const nextFailure: CountFailure = {
            uuid: entry.uuid,
            label: entry.label,
            message: apiError.message,
            network,
            ...(apiError.code ? { code: String(apiError.code) } : {}),
          };
          failedRef.current = entry;
          failureRef.current = nextFailure;
          setFailure(nextFailure);
          syncQueueState(network ? 'offline' : 'error');
          break;
        }
      }
      if (queueRef.current.length === 0 && !failureRef.current) syncQueueState();
    } finally {
      drainingRef.current = false;
    }
  }, [sessionId, applyEvents, scheduleRefresh, syncQueueState]);

  const enqueue = useCallback(
    (entry: QueueEntry) => {
      if (
        !mountedRef.current ||
        failureRef.current ||
        !interactiveRef.current
      ) return;
      queueRef.current = [...queueRef.current, entry];
      syncQueueState('saving');
      void drain();
    },
    [drain, syncQueueState],
  );

  const pushEvent = useCallback(
    (request: CountEventRequest, meta: { label: string; key: string | null; delta: number }) => {
      if (!sessionId) return;
      const uuid = request.client_event_uuid;
      enqueue({
        uuid,
        label: meta.label,
        key: meta.key,
        delta: meta.delta,
        send: () => countingApi.postEvent(sessionId, request),
      });
    },
    [enqueue, sessionId],
  );

  const addOne = useCallback(
    (item: LocalItem) => {
      pushEvent(manualRequest('MANUAL_ADD', item, 1, newClientEventUuid()), {
        label: `Sumar 1 a ${item.name ?? item.internalReference ?? 'ítem'}`,
        key: item.key,
        delta: 1,
      });
    },
    [pushEvent],
  );

  const subtractOne = useCallback(
    (item: LocalItem) => {
      pushEvent(manualRequest('MANUAL_SUBTRACT', item, 1, newClientEventUuid()), {
        label: `Restar 1 a ${item.name ?? item.internalReference ?? 'ítem'}`,
        key: item.key,
        delta: -1,
      });
    },
    [pushEvent],
  );

  const setQuantity = useCallback(
    (item: LocalItem, value: number) => {
      const target = Math.max(0, Math.trunc(value));
      if (target === item.quantity) return;
      pushEvent(manualRequest('MANUAL_SET', item, target, newClientEventUuid()), {
        label: `Fijar ${item.name ?? item.internalReference ?? 'ítem'} en ${target}`,
        key: item.key,
        delta: target - item.quantity,
      });
    },
    [pushEvent],
  );

  const scanCodes = useCallback(
    (codes: string[]) => {
      const firstCode = codes[0];
      if (!firstCode || !sessionId) return;
      if (codes.length === 1) {
        pushEvent(qrRequest(firstCode, newClientEventUuid()), {
          label: `Escanear ${firstCode}`,
          key: null,
          delta: 0,
        });
        return;
      }
      const uuids = codes.map(() => newClientEventUuid());
      const firstUuid = uuids[0];
      if (!firstUuid) return;
      const requests = qrBatchRequest(codes, uuids);
      enqueue({
        uuid: firstUuid,
        label: `Escanear ${codes.length} QR`,
        key: null,
        delta: 0,
        send: async () => {
          const response = await countingApi.postBatch(sessionId, { events: requests });
          return response.items;
        },
      });
    },
    [enqueue, pushEvent, sessionId],
  );

  const undo = useCallback(
    (event: CountEvent) => {
      if (!sessionId) return;
      const uuid = newClientEventUuid();
      const key = event.product_id
        ? `product:${event.product_id}`
        : event.scanned_code
          ? `code:${event.scanned_code}`
          : null;
      enqueue({
        uuid,
        label: `Deshacer evento #${event.server_sequence}`,
        key,
        delta: 0,
        send: () => countingApi.undo(sessionId, event.event_id, uuid),
      });
    },
    [enqueue, sessionId],
  );

  const retryFailure = useCallback(() => {
    const entry = failedRef.current;
    if (!entry) return;
    failedRef.current = null;
    failureRef.current = null;
    setFailure(null);
    // The failed entry remains at the queue head; retry it in place so its
    // optimistic delta is counted once and the UUID stays unchanged.
    syncQueueState('saving');
    void drain();
  }, [drain, syncQueueState]);

  const dismissFailure = useCallback(() => {
    const failed = failedRef.current;
    if (failed) queueRef.current = queueRef.current.filter((entry) => entry !== failed);
    failedRef.current = null;
    failureRef.current = null;
    setFailure(null);
    syncQueueState();
    if (queueRef.current.length > 0) void drain();
  }, [drain, syncQueueState]);

  const replaceSession = useCallback((next: CountSession) => {
    interactiveRef.current = !sessionBlockRef.current && supportsLiveCount(next);
    setSession(next);
  }, []);

  const refresh = useCallback(() => {
    if (refreshTimerRef.current) {
      clearTimeout(refreshTimerRef.current);
      refreshTimerRef.current = null;
    }
    setReloadToken((token) => token + 1);
  }, []);

  return {
    loading: !sessionId || loading,
    loadError,
    session,
    items,
    events,
    pending,
    queued,
    saveState,
    failure,
    sessionBlock,
    lastScanned,
    interactive: Boolean(session && !sessionBlock && supportsLiveCount(session)),
    addOne,
    subtractOne,
    setQuantity,
    scanCodes,
    undo,
    retryFailure,
    dismissFailure,
    refresh,
    replaceSession,
  };
}
