import { Link } from 'react-router-dom';
import { ArrowUpRight } from 'lucide-react';
import { useAuth } from '@/auth/AuthProvider';
import { PERMISSIONS, hasPermission } from '@/auth/permissions';
import { useApiQuery } from '@/api/query';
import { inventoryApi, type CampaignSummary, type MyAssignment } from '@/api/inventory';
import { PageHeader } from '@/components/layout/PageHeader';
import { PageShell } from '@/components/layout/PageShell';
import { Badge } from '@/components/ui/Badge';
import { Card } from '@/components/ui/Card';
import { Skeleton } from '@/components/ui/Skeleton';
import { EmptyState, ErrorState } from '@/components/ui/State';
import { STATUS_LABEL, STATUS_TONE, canReopenCampaign } from '@/features/inventarios/campaignStatus';
import { campaignKeys } from '@/features/inventarios/campaignCache';
import styles from './DashboardPage.module.css';

const DASHBOARD_LIMIT = 50;
const UPCOMING_DAYS = 7;
const MY_ASSIGNMENTS_LIMIT = 20;

const DASHBOARD_DATE_FORMAT = new Intl.DateTimeFormat('es-PE', { dateStyle: 'medium' });

function formatDate(value: string | null): string {
  if (!value) return 'Sin fecha';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'Sin fecha';
  return DASHBOARD_DATE_FORMAT.format(date);
}

function daysUntil(value: string): number | null {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  const diff = date.getTime() - Date.now();
  return Math.ceil(diff / 86_400_000);
}

function isUpcoming(campaign: CampaignSummary): boolean {
  if (!campaign.deadline_at) return false;
  if (canReopenCampaign(campaign.status) || campaign.status === 'CANCELLED') return false;
  const days = daysUntil(campaign.deadline_at);
  return days !== null && days >= 0 && days <= UPCOMING_DAYS;
}

function isOverdue(campaign: CampaignSummary): boolean {
  if (!campaign.deadline_at) return false;
  const days = daysUntil(campaign.deadline_at);
  return days !== null && days < 0;
}

function CampaignRow({
  campaign,
  meta,
}: {
  campaign: MyAssignment | CampaignSummary;
  meta?: React.ReactNode;
}) {
  return (
    <li>
      <Link className={styles.campaignRow} to={`/app/inventarios/${campaign.id}`}>
        <span className={styles.campaignMain}>
          <span className={styles.campaignName}>{campaign.name}</span>
          <span className={styles.campaignMeta}>
            <span className="mono">{campaign.code}</span>
            <span aria-hidden="true">·</span>
            <span>{formatDate(campaign.deadline_at)}</span>
            {meta ? (
              <>
                <span aria-hidden="true">·</span>
                {meta}
              </>
            ) : null}
          </span>
        </span>
        <span className={styles.campaignSide}>
          <Badge tone={STATUS_TONE[campaign.status]} dot>
            {STATUS_LABEL[campaign.status]}
          </Badge>
        </span>
      </Link>
    </li>
  );
}

function RowSkeletons({ rows = 3 }: { rows?: number }) {
  return (
    <div className={styles.feedSkeleton}>
      <span className="sr-only">Cargando…</span>
      {Array.from({ length: rows }, (_, index) => (
        <div key={index} className={styles.feedSkeletonRow} aria-hidden="true">
          <Skeleton width="45%" height={12} radius="var(--r-xs)" />
          <Skeleton width="24%" height={12} radius="var(--r-xs)" />
        </div>
      ))}
    </div>
  );
}

