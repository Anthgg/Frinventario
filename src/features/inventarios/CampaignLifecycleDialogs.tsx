import { useState, type FormEvent } from 'react';
import { ApiError } from '@/api/errors';
import type { CampaignDetail } from '@/api/inventory';
import { Alert } from '@/components/ui/Alert';
import { Button } from '@/components/ui/Button';
import { Dialog } from '@/components/ui/Dialog';
import { Input, Textarea } from '@/components/ui/Input';
import { toIso } from './campaignDateTime';
import styles from './campaignDialogs.module.css';

function ErrorAlert({ error }: { error?: unknown }) {
  if (!error) return null;
  return (
    <Alert tone="danger" title="El backend rechazó la operación">
      {ApiError.from(error).message}
    </Alert>
  );
}

/* ------------------------------- iniciar ---------------------------------- */

export type StartPhase = 'confirm' | 'aggregate';

export interface StartCampaignDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  campaign: CampaignDetail;
  phase: StartPhase;
  pending?: boolean;
  error?: unknown;
  onConfirm: (confirmAggregate: boolean) => void;
}

/**
 * Iniciar = congelar snapshot y pasar a En conteo. El backend valida fecha
 * límite futura, origen de snapshot y responsable activo; si el origen es
 * AGGREGATE con ubicación física pide confirmación explícita y NUNCA se
 * envía confirm_aggregate_source=true por defecto.
 */
export function StartCampaignDialog({
  open,
  onOpenChange,
  campaign,
  phase,
  pending,
  error,
  onConfirm,
}: StartCampaignDialogProps) {
  const [acknowledged, setAcknowledged] = useState(false);
  const aggregate = phase === 'aggregate';

  return (
    <Dialog
      open={open}
      onOpenChange={onOpenChange}
      title={aggregate ? 'Confirmar origen AGGREGATE' : '¿Iniciar la campaña?'}
      description={
        aggregate
          ? 'El backend detectó un origen agregado con ubicación física asignada.'
          : 'Esta acción congela el snapshot y deja la campaña en «En conteo».'
      }
      closeLabel="Cerrar"
      footer={
        <>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button
            variant="primary"
            loading={pending}
            disabled={aggregate && !acknowledged}
            onClick={() => onConfirm(aggregate)}
          >
            {aggregate ? 'Confirmar e iniciar' : 'Iniciar campaña'}
          </Button>
        </>
      }
    >
      <div className={styles.form}>
        <ErrorAlert error={error} />

        {aggregate ? (
          <>
            <Alert tone="warning" title="Origen AGGREGATE">
              El snapshot de esta campaña no corresponde solo a la ubicación física de la campaña,
              así que el conteo mezclaría existencias de varias ubicaciones.
            </Alert>
            <label className={styles.confirmBox}>
              <input
                type="checkbox"
                checked={acknowledged}
                onChange={(event) => setAcknowledged(event.target.checked)}
              />
              <span className={styles.confirmLabel}>
                Entiendo esto y confirmo iniciar la campaña con origen AGGREGATE.
              </span>
            </label>
          </>
        ) : (
          <>
            <div className={styles.note}>
              <p className={styles.noteText}>El backend exige, antes de iniciar:</p>
              <ul className={styles.noteList}>
                <li>Fecha límite futura (si no existe o venció, no arranca).</li>
                <li>Origen de snapshot asignado.</li>
                <li>Responsable activo con permiso de conteo.</li>
              </ul>
            </div>
            <p className={styles.noteText}>
              Al iniciar se congela el snapshot de la campaña{' '}
              <span className="mono">{campaign.code}</span> y su estado pasa a «En conteo».
            </p>
          </>
        )}
      </div>
    </Dialog>
  );
}

/* ------------------------------- cancelar --------------------------------- */

export interface CancelCampaignDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  campaign: CampaignDetail;
  pending?: boolean;
  error?: unknown;
  onConfirm: (reason: string) => void;
}

