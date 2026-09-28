import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createJsQrDetector, toOperationalCode } from '@/features/conteo/qr/detector';

const QR_CODES: Record<string, readonly string[]> = {
  ACA60001: [
    '111111100110001111111',
    '100000100011001000001',
    '101110100111001011101',
    '101110100111001011101',
    '101110100101101011101',
    '100000101010001000001',
    '111111101010101111111',
    '000000000010000000000',
    '100101101011110100000',
    '111100010011010101011',
    '001101101111001111000',
    '000000011100111110111',
    '001110101011011101110',
    '000000001000011111010',
    '111111100101101011100',
    '100000101000001101010',
    '101110100010111010101',
    '101110101000011100011',
    '101110100101011010101',
    '100000100011100111001',
    '111111101010010011100',
  ],
  ACA60002: [
    '111111101011101111111',
    '100000101011101000001',
    '101110100111001011101',
    '101110101010101011101',
    '101110100010001011101',
    '100000100010001000001',
    '111111101010101111111',
    '000000001000000000000',
    '101101110010001001011',
    '000100011010100100101',
    '110101101100111110110',
    '010010010110110000110',
    '011110100011010011111',
    '000000001100010001011',
    '111111101000011010010',
    '100000101001111100100',
    '101110100011001001011',
    '101110101110010110010',
    '101110101111010100100',
    '100000100101101001000',
    '111111101111100010010',
  ],
};

const SCALE = 5;
const QUIET_MODULES = 4;
const GAP = 20 * SCALE;
let activeContext: CanvasRenderingContext2D | null = null;
const originalGetContext = Object.getOwnPropertyDescriptor(HTMLCanvasElement.prototype, 'getContext');

function makeSyntheticFrame(codes: string[]) {
  const moduleCount = QR_CODES[codes[0] ?? '']?.length ?? 21;
  const symbolSize = (moduleCount + QUIET_MODULES * 2) * SCALE;
  const margin = QUIET_MODULES * SCALE;
  const width = margin * 2 + symbolSize;
  const height = margin * 2 + codes.length * symbolSize + Math.max(0, codes.length - 1) * GAP;
  const data = new Uint8ClampedArray(width * height * 4);
  for (let offset = 0; offset < data.length; offset += 4) {
    data[offset] = 255;
    data[offset + 1] = 255;
    data[offset + 2] = 255;
    data[offset + 3] = 255;
  }

  codes.forEach((code, codeIndex) => {
    const rows = QR_CODES[code];
    if (!rows) throw new Error(`No existe matriz QR para ${code}`);
    const originX = margin + QUIET_MODULES * SCALE;
    const originY = margin + codeIndex * (symbolSize + GAP) + QUIET_MODULES * SCALE;
    rows.forEach((row, y) => {
      [...row].forEach((module, x) => {
        if (module !== '1') return;
        for (let dy = 0; dy < SCALE; dy += 1) {
          for (let dx = 0; dx < SCALE; dx += 1) {
            const offset = ((originY + y * SCALE + dy) * width + originX + x * SCALE + dx) * 4;
            data[offset] = 0;
            data[offset + 1] = 0;
            data[offset + 2] = 0;
          }
        }
      });
    });
  });

  return { width, height, data };
}

async function detectSyntheticFrame(codes: string[]) {
  const frame = makeSyntheticFrame(codes);
  activeContext = {
    drawImage: vi.fn(),
    getImageData: vi.fn(() => frame as ImageData),
  } as unknown as CanvasRenderingContext2D;
  const detector = createJsQrDetector();
  try {
    return await detector.detect({ videoWidth: frame.width, videoHeight: frame.height } as HTMLVideoElement);
  } finally {
    detector.stop();
  }
}

beforeEach(() => {
  Object.defineProperty(HTMLCanvasElement.prototype, 'getContext', {
    configurable: true,
    value: () => activeContext,
  });
});

afterEach(() => {
  activeContext = null;
  if (originalGetContext) {
    Object.defineProperty(HTMLCanvasElement.prototype, 'getContext', originalGetContext);
  } else {
    Reflect.deleteProperty(HTMLCanvasElement.prototype, 'getContext');
  }
  vi.restoreAllMocks();
});

describe('createJsQrDetector con píxeles QR sintéticos', () => {
  it('decodifica un QR real de la imagen del frame', async () => {
    const detections = await detectSyntheticFrame(['ACA60001']);
    expect(detections.map((detection) => detection.value)).toEqual(['ACA60001']);
    expect(detections[0]?.box).not.toBeNull();
  });

  it('decodifica dos QR distintos en el mismo frame sin BarcodeDetector', async () => {
    const detections = await detectSyntheticFrame(['ACA60001', 'ACA60002']);
    expect(detections.map((detection) => detection.value).sort()).toEqual(['ACA60001', 'ACA60002']);
    expect(detections[0]?.box).not.toEqual(detections[1]?.box);
  });

  it('distingue dos regiones físicas con el mismo texto', async () => {
    const detections = await detectSyntheticFrame(['ACA60001', 'ACA60001']);
    expect(detections.map((detection) => detection.value)).toEqual(['ACA60001', 'ACA60001']);
    expect(detections[0]?.box).not.toEqual(detections[1]?.box);
  });
});

describe('toOperationalCode (paridad con normalize_scanned_code)', () => {
  it.each([
    [' ACA60001 ', 'ACA60001'],
    ['https://inventario.example/productos/ACA60001', 'ACA60001'],
    ['https://inventario.example/productos/ACA60001/', 'ACA60001'],
    ['https://inventario.example/productos/%41CA60001', ''],
    ['https://inventario.example/productos/ACA60001?x=1', ''],
    ['ACA60001\u0000X', ''],
    ['A'.repeat(101), ''],
  ])('normaliza %s', (raw, expected) => {
    expect(toOperationalCode(raw)).toBe(expected);
  });
});
