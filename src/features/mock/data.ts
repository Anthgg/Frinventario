/**
 * Datos de demostración — UI_MOCK.
 *
 * FF002: el dashboard, el listado de inventarios y el detalle de campaña ya
 * consumen el backend real, así que aquí SOLO queda lo que todavía no tiene
 * endpoint (sesión de conteo y páginas placeholder). Las etiquetas y estados
 * de campaña viven en features/inventarios/campaignStatus.ts, que es el
 * espejo del enum real.
 *
 * Sin cantidades esperadas, diferencias, costos ni valorizaciones: esos datos
 * pertenecen al backend y el modo ciego del operador no los ve.
 */

export const UI_MOCK = 'UI_MOCK';

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
