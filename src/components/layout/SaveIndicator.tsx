import { CloudOff, Loader2, Check, AlertTriangle } from 'lucide-react';
import styles from './SaveIndicator.module.css';

export type SaveState = 'saved' | 'saving' | 'offline' | 'error';

const LABELS: Record<SaveState, string> = {
  saved: 'Guardado',
  saving: 'Guardando…',
  offline: 'Sin conexión',
  error: 'Error al guardar',
};

/**
 * Indicador de autoguardado. El estado lo decide el motor de la vista (cola de
 * eventos, red, conflictos); aquí solo se comunica.
 */
export function SaveIndicator({ state = 'saved' }: { state?: SaveState }) {
  return (
    <span className={[styles.indicator, styles[state]].join(' ')} data-state={state}>
      {state === 'saved' ? (
        <Check size={13} aria-hidden="true" />
      ) : state === 'saving' ? (
        <Loader2 size={13} className={styles.spin} aria-hidden="true" />
      ) : state === 'error' ? (
        <AlertTriangle size={13} aria-hidden="true" />
      ) : (
        <CloudOff size={13} aria-hidden="true" />
      )}
      <span className={styles.label}>{LABELS[state]}</span>
      <span className="sr-only" aria-live="polite">
        {LABELS[state]}
      </span>
    </span>
  );
}
