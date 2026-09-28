import { useState, type ReactNode } from 'react';
import { useParams } from 'react-router-dom';
import { EyeOff } from 'lucide-react';
import { useAuth } from '@/auth/AuthProvider';
import { PERMISSIONS, hasPermission } from '@/auth/permissions';
import { ApiError } from '@/api/errors';
import { useApiQuery } from '@/api/query';
import { inventoryApi, type StartResult } from '@/api/inventory';
import { PageHeader } from '@/components/layout/PageHeader';
import { PageShell } from '@/components/layout/PageShell';
import { Alert } from '@/components/ui/Alert';
import { Badge, type BadgeTone } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Skeleton } from '@/components/ui/Skeleton';
import { EmptyState, ErrorState } from '@/components/ui/State';
import { useToast } from '@/components/ui/Toast';
import { formatDate, formatDateTime } from './campaignDateTime';
import { CampaignFormDialog, type CampaignFormValues } from './CampaignFormDialog';
import {
  CancelCampaignDialog,
  ReopenCampaignDialog,
  StartCampaignDialog,
  type StartPhase,
} from './CampaignLifecycleDialogs';
import { AssignResponsibleDialog, UnassignResponsibleDialog } from './AssignDialogs';
import { CampaignStatusRail } from './CampaignStatusRail';
import { campaignKeys, invalidateCampaignData } from './campaignCache';
import {
  STATUS_LABEL,
  STATUS_TONE,
  canAssignResponsible,
  canCancelCampaign,
  canReopenCampaign,
  canStartCampaign,
  canUnassignResponsible,
} from './campaignStatus';
import styles from './CampaignDetailPage.module.css';

type DialogName =
  | 'edit'
  | 'start'
  | 'cancel'
  | 'reopen'
  | 'assign'
  | 'unassign';

const HISTORY_LIMIT = 50;
const ASSIGNEE_CANDIDATE_LIMIT = 50;

const ASSIGNMENT_LABEL: Record<string, { label: string; tone: BadgeTone }> = {
  ACTIVE: { label: 'Activo', tone: 'success' },
  REVOKED: { label: 'Revocado', tone: 'neutral' },
};

function Row({
  term,
  value,
  note,
}: {
  term: string;
  value: ReactNode;
  note?: ReactNode;
}) {
  return (
    <div className={styles.row}>
      <dt className={styles.term}>{term}</dt>
      <dd className={styles.value}>
        {value}
        {note ? <span className={styles.note}>{note}</span> : null}
      </dd>
    </div>
  );
}

function PanelSkeleton() {
  return (
    <div className={styles.grid} aria-hidden="true">
      {Array.from({ length: 3 }, (_, index) => (
        <div key={index} className={styles.skeletonPanel}>
          <Skeleton width="40%" height={12} radius="var(--r-xs)" />
          <Skeleton width="75%" height={14} radius="var(--r-xs)" />
          <Skeleton width="60%" height={14} radius="var(--r-xs)" />
          <Skeleton width="50%" height={14} radius="var(--r-xs)" />
        </div>
      ))}
      <span className="sr-only">Cargando campaña…</span>
    </div>
  );
}

/** 409 = alguien más guardó primero; el mensaje real lo manda el backend. */
function isVersionConflict(error: ApiError): boolean {
  return error.status === 409 && /conflicto de versi[oó]n/i.test(error.message);
}

function isAggregateConfirmation(error: ApiError): boolean {
  return error.status === 409 && error.message.includes('confirm_aggregate_source');
}

