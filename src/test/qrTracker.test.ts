import { describe, expect, it } from 'vitest';
import { QrRegionTracker } from '@/features/conteo/qr/tracker';
import type { QrDetection } from '@/features/conteo/qr/detector';

function box(x: number, y: number, size = 80): QrDetection['box'] {
  return { x, y, width: size, height: size };
}

function detect(value: string, boxValue: QrDetection['box']): QrDetection {
  return { value, box: boxValue };
}

describe('QrRegionTracker (dedupe por región visual)', () => {
  it('cuenta una sola vez el mismo QR que permanece frente a la cámara', () => {
    const tracker = new QrRegionTracker();
    let accepted = 0;

    for (let frame = 0; frame < 30; frame += 1) {
      // Micro-jitter real de la mano: la región se mueve unos píxeles.
      const jitter = frame % 3;
      accepted += tracker.acceptFrame([detect('REF-1', box(100 + jitter, 60 + jitter))], frame * 100)
        .length;
    }

    expect(accepted).toBe(1);
  });

  it('permite volver a contar cuando la región desaparece y reaparece', () => {
    const tracker = new QrRegionTracker({ missFrames: 6 });
    expect(tracker.acceptFrame([detect('REF-1', box(100, 60))], 0)).toHaveLength(1);

    // 8 frames sin la región: el track se retira.
    for (let frame = 1; frame <= 8; frame += 1) {
      expect(tracker.acceptFrame([], frame * 100)).toHaveLength(0);
    }

    expect(tracker.acceptFrame([detect('REF-1', box(100, 60))], 900)).toHaveLength(1);
  });

  it('cuenta como dos unidades el mismo texto en dos regiones distintas', () => {
    const tracker = new QrRegionTracker();

    const first = tracker.acceptFrame(
      [detect('REF-1', box(20, 20)), detect('REF-1', box(400, 20))],
      0,
    );

    expect(first).toHaveLength(2);
    // Siguen vivas: el siguiente frame no las duplica.
    expect(
      tracker.acceptFrame(
        [detect('REF-1', box(20, 20)), detect('REF-1', box(400, 20))],
        100,
      ),
    ).toHaveLength(0);
  });

  it('procesa varias regiones distintas en el mismo frame (multi-QR)', () => {
    const tracker = new QrRegionTracker();

    const accepted = tracker.acceptFrame(
      [
        detect('REF-1', box(10, 10)),
        detect('REF-2', box(200, 10)),
        detect('REF-3', box(400, 10)),
      ],
      0,
    );

    expect(accepted.map((item) => item.value)).toEqual(['REF-1', 'REF-2', 'REF-3']);
  });

  it('sin geometría aplica cooldown por valor (detector sin región)', () => {
    const tracker = new QrRegionTracker({ valueCooldownMs: 1500 });

    expect(tracker.acceptFrame([detect('REF-1', null)], 0)).toHaveLength(1);
    expect(tracker.acceptFrame([detect('REF-1', null)], 500)).toHaveLength(0);
    expect(tracker.acceptFrame([detect('REF-1', null)], 2000)).toHaveLength(1);
  });

  it('olvida los tracks al hacer reset (cambio de sesión)', () => {
    const tracker = new QrRegionTracker();
    expect(tracker.acceptFrame([detect('REF-1', box(10, 10))], 0)).toHaveLength(1);
    tracker.reset();
    expect(tracker.acceptFrame([detect('REF-1', box(10, 10))], 100)).toHaveLength(1);
  });
});
