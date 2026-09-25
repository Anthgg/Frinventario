import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ArrowUpRight, ScanLine } from 'lucide-react';
import { useAuth } from '@/auth/AuthProvider';
import { PageHeader } from '@/components/layout/PageHeader';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Skeleton } from '@/components/ui/Skeleton';
import {
  ACTIVITY,
  CAMPAIGNS,
  DASHBOARD_KPI,
  STATUS_LABEL,
  STATUS_TONE,
  UI_MOCK,
} from '../mock/data';
import styles from './DashboardPage.module.css';

export function DashboardPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [feedLoading, setFeedLoading] = useState(true);

  useEffect(() => {
    const timer = window.setTimeout(() => setFeedLoading(false), 450);
    return () => window.clearTimeout(timer);
  }, []);

  const activas = CAMPAIGNS.filter((campaign) => campaign.status !== 'cerrada');
  const enCurso = activas[0];

  return (
    <>
      <PageHeader
        title="Dashboard"
        description={`Operación de conteo en curso, ${user?.display_name ?? 'invitado'}.`}
        badge={<Badge tone="hilo">{UI_MOCK}</Badge>}
        actions={
          <Button variant="primary" onClick={() => navigate('/app/conteo/ses-001')}>
            <ScanLine size={16} />
            Continuar conteo
          </Button>
        }
      />

      <section className={styles.heroGrid} aria-label="Resumen operativo">
        <Card tone="glass" padding="lg" className={styles.hero}>
          <p className={styles.heroLabel}>Conteo en curso</p>
          <h2 className={styles.heroTitle}>{enCurso?.name}</h2>
          <p className={styles.heroCode}>
            <span className="mono">{enCurso?.code}</span>
            <span className={styles.dot} aria-hidden="true" />
            <span>Sesión S-042</span>
          </p>

          <div className={styles.heroFigure}>
            <span className={styles.heroNumber}>{enCurso?.registrados.toLocaleString('es-PE')}</span>
            <span className={styles.heroUnit}>
              registrados
              <span className={styles.heroHint}>sin total esperado — modo ciego</span>
            </span>
          </div>

          <div className={styles.heroFoot}>
            <span className={styles.heroMeta}>Última lectura hace 2 min</span>
            <Link className={styles.heroLink} to="/app/conteo/ses-001">
              Abrir sesión <ArrowUpRight size={14} aria-hidden="true" />
            </Link>
          </div>
        </Card>

        <Card padding="lg" className={styles.summary}>
          <p className={styles.summaryTitle}>Hoy</p>
          <dl className={styles.summaryList}>
            <div className={styles.summaryRow}>
              <dt>Unidades contadas</dt>
              <dd className="mono">{DASHBOARD_KPI.unidadesHoy.toLocaleString('es-PE')}</dd>
            </div>
            <div className={styles.summaryRow}>
              <dt>Sesiones abiertas</dt>
              <dd className="mono">{DASHBOARD_KPI.sesionesAbiertas}</dd>
            </div>
            <div className={styles.summaryRow}>
              <dt>Campañas activas</dt>
              <dd className="mono">{DASHBOARD_KPI.campanasActivas}</dd>
            </div>
            <div className={styles.summaryRow}>
              <dt>Documentos por revisar</dt>
              <dd className="mono">{DASHBOARD_KPI.documentosPendientes}</dd>
            </div>
          </dl>
        </Card>
      </section>

      <section className={styles.panels}>
        <Card padding="lg">
          <header className={styles.panelHead}>
            <h3 className={styles.panelTitle}>Campañas recientes</h3>
            <Link className={styles.panelLink} to="/app/inventarios">
              Ver todas
            </Link>
          </header>
          <ul className={styles.campaignList}>
            {activas.slice(0, 3).map((campaign) => (
              <li key={campaign.id}>
                <Link className={styles.campaignRow} to={`/app/inventarios/${campaign.id}`}>
                  <span className={styles.campaignMain}>
                    <span className={styles.campaignName}>{campaign.name}</span>
                    <span className={styles.campaignMeta}>
                      <span className="mono">{campaign.code}</span>
                      <span aria-hidden="true">·</span>
                      {campaign.responsable}
                    </span>
                  </span>
                  <span className={styles.campaignSide}>
                    <Badge tone={STATUS_TONE[campaign.status]} dot>
                      {STATUS_LABEL[campaign.status]}
                    </Badge>
                    <span className={styles.campaignCount}>
                      <span className="mono">{campaign.registrados.toLocaleString('es-PE')}</span>
                      <span className={styles.campaignCountLabel}>registrados</span>
                    </span>
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </Card>

        <Card padding="lg">
          <header className={styles.panelHead}>
            <h3 className={styles.panelTitle}>Actividad</h3>
          </header>
          {feedLoading ? (
            <div className={styles.feedSkeleton}>
              <span className="sr-only">Cargando actividad…</span>
              {Array.from({ length: 4 }, (_, index) => (
                <div key={index} className={styles.feedSkeletonRow} aria-hidden="true">
                  <Skeleton width={44} height={12} radius="var(--r-xs)" />
                  <Skeleton width="70%" height={12} radius="var(--r-xs)" />
                </div>
              ))}
            </div>
          ) : (
            <ul className={styles.feed}>
              {ACTIVITY.map((entry) => (
                <li key={entry.id} className={styles.feedItem}>
                  <time className={styles.feedTime}>{entry.time}</time>
                  <p className={styles.feedText}>
                    <span className={styles.feedWho}>{entry.who}</span> {entry.text}
                  </p>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </section>
    </>
  );
}
