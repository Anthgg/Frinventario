/**
 * Datos de demostración — UI_MOCK.
 * Sin cantidades esperadas, diferencias, costos ni valorizaciones:
 * esos datos pertenecen al backend y el modo ciego del operador no los ve.
 */

export const UI_MOCK = 'UI_MOCK';

export type CampaignStatus = 'abierta' | 'en_conteo' | 'conciliacion' | 'cerrada';

export interface Campaign {
  id: string;
  code: string;
  name: string;
  status: CampaignStatus;
  responsable: string;
  fecha: string;
  registrados: number;
}

export const STATUS_LABEL: Record<CampaignStatus, string> = {
  abierta: 'Abierta',
  en_conteo: 'En conteo',
  conciliacion: 'Conciliación',
  cerrada: 'Cerrada',
};

export const STATUS_TONE: Record<
  CampaignStatus,
  'neutral' | 'hilo' | 'warning' | 'success'
> = {
  abierta: 'neutral',
  en_conteo: 'hilo',
  conciliacion: 'warning',
  cerrada: 'success',
};

export const CAMPAIGNS: Campaign[] = [
  {
    id: 'camp-001',
    code: 'CAMP-2026-014',
    name: 'Almacén central — línea A',
    status: 'en_conteo',
    responsable: 'R. Quispe',
    fecha: '24 sep 2026',
    registrados: 1842,
  },
  {
    id: 'camp-002',
    code: 'CAMP-2026-013',
    name: 'Tienda sur — anaqueles 1-6',
    status: 'conciliacion',
    responsable: 'M. Torres',
    fecha: '23 sep 2026',
    registrados: 967,
  },
  {
    id: 'camp-003',
    code: 'CAMP-2026-012',
    name: 'Depósito industrial — pallets',
    status: 'abierta',
    responsable: 'J. Alanis',
    fecha: '22 sep 2026',
    registrados: 431,
  },
  {
    id: 'camp-004',
    code: 'CAMP-2026-011',
    name: 'Kardex histórico — agosto',
    status: 'cerrada',
    responsable: 'R. Quispe',
    fecha: '05 sep 2026',
    registrados: 2510,
  },
];

export interface ActivityEntry {
  id: string;
  time: string;
  who: string;
  text: string;
}

export const ACTIVITY: ActivityEntry[] = [
  { id: 'a1', time: '21:48', who: 'R. Quispe', text: 'Cerró la sesión de conteo S-042' },
  { id: 'a2', time: '21:31', who: 'M. Torres', text: 'Subió 3 documentos a CAMP-2026-013' },
  { id: 'a3', time: '21:12', who: 'J. Alanis', text: 'Inició la campaña Depósito industrial' },
  { id: 'a4', time: '20:54', who: 'Sistema', text: 'Importación de productos finalizada' },
];

export interface CountedProduct {
  id: string;
  code: string;
  name: string;
  quantity: number;
  damaged?: boolean;
}

export const RECENT_PRODUCTS: CountedProduct[] = [
  { id: 'p1', code: 'SKU-88412', name: 'Funda transparente 30×40', quantity: 34 },
  { id: 'p2', code: 'SKU-10233', name: 'Cinta empaque 48mm', quantity: 12 },
  { id: 'p3', code: 'SKU-55190', name: 'Caja cartón 40×30', quantity: 8, damaged: true },
  { id: 'p4', code: 'SKU-77021', name: 'Etiqueta térmica 100×50', quantity: 25 },
];

export const DASHBOARD_KPI = {
  sesionesAbiertas: 7,
  campanasActivas: 3,
  documentosPendientes: 12,
  unidadesHoy: 1284,
};
