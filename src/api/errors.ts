/**
 * Modelo único de error de API.
 * Normaliza los códigos previstos por el contrato y NUNCA expone stack traces
 * ni detalles internos al usuario.
 */

export type ApiErrorCode =
  | 'UNAUTHORIZED'
  | 'FORBIDDEN'
  | 'NOT_FOUND'
  | 'CONFLICT'
  | 'PAYLOAD_TOO_LARGE'
  | 'UNSUPPORTED_MEDIA_TYPE'
  | 'VALIDATION_ERROR'
  | 'SERVER_ERROR'
  | 'BAD_GATEWAY'
  | 'NETWORK_ERROR'
  | 'UNKNOWN_ERROR';

export interface ApiErrorDetails {
  readonly field?: string;
  readonly issues?: ReadonlyArray<{ path?: string; message?: string }>;
}

interface StatusSpec {
  readonly code: ApiErrorCode;
  readonly message: string;
}

const STATUS_SPEC: Readonly<Record<number, StatusSpec>> = {
  401: { code: 'UNAUTHORIZED', message: 'Tu sesión expiró o no es válida.' },
  403: { code: 'FORBIDDEN', message: 'No tienes permisos para esta acción.' },
  404: { code: 'NOT_FOUND', message: 'No encontramos lo que buscas.' },
  409: { code: 'CONFLICT', message: 'La operación entra en conflicto con el estado actual.' },
  413: { code: 'PAYLOAD_TOO_LARGE', message: 'El archivo supera el tamaño permitido.' },
  415: { code: 'UNSUPPORTED_MEDIA_TYPE', message: 'Tipo de archivo no soportado.' },
  422: { code: 'VALIDATION_ERROR', message: 'Revisa los datos ingresados.' },
  500: { code: 'SERVER_ERROR', message: 'Ocurrió un error en el servidor.' },
  502: { code: 'BAD_GATEWAY', message: 'El servicio no está disponible en este momento.' },
};

const NETWORK_SPEC: StatusSpec = {
  code: 'NETWORK_ERROR',
  message: 'Sin conexión con el servidor. Verifica tu red.',
};

const UNKNOWN_SPEC: StatusSpec = {
  code: 'UNKNOWN_ERROR',
  message: 'Algo salió mal. Intenta de nuevo.',
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function readDetail(payload: unknown): string | undefined {
  if (!isRecord(payload)) return undefined;
  const detail = payload['detail'];
  if (typeof detail === 'string' && detail.trim().length > 0) return detail;
  return undefined;
}

function readIssues(payload: unknown): ApiErrorDetails['issues'] {
  if (!isRecord(payload)) return undefined;
  const detail = payload['detail'];
  if (!Array.isArray(detail)) return undefined;
  return detail.map((issue) => {
    if (isRecord(issue)) {
      const path = Array.isArray(issue['loc']) ? issue['loc'].join('.') : undefined;
      const message = typeof issue['msg'] === 'string' ? issue['msg'] : undefined;
      return { path, message };
    }
    return {};
  });
}

export class ApiError extends Error {
  readonly status: number;
  readonly code: ApiErrorCode;
  readonly details?: ApiErrorDetails;

  constructor(
    status: number,
    code: ApiErrorCode,
    message: string,
    details?: ApiErrorDetails,
  ) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.code = code;
    if (details) this.details = details;
  }

  static fromResponse(status: number, payload?: unknown): ApiError {
    const spec = STATUS_SPEC[status] ?? UNKNOWN_SPEC;
    const serverMessage = readDetail(payload);
    const issues = readIssues(payload);
    const details: ApiErrorDetails | undefined = issues ? { issues } : undefined;
    return new ApiError(status, spec.code, serverMessage ?? spec.message, details);
  }

  static network(): ApiError {
    return new ApiError(0, NETWORK_SPEC.code, NETWORK_SPEC.message);
  }

  static unknown(): ApiError {
    return new ApiError(0, UNKNOWN_SPEC.code, UNKNOWN_SPEC.message);
  }

  static from(unknownError: unknown): ApiError {
    if (unknownError instanceof ApiError) return unknownError;
    if (unknownError instanceof TypeError) return ApiError.network();
    return ApiError.unknown();
  }
}
