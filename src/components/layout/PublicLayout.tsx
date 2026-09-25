import { Outlet } from 'react-router-dom';
import { BrandMark, Wordmark } from '@/components/BrandMark';
import styles from './PublicLayout.module.css';

/** Rutas públicas (login, 404 fuera de sesión): una sola columna centrada. */
export function PublicLayout() {
  return (
    <div className={styles.page}>
      <main className={styles.center}>
        <div className={styles.brand}>
          <BrandMark size={32} />
          <Wordmark />
        </div>
        <Outlet />
      </main>
      <footer className={styles.footer}>
        <span>Inventario Dedalo</span>
        <span className="mono">FF000 · foundation</span>
      </footer>
    </div>
  );
}
