import { useMemo, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { ChevronRight, Plus, X } from 'lucide-react';
import { useAuth } from '@/auth/AuthProvider';
import { hasPermission, PERMISSIONS } from '@/auth/permissions';
import { ApiError } from '@/api/errors';
import { useApiQuery } from '@/api/query';
import {
  inventoryApi,
  isCampaignStatus,
  type CampaignCreateBody,
  type CampaignListParams,
  type CampaignPage,
  type CampaignStatus,
  CAMPAIGN_STATUS_VALUES,
} from '@/api/inventory';
import { PageHeader } from '@/components/layout/PageHeader';
import { PageShell } from '@/components/layout/PageShell';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Pagination } from '@/components/ui/Pagination';
import { Skeleton } from '@/components/ui/Skeleton';
import { EmptyState, ErrorState } from '@/components/ui/State';
import { useToast } from '@/components/ui/Toast';
import { CampaignFormDialog, type CampaignFormValues } from './CampaignFormDialog';
import { formatDate, formatDateTime } from './campaignDateTime';
import { STATUS_LABEL, STATUS_TONE } from './campaignStatus';
import { campaignKeys, invalidateCampaignData } from './campaignCache';
import styles from './InventariosPage.module.css';

const PAGE_SIZE = 20;

interface Filters {
  status: CampaignStatus | '';
  locationId: string;
  mine: boolean;
}

function buildParams(filters: Filters, userId: string | undefined, offset: number): CampaignListParams {
  return {
    status: filters.status ? (filters.status as CampaignStatus) : undefined,
    location_id: filters.locationId || undefined,
    assigned_user_id: filters.mine ? userId : undefined,
    limit: PAGE_SIZE,
    offset,
  };
}

function setParam(params: URLSearchParams, key: string, value: string): void {
  if (value) params.set(key, value);
  else params.delete(key);
}

