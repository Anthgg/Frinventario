import { afterEach, describe, expect, it, vi } from 'vitest';
import { apiClient } from '@/api/client';
import { countingApi } from '@/api/counting';

describe('countingApi pagination', () => {
  afterEach(() => vi.restoreAllMocks());

  it('carga todos los items respetando el máximo contractual de 200', async () => {
    const allItems = Array.from({ length: 401 }, (_, index) => ({
      product_id: `product-${index}`,
      internal_reference: `REF-${index}`,
    }));
    const requests: Array<{ offset: number; limit: number }> = [];
    vi.spyOn(apiClient, 'get').mockImplementation(async (path, options) => {
      const offset = Number(options?.query?.offset ?? 0);
      const limit = Number(options?.query?.limit ?? 0);
      requests.push({ offset, limit });
      if (path.endsWith('/items')) return allItems.slice(offset, offset + limit) as never;
      throw new Error(`Ruta inesperada: ${path}`);
    });

    const items = await countingApi.getItems('session-1');

    expect(items).toHaveLength(401);
    expect(requests).toEqual([
      { offset: 0, limit: 200 },
      { offset: 200, limit: 200 },
      { offset: 400, limit: 200 },
    ]);
  });

  it('carga todo el historial por páginas sin truncar después de 200 eventos', async () => {
    const allEvents = Array.from({ length: 1001 }, (_, index) => ({
      event_id: `event-${index + 1}`,
      server_sequence: index + 1,
    }));
    const requests: Array<{ offset: number; limit: number }> = [];
    vi.spyOn(apiClient, 'get').mockImplementation(async (path, options) => {
      const offset = Number(options?.query?.offset ?? 0);
      const limit = Number(options?.query?.limit ?? 0);
      requests.push({ offset, limit });
      if (path.endsWith('/events')) {
        return {
          session_id: 'session-1',
          offset,
          limit,
          items: allEvents.slice(offset, offset + limit),
        } as never;
      }
      throw new Error(`Ruta inesperada: ${path}`);
    });

    const page = await countingApi.getEvents('session-1');

    expect(page.items).toHaveLength(1001);
    expect(page.items[0]?.server_sequence).toBe(1);
    expect(page.items[1000]?.server_sequence).toBe(1001);
    expect(requests).toEqual([
      { offset: 0, limit: 500 },
      { offset: 500, limit: 500 },
      { offset: 1000, limit: 500 },
    ]);
  });
});
