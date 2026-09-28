import { useEffect, useState } from 'react';
import { CheckCircle2, ListX } from 'lucide-react';
import { ApiError } from '@/api/errors';
import { countingApi, type CountSession, type FinishCheck, type SubmitCountSessionResponse } from '@/api/counting';
import { Alert } from '@/components/ui/Alert';
import { Button } from '@/components/ui/Button';
import { Dialog } from '@/components/ui/Dialog';
import { Spinner } from '@/components/ui/Spinner';
import styles from './CountSessionPage.module.css';

export interface FinishCountDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  session: CountSession;
  /** false mientras queden eventos en cola o un fallo sin resolver. */
  canSubmit: boolean;
  busyNote?: string;
  onSubmitted: (session: SubmitCountSessionResponse) => void;
  onSessionConflict: () => void;
}

/** finish-check (presencia/ausencia) con reintentos manuales. */
function useFinishCheck(open: boolean, sessionId: string) {
  const [check, setCheck] = useState<FinishCheck | null>(null);
  const [checking, setChecking] = useState(false);
  const [checkError, setCheckError] = useState<unknown>(null);
  const [checkToken, setCheckToken] = useState(0);

  useEffect(() => {
    if (!open) return;
    const controller = new AbortController();
    let cancelled = false;

    void (async () => {
      setChecking(true);
      setCheckError(null);
      setCheck(null);
      try {
        const result = await countingApi.finishCheck(sessionId, controller.signal);
        if (!cancelled) setCheck(result);
      } catch (error) {
        if (!cancelled) setCheckError(error);
      } finally {
        if (!cancelled) setChecking(false);
      }
    })();

    return () => {
      cancelled = true;
      controller.abort();
    };
  }, [open, sessionId, checkToken]);

  return {
    check,
    checking,
    checkError,
    retryCheck: () => setCheckToken((token) => token + 1),
  };
}

/** Traduce los errores de submit a una acción de UI. */
function mapSubmitError(error: unknown): { message: string; conflict: boolean } {
  const apiError = ApiError.from(error);

  if (apiError.code === 'MISSING_PRODUCTS_CONFIRMATION_REQUIRED') {
    return { message: 'Confirma los productos pendientes antes de enviar.', conflict: false };
  }

  if (apiError.status === 409 && !apiError.code) {
    // Conflicto de versión sin código: el servidor avanzó, resincronizar.
    return {
      message: 'La sesión cambió en el servidor. Se actualizó: revisa y vuelve a enviar.',
      conflict: true,
    };
  }

  return { message: apiError.message, conflict: false };
}

function MissingSection({
  missing,
  confirmed,
  onConfirmed,
}: {
  missing: FinishCheck['missing_products'];
  confirmed: boolean;
  onConfirmed: (checked: boolean) => void;
}) {
  return (
    <div className={styles.finishMissing}>
      <p className={styles.finishMissingTitle}>
        <ListX size={16} aria-hidden="true" /> Productos sin registrar
      </p>
      <ul className={styles.finishMissingList}>
        {missing.map((item) => (
          <li key={item.product_id}>
            <span className="mono">{item.internal_reference}</span>
            <span>{item.name}</span>
          </li>
        ))}
      </ul>
      <label className={styles.finishConfirm}>
        <input
          type="checkbox"
          checked={confirmed}
          onChange={(event) => onConfirmed(event.target.checked)}
        />
        <span>Entiendo que faltan productos y quiero enviar el conteo igual</span>
      </label>
    </div>
  );
}

interface BodyProps {
  canSubmit: boolean;
  busyNote?: string;
  checking: boolean;
  checkError: unknown;
  check: FinishCheck | null;
  confirmed: boolean;
  onConfirmed: (checked: boolean) => void;
  onRetryCheck: () => void;
}