export function InventariosPage() {
  const { user, permissions } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();
  const { push } = useToast();
  const canFilterMine = hasPermission(permissions, PERMISSIONS.INVENTORY_READ);
  const canCreate = hasPermission(permissions, PERMISSIONS.INVENTORY_CREATE);

  // Los filtros viven en la URL: son compartibles y sobreviven a un refetch.
  const rawStatus = searchParams.get('status') ?? '';
  const filters = useMemo<Filters>(
    () => ({
      status: isCampaignStatus(rawStatus) ? rawStatus : '',
      locationId: searchParams.get('location') ?? '',
      mine: searchParams.get('mine') === '1',
    }),
    [searchParams, rawStatus],
  );
  const requestedPage = Number.parseInt(searchParams.get('page') ?? '1', 10);
  const currentPage =
    Number.isFinite(requestedPage) && requestedPage > 0 ? requestedPage : 1;
  const offset = (currentPage - 1) * PAGE_SIZE;

  const params = useMemo(
    () => buildParams(filters, user?.id, offset),
    [filters, user?.id, offset],
  );

  const listQuery = useApiQuery<CampaignPage>(
    campaignKeys.list(params),
    () => inventoryApi.listCampaigns(params),
    { previousKeyPrefix: 'inventory.campaigns' },
  );
  const locationsQuery = useApiQuery(campaignKeys.locations, () =>
    inventoryApi.listLocations({ limit: 200 }),
  );
  // GET /snapshot-sources exige inventory.create: no se pide sin ese permiso.
  const sourcesQuery = useApiQuery(
    campaignKeys.sources,
    () => inventoryApi.listSnapshotSources({ limit: 200 }),
    { enabled: canCreate },
  );

  const [createOpen, setCreateOpen] = useState(false);
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState<unknown>(null);

  const page = listQuery.data;

  async function handleCreate(values: CampaignFormValues) {
    if (!values.name) return;
    const body: CampaignCreateBody = {
      name: values.name,
      location_id: values.location_id ?? null,
      source_import_batch_id: values.source_import_batch_id ?? null,
      deadline_at: values.deadline_at ?? null,
    };
    setCreating(true);
    setCreateError(null);
    try {
      const created = await inventoryApi.createCampaign(body);
      invalidateCampaignData();
      setCreateOpen(false);
      push({
        title: 'Campaña creada',
        description: `${created.code} · estado borrador.`,
        tone: 'success',
      });
      navigate(`/app/inventarios/${created.id}`);
    } catch (error) {
      setCreateError(ApiError.from(error));
    } finally {
      setCreating(false);
    }
  }

  const locations = locationsQuery.data ?? [];
  const locationName = (locationId: string | null): string => {
    if (!locationId) return 'Sin ubicación';
    return locations.find((item) => item.id === locationId)?.name ?? 'Ubicación no disponible';
  };

  const pageCount = page ? Math.max(1, Math.ceil(page.total / PAGE_SIZE)) : 1;
  const hasFilters = Boolean(filters.status || filters.locationId || filters.mine);

  /** Cambia filtros y vuelve a la primera página (offset 0). */
  function updateFilters(patch: Partial<Filters>) {
    const merged = { ...filters, ...patch };
    const next = new URLSearchParams(searchParams);
    setParam(next, 'status', merged.status);
    setParam(next, 'location', merged.locationId);
    setParam(next, 'mine', merged.mine ? '1' : '');
    next.delete('page');
    setSearchParams(next);
  }

  function clearFilters() {
    setSearchParams(new URLSearchParams());
  }

  function goToPage(pageNumber: number) {
    const next = new URLSearchParams(searchParams);
    if (pageNumber <= 1) next.delete('page');
    else next.set('page', String(pageNumber));
    setSearchParams(next);
  }

  return (
    <PageShell>
      <PageHeader
        title="Inventarios"
        description="Campañas de conteo reales: estado, ubicación y fecha límite, con filtros y paginación del backend."
        badge={
          page ? (
            <Badge tone="neutral">
              {page.total.toLocaleString('es-PE')} en total
            </Badge>
          ) : null
        }
        actions={
          <>
            {canCreate ? (
              <Button
                variant="primary"
                onClick={() => {
                  setCreateError(null);
                  setCreateOpen(true);
                }}
              >
                <Plus size={15} aria-hidden="true" />
                Nueva campaña
              </Button>
            ) : null}
            {hasFilters ? (
              <Button variant="ghost" onClick={clearFilters}>
                <X size={15} />
                Limpiar filtros
              </Button>
            ) : null}
          </>
        }
      />

      <div className={styles.filters}>
        <div className={styles.filterField}>
          <label className={styles.filterLabel} htmlFor="filtro-estado">
            Estado
          </label>
          <select
            id="filtro-estado"
            className={styles.select}
            value={filters.status}
            onChange={(event) => updateFilters({ status: event.target.value as CampaignStatus | '' })}
          >
            <option value="">Todos los estados</option>
            {CAMPAIGN_STATUS_VALUES.map((status) => (
              <option key={status} value={status}>
                {STATUS_LABEL[status]}
              </option>
            ))}
          </select>
        </div>

        <div className={styles.filterField}>
          <label className={styles.filterLabel} htmlFor="filtro-ubicacion">
            Ubicación
          </label>
          <select
            id="filtro-ubicacion"
            className={styles.select}
            value={filters.locationId}
            onChange={(event) => updateFilters({ locationId: event.target.value })}
          >
            <option value="">Todas las ubicaciones</option>
            {locations.map((location) => (
              <option key={location.id} value={location.id}>
                {location.name}
                {location.code ? ` · ${location.code}` : ''}
              </option>
            ))}
          </select>
        </div>

        <div className={styles.filterField}>
          <span className={styles.filterLabel} id="filtro-mias-label">
            Responsable
          </span>
          <button
            type="button"
            className={[styles.chip, filters.mine ? styles.chipActive : '']
              .filter(Boolean)
              .join(' ')}
            aria-pressed={filters.mine}
            aria-labelledby="filtro-mias-label"
            disabled={!canFilterMine || !user}
            onClick={() => updateFilters({ mine: !filters.mine })}
          >
            Mis asignaciones
          </button>
        </div>
      </div>

      {listQuery.error && !page ? (
        <ErrorState
          error={listQuery.error}
          title="No pudimos cargar las campañas"
          description="El servicio de inventario no respondió. Reintenta; no mostramos datos de respaldo."
          onRetry={listQuery.refetch}
        />
      ) : !page ? (
        <div className={styles.list} aria-hidden="true">
          {Array.from({ length: 6 }, (_, index) => (
            <div key={index} className={styles.skeletonRow}>
              <Skeleton width="38%" height={14} radius="var(--r-xs)" />
              <Skeleton width="18%" height={14} radius="var(--r-xs)" />
              <Skeleton width="14%" height={14} radius="var(--r-xs)" />
            </div>
          ))}
          <span className="sr-only">Cargando campañas…</span>
        </div>
      ) : page.items.length === 0 ? (
        <EmptyState
          title={hasFilters ? 'Sin campañas con estos filtros' : 'Aún no hay campañas'}
          description={
            hasFilters
              ? 'Cambia el estado o la ubicación para ver el resto de campañas.'
              : 'Cuando se cree una campaña aparecerá aquí con su estado y su fecha límite.'
          }
          action={
            hasFilters ? (
              <Button variant="secondary" onClick={clearFilters}>
                Limpiar filtros
              </Button>
            ) : undefined
          }
        />
      ) : (
        <>
          {listQuery.error ? (
            <ErrorState
              compact
              error={listQuery.error}
              title="No pudimos actualizar la lista"
              description="Se muestran los últimos datos cargados. Reintenta para actualizar."
              onRetry={listQuery.refetch}
            />
          ) : null}

          <div
            className={[styles.list, listQuery.isFetching ? styles.fetching : '']
              .filter(Boolean)
              .join(' ')}
          >
            <div className={styles.head} aria-hidden="true">
              <span>Código</span>
              <span>Campaña</span>
              <span>Estado</span>
              <span>Ubicación</span>
              <span>Vence</span>
              <span>Creada</span>
            </div>

            <ul className={styles.rows}>
              {page.items.map((campaign) => (
                <li key={campaign.id}>
                  <Link className={styles.row} to={`/app/inventarios/${campaign.id}`}>
                    <span className={styles.cell}>
                      <span className={styles.cellLabel}>Código</span>
                      <span className="mono">{campaign.code}</span>
                    </span>
                    <span className={styles.cell}>
                      <span className={styles.cellLabel}>Campaña</span>
                      <span className={styles.name}>{campaign.name}</span>
                    </span>
                    <span className={styles.cell}>
                      <span className={styles.cellLabel}>Estado</span>
                      <Badge tone={STATUS_TONE[campaign.status]} dot>
                        {STATUS_LABEL[campaign.status]}
                      </Badge>
                    </span>
                    <span className={styles.cell}>
                      <span className={styles.cellLabel}>Ubicación</span>
                      <span className={styles.muted}>{locationName(campaign.location_id)}</span>
                    </span>
                    <span className={styles.cell}>
                      <span className={styles.cellLabel}>Vence</span>
                      <span className="mono">{formatDate(campaign.deadline_at)}</span>
                    </span>
                    <span className={styles.cell}>
                      <span className={styles.cellLabel}>Creada</span>
                      <span className="mono">{formatDateTime(campaign.created_at)}</span>
                    </span>
                    <ChevronRight size={16} className={styles.chevron} aria-hidden="true" />
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          <div className={styles.footer}>
            <p className={styles.range}>
              Mostrando{' '}
              <span className="mono">
                {page.offset + 1}–{Math.min(page.offset + page.limit, page.total)}
              </span>{' '}
              de <span className="mono">{page.total.toLocaleString('es-PE')}</span>
            </p>
            <Pagination
              page={currentPage}
              pageCount={pageCount}
              onPageChange={goToPage}
              label="Paginación de campañas"
            />
          </div>
        </>
      )}

      {listQuery.isLoading && page ? (
        <span className="sr-only" role="status">
          Actualizando campañas…
        </span>
      ) : null}

      {createOpen ? (
        <CampaignFormDialog
          mode="create"
          open
          onOpenChange={(open) => {
            if (!open) setCreateOpen(false);
          }}
          locations={locations}
          sources={sourcesQuery.data ?? []}
          sourcesLoading={sourcesQuery.isLoading}
          sourcesError={sourcesQuery.error}
          pending={creating}
          error={createError}
          onSubmit={(values) => void handleCreate(values)}
        />
      ) : null}
    </PageShell>
  );
}
