import { useCallback, useMemo, useRef, useState } from 'react';
import { useParams } from 'react-router-dom';
import { Flag, PackageOpen, ScanBarcode } from 'lucide-react';
import { SaveIndicator } from '@/components/layout/SaveIndicator';
import { PageHeader } from '@/components/layout/PageHeader';
import { PageShell } from '@/components/layout/PageShell';
import { Alert } from '@/components/ui/Alert';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Skeleton } from '@/components/ui/Skeleton';
import { EmptyState, ErrorState } from '@/components/ui/State';
import { useToast } from '@/components/ui/Toast';
import { CameraPanel } from './CameraPanel';
import { CountHistory } from './CountHistory';
import { CountItemCard, CountItemRow } from './CountItemCard';
import { FinishCountDialog } from './FinishCountDialog';
import { toOperationalCode } from './qr/detector';
import type { SubmitCountSessionResponse } from '@/api/counting';
import { useCountSession } from './useCountSession';
import { useQrCamera } from './useQrCamera';
import { useQrScanner } from './useQrScanner';
import styles from './CountSessionPage.module.css';

type Count = ReturnType<typeof useCountSession>;
type Pending = Count['pending'];
type CountItem = Count['items'][number];
type CountEvent = Count['events'][number];
type Failure = Count['failure'];

function pendingFor(item: CountItem | null, pending: Pending): number {
  return item ? (pending[item.key] ?? 0) : 0;
}

function busyNoteFor(queued: number, hasFailure: boolean): string {
  if (queued > 0) return "Quedan " + queued + " movimientos por guardar.";
  return hasFailure ? "Hay un movimiento con error: resuélvelo para enviar." : "";
}

function useFocusItem(items: CountItem[], focusKey: string | null, lastScanned: string | null) {
  return useMemo(() => {
    if (focusKey) return items.find((item) => item.key === focusKey) ?? null;
    if (lastScanned) {
      const scanned = toOperationalCode(lastScanned);
      return items.find((item) => item.internalReference === scanned) ?? null;
    }
    return items[0] ?? null;
  }, [focusKey, items, lastScanned]);
}

/**
 * Estado previo a la sesión (cargando / error / no encontrada). Un único
 * componente para conservar el mismo nodo de encabezado entre transiciones.
 */
function SessionStateShell({
  mode,
  error,
  onRetry,
}: {
  mode: 'loading' | 'error' | 'missing';
  error: unknown;
  onRetry: () => void;
}) {
  return (
    <PageShell>
      <PageHeader
        title="Conteo"
        description={mode === 'loading' ? 'Cargando sesión…' : undefined}
      />
      {mode === 'loading' ? (
        <div className={styles.loadingBox} role="status" aria-live="polite">
          <Skeleton height={160} />
          <Skeleton height={92} />
          <Skeleton height={180} />
          <span className="sr-only">Cargando sesión de conteo…</span>
        </div>
      ) : mode === 'error' ? (
        <ErrorState error={error} onRetry={onRetry} />
      ) : (
        <EmptyState
          title="No encontramos la sesión"
          description="Vuelve a inventarios y entra de nuevo a la campaña."
        />
      )}
    </PageShell>
  );
}

function SessionHeader({
  readOnly,
  sessionNumber,
  sessionType,
  saveState,
}: {
  readOnly: boolean;
  sessionNumber: number;
  sessionType: string;
  saveState: Count['saveState'];
}) {
  return (
    <PageHeader
      title={readOnly ? 'Conteo enviado' : 'Conteo'}
      description={
        readOnly
          ? 'Sesión cerrada: puedes consultar lo registrado, pero ya no acepta movimientos.'
          : 'Escanea con la cámara trasera o suma unidades a mano. Todo se guarda en el servidor.'
      }
      badge={
        <>
          <Badge tone={readOnly ? 'neutral' : 'hilo'}>{sessionType}</Badge>
          <Badge tone="neutral" className="mono">
            #{sessionNumber}
          </Badge>
        </>
      }
      actions={<SaveIndicator state={saveState} />}
    />
  );
}

