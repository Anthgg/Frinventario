import { useState, type FormEvent } from 'react';
import { ApiError } from '@/api/errors';
import type { AssigneeCandidatePage, CampaignDetail } from '@/api/inventory';
import { Alert } from '@/components/ui/Alert';
import { Button } from '@/components/ui/Button';
import { Dialog } from '@/components/ui/Dialog';
import { EmptyState, ErrorState } from '@/components/ui/State';
import styles from './campaignDialogs.module.css';

function ErrorAlert({ error }: { error?: unknown }) {
  if (!error) return null;
  return (
    <Alert tone="danger" title="El backend rechazó la operación">
      {ApiError.from(error).message}
    </Alert>
  );
}

/* -------------------------------- asignar --------------------------------- */

export interface AssignResponsibleDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  campaign: CampaignDetail;
  candidatePage?: AssigneeCandidatePage;
  candidatesLoading?: boolean;
  candidatesError?: unknown;
  onRetryCandidates?: () => void;
  onCandidateOffsetChange: (offset: number) => void;
  pending?: boolean;
  error?: unknown;
  onSubmit: (userId: string) => void;
}

export function AssignResponsibleDialog({
  open,
  onOpenChange,
  campaign,
  candidatePage,
  candidatesLoading,
  candidatesError,
  onRetryCandidates,
  onCandidateOffsetChange,
  pending,
  error,
  onSubmit,
}: AssignResponsibleDialogProps) {
  const [userId, setUserId] = useState('');
  const [userIdError, setUserIdError] = useState<string | undefined>(undefined);

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!userId) {
      setUserIdError('Elige a la persona responsable.');
      return;
    }
    setUserIdError(undefined);
    onSubmit(userId);
  }

  function changeCandidatePage(offset: number) {
    setUserId('');
    setUserIdError(undefined);
    onCandidateOffsetChange(offset);
  }

  const candidates = candidatePage?.items ?? [];
  const totalCandidates = candidatePage?.total ?? 0;
  const offset = candidatePage?.offset ?? 0;
  const limit = candidatePage?.limit ?? 50;
  const lastVisibleCandidate = Math.min(offset + candidates.length, totalCandidates);

  return (
    <Dialog
      open={open}
      onOpenChange={onOpenChange}
      title="Asignar responsable"
      description={`El responsable pasa a contar la campaña «${campaign.name}». Requiere permiso de conteo.`}
      closeLabel="Cerrar"
      footer={
        <>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button
            variant="primary"
            type="submit"
            form="campaign-assign-form"
            loading={pending}
            disabled={candidatesLoading || Boolean(candidatesError) || candidates.length === 0}
          >
            Asignar responsable
          </Button>
        </>
      }
    >
      <form id="campaign-assign-form" className={styles.form} onSubmit={handleSubmit} noValidate>
        <ErrorAlert error={error} />

        {candidatesError ? (
          <ErrorState
            compact
            error={candidatesError}
            title="No pudimos cargar los responsables"
            description="Sin la lista de personas elegibles no podemos asignar esta campaña."
            onRetry={onRetryCandidates}
          />
        ) : candidatesLoading ? (
          <p className={styles.hint}>Cargando responsables…</p>
        ) : totalCandidates === 0 ? (
          <EmptyState
            compact
            title="Sin responsables disponibles"
            description="No hay cuentas activas con permiso de conteo."
          />
        ) : (
          <div className={styles.field}>
            <label className={styles.label} htmlFor="campaign-assign-user">
              Usuario responsable
            </label>
            <select
              id="campaign-assign-user"
              className={styles.select}
              value={userId}
              aria-invalid={userIdError ? true : undefined}
              onChange={(event) => {
                setUserId(event.target.value);
                if (userIdError) setUserIdError(undefined);
              }}
            >
              <option value="">Selecciona una cuenta</option>
              {candidates.map((candidate) => (
                <option key={candidate.id} value={candidate.id}>
                  {candidate.display_name}
                  {candidate.email ? ` · ${candidate.email}` : ''}
                </option>
              ))}
            </select>
            {userIdError ? (
              <p className={styles.error} role="alert">
                {userIdError}
              </p>
            ) : (
              <p className={styles.hint}>
                Solo aparecen cuentas activas con permiso de conteo; el backend vuelve a validarlo.
              </p>
            )}
            {candidatePage && totalCandidates > limit ? (
              <div
                className={styles.pagination}
                role="group"
                aria-label="Paginación de responsables"
              >
                <Button
                  variant="ghost"
                  disabled={offset === 0 || candidatesLoading}
                  onClick={() => changeCandidatePage(Math.max(0, offset - limit))}
                >
                  Anteriores
                </Button>
                <span className={styles.hint} aria-live="polite">
                  {offset + 1}–{lastVisibleCandidate} de {totalCandidates}
                </span>
                <Button
                  variant="ghost"
                  disabled={offset + candidates.length >= totalCandidates || candidatesLoading}
                  onClick={() => changeCandidatePage(offset + limit)}
                >
                  Siguientes
                </Button>
              </div>
            ) : null}
          </div>
        )}
      </form>
    </Dialog>
  );
}

/* ------------------------------- desasignar ------------------------------- */

export interface UnassignResponsibleDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  campaign: CampaignDetail;
  pending?: boolean;
  error?: unknown;
  onConfirm: () => void;
}

export function UnassignResponsibleDialog({
  open,
  onOpenChange,
  campaign,
  pending,
  error,
  onConfirm,
}: UnassignResponsibleDialogProps) {
  return (
    <Dialog
      open={open}
      onOpenChange={onOpenChange}
      title="¿Quitar el responsable?"
      description="La campaña vuelve a borrador y se cancelan sus sesiones de conteo activas (sin borrar eventos)."
      closeLabel="Cerrar"
      footer={
        <>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            Volver
          </Button>
          <Button variant="danger" loading={pending} onClick={onConfirm}>
            Quitar responsable
          </Button>
        </>
      }
    >
      <div className={styles.form}>
        <ErrorAlert error={error} />
        <p className={styles.noteText}>
          Campaña <span className="mono">{campaign.code}</span> · versión {campaign.version}. Solo
          funciona antes de «En conteo».
        </p>
      </div>
    </Dialog>
  );
}
