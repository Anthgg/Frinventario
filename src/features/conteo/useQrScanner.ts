import { useCallback, useEffect, useRef, useState } from 'react';
import { createQrDetector, type QrDetection, type QrDetector } from './qr/detector';
import { QrRegionTracker } from './qr/tracker';

/**
 * Loop de detección (FF003).
 *
 * - requestAnimationFrame con throttle (~10 detecciones/segundo): ni 120 FPS
 *   ni congelar el vídeo.
 * - UN solo loop por cámara activa (sin loops duplicados por rerender/StrictMode).
 * - El detector/tracker vive fuera del state de alta frecuencia: React solo se
 *   actualiza cuando hay eventos aceptados o un error real.
 */

export interface QrScannerOptions {
  videoRef: React.RefObject<HTMLVideoElement | null>;
  /** true mientras la cámara esté viva y la sesión acepte eventos. */
  enabled: boolean;
  onAccepted: (detections: QrDetection[]) => void;
  fps?: number;
  /** Reinicia tracks cuando cambia la sesión aunque la ruta siga montada. */
  resetKey?: string | number | null;
  /** Inyección para tests (sin cámara física). */
  detectorFactory?: () => QrDetector;
}

export interface QrScannerState {
  error: string | null;
  /** 'native' | 'fallback' del último detector creado (ref, sin rerender). */
  detectorKind: () => 'native' | 'fallback' | null;
}

const DEFAULT_FPS = 10;

export function useQrScanner({
  videoRef,
  enabled,
  onAccepted,
  fps = DEFAULT_FPS,
  resetKey,
  detectorFactory = createQrDetector,
}: QrScannerOptions): QrScannerState {
  const [error, setError] = useState<string | null>(null);
  const kindRef = useRef<'native' | 'fallback' | null>(null);
  const onAcceptedRef = useRef(onAccepted);
  useEffect(() => {
    onAcceptedRef.current = onAccepted;
  });

  useEffect(() => {
    if (!enabled) return;

    let cancelled = false;
    let rafId = 0;
    let busy = false;
    let lastRun = 0;
    let detector: QrDetector | null = null;
    const tracker = new QrRegionTracker();
    const interval = 1000 / Math.max(1, fps);

    const detectOnce = async () => {
      const video = videoRef.current;
      if (!detector || !video) return;
      try {
        const frame = await detector.detect(video);
        if (cancelled) return;
        const accepted = tracker.acceptFrame(frame, Date.now());
        if (accepted.length > 0) onAcceptedRef.current(accepted);
        // El error solo se toca en contexto asíncrono (post-await).
        setError((current) => (current === null ? current : null));
      } catch (caught) {
        if (cancelled) return;
        setError(caught instanceof Error ? caught.message : 'No pudimos leer la cámara.');
      } finally {
        busy = false;
      }
    };

    const loop = (time: number) => {
      rafId = requestAnimationFrame(loop);
      if (cancelled || busy) return;
      if (time - lastRun < interval) return;
      lastRun = time;
      busy = true;
      void detectOnce();
    };

    try {
      detector = detectorFactory();
    } catch {
      // El error se notifica en microtarea: nada de setState síncrono en effects.
      void Promise.resolve().then(() => {
        if (!cancelled) setError('No pudimos iniciar el lector de QR en este navegador.');
      });
      return () => {
        cancelled = true;
      };
    }
    kindRef.current = detector.kind;
    rafId = requestAnimationFrame(loop);

    return () => {
      cancelled = true;
      cancelAnimationFrame(rafId);
      detector?.stop();
      tracker.reset();
      kindRef.current = null;
    };
  }, [enabled, fps, videoRef, detectorFactory, resetKey]);

  const detectorKind = useCallback(() => kindRef.current, []);

  return { error, detectorKind };
}

