import type { QrBox, QrDetection } from './detector';

/**
 * Tracking por REGIÓN visual (FF003).
 *
 * Objetivo: contar una vez el mismo QR que permanece frente a la cámara,
 * permitir que dos objetos con el MISMO texto se cuenten como dos unidades
 * (regiones espaciales distintas) y dejar que una región que desaparece y
 * reaparezca vuelva a contarse.
 *
 * Límite físico documentado: sin identificador serial único, si un objeto
 * desaparece y vuelve con el mismo código no existe forma matemática de
 * demostrar que sea la misma pieza física; por eso el dedupe es por región
 * visible y NO por valor durante toda la sesión.
 */

export interface TrackerOptions {
  /** Frames seguidos sin ver una región antes de poder volver a contarla. */
  missFrames?: number;
  /** Tolerancia base en píxeles para emparejar la misma región entre frames. */
  matchTolerancePx?: number;
  /** Cooldown (ms) cuando el detector no expone geometría (solo valor). */
  valueCooldownMs?: number;
  /** Tope de regiones activas para no acumular memoria indefinidamente. */
  maxTracks?: number;
}

interface Track {
  id: number;
  value: string;
  centerX: number;
  centerY: number;
  width: number;
  height: number;
  counted: boolean;
  misses: number;
}

const DEFAULTS: Required<TrackerOptions> = {
  missFrames: 6,
  matchTolerancePx: 16,
  valueCooldownMs: 1500,
  maxTracks: 64,
};

function centerOf(box: QrBox): { x: number; y: number } {
  return { x: box.x + box.width / 2, y: box.y + box.height / 2 };
}

function distance(ax: number, ay: number, bx: number, by: number): number {
  return Math.hypot(ax - bx, ay - by);
}

export class QrRegionTracker {
  private readonly options: Required<TrackerOptions>;
  private tracks = new Map<number, Track>();
  private lastAcceptedByValue = new Map<string, number>();
  private nextId = 1;

  constructor(options: TrackerOptions = {}) {
    this.options = { ...DEFAULTS, ...options };
  }

  /** Reinicia todo el estado (cambio de sesión / unmount). */
  reset(): void {
    this.tracks.clear();
    this.lastAcceptedByValue.clear();
    this.nextId = 1;
  }

  /**
   * Procesa UN frame y devuelve las detecciones aceptadas (cada una = una
   * intención de evento). Llamar una vez por frame analizado.
   */
  acceptFrame(detections: QrDetection[], now: number): QrDetection[] {
    const accepted: QrDetection[] = [];
    const matchedTrackIds = new Set<number>();

    for (const detection of detections) {
      if (!detection.value) continue;

      if (!detection.box) {
        // Sin geometría: cooldown por valor (único caso donde aplica).
        const last = this.lastAcceptedByValue.get(detection.value);
        if (last === undefined || now - last >= this.options.valueCooldownMs) {
          this.rememberAcceptedValue(detection.value, now);
          accepted.push(detection);
        }
        continue;
      }

      const track = this.matchTrack(detection, matchedTrackIds);
      if (track) {
        matchedTrackIds.add(track.id);
        track.misses = 0;
        track.counted = true;
        track.centerX = centerOf(detection.box).x;
        track.centerY = centerOf(detection.box).y;
        track.width = detection.box.width;
        track.height = detection.box.height;
        continue; // Ya contada mientras sigue visible.
      }

      const newTrack: Track = {
        id: this.nextId++,
        value: detection.value,
        centerX: centerOf(detection.box).x,
        centerY: centerOf(detection.box).y,
        width: detection.box.width,
        height: detection.box.height,
        counted: true,
        misses: 0,
      };
      this.tracks.set(newTrack.id, newTrack);
      matchedTrackIds.add(newTrack.id);
      accepted.push(detection);
    }

    this.advanceFrame(matchedTrackIds);
    this.prune();
    return accepted;
  }

  private matchTrack(detection: QrDetection, matchedTrackIds: Set<number>): Track | undefined {
    const box = detection.box;
    if (!box) return undefined;
    const { x, y } = centerOf(box);
    let best: Track | undefined;
    let bestDistance = Number.POSITIVE_INFINITY;

    for (const track of this.tracks.values()) {
      if (matchedTrackIds.has(track.id)) continue;
      if (track.value !== detection.value) continue;
      // Tolerancia proporcional al tamaño de la región: mueve la pieza un poco
      // y sigue siendo la misma; dos piezas juntas quedan fuera de tolerancia.
      const reach =
        this.options.matchTolerancePx +
        Math.min(track.width, track.height, box.width, box.height) / 2;
      const gap = distance(track.centerX, track.centerY, x, y);
      if (gap <= reach && gap < bestDistance) {
        best = track;
        bestDistance = gap;
      }
    }
    return best;
  }

  private advanceFrame(matchedTrackIds: Set<number>): void {
    for (const [id, track] of this.tracks) {
      if (matchedTrackIds.has(id)) continue;
      track.misses += 1;
      if (track.misses > this.options.missFrames) {
        this.tracks.delete(id);
      }
    }
  }

  private prune(): void {
    if (this.tracks.size <= this.options.maxTracks) return;
    const ordered = [...this.tracks.values()].sort(
      (a, b) => b.misses - a.misses || a.id - b.id,
    );
    const excess = this.tracks.size - this.options.maxTracks;
    for (let index = 0; index < excess; index += 1) {
      const target = ordered[index];
      if (target) this.tracks.delete(target.id);
    }
  }

  private rememberAcceptedValue(value: string, now: number): void {
    // Map insertion order gives a small FIFO cap for geometry-less detections.
    this.lastAcceptedByValue.delete(value);
    this.lastAcceptedByValue.set(value, now);
    while (this.lastAcceptedByValue.size > this.options.maxTracks) {
      const oldest = this.lastAcceptedByValue.keys().next().value as string | undefined;
      if (oldest === undefined) break;
      this.lastAcceptedByValue.delete(oldest);
    }
  }
}
