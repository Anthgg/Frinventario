import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { ChevronRight } from 'lucide-react';
import { PageHeader } from '@/components/layout/PageHeader';
import { Badge } from '@/components/ui/Badge';
import { EmptyState } from '@/components/ui/State';
import {
  CAMPAIGNS,
  STATUS_LABEL,
  STATUS_TONE,
  UI_MOCK,
  type CampaignStatus,
} from '../mock/data';
import styles from './InventariosPage.module.css';

type Filter = 'todas' | CampaignStatus;

const FILTERS: { value: Filter; label: string }[] = [
  { value: 'todas', label: 'Todas' },
  { value: 'en_conteo', label: 'En conteo' },
  { value: 'abierta', label: 'Abiertas' },
  { value: 'conciliacion', label: 'Conciliación' },
  { value: 'cerrada', label: 'Cerradas' },
];

export function InventariosPage() {
  const [filter, setFilter] = useState<Filter>('todas');

  const campaigns = useMemo(
    () => (filter === 'todas' ? CAMPAIGNS : CAMPAIGNS.filter((item) => item.status === filter)),
    [filter],
  );

  return (
    <>
      <PageHeader
        title="Inventarios"
        description="Campañas de conteo: quién las tiene, en qué estado están y cuánto se ha registrado."
        badge={<Badge tone="hilo">{UI_MOCK}</Badge>}
      />

      <div className={styles.filters} role="group" aria-label="Filtrar campañas">
        {FILTERS.map((option) => (
          <button
            key={option.value}
            type="button"
            className={[styles.chip, filter === option.value ? styles.chipActive : '']
              .filter(Boolean)
              .join(' ')}
            aria-pressed={filter === option.value}
            onClick={() => setFilter(option.value)}
          >
            {option.label}
          </button>
        ))}
      </div>

      {campaigns.length === 0 ? (
        <EmptyState
          title="Sin campañas en esta vista"
          description="No hay campañas con el estado seleccionado. Cambia el filtro para ver el resto."
        />
      ) : (
        <ul className={styles.list}>
          {campaigns.map((campaign) => (
            <li key={campaign.id}>
              <Link className={styles.row} to={`/app/inventarios/${campaign.id}`}>
                <span className={styles.leading}>
                  <span className={styles.name}>{campaign.name}</span>
                  <span className={styles.meta}>
                    <span className="mono">{campaign.code}</span>
                    <span aria-hidden="true">·</span>
                    <span>{campaign.responsable}</span>
                    <span aria-hidden="true">·</span>
                    <span>{campaign.fecha}</span>
                  </span>
                </span>

                <span className={styles.trailing}>
                  <span className={styles.count}>
                    <span className="mono">{campaign.registrados.toLocaleString('es-PE')}</span>
                    <span className={styles.countLabel}>registrados</span>
                  </span>
                  <Badge tone={STATUS_TONE[campaign.status]} dot>
                    {STATUS_LABEL[campaign.status]}
                  </Badge>
                  <ChevronRight size={16} className={styles.chevron} aria-hidden="true" />
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
