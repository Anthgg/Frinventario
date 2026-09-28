import { invalidateQueries } from '@/api/query';
import type { CampaignListParams } from '@/api/inventory';

/** Claves de caché: una por recurso real del backend. */
export const campaignKeys = {
  list: (params: CampaignListParams) =>
    `inventory.campaigns::${JSON.stringify({
      status: params.status ?? null,
      location_id: params.location_id ?? null,
      assigned_user_id: params.assigned_user_id ?? null,
      limit: params.limit ?? null,
      offset: params.offset ?? null,
    })}`,
  detail: (campaignId: string) => `inventory.campaign::${campaignId}`,
  assignments: (campaignId: string) => `inventory.assignments::${campaignId}`,
  locations: 'inventory.locations',
  sources: 'inventory.snapshot-sources',
  myAssignments: 'inventory.my-assignments',
  assigneeCandidates: (offset: number) => `inventory.assignee-candidates::${offset}`,
};

/**
 * Tras una mutación de campaña se refetchea todo lo que puede haber cambiado:
 * listados, detalle, dashboard y mis asignaciones. Nunca se pinta un estado
 * optimista que el backend no haya confirmado.
 */
export function invalidateCampaignData(campaignId?: string): void {
  invalidateQueries('inventory.campaigns');
  invalidateQueries(campaignKeys.myAssignments);
  if (campaignId) {
    invalidateQueries(campaignKeys.detail(campaignId));
    invalidateQueries(campaignKeys.assignments(campaignId));
  }
}
