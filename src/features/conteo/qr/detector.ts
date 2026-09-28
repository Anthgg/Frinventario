/**
 * Contrato mínimo del detector QR (FF003).
 *
 * La detección es 100% local: ningún frame sale del navegador.
 * El detector solo expone valor + geometría; el tracking (dedupe por región)
 * vive en ./tracker para poder testearlo sin cámara.
 */

export interface QrBox {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface QrDetection {
  /** Texto crudo del QR (el backend normaliza; aquí solo se rastrea/display). */
  value: string;
  /** Geometría en píxeles del frame. null = el detector no expone región. */
  box: QrBox | null;
}

export interface QrDetector {
  readonly kind: 'native' | 'fallback';
  /** Devuelve todas las regiones QR visibles en el frame (puede ser 0..n). */
  detect(video: HTMLVideoElement): Promise<QrDetection[]>;
  stop(): void;
}

interface BarcodeCornerPoint {
  x: number;
  y: number;
}

interface BarcodeDetectionLike {
  rawValue: string;
  boundingBox?: DOMRectReadOnly;
  cornerPoints?: BarcodeCornerPoint[];
}

interface BarcodeDetectorLike {
  detect(source: HTMLVideoElement): Promise<BarcodeDetectionLike[]>;
}

interface BarcodeDetectorConstructor {
  new (options?: { formats?: string[] }): BarcodeDetectorLike;
}

interface BarcodeDetectorGlobal {
  BarcodeDetector?: BarcodeDetectorConstructor;
  getSupportedFormats?: () => Promise<Record<string, boolean>>;
}

function globalBarcode(): BarcodeDetectorGlobal {
  return globalThis as unknown as BarcodeDetectorGlobal;
}

export function supportsNativeQr(): boolean {
  return typeof globalBarcode().BarcodeDetector === 'function';
}

function boxFromDetection(detection: BarcodeDetectionLike): QrBox | null {
  const corners = detection.cornerPoints;
  if (corners && corners.length > 0) {
    const xs = corners.map((point) => point.x);
    const ys = corners.map((point) => point.y);
    const minX = Math.min(...xs);
    const maxX = Math.max(...xs);
    const minY = Math.min(...ys);
    const maxY = Math.max(...ys);
    return { x: minX, y: minY, width: Math.max(1, maxX - minX), height: Math.max(1, maxY - minY) };
  }
  const box = detection.boundingBox;
  if (box) {
    return { x: box.x, y: box.y, width: Math.max(1, box.width), height: Math.max(1, box.height) };
  }
  return null;
}

function createNativeDetector(): QrDetector {
  const Ctor = globalBarcode().BarcodeDetector;
  if (!Ctor) throw new Error('BarcodeDetector no disponible');
  const detector = new Ctor({ formats: ['qr_code'] });
  return {
    kind: 'native',
    async detect(video) {
      if (video.videoWidth === 0 || video.videoHeight === 0) return [];
      const detections = await detector.detect(video);
      return detections
        .filter((item) => typeof item.rawValue === 'string' && item.rawValue.length > 0)
        .map((item) => ({ value: item.rawValue, box: boxFromDetection(item) }));
    },
    stop() {
      // BarcodeDetector no mantiene recursos que liberar.
    },
  };
}

/** Canvas reutilizado para el fallback (un solo elemento por detector). */
function createCanvas(width: number, height: number): HTMLCanvasElement {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  return canvas;
}

/**
 * Fallback local con jsQR (Apache-2.0, sin dependencias): decodifica un frame
 * en ImageData y devuelve como máximo UNA región por frame. El pipeline
 * multi-QR sigue soportado: cuando hay detector nativo se procesan todas las
 * regiones del frame.
 */
function createJsQrDetector(): QrDetector {
  let stopped = false;
  let canvas: HTMLCanvasElement | null = null;
  let context: CanvasRenderingContext2D | null = null;

  return {
    kind: 'fallback',
    async detect(video) {
      if (stopped) return [];
      const width = video.videoWidth;
      const height = video.videoHeight;
      if (!width || !height) return [];

      if (!canvas || canvas.width !== width || canvas.height !== height) {
        canvas = createCanvas(width, height);
        context = canvas.getContext('2d', { willReadFrequently: true });
      }
      if (!context || !canvas) return [];

      try {
        context.drawImage(video, 0, 0, width, height);
      } catch {
        // Frame aún no decodificable: se omite este ciclo.
        return [];
      }

      const { default: jsQR } = await import('jsqr');
      if (stopped) return [];
      const image = context.getImageData(0, 0, width, height);
      const result = jsQR(image.data, width, height, { inversionAttempts: 'dontInvert' });
      if (!result || !result.data) return [];

      const location = result.location;
      const corners = location
        ? [location.topLeftCorner, location.topRightCorner, location.bottomRightCorner, location.bottomLeftCorner]
        : null;
      const box = corners
        ? (() => {
            const xs = corners.map((corner) => corner.x);
            const ys = corners.map((corner) => corner.y);
            const minX = Math.min(...xs);
            const maxX = Math.max(...xs);
            const minY = Math.min(...ys);
            const maxY = Math.max(...ys);
            return {
              x: minX,
              y: minY,
              width: Math.max(1, maxX - minX),
              height: Math.max(1, maxY - minY),
            };
          })()
        : null;

      return [{ value: result.data, box }];
    },
    stop() {
      stopped = true;
      canvas = null;
      context = null;
    },
  };
}

/**
 * Preferencia: BarcodeDetector nativo (multi-QR por frame) → fallback local jsQR.
 * Nunca se envía el frame a ningún servidor.
 */
export function createQrDetector(): QrDetector {
  if (supportsNativeQr()) {
    try {
      return createNativeDetector();
    } catch {
      // Si el constructor falla, cae al fallback local.
    }
  }
  return createJsQrDetector();
}

/**
 * Código operativo a rastrear, mostrar y enviar.
 *
 * Mismo criterio que el backend (qr_service.normalize_scanned_code): si el QR
 * contiene una URL, se toma el último segmento. Así el operador nunca ve una
 * URL larga como identificador y el payload cumple la validación del backend
 * (longitud ≤ 100) sin volver a inventar reglas nuevas.
 */
export function toOperationalCode(value: string): string {
  const trimmed = value.trim();
  if (!trimmed.includes('://')) return trimmed;
  try {
    const url = new URL(trimmed);
    const segments = url.pathname.split('/').filter(Boolean);
    const last = segments[segments.length - 1];
    return last ? decodeURIComponent(last) : trimmed;
  } catch {
    const candidate = trimmed.replace(/\/+$/, '').split('/').pop() ?? trimmed;
    return candidate;
  }
}
