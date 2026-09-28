import { useState, type FormEvent } from 'react';
import { ApiError } from '@/api/errors';
import type { CampaignDetail, Location, SnapshotSource } from '@/api/inventory';
import { Alert } from '@/components/ui/Alert';
import { Button } from '@/components/ui/Button';
import { Dialog } from '@/components/ui/Dialog';
import { Input } from '@/components/ui/Input';
import { toIso, toLocalInput } from './campaignDateTime';
import styles from './campaignDialogs.module.css';

export interface CampaignFormValues {
  name?: string;
  location_id?: string;
  source_import_batch_id?: string;
  deadline_at?: string;
}

export interface CampaignFormDialogProps {
  mode: 'create' | 'edit';
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Solo en modo edición. */
  campaign?: CampaignDetail;
  locations: Location[];
  sources: SnapshotSource[];
  sourcesLoading?: boolean;
  sourcesError?: unknown;
  pending?: boolean;
  /** Error del último intento (lo setea la página, no el diálogo). */
  error?: unknown;
  onSubmit: (values: CampaignFormValues) => void;
}

function sourceLabel(source: SnapshotSource): string {
  const pieces = [
    source.source_filename ?? source.import_type,
    source.stock_scope,
    `${source.stock_snapshot_count} productos`,
  ];
  return pieces.filter(Boolean).join(' · ');
}

/**
 * Crear / editar campaña. Los campos que el backend ignora cuando llegan en
 * null se explican en el propio formulario (nada de cambios silenciosos).
 */
export function CampaignFormDialog({
  mode,
  open,
  onOpenChange,
  campaign,
  locations,
  sources,
  sourcesLoading,
  sourcesError,
  pending,
  error,
  onSubmit,
}: CampaignFormDialogProps) {
  const isEdit = mode === 'edit';
  // El backend bloquea cambiar ubicación/origen/deadline con snapshot congelado.
  const locked = isEdit && Boolean(campaign?.starts_at);

  const [name, setName] = useState(campaign?.name ?? '');
  const [locationId, setLocationId] = useState(campaign?.location_id ?? '');
  const [sourceId, setSourceId] = useState('');
  const [deadline, setDeadline] = useState(() => toLocalInput(campaign?.deadline_at));
  const [nameError, setNameError] = useState<string | undefined>(undefined);
  const [noChanges, setNoChanges] = useState(false);

  const formId = `campaign-form-${mode}`;

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const trimmed = name.trim();
    if (!trimmed) {
      setNameError('Ingresa un nombre para la campaña.');
      return;
    }
    setNameError(undefined);

    const values: CampaignFormValues = {};
    if (!isEdit || trimmed !== (campaign?.name ?? '')) values.name = trimmed;
    if (locationId) values.location_id = locationId;
    if (sourceId) values.source_import_batch_id = sourceId;
    const iso = toIso(deadline);
    if (iso) values.deadline_at = iso;

    if (isEdit && Object.keys(values).length === 0) {
      setNoChanges(true);
      return;
    }
    setNoChanges(false);
    onSubmit(values);
  }

  const apiError = error ? ApiError.from(error) : undefined;

  return (
    <Dialog
      open={open}
      onOpenChange={onOpenChange}
      title={isEdit ? 'Editar campaña' : 'Nueva campaña'}
      description={
        isEdit
          ? 'Los cambios se envían con la versión actual; si alguien más la modificó, el backend lo rechazará.'
          : 'Se crea en estado borrador: después se asigna responsable, se ajusta y se inicia.'
      }
      closeLabel="Cerrar"
      footer={
        <>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button variant="primary" type="submit" form={formId} loading={pending}>
            {isEdit ? 'Guardar cambios' : 'Crear campaña'}
          </Button>
        </>
      }
    >
      <form id={formId} className={styles.form} onSubmit={handleSubmit} noValidate>
        {apiError ? (
          <Alert tone="danger" title="No se pudo guardar">
            {apiError.message}
          </Alert>
        ) : null}
        {noChanges ? (
          <Alert tone="info" title="Sin cambios">
            No modificaste ningún campo, así que no enviamos nada al servidor.
          </Alert>
        ) : null}

        <Input
          label="Nombre de la campaña"
          required
          value={name}
          error={nameError}
          placeholder="Inventario almacén central · línea A"
          onChange={(event) => {
            setName(event.target.value);
            if (nameError) setNameError(undefined);
          }}
        />

        <div className={styles.grid}>
          <div className={styles.field}>
            <label className={styles.label} htmlFor="campaign-location">
              Ubicación
            </label>
            <select
              id="campaign-location"
              className={styles.select}
              value={locationId}
              disabled={locked}
              onChange={(event) => setLocationId(event.target.value)}
            >
              <option value="">{isEdit ? 'Sin cambiar' : 'Sin ubicación'}</option>
              {locations.map((location) => (
                <option key={location.id} value={location.id}>
                  {location.name}
                  {location.code ? ` · ${location.code}` : ''}
                </option>
              ))}
            </select>
            <p className={styles.hint}>
              {locked
                ? 'Snapshot congelado: el backend ya no admite cambiar la ubicación.'
                : isEdit
                  ? 'Vacío: no modifica la ubicación actual.'
                  : 'Vacío: la campaña queda sin ubicación física.'}
            </p>
          </div>

          <div className={styles.field}>
            <label className={styles.label} htmlFor="campaign-source">
              Origen del snapshot
            </label>
            <select
              id="campaign-source"
              className={styles.select}
              value={sourceId}
              disabled={locked || sourcesLoading}
              onChange={(event) => setSourceId(event.target.value)}
            >
              <option value="">{isEdit ? 'Sin cambiar' : 'Sin origen'}</option>
              {sources.map((source) => (
                <option key={source.id} value={source.id}>
                  {sourceLabel(source)}
                </option>
              ))}
            </select>
            {sourcesError ? (
              <p className={styles.error} role="alert">
                No pudimos cargar los orígenes disponibles.
              </p>
            ) : (
              <p className={styles.hint}>
                {locked
                  ? 'Snapshot congelado: el backend ya no admite cambiar el origen.'
                  : sourcesLoading
                    ? 'Cargando orígenes…'
                    : isEdit
                      ? 'El detalle no expone el origen actual: vacío no lo modifica.'
                      : 'El inicio de campaña exige un origen de snapshot.'}
              </p>
            )}
          </div>

          <div className={styles.field}>
            <label className={styles.label} htmlFor="campaign-deadline">
              Fecha límite
            </label>
            <input
              id="campaign-deadline"
              type="datetime-local"
              className={styles.select}
              value={deadline}
              disabled={locked}
              onChange={(event) => setDeadline(event.target.value)}
            />
            <p className={styles.hint}>
              {locked
                ? 'Snapshot congelado: el backend ya no admite cambiar la fecha límite.'
                : isEdit
                  ? 'Vacío: mantiene la fecha límite actual.'
                  : 'Se envía con zona horaria; vacío deja la campaña sin fecha.'}
            </p>
          </div>
        </div>
      </form>
    </Dialog>
  );
}