function FinishBody({
  canSubmit,
  busyNote,
  checking,
  checkError,
  check,
  confirmed,
  onConfirmed,
  onRetryCheck,
}: BodyProps) {
  if (!canSubmit && busyNote) {
    return (
      <Alert tone="warning" title="Espera a que se guarden los cambios">
        {busyNote}
      </Alert>
    );
  }

  if (checking) {
    return (
      <p className={styles.finishLoading}>
        <Spinner size={15} aria-hidden="true" /> Comprobando productos del inventario…
      </p>
    );
  }

  if (checkError) {
    return (
      <Alert
        tone="danger"
        title="No pudimos comprobar el inventario"
        actions={
          <Button size="sm" variant="secondary" onClick={onRetryCheck}>
            Reintentar
          </Button>
        }
      >
        {ApiError.from(checkError).message}
      </Alert>
    );
  }

  if (!check) return null;

  if (check.has_missing) {
    return (
      <MissingSection
        missing={check.missing_products}
        confirmed={confirmed}
        onConfirmed={onConfirmed}
      />
    );
  }

  return (
    <p className={styles.finishOk}>
      <CheckCircle2 size={16} aria-hidden="true" /> Todos los productos del inventario están
      registrados.
    </p>
  );
}

interface FooterProps {
  submitting: boolean;
  canSubmit: boolean;
  checking: boolean;
  hasCheck: boolean;
  needsConfirm: boolean;
  onClose: () => void;
  onSubmit: () => void;
}

function FinishFooter({
  submitting,
  canSubmit,
  checking,
  hasCheck,
  needsConfirm,
  onClose,
  onSubmit,
}: FooterProps) {
  return (
    <>
      <Button variant="ghost" onClick={onClose} disabled={submitting}>
        Seguir contando
      </Button>
      <Button
        variant="primary"
        onClick={onSubmit}
        loading={submitting}
        disabled={!canSubmit || checking || !hasCheck}
      >
        {needsConfirm ? 'Confirmar y enviar' : 'Enviar conteo'}
      </Button>
    </>
  );
}

/**
 * Finalizar conteo: finish-check (presencia/ausencia, blind-safe) + submit
 * con `expected_version`. Si faltan productos el operador debe confirmarlo
 * explícitamente; el backend lo exige igual.
 */
export function FinishCountDialog({
  open,
  onOpenChange,
  session,
  canSubmit,
  busyNote,
  onSubmitted,
  onSessionConflict,
}: FinishCountDialogProps) {
  const { check, checking, checkError, retryCheck } = useFinishCheck(open && canSubmit, session.id);
  const [confirmed, setConfirmed] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  function handleOpenChange(next: boolean) {
    if (next) {
      setConfirmed(false);
      setSubmitError(null);
    }
    onOpenChange(next);
  }

  async function submit() {
    const hasMissing = check?.has_missing === true;
    if (hasMissing && !confirmed) {
      setSubmitError('Marca la confirmación para enviar con productos pendientes.');
      return;
    }
    setSubmitting(true);
    setSubmitError(null);
    try {
      const result = await countingApi.submit(session.id, {
        expected_version: session.version,
        confirm_missing: hasMissing && confirmed,
      });
      onSubmitted(result);
    } catch (error) {
      const mapped = mapSubmitError(error);
      if (mapped.conflict) onSessionConflict();
      setSubmitError(mapped.message);
    } finally {
      setSubmitting(false);
    }
  }

  const needsConfirm = check?.has_missing === true && !confirmed;

  return (
    <Dialog
      open={open}
      onOpenChange={handleOpenChange}
      title="¿Finalizar y enviar el conteo?"
      description="Se enviará la sesión a revisión. Ya no podrás registrar más movimientos."
      closeLabel="Cerrar"
      footer={
        <FinishFooter
          submitting={submitting}
          canSubmit={canSubmit}
          checking={checking}
          hasCheck={check !== null}
          needsConfirm={needsConfirm}
          onClose={() => handleOpenChange(false)}
          onSubmit={() => void submit()}
        />
      }
    >
      <FinishBody
        canSubmit={canSubmit}
        busyNote={busyNote}
        checking={checking}
        checkError={checkError}
        check={check}
        confirmed={confirmed}
        onConfirmed={setConfirmed}
        onRetryCheck={retryCheck}
      />

      {submitError ? (
        <Alert tone="danger" title="No se pudo enviar">
          {submitError}
        </Alert>
      ) : null}
    </Dialog>
  );
}
