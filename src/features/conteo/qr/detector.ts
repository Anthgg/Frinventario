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
 * Fallback local con jsQR (Apache-2.0, sin servicios externos): decodifica un frame
 * en ImageData y devuelve hasta ocho regiones por frame. Después de cada
 * lectura oculta esa región en la copia local de píxeles y busca la siguiente.
 */
export function createJsQrDetector(): QrDetector {
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
      const pixels = image.data.slice();
      const detections: QrDetection[] = [];
      const boxlessValues = new Set<string>();

      scanRegion(jsQR, pixels, width, height, { x: 0, y: 0, width, height }, detections, boxlessValues);
      // jsQR can fail to locate any symbol when several finder patterns share
      // one full frame. Retry overlapping local crops; each result is mapped
      // back to the original camera frame before it reaches the tracker.
      for (const region of fallbackTiles(width, height)) {
        if (stopped || detections.length >= MAX_FALLBACK_DETECTIONS) break;
        scanRegion(jsQR, pixels, width, height, region, detections, boxlessValues);
      }

      return detections;
    },
    stop() {
      stopped = true;
      canvas = null;
      context = null;
    },
  };
}

const MAX_FALLBACK_DETECTIONS = 8;

interface QrLocationLike {
  topLeftCorner: { x: number; y: number };
  topRightCorner: { x: number; y: number };
  bottomRightCorner: { x: number; y: number };
  bottomLeftCorner: { x: number; y: number };
}

function boxFromLocation(location: QrLocationLike | null | undefined): QrDetection['box'] {
  if (!location) return null;
  const corners = [
    location.topLeftCorner,
    location.topRightCorner,
    location.bottomRightCorner,
    location.bottomLeftCorner,
  ];
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
}

function concealRegion(
  pixels: Uint8ClampedArray,
  frameWidth: number,
  frameHeight: number,
  box: NonNullable<QrDetection['box']>,
): void {
  // jsQR's reported corners exclude the four-module quiet zone. Mask a small
  // padding around them so a second pass cannot decode the same QR again.
  const padding = Math.ceil(Math.min(box.width, box.height) * 0.25);
  const left = Math.max(0, Math.floor(box.x - padding));
  const top = Math.max(0, Math.floor(box.y - padding));
  const right = Math.min(frameWidth, Math.ceil(box.x + box.width + padding));
  const bottom = Math.min(frameHeight, Math.ceil(box.y + box.height + padding));

  for (let y = top; y < bottom; y += 1) {
    for (let x = left; x < right; x += 1) {
      const offset = (y * frameWidth + x) * 4;
      pixels[offset] = 255;
      pixels[offset + 1] = 255;
      pixels[offset + 2] = 255;
      pixels[offset + 3] = 255;
    }
  }
}

interface PixelRegion {
  x: number;
  y: number;
  width: number;
  height: number;
}

function scanRegion(
  jsQR: typeof import('jsqr').default,
  pixels: Uint8ClampedArray,
  frameWidth: number,
  frameHeight: number,
  region: PixelRegion,
  detections: QrDetection[],
  boxlessValues: Set<string>,
): void {
  const regionPixels = cropPixels(pixels, frameWidth, region);
  for (let index = 0; index < MAX_FALLBACK_DETECTIONS - detections.length; index += 1) {
    const result = jsQR(regionPixels, region.width, region.height, { inversionAttempts: 'dontInvert' });
    if (!result?.data) return;

    const localBox = boxFromLocation(result.location);
    const globalBox = localBox
      ? { ...localBox, x: localBox.x + region.x, y: localBox.y + region.y }
      : null;
    if (localBox && globalBox) {
      const duplicate = detections.some(
        (detection) =>
          detection.value === result.data &&
          detection.box !== null &&
          boxesMostlyOverlap(detection.box, globalBox),
      );
      if (!duplicate && detections.length < MAX_FALLBACK_DETECTIONS) {
        detections.push({ value: result.data, box: globalBox });
      }
      concealRegion(pixels, frameWidth, frameHeight, globalBox);
      concealRegion(regionPixels, region.width, region.height, localBox);
      continue;
    }

    if (!boxlessValues.has(result.data) && detections.length < MAX_FALLBACK_DETECTIONS) {
      boxlessValues.add(result.data);
      detections.push({ value: result.data, box: null });
    }
    return;
  }
}

function cropPixels(pixels: Uint8ClampedArray, frameWidth: number, region: PixelRegion): Uint8ClampedArray {
  const crop = new Uint8ClampedArray(region.width * region.height * 4);
  for (let row = 0; row < region.height; row += 1) {
    const sourceStart = ((region.y + row) * frameWidth + region.x) * 4;
    const sourceEnd = sourceStart + region.width * 4;
    crop.set(pixels.subarray(sourceStart, sourceEnd), row * region.width * 4);
  }
  return crop;
}

function fallbackTiles(width: number, height: number): PixelRegion[] {
  const xRegions = overlappingRegions(width);
  const yRegions = overlappingRegions(height);
  const regions: PixelRegion[] = [];
  for (const y of yRegions) {
    for (const x of xRegions) {
      if (x === 0 && y === 0 && xRegions.length === 1 && yRegions.length === 1) continue;
      const region = { x, y, width: Math.min(width, tileSize(width)), height: Math.min(height, tileSize(height)) };
      if (region.x + region.width <= width && region.y + region.height <= height) regions.push(region);
    }
  }
  return regions;
}

function tileSize(length: number): number {
  return Math.min(length, Math.max(256, Math.ceil(length * 0.6)));
}

function overlappingRegions(length: number): number[] {
  const size = tileSize(length);
  const lastStart = Math.max(0, length - size);
  return lastStart === 0 ? [0] : [0, lastStart];
}

function boxesMostlyOverlap(a: NonNullable<QrDetection['box']>, b: NonNullable<QrDetection['box']>): boolean {
  const left = Math.max(a.x, b.x);
  const top = Math.max(a.y, b.y);
  const right = Math.min(a.x + a.width, b.x + b.width);
  const bottom = Math.min(a.y + a.height, b.y + b.height);
  const overlapArea = Math.max(0, right - left) * Math.max(0, bottom - top);
  const smallerArea = Math.min(a.width * a.height, b.width * b.height);
  return smallerArea > 0 && overlapArea / smallerArea >= 0.5;
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
  let candidate = value.trim();
  if (candidate.includes('://')) {
    candidate = candidate.replace(/\/+$/, '').split('/').pop() ?? '';
  }

  if (
    !candidate ||
    candidate.length > 100 ||
    Array.from(candidate).some((character) => {
      const code = character.charCodeAt(0);
      return code <= 0x1f || code === 0x7f;
    })
  ) {
    return '';
  }

  return /^[A-Za-z0-9][A-Za-z0-9._/-]*$/.test(candidate) ? candidate : '';
}
