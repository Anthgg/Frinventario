import { useState } from 'react';
import { useParams } from 'react-router-dom';
import { AlertTriangle, Check, Minus, Plus, Square } from 'lucide-react';
import { SaveIndicator } from '@/components/layout/SaveIndicator';
import { PageHeader } from '@/components/layout/PageHeader';
import { Badge } from '@/components/ui/Badge';
import { Button, IconButton } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Dialog } from '@/components/ui/Dialog';
import { useToast } from '@/components/ui/Toast';
import { RECENT_PRODUCTS, UI_MOCK } from '../mock/data';
import { CameraFrame } from './CameraFrame';
import styles from './CountSessionPage.module.css';

export function CountSessionPage() {
  const { sessionId } = useParams();
  const { push } = useToast();

  const [products, setProducts] = useState(RECENT_PRODUCTS);
  const current = products[0];
  const [quantity, setQuantity] = useState(current?.quantity ?? 0);
  const [damaged, setDamaged] = useState(current?.damaged ?? false);
  const [finishOpen, setFinishOpen] = useState(false);

  function changeQuantity(delta: number) {
    setQuantity((value) => Math.max(0, value + delta));
  }

  function applyToCurrent() {
    if (!current) return;
    setProducts((list) =>
      list.map((item) => (item.id === current.id ? { ...item, quantity, damaged } : item)),
    );
    push({ title: 'Producto actualizado', tone: 'success', description: current.code });
  }

  return (
    <>
      <PageHeader
        title="Conteo"
        description="Sesión de campo: escanea o busca, registra la cantidad y sigue."
        badge={
          <>
            <Badge tone="hilo">{UI_MOCK}</Badge>
            <Badge tone="neutral" className="mono">
              {sessionId ?? 'ses-001'}
            </Badge>
          </>
        }
        actions={<SaveIndicator state="saved" />}
      />

      {/* 1. Cámara — primer elemento en mobile */}
      <section className={styles.topZone}>
        <div className={styles.cameraZone} aria-label="Escaneo">
          <CameraFrame />
        </div>

        {/* 2/3/4/5. Último producto: cantidad editable, stepper y daño */}
        {current ? (
        <Card tone="glass" padding="md" className={styles.currentCard}>
          <div className={styles.currentHead}>
            <div className={styles.currentIdentity}>
              <p className={styles.currentLabel}>Último producto</p>
              <p className={styles.currentCode}>{current.code}</p>
              <p className={styles.currentName}>{current.name}</p>
            </div>
            <span className={styles.registered}>
              <span className={styles.registeredValue}>{current.quantity}</span>
              <span className={styles.registeredLabel}>registrado</span>
            </span>
          </div>

          <div className={styles.controls}>
            <div className={styles.stepper} role="group" aria-label="Cantidad">
              <IconButton
                label="Restar una unidad"
                size="lg"
                variant="secondary"
                onClick={() => changeQuantity(-1)}
                disabled={quantity <= 0}
                className={styles.stepButton}
              >
                <Minus size={18} />
              </IconButton>

              <label className={styles.quantityField}>
                <span className="sr-only">Cantidad a registrar</span>
                <input
                  className={styles.quantityInput}
                  type="number"
                  inputMode="numeric"
                  min={0}
                  value={quantity}
                  onChange={(event) => setQuantity(Math.max(0, Number(event.target.value) || 0))}
                />
              </label>

              <IconButton
                label="Sumar una unidad"
                size="lg"
                variant="secondary"
                onClick={() => changeQuantity(1)}
                className={styles.stepButton}
              >
                <Plus size={18} />
              </IconButton>
            </div>

            <button
              type="button"
              className={[styles.damage, damaged ? styles.damageOn : ''].filter(Boolean).join(' ')}
              aria-pressed={damaged}
              onClick={() => setDamaged((value) => !value)}
            >
              {damaged ? <Check size={15} aria-hidden="true" /> : <Square size={15} aria-hidden="true" />}
              Dañado
            </button>
          </div>

          <Button variant="primary" size="lg" block onClick={applyToCurrent}>
            Registrar cantidad
          </Button>
        </Card>
      ) : null}
      </section>

      {/* Últimos productos */}
      <section className={styles.recent} aria-label="Últimos productos registrados">
        <header className={styles.recentHead}>
          <h2 className={styles.recentTitle}>Últimos productos</h2>
          <span className={styles.recentCount}>{products.length} en pantalla</span>
        </header>
        <ul className={styles.recentList}>
          {products.map((product) => (
            <li key={product.id} className={styles.recentItem}>
              <span className={styles.recentIdentity}>
                <span className={styles.recentCode}>{product.code}</span>
                <span className={styles.recentName}>{product.name}</span>
              </span>
              <span className={styles.recentRight}>
                {product.damaged ? (
                  <Badge tone="warning">
                    <AlertTriangle size={10} aria-hidden="true" /> Dañado
                  </Badge>
                ) : null}
                <span className={styles.recentQty}>{product.quantity}</span>
              </span>
            </li>
          ))}
        </ul>
      </section>

      {/* 6. Finalizar */}
      <div className={styles.finishZone}>
        <Button variant="secondary" size="lg" block onClick={() => setFinishOpen(true)}>
          Finalizar sesión
        </Button>
      </div>

      <Dialog
        open={finishOpen}
        onOpenChange={setFinishOpen}
        title="¿Finalizar la sesión?"
        description="El cierre real de sesión y la sincronización llegan en FF001. Aquí solo se valida la interacción."
        closeLabel="Cerrar"
        footer={
          <>
            <Button variant="ghost" onClick={() => setFinishOpen(false)}>
              Seguir contando
            </Button>
            <Button variant="primary" onClick={() => setFinishOpen(false)}>
              Finalizar
            </Button>
          </>
        }
      >
        <p>
          Se conservarán los productos registrados en esta sesión con identificador{' '}
          <span className="mono">{sessionId ?? 'ses-001'}</span>.
        </p>
      </Dialog>
    </>
  );
}