function FailureNotice({
  failure,
  onRetry,
  onDismiss,
}: {
  failure: NonNullable<Failure>;
  onRetry: () => void;
  onDismiss: () => void;
}) {
  return (
    <Alert
      tone={failure.network ? 'warning' : 'danger'}
      title={failure.network ? 'Sin conexión con el servidor' : 'No se pudo guardar'}
      actions={
        <>
          <Button size="sm" variant="primary" onClick={onRetry}>
            Reintentar
          </Button>
          <Button size="sm" variant="ghost" onClick={onDismiss}>
            Descartar
          </Button>
        </>
      }
    >
      <span>{failure.label}</span>
      <span className={styles.failureDetail}>
        {failure.message}
        {failure.code ? ` · ${failure.code}` : ''}
      </span>
    </Alert>
  );
}

function SessionNotice({
  status,
  submittedAt,
}: {
  status: string;
  submittedAt: string | null;
}) {
  const cancelled = status === 'CANCELLED';
  const sentAt = submittedAt ? new Date(submittedAt).toLocaleString('es-ES') : '—';

  return (
    <Alert tone={cancelled ? 'danger' : 'info'} title={cancelled ? 'Esta sesión fue cancelada' : 'Esta sesión ya fue enviada'}>
      {cancelled
        ? 'La asignación cambió y la sesión dejó de estar activa.'
        : `Enviada el ${sentAt}.`}
    </Alert>
  );
}

function FocusArea({
  item,
  pendingDelta,
  disabled,
  onAdd,
  onSubtract,
  onSet,
}: {
  item: CountItem | null;
  pendingDelta: number;
  disabled: boolean;
  onAdd: (item: CountItem) => void;
  onSubtract: (item: CountItem) => void;
  onSet: (item: CountItem, value: number) => void;
}) {
  if (item) {
    return (
      <CountItemCard
        item={item}
        pendingDelta={pendingDelta}
        disabled={disabled}
        onAdd={() => onAdd(item)}
        onSubtract={() => onSubtract(item)}
        onSet={(value) => onSet(item, value)}
      />
    );
  }

  return (
    <Card tone="glass" padding="md" className={styles.currentCard}>
      <EmptyState
        icon={<ScanBarcode size={20} />}
        title="Aún no registras productos"
        description="Activa la cámara y apunta al QR del primer producto."
        compact
      />
    </Card>
  );
}

function ProductsSection({
  items,
  pending,
  focusKey,
  disabled,
  onFocus,
  onAdd,
  onSubtract,
}: {
  items: CountItem[];
  pending: Pending;
  focusKey: string | null;
  disabled: boolean;
  onFocus: (key: string) => void;
  onAdd: (item: CountItem) => void;
  onSubtract: (item: CountItem) => void;
}) {
  return (
    <section className={styles.recent} aria-label="Productos registrados">
      <header className={styles.recentHead}>
        <h2 className={styles.recentTitle}>Productos</h2>
        <span className={styles.recentCount}>{items.length} con cantidad registrada</span>
      </header>
      {items.length === 0 ? (
        <EmptyState
          icon={<PackageOpen size={20} />}
          title="Ningún producto con cantidad todavía"
          description="Escanea un QR o suma unidades desde la tarjeta de arriba."
          compact
        />
      ) : (
        <ul className={styles.recentList}>
          {items.map((item) => (
            <CountItemRow
              key={item.key}
              item={item}
              pendingDelta={pending[item.key] ?? 0}
              disabled={disabled}
              focused={focusKey === item.key}
              onFocus={() => onFocus(item.key)}
              onAdd={() => onAdd(item)}
              onSubtract={() => onSubtract(item)}
            />
          ))}
        </ul>
      )}
    </section>
  );
}

function HistorySection({
  events,
  items,
  disabled,
  onUndo,
}: {
  events: CountEvent[];
  items: CountItem[];
  disabled: boolean;
  onUndo: (event: CountEvent) => void;
}) {
  return (
    <section className={styles.history} aria-label="Historial">
      <header className={styles.recentHead}>
        <h2 className={styles.recentTitle}>Historial</h2>
        <span className={styles.recentCount}>{events.length} eventos</span>
      </header>
      <CountHistory events={events} items={items} disabled={disabled} onUndo={onUndo} />
    </section>
  );
}

