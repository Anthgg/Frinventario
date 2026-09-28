import { apiClient } from './client';

/**
 * Módulo API de inventario (FF002) — espejo del contrato REAL del backend
 * (app/api/inventory.py, OpenAPI congelado). Tipos blind-safe: el backend no
 * devuelve expected, costos ni diferencias, y este módulo tampoco los declara.
 */

/** Enum real de CampaignStatus (backend app/models/enums.py). */
export const CAMPAIGN_STATUS_VALUES = [
  'DRAFT',
  'ASSIGNED',
  'IN_PROGRESS',
  'SUBMITTED',
  'RECOUNT',
  'UNDER_REVIEW',
  'APPROVED',
  'CLOSED',
  'EXPIRED',
  'CANCELLED',
] as const;

export type CampaignStatus = (typeof CAMPAIGN_STATUS_VALUES)[number];

export function isCampaignStatus(value: unknown): value is CampaignStatus {
  return (
    typeof value === 'string' && (CAMPAIGN_STATUS_VALUES as readonly string[]).includes(value)
  );
}

export interface CampaignSummary {
  id: string;
  code: string;
  name: string;
  status: CampaignStatus;
  location_id: string | null;
  deadline_at: string | null;
  created_at: string | null;
  version: number;
}

export interface CampaignDetail extends CampaignSummary {
  starts_at: string | null;
}

export interface CampaignPage {
  total: number;
  limit: number;
  offset: number;
  items: CampaignSummary[];
}

export interface Location {
  id: string;
  code: string | null;
  name: string;
  external_ref: string | null;
  active: boolean;
}

export type StockScope = 'LOCATION' | 'AGGREGATE' | string;

export interface SnapshotSource {
  id: string;
  import_type: string;
  source_filename: string | null;
  completed_at: string | null;
  stock_snapshot_count: number;
  stock_scope: StockScope;
}

/** GET /my-assignments: campaign_summary + campos de la asignación activa. */
export interface MyAssignment extends CampaignSummary {
  assignment_id: string;
  assigned_at: string | null;
}

export interface AssignmentHistoryItem {
  assignment_id: string;
  user_id: string;
  status: string;
  assigned_at: string | null;
  revoked_at: string | null;
}

/** GET /admin/users (permiso users.read): el backend devuelve una lista plana. */
export interface AdminUser {
  id: string;
  email: string;
  display_name: string;
  is_active: boolean;
  roles: string[];
}

export interface CampaignListParams {
  status?: CampaignStatus;
  location_id?: string;
  assigned_user_id?: string;
  limit?: number;
  offset?: number;
}

export interface CampaignCreateBody {
  name: string;
  location_id?: string | null;
  source_import_batch_id?: string | null;
  deadline_at?: string | null;
}

export interface CampaignUpdateBody {
  expected_version: number;
  name?: string | null;
  location_id?: string | null;
  source_import_batch_id?: string | null;
  deadline_at?: string | null;
}

export interface StartCampaignBody {
  expected_version: number;
  confirm_aggregate_source?: boolean;
}

export interface CancelCampaignBody {
  reason: string;
  expected_version: number;
}

export interface ReopenCampaignBody {
  reason: string;
  new_deadline_at: string;
  expected_version: number;
}

export interface AssignBody {
  user_id: string;
  expected_version: number;
}

export interface VersionBody {
  expected_version: number;
}

export interface AssignResult {
  assignment_id: string;
  user_id: string;
  status: string;
  created: boolean;
  reassigned: boolean;
}

export interface StartResult extends CampaignDetail {
  already_started: boolean;
}

type QueryValue = string | number | undefined;

function clean(params: Record<string, QueryValue | null | undefined>) {
  const out: Record<string, QueryValue> = {};
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== null && value !== '') out[key] = value;
  }
  return out;
}

const BASE = '/inventory';

export const inventoryApi = {
  listCampaigns(params: CampaignListParams = {}, signal?: AbortSignal) {
    return apiClient.get<CampaignPage>(`${BASE}/campaigns`, {
      query: clean({
        status: params.status,
        location_id: params.location_id,
        assigned_user_id: params.assigned_user_id,
        limit: params.limit,
        offset: params.offset,
      }),
      signal,
    });
  },

  getCampaign(campaignId: string, signal?: AbortSignal) {
    return apiClient.get<CampaignDetail>(`${BASE}/campaigns/${campaignId}`, { signal });
  },

  createCampaign(body: CampaignCreateBody) {
    return apiClient.post<CampaignDetail>(`${BASE}/campaigns`, body);
  },

  updateCampaign(campaignId: string, body: CampaignUpdateBody) {
    return apiClient.patch<CampaignDetail>(`${BASE}/campaigns/${campaignId}`, body);
  },

  startCampaign(campaignId: string, body: StartCampaignBody) {
    return apiClient.post<StartResult>(`${BASE}/campaigns/${campaignId}/start`, body);
  },

  cancelCampaign(campaignId: string, body: CancelCampaignBody) {
    return apiClient.post<CampaignDetail>(`${BASE}/campaigns/${campaignId}/cancel`, body);
  },

  reopenCampaign(campaignId: string, body: ReopenCampaignBody) {
    return apiClient.post<CampaignDetail>(`${BASE}/campaigns/${campaignId}/reopen`, body);
  },

  listLocations(params: { limit?: number; offset?: number } = {}, signal?: AbortSignal) {
    return apiClient.get<Location[]>(`${BASE}/locations`, {
      query: clean({ limit: params.limit, offset: params.offset }),
      signal,
    });
  },

  getLocation(locationId: string, signal?: AbortSignal) {
    return apiClient.get<Location>(`${BASE}/locations/${locationId}`, { signal });
  },

  listSnapshotSources(params: { limit?: number; offset?: number } = {}, signal?: AbortSignal) {
    return apiClient.get<SnapshotSource[]>(`${BASE}/snapshot-sources`, {
      query: clean({ limit: params.limit, offset: params.offset }),
      signal,
    });
  },

  myAssignments(params: { limit?: number; offset?: number } = {}, signal?: AbortSignal) {
    return apiClient.get<MyAssignment[]>(`${BASE}/my-assignments`, {
      query: clean({ limit: params.limit, offset: params.offset }),
      signal,
    });
  },

  assign(campaignId: string, body: AssignBody) {
    return apiClient.post<AssignResult>(`${BASE}/campaigns/${campaignId}/assign`, body);
  },

  unassign(campaignId: string, body: VersionBody) {
    return apiClient.post<{ status: string }>(`${BASE}/campaigns/${campaignId}/unassign`, body);
  },

  assignmentHistory(
    campaignId: string,
    params: { limit?: number; offset?: number } = {},
    signal?: AbortSignal,
  ) {
    return apiClient.get<AssignmentHistoryItem[]>(`${BASE}/campaigns/${campaignId}/assignments`, {
      query: clean({ limit: params.limit, offset: params.offset }),
      signal,
    });
  },
};

/**
 * GET /admin/users — requiere users.read. MANAGER tiene inventory.assign pero
 * NO users.read: nunca debe llamarse sin ese permiso (ver contract gap
 * MANAGER_ASSIGNMENT_USER_DISCOVERY).
 */
export function listAdminUsers(
  params: { limit?: number; offset?: number } = {},
  signal?: AbortSignal,
) {
  return apiClient.get<AdminUser[]>('/admin/users', {
    query: clean({ limit: params.limit, offset: params.offset }),
    signal,
  });
}