export function CampaignDetailPage() {
  const { campaignId = '' } = useParams();
  const { user, permissions } = useAuth();
  const { push } = useToast();

  const canRead = hasPermission(permissions, PERMISSIONS.INVENTORY_READ);
  const canCreate = hasPermission(permissions, PERMISSIONS.INVENTORY_CREATE);
  const canAssign = hasPermission(permissions, PERMISSIONS.INVENTORY_ASSIGN);
  const canMonitor = hasPermission(permissions, PERMISSIONS.INVENTORY_MONITOR);
  const canClose = hasPermission(permissions, PERMISSIONS.INVENTORY_CLOSE);
  const canReopenPerm = hasPermission(permissions, PERMISSIONS.INVENTORY_REOPEN);
  const [assigneeOffset, setAssigneeOffset] = useState(0);

  const detailQuery = useApiQuery(
    campaignKeys.detail(campaignId),
    () => inventoryApi.getCampaign(campaignId),
    { enabled: canRead && Boolean(campaignId) },
  );
  const locationsQuery = useApiQuery(
    campaignKeys.locations,
    () => inventoryApi.listLocations({ limit: 200 }),
    { enabled: canRead },
  );
  const historyQuery = useApiQuery(
    campaignKeys.assignments(campaignId),
    () => inventoryApi.assignmentHistory(campaignId, { limit: HISTORY_LIMIT }),
    { enabled: canRead && canMonitor && Boolean(campaignId) },
  );
  const mineQuery = useApiQuery(
    campaignKeys.myAssignments,
    () => inventoryApi.myAssignments({ limit: 100 }),
    { enabled: canRead },
  );
  const sourcesQuery = useApiQuery(
    campaignKeys.sources,
    () => inventoryApi.listSnapshotSources({ limit: 200 }),
    { enabled: canCreate },
  );
  const candidatesQuery = useApiQuery(
    campaignKeys.assigneeCandidates(assigneeOffset),
    () =>
      inventoryApi.assigneeCandidates({
        limit: ASSIGNEE_CANDIDATE_LIMIT,
        offset: assigneeOffset,
      }),
    { enabled: canAssign },
  );

  const [dialog, setDialog] = useState<DialogName | null>(null);
  const [startPhase, setStartPhase] = useState<StartPhase>('confirm');
  const [pending, setPending] = useState(false);
  const [actionError, setActionError] = useState<unknown>(null);
  const [conflict, setConflict] = useState(false);

  const campaign = detailQuery.data;
  const locations = locationsQuery.data ?? [];
  const history = historyQuery.data;
  const candidatePage = candidatesQuery.data;
  const candidates = candidatePage?.items ?? [];

  const locationName = (locationId: string | null): string => {
    if (!locationId) return 'Sin ubicación';
    return locations.find((item) => item.id === locationId)?.name ?? 'Ubicación no disponible';
  };

  const userName = (userId: string): string => {
    const match = candidates.find((item) => item.id === userId);
    return match?.display_name ?? `${userId.slice(0, 8)}…`;
  };

  const isMine = Boolean(campaign && (mineQuery.data ?? []).some((item) => item.id === campaign.id));
  const activeAssignment = history?.find((item) => item.status === 'ACTIVE');

  async function runAction(
    action: () => Promise<unknown>,
    successMessage?: string,
  ): Promise<unknown | null> {
    setPending(true);
    setActionError(null);
    try {
      const result = await action();
      invalidateCampaignData(campaignId);
      setDialog(null);
      setConflict(false);
      if (successMessage) push({ title: successMessage, tone: 'success' });
      return result;
    } catch (error) {
      const apiError = ApiError.from(error);
      if (isVersionConflict(apiError)) {
        setDialog(null);
        setConflict(true);
        invalidateCampaignData(campaignId);
        push({ title: 'La campaña cambió mientras la estabas editando.', tone: 'warning' });
        return null;
      }
      if (isAggregateConfirmation(apiError)) {
        setStartPhase('aggregate');
        setActionError(null);
        return null;
      }
      setActionError(apiError);
      return null;
    } finally {
      setPending(false);
    }
  }

  function openDialog(name: DialogName) {
    setActionError(null);
    setConflict(false);
    if (name === 'assign') setAssigneeOffset(0);
    if (name === 'start') setStartPhase('confirm');
    setDialog(name);
  }

  async function handleEdit(values: CampaignFormValues) {
    await runAction(
      () => inventoryApi.updateCampaign(campaignId, { expected_version: campaign!.version, ...values }),
      'Cambios guardados',
    );
  }

  async function handleStart(confirmAggregate: boolean) {
    const result = await runAction(() =>
      inventoryApi.startCampaign(campaignId, {
        expected_version: campaign!.version,
        confirm_aggregate_source: confirmAggregate,
      }),
    );
    if (!result) return;
    setDialog(null);
    const start = result as StartResult;
    push({
      title: start.already_started ? 'La campaña ya estaba iniciada.' : 'Campaña iniciada',
      description: start.already_started
        ? 'No se congeló un snapshot nuevo.'
        : 'Snapshot congelado y estado en «En conteo».',
      tone: 'success',
    });
  }

  async function handleCancel(reason: string) {
    await runAction(
      () => inventoryApi.cancelCampaign(campaignId, { reason, expected_version: campaign!.version }),
      'Campaña cancelada',
    );
  }

  async function handleReopen(values: { reason: string; new_deadline_at: string }) {
    await runAction(
      () =>
        inventoryApi.reopenCampaign(campaignId, {
          ...values,
          expected_version: campaign!.version,
        }),
      'Campaña reabierta',
    );
  }

  async function handleAssign(userId: string) {
    await runAction(
      () => inventoryApi.assign(campaignId, { user_id: userId, expected_version: campaign!.version }),
      'Responsable asignado',
    );
  }

  async function handleUnassign() {
    await runAction(
      () => inventoryApi.unassign(campaignId, { expected_version: campaign!.version }),
      'Responsable quitado',
    );
  }

  if (!canRead) {
    return (
      <PageShell>
        <PageHeader title="Campaña" />
        <EmptyState
          title="Sin acceso a inventario"
          description="Tu cuenta no tiene permiso inventory.read para ver estas campañas."
        />
      </PageShell>
    );
  }

  if (detailQuery.error && !campaign) {
    return (
      <PageShell>
        <PageHeader title="Campaña" />
        <ErrorState
          error={detailQuery.error}
          title="No pudimos cargar la campaña"
          onRetry={detailQuery.refetch}
        />
      </PageShell>
    );
  }

  if (!campaign) {
    return (
      <PageShell>
        <PageHeader title="Campaña" />
        <PanelSkeleton />
      </PageShell>
    );
  }

  const status = campaign.status;
  const showEdit = canCreate;
  const showStart = canCreate && canStartCampaign(status);
  const showCancel = canClose && canCancelCampaign(status);
  const showReopen = canReopenPerm && canReopenCampaign(status);
  const showAssign = canAssign && canAssignResponsible(status);
  const hasActive = Boolean(activeAssignment) || isMine;
  const showUnassign = canAssign && canUnassignResponsible(status) && hasActive;

  return (
    <PageShell>
      <PageHeader
        title={campaign.name}
        description={
          <span className={styles.headerMeta}>
            <span className="mono">{campaign.code}</span>
            <span aria-hidden="true">·</span>
            <span>{locationName(campaign.location_id)}</span>
            <span aria-hidden="true">·</span>
            <span>Vence {formatDate(campaign.deadline_at)}</span>
          </span>
        }
        badge={
          <Badge tone={STATUS_TONE[status]} dot>
            {STATUS_LABEL[status]}
          </Badge>
        }
        actions={
          <div className={styles.actions}>
            {showEdit ? (
              <Button variant="secondary" onClick={() => openDialog('edit')}>
                Editar
              </Button>
            ) : null}
            {showStart ? (
              <Button variant="primary" onClick={() => openDialog('start')}>
                Iniciar
              </Button>
            ) : null}
            {showAssign ? (
              <Button variant="secondary" onClick={() => openDialog('assign')}>
                Asignar
              </Button>
            ) : null}
            {showUnassign ? (
              <Button variant="ghost" onClick={() => openDialog('unassign')}>
                Desasignar
              </Button>
            ) : null}
            {showReopen ? (
              <Button variant="secondary" onClick={() => openDialog('reopen')}>
                Reabrir
              </Button>
            ) : null}
            {showCancel ? (
              <Button variant="danger" onClick={() => openDialog('cancel')}>
                Cancelar
              </Button>
            ) : null}
          </div>
        }
      />

      {conflict ? (
        <Alert tone="warning" title="La campaña cambió mientras la estabas editando.">
          Recargamos los datos más recientes: revisa la versión nueva y vuelve a intentarlo.
        </Alert>
      ) : null}

      <CampaignStatusRail status={status} />

      <div className={styles.grid}>
        <Card padding="lg" className={styles.panel}>
          <h3 className={styles.panelTitle}>Datos de la campaña</h3>
          <dl className={styles.data}>
            <Row term="Código" value={<span className="mono">{campaign.code}</span>} />
            <Row term="Estado" value={STATUS_LABEL[status]} />
            <Row
              term="Versión"
              value={<span className="mono">{campaign.version}</span>}
              note="Se envía en cada escritura para no pisar cambios ajenos."
            />
            <Row term="Creada" value={<span className="mono">{formatDateTime(campaign.created_at)}</span>} />
          </dl>
        </Card>

        <Card padding="lg" className={styles.panel}>
          <h3 className={styles.panelTitle}>Ubicación y fechas</h3>
          <dl className={styles.data}>
            <Row term="Ubicación" value={locationName(campaign.location_id)} />
            <Row term="Vence" value={<span className="mono">{formatDateTime(campaign.deadline_at)}</span>} />
            <Row term="Inicio" value={<span className="mono">{formatDateTime(campaign.starts_at)}</span>} />
            <Row term="Identificador" value={<span className="mono">{campaign.id}</span>} />
          </dl>
        </Card>

        <Card padding="lg" className={styles.panel}>
          <h3 className={styles.panelTitle}>Responsable</h3>
          {canMonitor ? (
            historyQuery.error && !history ? (
              <ErrorState
                compact
                error={historyQuery.error}
                title="Sin historial de asignaciones"
                onRetry={historyQuery.refetch}
              />
            ) : !history ? (
              <Skeleton width="70%" height={14} radius="var(--r-xs)" />
            ) : history.length === 0 ? (
              <EmptyState
                compact
                title="Sin asignaciones registradas"
                description="Asigna un responsable para que la campaña pueda avanzar."
              />
            ) : (
              <ul className={styles.assignmentList}>
                {history.map((item) => {
                  const meta = ASSIGNMENT_LABEL[item.status] ?? {
                    label: item.status,
                    tone: 'neutral' as BadgeTone,
                  };
                  const mineAssignment =
                    (mineQuery.data ?? []).find(
                      (assignment) => assignment.assignment_id === item.assignment_id,
                    ) ?? null;
                  return (
                    <li key={item.assignment_id} className={styles.assignmentItem}>
                      <span className={styles.assignmentWho}>
                        <span className={styles.assignmentName}>
                          {mineAssignment ? `${mineAssignment.name} · tú` : userName(item.user_id)}
                        </span>
                        <Badge tone={meta.tone}>{meta.label}</Badge>
                      </span>
                      <span className={styles.assignmentDates}>
                        <span className="mono">{formatDateTime(item.assigned_at)}</span>
                        {item.revoked_at ? (
                          <span className={styles.revoked}>
                            → {formatDateTime(item.revoked_at)}
                          </span>
                        ) : null}
                      </span>
                    </li>
                  );
                })}
              </ul>
            )
          ) : isMine ? (
            <p className={styles.mineNote}>
              Esta campaña está asignada a ti ({user?.display_name ?? 'tu cuenta'}).
            </p>
          ) : (
            <EmptyState
              compact
              title="Historial no visible"
              description="Tu cuenta no tiene permiso inventory.monitor para ver las asignaciones de esta campaña."
            />
          )}

          {isMine && canMonitor ? (
            <p className={styles.mineNote}>Esta campaña está asignada a ti.</p>
          ) : null}
        </Card>
      </div>

      <Alert tone="info" title="Modo ciego activo">
        <span className={styles.blind}>
          <EyeOff size={13} aria-hidden="true" />
          Esta pantalla solo expone lo que el backend devuelve: nunca los campos protegidos del
          modo ciego.
        </span>
      </Alert>

      {dialog === 'edit' ? (
        <CampaignFormDialog
          mode="edit"
          open
          onOpenChange={(open) => {
            if (!open) setDialog(null);
          }}
          campaign={campaign}
          locations={locations}
          sources={sourcesQuery.data ?? []}
          sourcesLoading={sourcesQuery.isLoading}
          sourcesError={sourcesQuery.error}
          pending={pending}
          error={actionError}
          onSubmit={(values) => void handleEdit(values)}
        />
      ) : null}

      {dialog === 'start' ? (
        <StartCampaignDialog
          open
          onOpenChange={(open) => {
            if (!open) setDialog(null);
          }}
          campaign={campaign}
          phase={startPhase}
          pending={pending}
          error={actionError}
          onConfirm={(confirm) => void handleStart(confirm)}
        />
      ) : null}

      {dialog === 'cancel' ? (
        <CancelCampaignDialog
          open
          onOpenChange={(open) => {
            if (!open) setDialog(null);
          }}
          campaign={campaign}
          pending={pending}
          error={actionError}
          onConfirm={(reason) => void handleCancel(reason)}
        />
      ) : null}

      {dialog === 'reopen' ? (
        <ReopenCampaignDialog
          open
          onOpenChange={(open) => {
            if (!open) setDialog(null);
          }}
          campaign={campaign}
          pending={pending}
          error={actionError}
          onConfirm={(values) => void handleReopen(values)}
        />
      ) : null}

      {dialog === 'assign' ? (
        <AssignResponsibleDialog
          open
          onOpenChange={(open) => {
            if (!open) setDialog(null);
          }}
          campaign={campaign}
          candidatePage={candidatePage}
          candidatesLoading={candidatesQuery.isLoading}
          candidatesError={candidatesQuery.error}
          onRetryCandidates={candidatesQuery.refetch}
          onCandidateOffsetChange={setAssigneeOffset}
          pending={pending}
          error={actionError}
          onSubmit={(userId) => void handleAssign(userId)}
        />
      ) : null}

      {dialog === 'unassign' ? (
        <UnassignResponsibleDialog
          open
          onOpenChange={(open) => {
            if (!open) setDialog(null);
          }}
          campaign={campaign}
          pending={pending}
          error={actionError}
          onConfirm={() => void handleUnassign()}
        />
      ) : null}
    </PageShell>
  );
}
