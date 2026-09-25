import { Link, useParams } from 'react-router-dom';
import { EyeOff } from 'lucide-react';
import { PageHeader } from '@/components/layout/PageHeader';
import { Alert } from '@/components/ui/Alert';
import { Badge } from '@/components/ui/Badge';
import { Card } from '@/components/ui/Card';
import { Tabs } from '@/components/ui/Tabs';
import { ErrorState, EmptyState } from '@/components/ui/State';
import { CAMPAIGNS, STATUS_LABEL, STATUS_TONE, UI_MOCK } from '../mock/data';
import styles from './CampaignDetailPage.module.css';

export function CampaignDetailPage() {
  const { campaignId } = useParams();
  const campaign = CAMPAIGNS.find((item) => item.id === campaignId);

  if (!campaign) {
    return (
      <ErrorState
        title="Campaña no encontrada"
        description={`No existe la campaña con identificador «${campaignId ?? ''}».`}
        error={undefined}
      />
    );
  }

  return (
    <>
      <PageHeader
        title={campaign.name}
        description={
          <span className={styles.headerMeta}>
            <span className="mono">{campaign.code}</span>
            <span aria-hidden="true">·</span>
            <span>Responsable: {campaign.responsable}</span>
            <span aria-hidden="true">·</span>
            <span>{campaign.fecha}</span>
          </span>
        }
        badge={
          <>
            <Badge tone={STATUS_TONE[campaign.status]} dot>
              {STATUS_LABEL[campaign.status]}
            </Badge>
            <Badge tone="hilo">{UI_MOCK}</Badge>
          </>
        }
        actions={
          <Link className={styles.countLink} to={`/app/conteo/ses-001`}>
            Ir al conteo
          </Link>
        }
      />

      <Alert tone="info" title="Modo ciego activo">
        <span className={styles.blind}>
          <EyeOff size={13} aria-hidden="true" />
          El operador ve lo registrado, nunca lo esperado: sin totales, diferencias, costos ni
          valorizaciones.
        </span>
      </Alert>

      <div className={styles.tabs}>
        <Tabs
          label="Secciones de la campaña"
          items={[
            {
              value: 'resumen',
              label: 'Resumen',
              content: (
                <Card padding="lg">
                  <dl className={styles.data}>
                    <div>
                      <dt>Unidades registradas</dt>
                      <dd className="mono">{campaign.registrados.toLocaleString('es-PE')}</dd>
                    </div>
                    <div>
                      <dt>Sesiones de conteo</dt>
                      <dd className="mono">4</dd>
                    </div>
                    <div>
                      <dt>Documentos adjuntos</dt>
                      <dd className="mono">3</dd>
                    </div>
                  </dl>
                </Card>
              ),
            },
            {
              value: 'conteo',
              label: 'Conteo',
              content: (
                <Card padding="lg">
                  <EmptyState
                    compact
                    title="Aún sin sesiones registradas"
                    description="Las sesiones aparecen aquí cuando el operador abre un conteo desde el dispositivo."
                    action={
                      <Link className={styles.countLink} to="/app/conteo/ses-001">
                        Abrir sesión demo
                      </Link>
                    }
                  />
                </Card>
              ),
            },
            {
              value: 'documentos',
              label: 'Documentos',
              content: (
                <Card padding="lg">
                  <EmptyState
                    compact
                    title="Sin documentos"
                    description="Guías, boletas y evidencias adjuntas se listarán en este tab."
                  />
                </Card>
              ),
            },
          ]}
        />
      </div>
    </>
  );
}