export function CancelCampaignDialog({
  open,
  onOpenChange,
  campaign,
  pending,
  error,
  onConfirm,
}: CancelCampaignDialogProps) {
  const [reason, setReason] = useState('');
  const [reasonError, setReasonError] = useState<string | undefined>(undefined);

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const trimmed = reason.trim();
    if (!trimmed) {
      setReasonError('El motivo es obligatorio: queda registrado en la auditoría.');
      return;
    }
    setReasonError(undefined);
    onConfirm(trimmed);
  }

  return (
    <Dialog
      open={open}
      onOpenChange={onOpenChange}
      title="¿Cancelar la campaña?"
      description="Se registra el motivo en la auditoría y la campaña queda en estado «Cancelada»."
      closeLabel="Cerrar"
      footer={
        <>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            Volver
          </Button>
          <Button variant="danger" type="submit" form="campaign-cancel-form" loading={pending}>
            Cancelar campaña
          </Button>
        </>
      }
    >
      <form id="campaign-cancel-form" className={styles.form} onSubmit={handleSubmit} noValidate>
        <ErrorAlert error={error} />
        <Textarea
          label="Motivo de la cancelación"
          required
          value={reason}
          error={reasonError}
          placeholder="Se anula por cierre del almacén afectado."
          onChange={(event) => {
            setReason(event.target.value);
            if (reasonError) setReasonError(undefined);
          }}
        />
        <p className={styles.hint}>
          Se enviará con la versión {campaign.version} de la campaña.
        </p>
      </form>
    </Dialog>
  );
}

/* -------------------------------- reabrir --------------------------------- */

export interface ReopenCampaignDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  campaign: CampaignDetail;
  pending?: boolean;
  error?: unknown;
  onConfirm: (values: { reason: string; new_deadline_at: string }) => void;
}

export function ReopenCampaignDialog({
  open,
  onOpenChange,
  campaign,
  pending,
  error,
  onConfirm,
}: ReopenCampaignDialogProps) {
  const [reason, setReason] = useState('');
  const [deadline, setDeadline] = useState('');
  const [errors, setErrors] = useState<{ reason?: string; deadline?: string }>({});

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const trimmed = reason.trim();
    const iso = toIso(deadline);
    const next: { reason?: string; deadline?: string } = {};
    if (!trimmed) next.reason = 'El motivo es obligatorio.';
    if (!iso) next.deadline = 'Define una nueva fecha límite.';
    else if (Date.parse(iso) <= Date.now()) next.deadline = 'La nueva fecha debe ser futura.';
    setErrors(next);
    if (Object.keys(next).length > 0 || !trimmed || !iso) return;
    onConfirm({ reason: trimmed, new_deadline_at: iso });
  }

  return (
    <Dialog
      open={open}
      onOpenChange={onOpenChange}
      title="¿Reabrir la campaña?"
      description="Solo el vencimiento o el cierre admiten reapertura, y siempre con una fecha límite nueva."
      closeLabel="Cerrar"
      footer={
        <>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            Volver
          </Button>
          <Button variant="primary" type="submit" form="campaign-reopen-form" loading={pending}>
            Reabrir campaña
          </Button>
        </>
      }
    >
      <form id="campaign-reopen-form" className={styles.form} onSubmit={handleSubmit} noValidate>
        <ErrorAlert error={error} />
        <Textarea
          label="Motivo de la reapertura"
          required
          value={reason}
          error={errors.reason}
          placeholder="Se reabre por reconteo solicitado por almacén."
          onChange={(event) => {
            setReason(event.target.value);
            if (errors.reason) setErrors((current) => ({ ...current, reason: undefined }));
          }}
        />
        <Input
          label="Nueva fecha límite"
          type="datetime-local"
          required
          value={deadline}
          error={errors.deadline}
          hint="Debe ser futura y se envía con zona horaria."
          onChange={(event) => {
            setDeadline(event.target.value);
            if (errors.deadline) setErrors((current) => ({ ...current, deadline: undefined }));
          }}
        />
        <p className={styles.hint}>Se enviará con la versión {campaign.version} de la campaña.</p>
      </form>
    </Dialog>
  );
}
