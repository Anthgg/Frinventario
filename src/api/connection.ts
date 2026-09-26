import { useSyncExternalStore } from 'react';

/**
 * Estado de conexión con el API (discreto, no confundir con offline de FF004).
 * El cliente HTTP reporta aquí cuando una request falla por red o recupera.
 */

export type ConnectionState = 'unknown' | 'online' | 'offline';

let snapshot: ConnectionState = 'unknown';
const listeners = new Set<() => void>();

function emit(): void {
  for (const listener of [...listeners]) listener();
}

export function reportConnection(next: ConnectionState): void {
  if (next === snapshot) return;
  snapshot = next;
  emit();
}

export function subscribeConnection(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function getConnectionSnapshot(): ConnectionState {
  return snapshot;
}

export function resetConnection(): void {
  snapshot = 'unknown';
  emit();
}

export function useConnectionStatus(): ConnectionState {
  return useSyncExternalStore(subscribeConnection, getConnectionSnapshot, getConnectionSnapshot);
}
