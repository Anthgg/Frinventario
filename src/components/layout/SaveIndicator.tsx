import { CloudOff, Loader2, Check } from 'lucide-react';
import styles from './SaveIndicator.module.css';

export type SaveState = 'saved' | 'saving' | 'offline';

const LABELS: Record<SaveState, string> = {
  saved: 'Guardado',
  saving: 'Guardando…',
  offline: 'Sin conexión',
};

/**
 * Indicador de autoguardado (UX preparada; el autoguardado real llega en
 * FF001). El estado es dato de entrada, no lógica del frontend.
 */
export function SaveIndicator({ state = 'saved' }: { state?: SaveState }) {
  return (
    <span className={[styles.indicator, styles[state]].join(' ')} data-state={state}>
      {state === 'saved' ? (
        <Check size={13} aria-hidden="true" />
      ) : state === 'saving' ? (
        <Loader2 size={13} className={styles.spin} aria-hidden="true" />
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
