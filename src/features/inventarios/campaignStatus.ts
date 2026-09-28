import type { BadgeTone } from '@/components/ui/Badge';
import type { CampaignStatus } from '@/api/inventory';

/**
 * Estados de campaña EXACTAMENTE como los devuelve el backend (CampaignStatus),
 * con etiqueta humana para la UI. El enum real se conserva internamente.
 */

export const STATUS_LABEL: Record<CampaignStatus, string> = {
  DRAFT: 'Borrador',
  ASSIGNED: 'Asignada',
  IN_PROGRESS: 'En conteo',
  SUBMITTED: 'Conteo enviado',
  RECOUNT: 'En reconteo',
  UNDER_REVIEW: 'En revisión',
  APPROVED: 'Aprobada',
  CLOSED: 'Cerrada',
  EXPIRED: 'Vencida',
  CANCELLED: 'Cancelada',
};

export const STATUS_TONE: Record<CampaignStatus, BadgeTone> = {
  DRAFT: 'neutral',
  ASSIGNED: 'info',
  IN_PROGRESS: 'hilo',
  SUBMITTED: 'info',
  RECOUNT: 'warning',
  UNDER_REVIEW: 'warning',
  APPROVED: 'success',
  CLOSED: 'neutral',
  EXPIRED: 'danger',
  CANCELLED: 'danger',
};

/**
 * Recorrido real de una campaña. NO es decoración: es la secuencia de estados
 * por la que pasa una campaña que llega a cierre. RECOUNT es opcional (solo
 * cuando hubo reconteo), por eso el tramo se dibuja continuo y el estado
 * actual es el que ancla el hilo.
 */
export const CAMPAIGN_LIFECYCLE: readonly CampaignStatus[] = [
  'DRAFT',
  'ASSIGNED',
  'IN_PROGRESS',
  'SUBMITTED',
  'RECOUNT',
  'UNDER_REVIEW',
  'APPROVED',
  'CLOSED',
];

/** Estados fuera del recorrido: salidas por vencimiento o cancelación. */
export const OFF_RAMP_STATUSES: readonly CampaignStatus[] = ['EXPIRED', 'CANCELLED'];

export function lifecycleIndex(status: CampaignStatus): number {
  return CAMPAIGN_LIFECYCLE.indexOf(status);
}

export function isOffRamp(status: CampaignStatus): boolean {
  return OFF_RAMP_STATUSES.includes(status);
}

/** Acciones disponibles según status (el backend sigue validando). */
export function canStartCampaign(status: CampaignStatus): boolean {
  return status === 'DRAFT' || status === 'ASSIGNED';
}

export function canCancelCampaign(status: CampaignStatus): boolean {
  return status === 'DRAFT' || status === 'ASSIGNED' || status === 'IN_PROGRESS';
}

export function canReopenCampaign(status: CampaignStatus): boolean {
  return status === 'EXPIRED' || status === 'CLOSED';
}

export function canAssignResponsible(status: CampaignStatus): boolean {
  return status === 'DRAFT' || status === 'ASSIGNED' || status === 'IN_PROGRESS';
}

export function canUnassignResponsible(status: CampaignStatus): boolean {
  return status === 'DRAFT' || status === 'ASSIGNED';
}

/** Estados que cuentan como "en curso" para el dashboard. */
export function isOngoing(status: CampaignStatus): boolean {
  return (
    status === 'ASSIGNED' ||
    status === 'IN_PROGRESS' ||
    status === 'SUBMITTED' ||
    status === 'RECOUNT' ||
    status === 'UNDER_REVIEW'
  );
}
