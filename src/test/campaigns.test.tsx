import { fireEvent, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import {
  renderApp,
  seedRefreshToken,
  stubAuthBackend,
  TEST_ME,
  type StubRoute,
  type StubRouteContext,
} from './helpers';
import {
  inventoryRoutes,
  TEST_ASSIGNEE_CANDIDATES,
  TEST_CAMPAIGN_ID,
  TEST_HISTORY,
  TEST_LOCATION,
  TEST_MY_ASSIGNMENTS,
  TEST_SOURCES,
  testCampaignDetail,
  testCampaignPage,
  testAssigneeCandidatePage,
} from './inventoryFixtures';

/** Permisos de una cuenta administrativa completa (espejo del backend). */
const ADMIN_PERMISSIONS = [
  'auth.self.read',
  'inventory.read',
  'inventory.create',
  'inventory.assign',
  'inventory.close',
  'inventory.reopen',
  'inventory.monitor',
  'users.read',
];

/** Gap real: tiene inventory.assign pero NO users.read (rol MANAGER). */
const MANAGER_PERMISSIONS = ['inventory.read', 'inventory.assign'];

function seedApp(path: string, permissions: string[], routes: StubRoute[]) {
  const stub = stubAuthBackend({ me: { ...TEST_ME, permissions }, routes });
  seedRefreshToken();
  const view = renderApp(path);
  return { ...stub, ...view };
}

function detailRoutes(extra: Partial<Parameters<typeof inventoryRoutes>[0]> = {}) {
  return inventoryRoutes({
    detail: testCampaignDetail(),
    list: testCampaignPage([testCampaignDetail()]),
    locations: [TEST_LOCATION],
    sources: TEST_SOURCES,
    history: TEST_HISTORY,
    myAssignments: TEST_MY_ASSIGNMENTS,
    candidates: testAssigneeCandidatePage(),
    ...extra,
  });
}

describe('listado real de inventarios', () => {
  it('pinta los datos del backend, sin rastro de mocks', async () => {
    seedApp('/app/inventarios', ADMIN_PERMISSIONS, detailRoutes());

    expect(await screen.findByText('CAMP-2026-014')).toBeInTheDocument();
    expect(screen.getByText('Inventario almacén central')).toBeInTheDocument();
    expect(screen.getByText('Almacén central')).toBeInTheDocument();
    expect(screen.getAllByText('Asignada').length).toBeGreaterThan(0);
    expect(screen.queryByText('UI_MOCK')).not.toBeInTheDocument();
    expect(screen.queryByText(/página no encontrada/i)).not.toBeInTheDocument();
  });

  it('respeta los filtros de la URL y pagina con offset real del backend', async () => {
    const { calls } = stubAuthBackend({
      me: { ...TEST_ME, permissions: ADMIN_PERMISSIONS },
      routes: detailRoutes({
        list: testCampaignPage([testCampaignDetail()], { total: 45, limit: 20 }),
      }),
    });
    seedRefreshToken();
    renderApp('/app/inventarios?status=IN_PROGRESS&location=' + TEST_LOCATION.id);

    await screen.findByText('CAMP-2026-014');
    expect(calls.some((call) => call.url.includes('status=IN_PROGRESS'))).toBe(true);
    expect(
      calls.some((call) => call.url.includes(`location_id=${TEST_LOCATION.id}`)),
    ).toBe(true);

    const user = userEvent.setup();
    await user.click(screen.getByRole('button', { name: 'Página siguiente' }));

    await vi.waitFor(() => {
      expect(calls.some((call) => call.url.includes('offset=20'))).toBe(true);
    });
    expect(screen.getByRole('navigation', { name: 'Paginación de campañas' })).toBeInTheDocument();
  });

  it('ante un error del backend muestra el error y NO inventa filas', async () => {
    seedApp('/app/inventarios', ADMIN_PERMISSIONS, [
      {
        match: /\/inventory\/campaigns(\?|$)/,
        method: 'GET',
        status: 500,
        body: { detail: 'boom' },
      },
      { match: '/inventory/locations', method: 'GET', body: [TEST_LOCATION] },
      { match: '/inventory/my-assignments', method: 'GET', body: [] },
    ]);

    expect(await screen.findByText('No pudimos cargar las campañas')).toBeInTheDocument();
    expect(screen.queryByText('CAMP-2026-014')).not.toBeInTheDocument();
  });

  it('permiso inventory.create habilita el alta de campañas', async () => {
    seedApp('/app/inventarios', ADMIN_PERMISSIONS, detailRoutes());
    await screen.findByText('CAMP-2026-014');
    expect(screen.getByRole('button', { name: /nueva campaña/i })).toBeInTheDocument();
  });
});

describe('detalle de campaña', () => {
  it('muestra estado, versión, ubicación y el recorrido real', async () => {
    seedApp(`/app/inventarios/${TEST_CAMPAIGN_ID}`, ADMIN_PERMISSIONS, detailRoutes());

    expect(
      await screen.findByRole('heading', { name: 'Inventario almacén central', level: 1 }),
    ).toBeInTheDocument();
    expect(screen.getAllByText('CAMP-2026-014').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Almacén central').length).toBeGreaterThan(0);

    const versionRow = screen.getByText('Versión').closest('div');
    expect(versionRow).toHaveTextContent('3');

    const rail = screen.getByRole('list', { name: /recorrido de estados/i });
    const current = within(rail)
      .getAllByRole('listitem')
      .find((item) => item.getAttribute('aria-current') === 'step');
    expect(current).toHaveTextContent('Asignada');
  });

  it('oculta las acciones que los permisos no conceden', async () => {
    seedApp(`/app/inventarios/${TEST_CAMPAIGN_ID}`, ['inventory.read'], detailRoutes());

    expect(await screen.findByRole('heading', { level: 1 })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Editar' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Iniciar' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Cancelar' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Asignar' })).not.toBeInTheDocument();
  });

  it('ofrece las acciones que el estado y los permisos sí permiten', async () => {
    seedApp(`/app/inventarios/${TEST_CAMPAIGN_ID}`, ADMIN_PERMISSIONS, detailRoutes());

    expect(await screen.findByRole('button', { name: 'Editar' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Iniciar' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Asignar' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Desasignar' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Cancelar' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Reabrir' })).not.toBeInTheDocument();
  });

  it('sin inventory.read la ruta ni siquiera llega a la campaña', async () => {
    seedApp(`/app/inventarios/${TEST_CAMPAIGN_ID}`, ['exports.read'], detailRoutes());

    expect(await screen.findByText(/acceso restringido/i)).toBeInTheDocument();
    expect(screen.queryByText('CAMP-2026-014')).not.toBeInTheDocument();
  });
});

describe('editar campaña (versionado optimista)', () => {
  it('envía expected_version y nombre al backend', async () => {
    const { calls } = seedApp(`/app/inventarios/${TEST_CAMPAIGN_ID}`, ADMIN_PERMISSIONS, [
      ...detailRoutes({
        mutations: [
          {
            match: `/inventory/campaigns/${TEST_CAMPAIGN_ID}`,
            method: 'PATCH',
            body: testCampaignDetail({ name: 'Nombre nuevo', version: 4 }),
          },
        ],
      }),
    ]);

    const user = userEvent.setup();
    await user.click(await screen.findByRole('button', { name: 'Editar' }));

    const dialog = await screen.findByRole('dialog', { name: 'Editar campaña' });
    const nameInput = within(dialog).getByLabelText(/nombre de la campaña/i);
    await user.clear(nameInput);
    await user.type(nameInput, 'Nombre nuevo');
    await user.click(within(dialog).getByRole('button', { name: 'Guardar cambios' }));

    await screen.findByText('Cambios guardados');
    const patch = await vi.waitFor(() => {
      const call = calls.find(
        (item) => item.method === 'PATCH' && item.url.includes(`/campaigns/${TEST_CAMPAIGN_ID}`),
      );
      expect(call).toBeDefined();
      return call!;
    });
    expect(patch.body).toMatchObject({ name: 'Nombre nuevo', expected_version: 3 });
  });

  it('ante un conflicto de versión avisa y recarga, sin aplazar el error', async () => {
    seedApp(`/app/inventarios/${TEST_CAMPAIGN_ID}`, ADMIN_PERMISSIONS, [
      ...detailRoutes({
        mutations: [
          {
            match: `/inventory/campaigns/${TEST_CAMPAIGN_ID}`,
            method: 'PATCH',
            status: 409,
            body: { detail: 'Conflicto de version' },
          },
        ],
      }),
    ]);

    const user = userEvent.setup();
    await user.click(await screen.findByRole('button', { name: 'Editar' }));
    const dialog = await screen.findByRole('dialog', { name: 'Editar campaña' });
    await user.click(within(dialog).getByRole('button', { name: 'Guardar cambios' }));

    expect(
      (await screen.findAllByText('La campaña cambió mientras la estabas editando.')).length,
    ).toBeGreaterThan(0);
    expect(screen.queryByRole('dialog', { name: 'Editar campaña' })).not.toBeInTheDocument();
  });
});

describe('iniciar campaña', () => {
  it('pide confirmación explícita cuando el origen es AGGREGATE', async () => {
    const { calls } = seedApp(`/app/inventarios/${TEST_CAMPAIGN_ID}`, ADMIN_PERMISSIONS, [
      ...detailRoutes({
        mutations: [
          {
            match: '/start',
            method: 'POST',
            status: (context: StubRouteContext) => (context.attempt === 0 ? 409 : 200),
            body: (context: StubRouteContext) =>
              context.attempt === 0
                ? {
                    detail:
                      'El origen es AGGREGATE y la campana tiene ubicacion fisica: confirme con confirm_aggregate_source=true',
                  }
                : {
                    ...testCampaignDetail({
                      status: 'IN_PROGRESS',
                      version: 4,
                      starts_at: '2026-09-27T12:00:00-05:00',
                    }),
                    already_started: false,
                  },
          },
        ],
      }),
    ]);

    const user = userEvent.setup();
    await user.click(await screen.findByRole('button', { name: 'Iniciar' }));

    const first = await screen.findByRole('dialog', { name: '¿Iniciar la campaña?' });
    await user.click(within(first).getByRole('button', { name: 'Iniciar campaña' }));

    // El backend pide confirmación: el diálogo cambia de fase.
    const aggregate = await screen.findByRole('dialog', { name: 'Confirmar origen AGGREGATE' });
    expect(within(aggregate).getByText(/origen agregado/i)).toBeInTheDocument();

    const confirmButton = within(aggregate).getByRole('button', {
      name: 'Confirmar e iniciar',
    });
    expect(confirmButton).toBeDisabled();

    await user.click(within(aggregate).getByLabelText(/confirmo iniciar/i));
    expect(confirmButton).toBeEnabled();
    await user.click(confirmButton);

    await screen.findByText('Campaña iniciada');

    const startCalls = calls.filter(
      (call) => call.method === 'POST' && call.url.includes('/start'),
    );
    expect(startCalls).toHaveLength(2);
    expect(startCalls[0]!.body).not.toHaveProperty('confirm_aggregate_source', true);
    expect(startCalls[1]!.body).toMatchObject({ confirm_aggregate_source: true });
  });
});

describe('cancelar campaña', () => {
  it('exige motivo y lo envía con la versión', async () => {
    const { calls } = seedApp(`/app/inventarios/${TEST_CAMPAIGN_ID}`, ADMIN_PERMISSIONS, [
      ...detailRoutes({
        mutations: [
          {
            match: '/cancel',
            method: 'POST',
            body: testCampaignDetail({ status: 'CANCELLED', version: 4 }),
          },
        ],
      }),
    ]);

    const user = userEvent.setup();
    await user.click(await screen.findByRole('button', { name: 'Cancelar' }));
    const dialog = await screen.findByRole('dialog', { name: '¿Cancelar la campaña?' });

    await user.click(within(dialog).getByRole('button', { name: 'Cancelar campaña' }));
    expect(
      await within(dialog).findByText(/el motivo es obligatorio/i),
    ).toBeInTheDocument();

    await user.type(within(dialog).getByLabelText(/motivo/i), 'Cierre del almacén');
    await user.click(within(dialog).getByRole('button', { name: 'Cancelar campaña' }));

    await screen.findByText('Campaña cancelada');
    const cancel = await vi.waitFor(() => {
      const call = calls.find((item) => item.url.includes('/cancel'));
      expect(call).toBeDefined();
      return call!;
    });
    expect(cancel.body).toMatchObject({
      reason: 'Cierre del almacén',
      expected_version: 3,
    });
  });
});

describe('responsable', () => {
  it('carga candidatos elegibles y asigna con expected_version', async () => {
    const { calls } = seedApp(`/app/inventarios/${TEST_CAMPAIGN_ID}`, ADMIN_PERMISSIONS, [
      ...detailRoutes({
        mutations: [
          {
            match: '/assign',
            method: 'POST',
            body: {
              assignment_id: '88888888-8888-4888-8888-888888888888',
              user_id: TEST_ASSIGNEE_CANDIDATES[0]!.id,
              status: 'ACTIVE',
              created: true,
              reassigned: false,
            },
          },
        ],
      }),
    ]);

    const user = userEvent.setup();
    await user.click(await screen.findByRole('button', { name: 'Asignar' }));
    const dialog = await screen.findByRole('dialog', { name: 'Asignar responsable' });

    const select = await within(dialog).findByLabelText(/usuario responsable/i);
    await user.selectOptions(select, TEST_ASSIGNEE_CANDIDATES[0]!.id);
    await user.click(within(dialog).getByRole('button', { name: 'Asignar responsable' }));

    await screen.findByText('Responsable asignado');
    const assign = await vi.waitFor(() => {
      const call = calls.find(
        (item) => item.method === 'POST' && item.url.includes('/assign'),
      );
      expect(call).toBeDefined();
      return call!;
    });
    expect(assign.body).toMatchObject({
      user_id: TEST_ASSIGNEE_CANDIDATES[0]!.id,
      expected_version: 3,
    });
    expect(calls.some((call) => call.url.includes('/inventory/assignee-candidates'))).toBe(true);
    expect(calls.some((call) => call.url.includes('/admin/users'))).toBe(false);
  });

  it('MANAGER con inventory.assign puede asignar sin users.read', async () => {
    const { calls } = seedApp(
      `/app/inventarios/${TEST_CAMPAIGN_ID}`,
      MANAGER_PERMISSIONS,
      detailRoutes({
        history: undefined,
        sources: undefined,
        mutations: [
          {
            match: '/assign',
            method: 'POST',
            body: {
              assignment_id: '88888888-8888-4888-8888-888888888888',
              user_id: TEST_ASSIGNEE_CANDIDATES[0]!.id,
              status: 'ACTIVE',
              created: true,
              reassigned: false,
            },
          },
        ],
      }),
    );

    const user = userEvent.setup();
    await user.click(await screen.findByRole('button', { name: 'Asignar' }));
    const dialog = await screen.findByRole('dialog', { name: 'Asignar responsable' });
    const select = await within(dialog).findByLabelText(/usuario responsable/i);
    await user.selectOptions(select, TEST_ASSIGNEE_CANDIDATES[0]!.id);
    await user.click(within(dialog).getByRole('button', { name: 'Asignar responsable' }));

    await screen.findByText('Responsable asignado');
    expect(calls.some((call) => call.url.includes('/inventory/assignee-candidates'))).toBe(true);
    expect(calls.some((call) => call.url.includes('/admin/users'))).toBe(false);
  });

  it('permite paginar los candidatos de asignación', async () => {
    const nextCandidate = {
      id: '99999999-9999-4999-8999-999999999999',
      display_name: 'A. Cárdenas',
      email: 'a.cardenas@dedalo.local',
    };
    const { calls } = seedApp(
      `/app/inventarios/${TEST_CAMPAIGN_ID}`,
      MANAGER_PERMISSIONS,
      detailRoutes({
        candidates: testAssigneeCandidatePage(TEST_ASSIGNEE_CANDIDATES, { total: 51 }),
        mutations: [
          {
            match: /\/inventory\/assignee-candidates\?.*offset=50/,
            method: 'GET',
            body: testAssigneeCandidatePage([nextCandidate], {
              total: 51,
              limit: 50,
              offset: 50,
            }),
          },
        ],
      }),
    );

    const user = userEvent.setup();
    await user.click(await screen.findByRole('button', { name: 'Asignar' }));
    const dialog = await screen.findByRole('dialog', { name: 'Asignar responsable' });
    expect(await within(dialog).findByText('1–2 de 51')).toBeInTheDocument();
    await user.click(within(dialog).getByRole('button', { name: 'Siguientes' }));

    expect(await within(dialog).findByText('51–51 de 51')).toBeInTheDocument();
    expect(within(dialog).getByRole('option', { name: /A\. Cárdenas/ })).toBeInTheDocument();
    expect(calls.some((call) => call.url.includes('offset=50'))).toBe(true);
  });
});

describe('crear campaña', () => {
  it('envía el alta al backend y navega al detalle', async () => {
    const created = testCampaignDetail({
      id: '99999999-9999-4999-8999-999999999999',
      code: 'CAMP-2026-015',
      name: 'Campaña nueva',
      status: 'DRAFT',
      version: 1,
      location_id: null,
      deadline_at: null,
    });
    const { calls } = seedApp('/app/inventarios', ADMIN_PERMISSIONS, [
      ...detailRoutes({
        mutations: [
          {
            match: '/inventory/campaigns',
            method: 'POST',
            body: created,
          },
        ],
        detail: created,
      }),
    ]);

    const user = userEvent.setup();
    await user.click(await screen.findByRole('button', { name: /nueva campaña/i }));
    const dialog = await screen.findByRole('dialog', { name: 'Nueva campaña' });

    await user.type(within(dialog).getByLabelText(/nombre de la campaña/i), 'Campaña nueva');
    await user.click(within(dialog).getByRole('button', { name: 'Crear campaña' }));

    await screen.findByRole('heading', { name: 'Campaña nueva', level: 1 });

    const post = await vi.waitFor(() => {
      const call = calls.find(
        (item) => item.method === 'POST' && item.url.endsWith('/inventory/campaigns'),
      );
      expect(call).toBeDefined();
      return call!;
    });
    expect(post.body).toMatchObject({ name: 'Campaña nueva' });
  });
});

describe('reabrir y desasignar', () => {
  it('reabrir exige motivo y fecha futura y envía ISO con zona horaria', async () => {
    const { calls } = seedApp(`/app/inventarios/${TEST_CAMPAIGN_ID}`, ADMIN_PERMISSIONS, [
      ...detailRoutes({
        detail: testCampaignDetail({ status: 'EXPIRED' }),
        mutations: [
          {
            match: '/reopen',
            method: 'POST',
            body: testCampaignDetail({ status: 'DRAFT', version: 4 }),
          },
        ],
      }),
    ]);

    const user = userEvent.setup();
    await user.click(await screen.findByRole('button', { name: 'Reabrir' }));
    const dialog = await screen.findByRole('dialog', { name: '¿Reabrir la campaña?' });

    await user.click(within(dialog).getByRole('button', { name: 'Reabrir campaña' }));
    expect(await within(dialog).findByText(/el motivo es obligatorio/i)).toBeInTheDocument();
    expect(within(dialog).getByText(/define una nueva fecha límite/i)).toBeInTheDocument();

    await user.type(
      within(dialog).getByLabelText(/motivo de la reapertura/i),
      'Reapertura solicitada',
    );
    fireEvent.change(within(dialog).getByLabelText(/nueva fecha límite/i), {
      target: { value: '2027-01-01T10:00' },
    });
    await user.click(within(dialog).getByRole('button', { name: 'Reabrir campaña' }));

    await screen.findByText('Campaña reabierta');
    const reopen = await vi.waitFor(() => {
      const call = calls.find(
        (item) => item.method === 'POST' && item.url.includes('/reopen'),
      );
      expect(call).toBeDefined();
      return call!;
    });
    expect(reopen.body).toMatchObject({
      reason: 'Reapertura solicitada',
      expected_version: 3,
    });
    expect(String((reopen.body as { new_deadline_at?: string }).new_deadline_at)).toMatch(
      /Z$|[+-]\d{2}:\d{2}$/,
    );
  });

  it('desasignar envía la versión actual al backend', async () => {
    const { calls } = seedApp(`/app/inventarios/${TEST_CAMPAIGN_ID}`, ADMIN_PERMISSIONS, [
      ...detailRoutes({
        mutations: [{ match: '/unassign', method: 'POST', body: { status: 'ok' } }],
      }),
    ]);

    const user = userEvent.setup();
    await user.click(await screen.findByRole('button', { name: 'Desasignar' }));
    const dialog = await screen.findByRole('dialog', { name: '¿Quitar el responsable?' });
    await user.click(within(dialog).getByRole('button', { name: 'Quitar responsable' }));

    await screen.findByText('Responsable quitado');
    const unassign = await vi.waitFor(() => {
      const call = calls.find(
        (item) => item.method === 'POST' && item.url.includes('/unassign'),
      );
      expect(call).toBeDefined();
      return call!;
    });
    expect(unassign.body).toMatchObject({ expected_version: 3 });
  });
});
