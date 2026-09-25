import * as DialogPrimitive from '@radix-ui/react-dialog';
import { X } from 'lucide-react';
import type { ReactNode } from 'react';
import styles from './Dialog.module.css';

const Root = DialogPrimitive.Root;
const Trigger = DialogPrimitive.Trigger;
const Close = DialogPrimitive.Close;

interface SurfaceProps {
  title: ReactNode;
  description?: ReactNode;
  children?: ReactNode;
  footer?: ReactNode;
  closeLabel: string;
  className?: string;
}

/** Superficie compartida: encabezado, cuerpo y acciones de diálogo/cajón. */
function Surface({
  title,
  description,
  children,
  footer,
  closeLabel,
  className,
}: SurfaceProps) {
  return (
    <DialogPrimitive.Content className={className} aria-describedby={undefined}>
      <header className={styles.header}>
        <div>
          <DialogPrimitive.Title className={styles.title}>{title}</DialogPrimitive.Title>
          {description ? (
            <DialogPrimitive.Description className={styles.description}>
              {description}
            </DialogPrimitive.Description>
          ) : (
            <DialogPrimitive.Description className={styles.description} hidden />
          )}
        </div>
        <DialogPrimitive.Close className={styles.close} aria-label={closeLabel}>
          <X size={16} />
        </DialogPrimitive.Close>
      </header>
      {children ? <div className={styles.body}>{children}</div> : null}
      {footer ? <footer className={styles.footer}>{footer}</footer> : null}
    </DialogPrimitive.Content>
  );
}

export interface DialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: ReactNode;
  description?: ReactNode;
  children?: ReactNode;
  footer?: ReactNode;
  /** Etiqueta accesible del cierre. */
  closeLabel?: string;
}

/** Diálogo centrado: primitiva Radix (foco, Escape, ARIA, scroll-lock). */
export function Dialog({
  open,
  onOpenChange,
  title,
  description,
  children,
  footer,
  closeLabel = 'Cerrar',
}: DialogProps) {
  return (
    <Root open={open} onOpenChange={onOpenChange}>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay className={styles.overlay} />
        <Surface
          className={styles.content}
          title={title}
          description={description}
          closeLabel={closeLabel}
          footer={footer}
        >
          {children}
        </Surface>
      </DialogPrimitive.Portal>
    </Root>
  );
}

export interface DrawerProps extends Omit<DialogProps, 'children'> {
  children?: ReactNode;
  side?: 'right' | 'left' | 'bottom';
}

/** Cajón lateral (mobile). Misma primitiva, desliza desde el borde. */
export function Drawer({
  open,
  onOpenChange,
  title,
  description,
  children,
  footer,
  side = 'right',
  closeLabel = 'Cerrar',
}: DrawerProps) {
  return (
    <Root open={open} onOpenChange={onOpenChange}>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay className={styles.overlay} />
        <Surface
          className={[styles.drawer, styles[`drawer_${side}`]].join(' ')}
          title={title}
          description={description}
          closeLabel={closeLabel}
          footer={footer}
        >
          {children}
        </Surface>
      </DialogPrimitive.Portal>
    </Root>
  );
}

export { Root as DialogRoot, Trigger as DialogTrigger, Close as DialogClose };
