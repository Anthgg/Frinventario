import type { RefObject } from 'react';
import { Camera, CameraOff, Check, ScanLine } from 'lucide-react';
import { Alert } from '@/components/ui/Alert';
import { Button } from '@/components/ui/Button';
import { Spinner } from '@/components/ui/Spinner';
import type { CameraError, CameraStatus } from './useQrCamera';
import { toOperationalCode } from './qr/detector';
import styles from './CountSessionPage.module.css';

export interface CameraPanelProps {
  videoRef: RefObject<HTMLVideoElement | null>;
  status: CameraStatus;
  error: CameraError | null;
  scannerError: string | null;
  lastScan: string | null;
  scanning: boolean;
  disabled: boolean;
  onStart: () => void;
  onStop: () => void;
}

interface ViewportProps {
  videoRef: RefObject<HTMLVideoElement | null>;
  live: boolean;
  scanning: boolean;
  lastScan: string | null;
}

function ViewportState({ live, scanning }: { live: boolean; scanning: boolean }) {
  if (!live) {
    return (
      <span className={styles.viewportState}>
        <Camera size={18} aria-hidden="true" /> Cámara apagada
      </span>
    );
  }

  if (scanning) {
    return (
      <span className={styles.viewportState}>
        <Spinner size={16} aria-hidden="true" /> Buscando QR…
      </span>
    );
  }

  return (
    <span className={styles.viewportState}>
      <ScanLine size={18} aria-hidden="true" /> Apunta al código del producto
    </span>
  );
}

function CameraViewport({ videoRef, live, scanning, lastScan }: ViewportProps) {
  return (
    <div className={styles.viewport} data-live={live ? 'true' : 'false'}>
      <video
        ref={videoRef}
        className={styles.video}
        playsInline
        muted
        autoPlay
        aria-hidden="true"
      />

      <span className={styles.frame} aria-hidden="true">
        <span className={styles.bracket} />
        <span className={styles.bracket} />
        <span className={styles.bracket} />
        <span className={styles.bracket} />
      </span>

      <ViewportState live={live} scanning={scanning} />

      {lastScan ? (
        <output className={styles.scanToast} data-testid="last-scan">
          <Check size={14} aria-hidden="true" />
          <span className="mono">{toOperationalCode(lastScan)}</span>
        </output>
      ) : null}
    </div>
  );
}

interface CameraActionProps {
  live: boolean;
  status: CameraStatus;
  disabled: boolean;
  onStart: () => void;
  onStop: () => void;
}

function CameraActionButton({ live, status, disabled, onStart, onStop }: CameraActionProps) {
  if (live) {
    return (
      <Button variant="secondary" size="lg" block onClick={onStop} disabled={disabled}>
        <CameraOff size={17} aria-hidden="true" /> Apagar cámara
      </Button>
    );
  }

  if (status === 'starting') {
    return (
      <Button variant="primary" size="lg" block onClick={onStart} disabled>
        Abriendo cámara…
      </Button>
    );
  }

  return (
    <Button variant="primary" size="lg" block onClick={onStart} disabled={disabled}>
      <Camera size={17} aria-hidden="true" /> Activar cámara
    </Button>
  );
}

/**
 * Zona de cámara (primer elemento en mobile). El stream solo se detiene con un
 * gesto explícito o al desmontar; escanear NO apaga la cámara.
 */
export function CameraPanel({
  videoRef,
  status,
  error,
  scannerError,
  lastScan,
  scanning,
  disabled,
  onStart,
  onStop,
}: CameraPanelProps) {
  const live = status === 'active';

  return (
    <section className={styles.cameraZone} aria-label="Escaneo QR">
      <CameraViewport videoRef={videoRef} live={live} scanning={scanning} lastScan={lastScan} />

      <div className={styles.cameraActions}>
        <CameraActionButton
          live={live}
          status={status}
          disabled={disabled}
          onStart={onStart}
          onStop={onStop}
        />
      </div>

      {error ? (
        <Alert tone="danger" title="No podemos usar la cámara">
          {error.message}
        </Alert>
      ) : null}
      {scannerError ? (
        <Alert tone="warning" title="Lectura interrumpida">
          {scannerError}
        </Alert>
      ) : null}
    </section>
  );
}
