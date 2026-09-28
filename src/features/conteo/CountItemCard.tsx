import { useRef, type ReactNode } from 'react';
import { Minus, Plus } from 'lucide-react';
import { IconButton } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { displayQuantity, formatQuantity, type LocalItem } from './countModel';
import styles from './CountSessionPage.module.css';

export interface CountControlsProps {
  item: LocalItem;
  pendingDelta: number;
  disabled: boolean;
  onAdd: () => void;
  onSubtract: () => void;
  onSet: (value: number) => void;
}

/**
 * Tarjeta del producto en foco: cantidad confirmada + intenciones pendientes,
 * stepper de una unidad y cantidad directa (MANUAL_SET).
 *
 * Mientras hay intenciones sin confirmar para este item, la cantidad directa se
 * deshabilita: escribir un valor absoluto contra un servidor desincronizado
 * produciría un estado ambiguo. El stepper sigue funcionando (se encola).
 */
export function CountItemCard({
  item,
  pendingDelta,
  disabled,
  onAdd,
  onSubtract,
  onSet,
}: CountControlsProps) {
  const display = displayQuantity(item, pendingDelta);
  const pending = pendingDelta !== 0;
  const inputRef = useRef<HTMLInputElement>(null);

  function commit() {
    const raw = inputRef.current?.value ?? String(display);
    const parsed = Number.parseInt(raw, 10);
    if (!Number.isFinite(parsed) || parsed === display) {
      if (inputRef.current) inputRef.current.value = String(display);
      return;
    }
    onSet(Math.max(0, parsed));
  }

  return (
    <CardShell item={item} display={display} pending={pending} pendingDelta={pendingDelta}>
      <div className={styles.controls}>
        <div className={styles.stepper} role="group" aria-label={`Cantidad de ${item.name ?? item.internalReference}`}>
          <IconButton
            label="Restar una unidad"
            size="lg"
            variant="secondary"
            onClick={onSubtract}
            disabled={disabled || display <= 0}
            className={styles.stepButton}
          >
            <Minus size={18} />
          </IconButton>

          <label className={styles.quantityField}>
            <span className="sr-only">Cantidad registrada</span>
            <input
              key={display}
              ref={inputRef}
              className={styles.quantityInput}
              type="number"
              inputMode="numeric"
              min={0}
              defaultValue={display}
              disabled={disabled || pending}
              onBlur={commit}
              onKeyDown={(event) => {
                if (event.key === 'Enter') commit();
              }}
            />
          </label>

          <IconButton
            label="Sumar una unidad"
            size="lg"
            variant="secondary"
            onClick={onAdd}
            disabled={disabled}
            className={styles.stepButton}
          >
            <Plus size={18} />
          </IconButton>
        </div>
      </div>

      {pending ? (
        <p className={styles.pendingNote} role="status">
          Guardando {pendingDelta > 0 ? `+${pendingDelta}` : pendingDelta}…
        </p>
      ) : null}
    </CardShell>
  );
}

function CardShell({
  item,
  display,
  pending,
  pendingDelta,
  children,
}: {
  item: LocalItem;
  display: number;
  pending: boolean;
  pendingDelta: number;
  children: ReactNode;
}) {
  return (
    <section className={[styles.currentCard, pending ? styles.cardPending : ''].filter(Boolean).join(' ')}>
      <header className={styles.currentHead}>
        <div className={styles.currentIdentity}>
          <p className={styles.currentLabel}>En foco</p>
          <p className={styles.currentCode}>{item.internalReference ?? '—'}</p>
          <p className={styles.currentName}>{item.name ?? 'Código sin descripción'}</p>
        </div>
        <span className={styles.registered}>
          <span className={styles.registeredValue} data-testid="focus-quantity">
            {display}
          </span>
          <span className={styles.registeredLabel}>
            registrado{pending && pendingDelta !== 0 ? ' (parcial)' : ''}
          </span>
        </span>
      </header>
      {children}
    </section>
  );
}

/** Fila compacta de la lista de productos registrados. */
export function CountItemRow({
  item,
  pendingDelta,
  disabled,
  onAdd,
  onSubtract,
  onFocus,
  focused,
}: Omit<CountControlsProps, 'onSet'> & { onFocus?: () => void; focused?: boolean }) {
  const display = displayQuantity(item, pendingDelta);
  const rowProps: Record<string, unknown> = onFocus ? { onClick: onFocus } : {};

  return (
    <li className={[styles.recentItem, focused ? styles.recentItemOn : ''].filter(Boolean).join(' ')}>
      <button type="button" className={styles.recentIdentity} {...rowProps}>
        <span className={styles.recentCode}>{item.internalReference ?? '—'}</span>
        <span className={styles.recentName}>{item.name ?? 'Código sin descripción'}</span>
      </button>
      <span className={styles.recentRight}>
        {item.kind === 'UNKNOWN' ? <Badge tone="warning">Desconocido</Badge> : null}
        <span className={styles.recentQty} data-testid={`quantity-${item.key}`}>
          {formatQuantity(display)}
        </span>
        <IconButton
          label={`Restar 1 a ${item.name ?? item.internalReference ?? 'ítem'}`}
          size="sm"
          variant="secondary"
          onClick={onSubtract}
          disabled={disabled || display <= 0}
        >
          <Minus size={15} />
        </IconButton>
        <IconButton
          label={`Sumar 1 a ${item.name ?? item.internalReference ?? 'ítem'}`}
          size="sm"
          variant="secondary"
          onClick={onAdd}
          disabled={disabled}
        >
          <Plus size={15} />
        </IconButton>
      </span>
    </li>
  );
}
