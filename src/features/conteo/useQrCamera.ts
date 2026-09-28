import { useCallback, useEffect, useRef, useState } from 'react';

/**
 * Adquisición de cámara (FF003).
 *
 * - `facingMode: { ideal: 'environment' }` → trasera en móvil.
 * - El stream se crea con un gesto del usuario ("Activar cámara") y permanece
 *   vivo: NO se apaga por cada escaneo.
 * - Se libera solo al desmontar, al desactivar explícitamente o al enviar.
 */

export type CameraStatus = 'idle' | 'starting' | 'active' | 'error';

export type CameraErrorKind =
  | 'denied'
  | 'not_found'
  | 'busy'
  | 'insecure'
  | 'overconstrained'
  | 'unknown';

export interface CameraError {
  kind: CameraErrorKind;
  message: string;
}

const MESSAGES: Record<CameraErrorKind, string> = {
  denied: 'Permiso de cámara denegado. Actívalo en tu navegador para escanear.',
  not_found: 'No se encontró cámara en este dispositivo.',
  busy: 'La cámara está siendo usada por otra aplicación.',
  insecure: 'Se requiere HTTPS o localhost para usar la cámara.',
  overconstrained: 'No hay una cámara trasera disponible; se usará la predeterminada.',
  unknown: 'No pudimos abrir la cámara.',
};

function mapError(error: unknown): CameraError {
  const name = (error as { name?: string } | null)?.name ?? '';
  switch (name) {
    case 'NotAllowedError':
    case 'SecurityError':
      return { kind: 'denied', message: MESSAGES.denied };
    case 'NotFoundError':
    case 'DevicesNotFoundError':
      return { kind: 'not_found', message: MESSAGES.not_found };
    case 'NotReadableError':
    case 'TrackStartError':
      return { kind: 'busy', message: MESSAGES.busy };
    case 'OverconstrainedError':
      return { kind: 'overconstrained', message: MESSAGES.overconstrained };
    default:
      return { kind: 'unknown', message: MESSAGES.unknown };
  }
}

export interface CameraController {
  status: CameraStatus;
  error: CameraError | null;
  /** true cuando hay un stream activo (útil para el overlay). */
  live: boolean;
  start: () => Promise<void>;
  stop: () => void;
}

function stopStream(stream: MediaStream): void {
  for (const track of stream.getTracks()) {
    if (track.readyState !== 'ended') track.stop();
  }
}

export function useQrCamera(videoRef: React.RefObject<HTMLVideoElement | null>): CameraController {
  const [status, setStatus] = useState<CameraStatus>('idle');
  const [error, setError] = useState<CameraError | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const startingRef = useRef(false);
  const startGenerationRef = useRef(0);
  const mountedRef = useRef(false);

  const stop = useCallback(() => {
    startGenerationRef.current += 1;
    startingRef.current = false;
    const stream = streamRef.current;
    if (stream) {
      stopStream(stream);
      streamRef.current = null;
    }
    const video = videoRef.current;
    if (video) {
      video.srcObject = null;
    }
    setStatus((current) => (current === 'active' || current === 'starting' ? 'idle' : current));
  }, [videoRef]);

  const start = useCallback(async () => {
    if (startingRef.current) return;
    if (streamRef.current) return;

    const mediaDevices = navigator.mediaDevices;
    if (!mediaDevices || typeof mediaDevices.getUserMedia !== 'function') {
      setError({ kind: 'insecure', message: MESSAGES.insecure });
      setStatus('error');
      return;
    }

    startingRef.current = true;
    const generation = ++startGenerationRef.current;
    setStatus('starting');
    setError(null);
    try {
      const stream = await mediaDevices.getUserMedia({
        video: { facingMode: { ideal: 'environment' } },
        audio: false,
      });
      if (!mountedRef.current || generation !== startGenerationRef.current) {
        stopStream(stream);
        return;
      }
      streamRef.current = stream;
      const video = videoRef.current;
      if (!video) {
        stopStream(stream);
        streamRef.current = null;
        setStatus('idle');
        return;
      }
      video.srcObject = stream;
      video.muted = true;
      video.playsInline = true;
      try {
        await video.play();
      } catch {
        // Autoplay bloqueado: el usuario puede tocar el vídeo; el stream sigue vivo.
      }
      if (!mountedRef.current || generation !== startGenerationRef.current || streamRef.current !== stream) {
        if (streamRef.current === stream) {
          stopStream(stream);
          streamRef.current = null;
        }
        if (video.srcObject === stream) video.srcObject = null;
        return;
      }
      setStatus('active');
    } catch (caught) {
      if (!mountedRef.current || generation !== startGenerationRef.current) return;
      setError(mapError(caught));
      setStatus('error');
    } finally {
      if (generation === startGenerationRef.current) startingRef.current = false;
    }
  }, [videoRef]);

  // Liberación garantizada al desmontar (sin dejar cámara encendida en background).
  useEffect(() => {
    mountedRef.current = true;
    const video = videoRef.current;
    return () => {
      mountedRef.current = false;
      startGenerationRef.current += 1;
      startingRef.current = false;
      const stream = streamRef.current;
      if (stream) {
        stopStream(stream);
        streamRef.current = null;
      }
      if (video) video.srcObject = null;
    };
  }, [videoRef]);

  return { status, error, live: status === 'active', start, stop };
}
