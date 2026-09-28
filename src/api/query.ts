import { useCallback, useEffect, useRef, useState } from 'react';

/**
 * Estado remoto mínimo (FF002): caché por clave, deduplicación de requests,
 * refetch e invalidación por prefijo. Suficiente para listados paginados +
 * detalle, sin introducir una librería de query completa.
 *
 * Reglas:
 * - una clave = una request en vuelo (dos componentes comparten datos);
 * - el dato cacheado NO se borra mientras se refetchea (sin parpadeo de layout);
 * - un error no reintenta solo (evita bucles): el usuario pulsa "Reintentar".
 */

interface CacheEntry {
  data: unknown;
  error: unknown;
  updatedAt: number;
  invalid: boolean;
  promise: Promise<void> | null;
  fetcher: (() => Promise<unknown>) | null;
  /** Prefijo de "misma colección" para conservar el dato anterior al paginar. */
  prefix?: string;
}

const cache = new Map<string, CacheEntry>();
const listeners = new Map<string, Set<() => void>>();
const previousByPrefix = new Map<string, unknown>();

function entryOf(key: string): CacheEntry {
  let entry = cache.get(key);
  if (!entry) {
    entry = {
      data: undefined,
      error: undefined,
      updatedAt: 0,
      invalid: false,
      promise: null,
      fetcher: null,
    };
    cache.set(key, entry);
  }
  return entry;
}

function notify(key: string): void {
  const set = listeners.get(key);
  if (set) for (const listener of set) listener();
}

function run(key: string): Promise<void> {
  const entry = entryOf(key);
  if (entry.promise) return entry.promise;
  const fetcher = entry.fetcher;
  if (!fetcher) return Promise.resolve();

  entry.promise = fetcher().then(
    (data) => {
      entry.data = data;
      entry.error = undefined;
      entry.updatedAt = Date.now();
      entry.invalid = false;
      entry.promise = null;
      if (entry.prefix) previousByPrefix.set(entry.prefix, data);
      notify(key);
    },
    (error: unknown) => {
      entry.error = error;
      entry.updatedAt = Date.now();
      entry.invalid = false;
      entry.promise = null;
      notify(key);
    },
  );
  return entry.promise;
}

/** Marca como obsoletas las claves con el prefijo y refetchea las activas. */
export function invalidateQueries(prefix: string): void {
  for (const [key, entry] of cache) {
    if (!key.startsWith(prefix)) continue;
    if (listeners.has(key)) {
      entry.invalid = false;
      entry.error = undefined;
      void run(key);
    } else {
      entry.invalid = true;
    }
  }
}

/** Solo para tests: limpia caché y suscriptores entre casos. */
export function resetQueryCache(): void {
  cache.clear();
  listeners.clear();
  previousByPrefix.clear();
}

export interface QueryResult<T> {
  data: T | undefined;
  error: unknown;
  /** Primera carga sin dato previo: muestra skeleton. */
  isLoading: boolean;
  /** Hay una request en vuelo (incluye refetch con dato en pantalla). */
  isFetching: boolean;
  refetch: () => void;
}

export interface QueryOptions {
  /** false = no consulta (p. ej. sin permiso). */
  enabled?: boolean;
  /**
   * Conserva el último dato de la misma colección mientras se carga otra clave
   * (paginación y filtros): la tabla no desaparece entre requests.
   */
  previousKeyPrefix?: string;
}

export function useApiQuery<T>(
  key: string | null,
  fetcher: () => Promise<T>,
  options: QueryOptions = {},
): QueryResult<T> {
  const enabled = options.enabled ?? true;
  const previousPrefix = options.previousKeyPrefix;
  const active = Boolean(key) && enabled;
  const [, rerender] = useState(0);
  const fetcherRef = useRef(fetcher);
  useEffect(() => {
    fetcherRef.current = fetcher;
  });

  useEffect(() => {
    if (!active || !key) return;

    const listener = () => rerender((value) => value + 1);
    const set = listeners.get(key) ?? new Set<() => void>();
    set.add(listener);
    listeners.set(key, set);

    const entry = entryOf(key);
    entry.fetcher = () => fetcherRef.current();
    entry.prefix = previousPrefix;
    if (entry.updatedAt === 0 || entry.invalid) void run(key);

    return () => {
      set.delete(listener);
      if (set.size === 0) listeners.delete(key);
    };
  }, [key, active, previousPrefix]);

  const entry = key ? cache.get(key) : undefined;
  const fallback = previousPrefix ? previousByPrefix.get(previousPrefix) : undefined;
  const data = (entry?.data ?? fallback) as T | undefined;
  const loading = active && data === undefined && entry?.error === undefined;
  const fetching = active && Boolean(entry?.promise);

  const refetch = useCallback(() => {
    if (!key) return;
    const entryToRefresh = entryOf(key);
    entryToRefresh.fetcher = () => fetcherRef.current();
    entryToRefresh.invalid = false;
    entryToRefresh.error = undefined;
    void run(key);
  }, [key]);

  return {
    data,
    error: entry?.error,
    isLoading: loading,
    isFetching: fetching,
    refetch,
  };
}

export interface MutationResult<TArgs extends unknown[], TResult> {
  run: (...args: TArgs) => Promise<TResult>;
  pending: boolean;
  error: unknown;
  reset: () => void;
}

/** Mutación con estado de "pendiente" local; el caller decide el invalidado. */
export function useApiMutation<TArgs extends unknown[], TResult>(
  action: (...args: TArgs) => Promise<TResult>,
): MutationResult<TArgs, TResult> {
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<unknown>(undefined);
  const actionRef = useRef(action);
  useEffect(() => {
    actionRef.current = action;
  });
  const mounted = useRef(true);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  const run = useCallback(async (...args: TArgs): Promise<TResult> => {
    setPending(true);
    setError(undefined);
    try {
      return await actionRef.current(...args);
    } catch (caught) {
      if (mounted.current) setError(caught);
      throw caught;
    } finally {
      if (mounted.current) setPending(false);
    }
  }, []);

  const reset = useCallback(() => setError(undefined), []);

  return { run, pending, error, reset };
}
