import { describe, expect, it } from 'vitest';
import { ApiError } from '@/api/errors';

describe('ApiError', () => {
  it('normaliza cada status previsto por el contrato', () => {
    const casos: Array<[number, string]> = [
      [401, 'UNAUTHORIZED'],
      [403, 'FORBIDDEN'],
      [404, 'NOT_FOUND'],
      [409, 'CONFLICT'],
      [413, 'PAYLOAD_TOO_LARGE'],
      [415, 'UNSUPPORTED_MEDIA_TYPE'],
      [422, 'VALIDATION_ERROR'],
      [500, 'SERVER_ERROR'],
      [502, 'BAD_GATEWAY'],
    ];

    for (const [status, code] of casos) {
      const error = ApiError.fromResponse(status);
      expect(error.status).toBe(status);
      expect(error.code).toBe(code);
      expect(error.message.length).toBeGreaterThan(0);
    }
  });

  it('usa el detail del backend cuando existe', () => {
    const error = ApiError.fromResponse(401, { detail: 'Credenciales invalidas' });
    expect(error.message).toBe('Credenciales invalidas');
  });

  it('expone los issues de validación 422 sin inventar mensajes', () => {
    const error = ApiError.fromResponse(422, {
      detail: [{ loc: ['body', 'email'], msg: 'Field required' }],
    });
    expect(error.code).toBe('VALIDATION_ERROR');
    expect(error.details?.issues?.[0]).toEqual({ path: 'body.email', message: 'Field required' });
  });

  it('cualquier status no previsto cae en UNKNOWN_ERROR', () => {
    expect(ApiError.fromResponse(418).code).toBe('UNKNOWN_ERROR');
  });

  it('distingue fallo de red de error desconocido', () => {
    expect(ApiError.network().code).toBe('NETWORK_ERROR');
    expect(ApiError.from(new TypeError('fetch failed')).code).toBe('NETWORK_ERROR');
    expect(ApiError.from('algo raro').code).toBe('UNKNOWN_ERROR');
  });

  it('nunca expone stack traces en el mensaje visible', () => {
    const error = ApiError.fromResponse(500, { detail: 'boom' });
    expect(error.message).toBe('boom');
    expect(error.message).not.toMatch(/\bat\s+.+:\d+:\d+/);

    const network = ApiError.network();
    expect(network.message).not.toContain('TypeError');
    expect(String(network.message)).not.toContain('http://');
  });

  it('preserva errores ya normalizados', () => {
    const original = ApiError.fromResponse(404);
    expect(ApiError.from(original)).toBe(original);
  });
});