/**
 * Sesión de conteo en campo (FF003).
 *
 * Orden mobile-first: cámara → producto en foco → lista → historial →
 * finalizar. Sin datos simulados: todo lo que se ve viene de
 * GET /count-sessions/{id} (+ items + events) y de las respuestas del backend.
 */
export function CountSessionPage() {
  const { sessionId } = useParams();
  const { push } = useToast();
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const [focusKey, setFocusKey] = useState<string | null>(null);
  const [finishOpen, setFinishOpen] = useState(false);

  const count = useCountSession({ sessionId });
  const { loading, loadError, session, items, events, pending, queued, saveState, failure, lastScanned, interactive } = count;

  const camera = useQrCamera(videoRef);

  const handleAccepted = useCallback(
    (detections: { value: string }[]) => {
      const codes = detections
        .map((detection) => toOperationalCode(detection.value))
        .filter((code) => code.length > 0);
      if (codes.length === 0) return;
      // El foco lo manda el último escaneo; el clic manual cede ante un nuevo QR.
      setFocusKey(null);
      count.scanCodes(codes);
    },
    [count],
  );

  const scanner = useQrScanner({
    videoRef,
    enabled: camera.live && interactive && !finishOpen,
    onAccepted: handleAccepted,
  });

  const focusItem = useFocusItem(items, focusKey, lastScanned);

  const canSubmit = queued === 0 && failure === null;

  const handleSubmitted = useCallback(
    (submitted: SubmitCountSessionResponse) => {
      count.replaceSession(submitted);
      setFinishOpen(false);
      camera.stop();
      push({
        title: submitted.already_submitted ? 'La sesión ya estaba enviada' : 'Conteo enviado',
        tone: 'success',
        description: 'El inventario pasó a revisión.',
      });
    },
    [camera, count, push],
  );

  if (!session) {
    const mode = loading ? 'loading' : loadError ? 'error' : 'missing';
    return <SessionStateShell mode={mode} error={loadError} onRetry={count.refresh} />;
  }

  const readOnly = session.status !== 'IN_PROGRESS';

  return (
    <PageShell>
      <SessionHeader
        readOnly={readOnly}
        sessionNumber={session.session_number}
        sessionType={session.session_type}
        saveState={saveState}
      />

      {failure ? (
        <FailureNotice
          failure={failure}
          onRetry={count.retryFailure}
          onDismiss={count.dismissFailure}
        />
      ) : null}

      {readOnly ? <SessionNotice status={session.status} submittedAt={session.submitted_at} /> : null}

      <section className={styles.topZone}>
        <CameraPanel
          videoRef={videoRef}
          status={camera.status}
          error={camera.error}
          scannerError={scanner.error}
          lastScan={lastScanned}
          scanning={camera.live && !readOnly && !finishOpen}
          disabled={readOnly || finishOpen}
          onStart={() => void camera.start()}
          onStop={camera.stop}
        />

        <FocusArea
          item={focusItem}
          pendingDelta={pendingFor(focusItem, pending)}
          disabled={readOnly}
          onAdd={count.addOne}
          onSubtract={count.subtractOne}
          onSet={count.setQuantity}
        />
      </section>

      <ProductsSection
        items={items}
        pending={pending}
        focusKey={focusItem?.key ?? null}
        disabled={readOnly}
        onFocus={setFocusKey}
        onAdd={count.addOne}
        onSubtract={count.subtractOne}
      />

      <HistorySection
        events={events}
        items={items}
        disabled={readOnly}
        onUndo={(event) => count.undo(event)}
      />

      <div className={styles.finishZone}>
        <Button
          variant="primary"
          size="lg"
          block
          onClick={() => setFinishOpen(true)}
          disabled={readOnly}
        >
          <Flag size={17} aria-hidden="true" /> Finalizar sesión
        </Button>
      </div>

      <FinishCountDialog
        open={finishOpen}
        onOpenChange={setFinishOpen}
        session={session}
        canSubmit={canSubmit}
        busyNote={busyNoteFor(queued, failure !== null)}
        onSubmitted={handleSubmitted}
        onSessionConflict={count.refresh}
      />
    </PageShell>
  );
}
