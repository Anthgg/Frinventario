import { Undo2 } from 'lucide-react';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { EmptyState } from '@/components/ui/State';
import type { CountEvent } from '@/api/counting';
import { summarizeEvent, type LocalItem } from './countModel';
import styles from './CountSessionPage.module.css';

export interface CountHistoryProps {
  events: CountEvent[];
  items: LocalItem[];
  disabled: boolean;
  onUndo: (event: CountEvent) => void;
}

function formatTime(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '';
  return date.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' });
}

/**
 * Historial de eventos (más reciente primero). Cada fila puede deshacerse SOLO
 * si el backend lo aceptaría (último evento efectivo del objetivo), así el
 * operador no se topa con un 409 evitable.
 */
export function CountHistory({ events, items, disabled, onUndo }: CountHistoryProps) {
  const lookup = new Map(items.map((item) => [item.key, item]));
  const ordered = [...events].reverse();

  if (ordered.length === 0) {
    return (
      <EmptyState
        title="Todavía no registras movimientos"
        description="Escanea un QR o suma unidades: cada acción aparecerá aquí."
      />
    );
  }

  return (
    <ol className={styles.historyList} aria-label="Historial de la sesión">
      {ordered.map((event) => {
        const summary = summarizeEvent(
          event,
          events,
          (key) => lookup.get(key),
        );
        const receivedAt = event.received_at ?? event.occurred_at ?? null;
        return (
          <li key={event.event_id} className={styles.historyItem} data-event-type={event.event_type}>
            <span className={styles.historyMain}>
              <span className={styles.historyTitle}>
                {summary.label}
                <Badge tone={summary.isUndo ? 'info' : 'neutral'}>{summary.detail}</Badge>
              </span>
              <span className={styles.historyTarget}>{summary.target}</span>
              <span className={styles.historyMeta}>
                <span aria-hidden="true">·</span>
                <span className="mono">#{event.server_sequence}</span>
                {receivedAt ? (
                  <>
                    <span aria-hidden="true">·</span>
                    <time dateTime={receivedAt}>{formatTime(receivedAt)}</time>
                  </>
                ) : null}
                {summary.resulting !== null ? (
                  <>
                    <span aria-hidden="true">·</span>
                    <span>Total {summary.resulting}</span>
                  </>
                ) : null}
              </span>
            </span>
            {summary.reversible ? (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => onUndo(event)}
                disabled={disabled}
                title={`Deshacer ${summary.label}`}
              >
                <Undo2 size={15} aria-hidden="true" /> Deshacer
              </Button>
            ) : null}
          </li>
        );
      })}
    </ol>
  );
}
