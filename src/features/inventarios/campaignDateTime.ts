/**
 * Conversión entre los ISO 8601 con offset que devuelve el backend y el formato
 * local que espera <input type="datetime-local">.
 *
 * El backend rechaza fechas sin zona horaria ("deadline_at debe incluir zona
 * horaria"), por eso SIEMPRE se envía el resultado de toISOString() (UTC con Z).
 */

export function toLocalInput(value: string | null | undefined): string {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  const pad = (part: number): string => String(part).padStart(2, '0');
  return [
    date.getFullYear(),
    pad(date.getMonth() + 1),
    pad(date.getDate()),
    'T',
    pad(date.getHours()),
    ':',
    pad(date.getMinutes()),
  ].join('');
}

/** undefined = sin fecha (no se envía el campo). */
export function toIso(value: string): string | undefined {
  if (!value) return undefined;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return undefined;
  return date.toISOString();
}

const DATE_FORMAT = new Intl.DateTimeFormat('es-PE', { dateStyle: 'medium' });
const DATE_TIME_FORMAT = new Intl.DateTimeFormat('es-PE', {
  dateStyle: 'medium',
  timeStyle: 'short',
});

export function formatDate(value: string | null | undefined): string {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '—';
  return DATE_FORMAT.format(date);
}

export function formatDateTime(value: string | null | undefined): string {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '—';
  return DATE_TIME_FORMAT.format(date);
}
