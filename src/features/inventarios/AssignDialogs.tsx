import { useState, type FormEvent } from 'react';
import { ApiError } from '@/api/errors';
import type { AdminUser, CampaignDetail } from '@/api/inventory';
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
  /**
   * false = la cuenta tiene inventory.assign pero no users.read: el backend
   * exige el id del usuario y no hay endpoint de descubrimiento permitido.
   */
  canReadUsers: boolean;
  users: AdminUser[];
  usersLoading?: boolean;
  usersError?: unknown;
  onRetryUsers?: () => void;
  pending?: boolean;
  error?: unknown;
  onSubmit: (userId: string) => void;
}

export function AssignResponsibleDialog({
  open,
  onOpenChange,
  campaign,
  canReadUsers,
  users,
  usersLoading,
  usersError,
  onRetryUsers,
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

  const activeUsers = users.filter((user) => user.is_active);

  return (
    <Dialog
      open={open}
      onOpenChange={onOpenChange}
      title="Asignar responsable"
      description={`El responsable pasa a contar la campaña «${campaign.name}». Requiere permiso de conteo.`}
      closeLabel="Cerrar"
      footer={
        canReadUsers ? (
          <>
            <Button variant="ghost" onClick={() => onOpenChange(false)}>
              Cancelar
            </Button>
            <Button
              variant="primary"
              type="submit"
              form="campaign-assign-form"
              loading={pending}
              disabled={usersLoading || Boolean(usersError)}
            >
              Asignar responsable
            </Button>
          </>
        ) : (
          <Button variant="secondary" onClick={() => onOpenChange(false)}>
            Entendido
          </Button>
        )
      }
    >
      {!canReadUsers ? (
        <div className={styles.form}>
          <Alert tone="warning" title="Falta el directorio de usuarios">
            Tu cuenta puede asignar responsables (permiso inventory.assign), pero no puede leer la
            lista de usuarios (permiso users.read), y el backend exige el identificador del usuario
            para asignar. Mientras eso no cambie, la asignación desde esta pantalla no está
            disponible.
          </Alert>
          <p className={styles.hint}>
            Un administrador con users.read puede hacerlo, o bien puede concederte ese permiso.
          </p>
        </div>
      ) : (
        <form id="campaign-assign-form" className={styles.form} onSubmit={handleSubmit} noValidate>
          <ErrorAlert error={error} />

          {usersError ? (
            <ErrorState
              compact
              error={usersError}
              title="No pudimos cargar los usuarios"
              description="Sin el directorio no podemos elegir responsable."
              onRetry={onRetryUsers}
            />
          ) : usersLoading ? (
            <p className={styles.hint}>Cargando usuarios…</p>
          ) : activeUsers.length === 0 ? (
            <EmptyState
              compact
              title="Sin usuarios disponibles"
              description="No hay cuentas activas con las que asignar esta campaña."
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
                {activeUsers.map((user) => (
                  <option key={user.id} value={user.id}>
                    {user.display_name} · {user.email}
                  </option>
                ))}
              </select>
              {userIdError ? (
                <p className={styles.error} role="alert">
                  {userIdError}
                </p>
              ) : (
                <p className={styles.hint}>
                  El backend valida que la cuenta tenga permiso inventory.count.
                </p>
              )}
            </div>
          )}
        </form>
      )}
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