export function DashboardPage() {
  const { user, permissions } = useAuth();
  const canRead = hasPermission(permissions, PERMISSIONS.INVENTORY_READ);

  const listParams = { limit: DASHBOARD_LIMIT, offset: 0 };
  const campaignsQuery = useApiQuery(
    campaignKeys.list(listParams),
    () => inventoryApi.listCampaigns(listParams),
    { enabled: canRead },
  );
  const mineQuery = useApiQuery(
    campaignKeys.myAssignments,
    () => inventoryApi.myAssignments({ limit: MY_ASSIGNMENTS_LIMIT }),
    { enabled: canRead },
  );

  const page = campaignsQuery.data;
  const items = page?.items ?? [];
  const mine = mineQuery.data ?? [];

  const counts = {
    total: page?.total ?? 0,
    loaded: items.length,
    enConteo: items.filter((item) => item.status === 'IN_PROGRESS').length,
    porIniciar: items.filter((item) => item.status === 'DRAFT' || item.status === 'ASSIGNED').length,
    enControl: items.filter(
      (item) => item.status === 'SUBMITTED' || item.status === 'RECOUNT' || item.status === 'UNDER_REVIEW',
    ).length,
    finalizadas: items.filter((item) => item.status === 'APPROVED' || item.status === 'CLOSED').length,
    vencenPronto: items.filter(isUpcoming).length,
    vencidas: items.filter(isOverdue).length,
  };

  const upcoming = [...items]
    .filter(
      (item) =>
        item.deadline_at &&
        item.status !== 'CLOSED' &&
        item.status !== 'CANCELLED' &&
        item.status !== 'APPROVED',
    )
    .sort((a, b) => Date.parse(a.deadline_at!) - Date.parse(b.deadline_at!))
    .slice(0, 5);

  return (
    <PageShell>
      <PageHeader
        title="Dashboard"
        description={`Operación de conteo en curso, ${user?.display_name ?? 'invitado'}.`}
        badge={canRead ? <Badge tone="neutral">Datos reales</Badge> : null}
      />

      <section className={styles.heroGrid} aria-label="Mis inventarios y resumen">
        <Card tone="glass" padding="lg" className={styles.hero}>
          <p className={styles.heroLabel}>Mis inventarios</p>
          {!canRead ? (
            <EmptyState
              compact
              title="Sin acceso a inventario"
              description="Tu cuenta no tiene permiso para leer campañas. Pide acceso a un administrador."
            />
          ) : mineQuery.error ? (
            <ErrorState
              compact
              error={mineQuery.error}
              title="No pudimos cargar tus asignaciones"
              onRetry={mineQuery.refetch}
            />
          ) : mineQuery.isLoading ? (
            <RowSkeletons rows={3} />
          ) : mine.length === 0 ? (
            <EmptyState
              compact
              title="Sin campañas asignadas"
              description="Cuando un responsable te asigne una campaña aparecerá aquí."
            />
          ) : (
            <>
              <p className={styles.heroTitle}>
                {mine.length === 1 ? '1 campaña asignada' : `${mine.length} campañas asignadas`}
              </p>
              <ul className={styles.campaignList}>
                {mine.slice(0, 3).map((assignment) => (
                  <CampaignRow key={assignment.assignment_id} campaign={assignment} />
                ))}
              </ul>
            </>
          )}
          <div className={styles.heroFoot}>
            <span className={styles.heroMeta}>Campañas donde eres responsable</span>
            <Link className={styles.heroLink} to="/app/inventarios?mine=1">
              Ver inventarios <ArrowUpRight size={14} aria-hidden="true" />
            </Link>
          </div>
        </Card>

        <Card padding="lg" className={styles.summary}>
          <p className={styles.summaryTitle}>Estado general</p>
          {campaignsQuery.error && !page ? (
            <ErrorState
              compact
              error={campaignsQuery.error}
              title="No pudimos cargar las campañas"
              onRetry={campaignsQuery.refetch}
            />
          ) : !page ? (
            <RowSkeletons rows={5} />
          ) : (
            <>
              <dl className={styles.summaryList}>
                <div className={styles.summaryRow}>
                  <dt>Campañas (total)</dt>
                  <dd className="mono">{counts.total.toLocaleString('es-PE')}</dd>
                </div>
                <div className={styles.summaryRow}>
                  <dt>En conteo</dt>
                  <dd className="mono">{counts.enConteo}</dd>
                </div>
                <div className={styles.summaryRow}>
                  <dt>Por iniciar</dt>
                  <dd className="mono">{counts.porIniciar}</dd>
                </div>
                <div className={styles.summaryRow}>
                  <dt>En control</dt>
                  <dd className="mono">{counts.enControl}</dd>
                </div>
                <div className={styles.summaryRow}>
                  <dt>Finalizadas</dt>
                  <dd className="mono">{counts.finalizadas}</dd>
                </div>
                <div className={styles.summaryRow}>
                  <dt>Vencen en {UPCOMING_DAYS} días</dt>
                  <dd className="mono">{counts.vencenPronto}</dd>
                </div>
                <div className={styles.summaryRow}>
                  <dt>Vencidas</dt>
                  <dd className="mono">{counts.vencidas}</dd>
                </div>
              </dl>
              <p className={styles.summaryNote}>
                Conteos sobre las {counts.loaded} campañas cargadas (de {counts.total}).
              </p>
            </>
          )}
        </Card>
      </section>

      <section className={styles.panels} aria-label="Campañas próximas">
        <Card padding="lg">
          <header className={styles.panelHead}>
            <h3 className={styles.panelTitle}>Próximas a vencer</h3>
            <Link className={styles.panelLink} to="/app/inventarios">
              Ver todas
            </Link>
          </header>
          {campaignsQuery.error && !page ? (
            <ErrorState
              compact
              error={campaignsQuery.error}
              title="Sin datos de vencimiento"
              onRetry={campaignsQuery.refetch}
            />
          ) : !page ? (
            <RowSkeletons rows={4} />
          ) : upcoming.length === 0 ? (
            <EmptyState
              compact
              title="Ninguna campaña vence pronto"
              description={`No hay fechas límite dentro de los próximos ${UPCOMING_DAYS} días en las campañas cargadas.`}
            />
          ) : (
            <ul className={styles.campaignList}>
              {upcoming.map((campaign) => (
                <CampaignRow key={campaign.id} campaign={campaign} />
              ))}
            </ul>
          )}
        </Card>

        <Card padding="lg">
          <header className={styles.panelHead}>
            <h3 className={styles.panelTitle}>Cómo leer este panel</h3>
          </header>
          <p className={styles.readNote}>
            Los totales salen del listado paginado real: no inventamos agregados que el backend no
            expone. El modo ciego se mantiene: aquí solo verás lo que el backend devuelve, nunca los
            campos protegidos.
          </p>
        </Card>
      </section>
    </PageShell>
  );
}
