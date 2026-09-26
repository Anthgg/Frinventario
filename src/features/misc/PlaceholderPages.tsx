import { FileText, Inbox, ListChecks, Scale } from 'lucide-react';
import { Link } from 'react-router-dom';
import { PageHeader } from '@/components/layout/PageHeader';
import { PageShell } from '@/components/layout/PageShell';
import { Badge } from '@/components/ui/Badge';
import { Card } from '@/components/ui/Card';
import { EmptyState } from '@/components/ui/State';
import { UI_MOCK } from '../mock/data';
import styles from './PlaceholderPages.module.css';

const MOCK_BADGE = <Badge tone="hilo">{UI_MOCK}</Badge>;

export function RecountsPage() {
  return (
    <PageShell>
      <PageHeader
        title="Reconteos"
        description="Segunda pasada sobre productos marcados durante el conteo principal."
        badge={MOCK_BADGE}
      />
      <Card padding="none">
        <EmptyState
          icon={<ListChecks size={20} />}
          title="Sin sesiones de reconteo"
          description="Cuando un supervisor abra un reconteo aparecerá aquí, con su responsable y estado."
        />
      </Card>
    </PageShell>
  );
}

export function ReconciliationPage() {
  return (
    <PageShell>
      <PageHeader
        title="Conciliación"
        description="Comparación de lo contado contra el registro — resuelta por el backend, revisada aquí."
        badge={MOCK_BADGE}
      />
      <Card padding="none">
        <EmptyState
          icon={<Scale size={20} />}
          title="Sin excepciones pendientes"
          description="No hay diferencias esperando revisión en esta campaña."
        />
      </Card>
    </PageShell>
  );
}

export function DocumentsPage() {
  return (
    <PageShell>
      <PageHeader
        title="Documentos"
        description="Guías, boletas y evidencias vinculadas a las campañas de inventario."
        badge={MOCK_BADGE}
      />
      <Card padding="none">
        <EmptyState
          icon={<FileText size={20} />}
          title="Sin documentos"
          description="Los archivos que subas desde el dispositivo se listarán aquí con su estado de procesamiento."
        />
      </Card>
    </PageShell>
  );
}

const COMPANY_FIELDS: { label: string; note: string }[] = [
  { label: 'Razón social', note: 'Backend F010' },
  { label: 'RUC', note: 'Backend F010' },
  { label: 'Logo empresarial', note: 'Backend F010' },
  { label: 'Zona horaria', note: 'VITE_TIMEZONE' },
];

export function ConfiguracionPage() {
  return (
    <PageShell>
      <PageHeader
        title="Configuración"
        description="Datos de la empresa y preferencias del dispositivo."
        badge={MOCK_BADGE}
      />
      <Card padding="lg">
        <h2 className={styles.sectionTitle}>Empresa</h2>
        <p className={styles.sectionNote}>
          Estos valores los entrega el backend (F010). No se dejan fijos en el frontend.
        </p>
        <dl className={styles.fields}>
          {COMPANY_FIELDS.map((field) => (
            <div key={field.label} className={styles.field}>
              <dt>{field.label}</dt>
              <dd>
                <span className={styles.placeholder} aria-label={`${field.label}: sin dato`}>
                  —
                </span>
                <span className={styles.note}>{field.note}</span>
              </dd>
            </div>
          ))}
        </dl>
      </Card>
    </PageShell>
  );
}

export function NotFoundPage() {
  return (
    <div className={styles.notFound}>
      <EmptyState
        icon={<Inbox size={20} />}
        title="404 — fuera del laberinto"
        description="La ruta que pediste no existe en esta versión de la aplicación."
        action={
          <Link className={styles.notFoundLink} to="/app/dashboard">
            Volver al dashboard
          </Link>
        }
      />
    </div>
  );
}
