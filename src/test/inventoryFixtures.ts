import type {
  AssigneeCandidate,
  AssigneeCandidatePage,
  AssignmentHistoryItem,
  CampaignDetail,
  CampaignPage,
  CampaignSummary,
  Location,
  MyAssignment,
  SnapshotSource,
} from '@/api/inventory';
import type { StubRoute } from './helpers';

/**
 * Payloads con la FORMA REAL del backend (campos cegados: jamás expected,
 * diferencias ni costos) para alimentar el stub de fetch en tests.
 */

export const TEST_LOCATION: Location = {
  id: '11111111-1111-4111-8111-111111111111',
  code: 'ALM-01',
  name: 'Almacén central',
  external_ref: 'WH-01',
  active: true,
};

export const TEST_CAMPAIGN_ID = '22222222-2222-4222-8222-222222222222';

export function testCampaignSummary(
  overrides: Partial<CampaignSummary> = {},
): CampaignSummary {
  return {
    id: TEST_CAMPAIGN_ID,
    code: 'CAMP-2026-014',
    name: 'Inventario almacén central',
    status: 'ASSIGNED',
    location_id: TEST_LOCATION.id,
    deadline_at: '2026-12-31T23:59:00-05:00',
    created_at: '2026-09-20T10:00:00-05:00',
    version: 3,
    ...overrides,
  };
}

export function testCampaignDetail(overrides: Partial<CampaignDetail> = {}): CampaignDetail {
  return {
    ...testCampaignSummary(),
    starts_at: null,
    ...overrides,
  };
}

export function testCampaignPage(
  items: CampaignSummary[],
  overrides: Partial<CampaignPage> = {},
): CampaignPage {
  return {
    total: items.length,
    limit: 20,
    offset: 0,
    items,
    ...overrides,
  };
}

export const TEST_SOURCES: SnapshotSource[] = [
  {
    id: '33333333-3333-4333-8333-333333333333',
    import_type: 'XLSX',
    source_filename: 'stock_almacen.xlsx',
    completed_at: '2026-09-19T18:30:00-05:00',
    stock_snapshot_count: 15420,
    stock_scope: 'LOCATION',
  },
];

export const TEST_ASSIGNEE_CANDIDATES: AssigneeCandidate[] = [
  {
    id: '44444444-4444-4444-8444-444444444444',
    email: 'rita.quispe@dedalo.local',
    display_name: 'R. Quispe',
  },
  {
    id: '55555555-5555-4555-8555-555555555555',
    email: 'marco.torres@dedalo.local',
    display_name: 'M. Torres',
  },
];

export function testAssigneeCandidatePage(
  items: AssigneeCandidate[] = TEST_ASSIGNEE_CANDIDATES,
  overrides: Partial<AssigneeCandidatePage> = {},
): AssigneeCandidatePage {
  return { total: items.length, limit: 50, offset: 0, items, ...overrides };
}

export const TEST_HISTORY: AssignmentHistoryItem[] = [
  {
    assignment_id: '66666666-6666-4666-8666-666666666666',
    user_id: TEST_ASSIGNEE_CANDIDATES[1]!.id,
    status: 'ACTIVE',
    assigned_at: '2026-09-21T09:00:00-05:00',
    revoked_at: null,
  },
  {
    assignment_id: '77777777-7777-4777-8777-777777777777',
    user_id: TEST_ASSIGNEE_CANDIDATES[0]!.id,
    status: 'REVOKED',
    assigned_at: '2026-09-18T09:00:00-05:00',
    revoked_at: '2026-09-21T09:00:00-05:00',
  },
];

export const TEST_MY_ASSIGNMENTS: MyAssignment[] = [];

interface InventoryRoutesOptions {
  list?: CampaignPage;
  detail?: CampaignDetail;
  locations?: Location[];
  sources?: SnapshotSource[];
  history?: AssignmentHistoryItem[];
  candidates?: AssigneeCandidatePage;
  myAssignments?: MyAssignment[];
  /** Mutaciones (POST/PATCH): se registran ANTES que las rutas de lectura. */
  mutations?: StubRoute[];
}

/** Rutas de /inventory listas para stubAuthBackend({ routes }). */
export function inventoryRoutes(options: InventoryRoutesOptions = {}): StubRoute[] {
  const mutations = options.mutations ?? [];
  const readRoutes: StubRoute[] = [];

  if (options.detail) {
    readRoutes.push({
      match: /\/inventory\/campaigns\/[^/?]+\/?$/,
      method: 'GET',
      body: options.detail,
    });
  }
  if (options.list) {
    readRoutes.push({ match: /\/inventory\/campaigns(\?|$)/, method: 'GET', body: options.list });
  }
  if (options.history) {
    readRoutes.push({
      match: /\/inventory\/campaigns\/[^/?]+\/assignments/,
      method: 'GET',
      body: options.history,
    });
  }
  if (options.locations) {
    readRoutes.push({ match: '/inventory/locations', method: 'GET', body: options.locations });
  }
  if (options.sources) {
    readRoutes.push({
      match: '/inventory/snapshot-sources',
      method: 'GET',
      body: options.sources,
    });
  }
  if (options.myAssignments) {
    readRoutes.push({
      match: '/inventory/my-assignments',
      method: 'GET',
      body: options.myAssignments,
    });
  }
  if (options.candidates) {
    readRoutes.push({
      match: '/inventory/assignee-candidates',
      method: 'GET',
      body: options.candidates,
    });
  }

  return [...mutations, ...readRoutes];
}
