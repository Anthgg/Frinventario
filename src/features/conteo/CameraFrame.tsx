import { Camera, ScanLine } from 'lucide-react';
import styles from './CameraFrame.module.css';

/**
 * Placeholder visual de cámara (FF000).
 * NO solicita permiso de cámara: ese trabajo llega en FF003.
 */
export function CameraFrame() {
  return (
    <div className={styles.frame} data-testid="camera-frame">
      <span className={`${styles.corner} ${styles.tl}`} aria-hidden="true" />
      <span className={`${styles.corner} ${styles.tr}`} aria-hidden="true" />
      <span className={`${styles.corner} ${styles.bl}`} aria-hidden="true" />
      <span className={`${styles.corner} ${styles.br}`} aria-hidden="true" />
      <span className={styles.scan} aria-hidden="true" />

      <div className={styles.center}>
        <Camera size={22} aria-hidden="true" />
        <p className={styles.title}>Cámara en espera</p>
        <p className={styles.subtitle}>
          <ScanLine size={12} aria-hidden="true" />
          Disponible desde FF003 · sin permiso solicitado
        </p>
      </div>

      <span className="sr-only">
        Vista previa de cámara no disponible todavía en esta versión.
      </span>
    </div>
  );
}
