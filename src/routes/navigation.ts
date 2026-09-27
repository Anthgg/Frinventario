import {
  Boxes,
  FileText,
  LayoutDashboard,
  type LucideIcon,
  RotateCcw,
  ScanLine,
  Scale,
  Settings,
} from 'lucide-react';
import { hasPermission, type PermissionInput } from '@/auth/permissions';

export interface NavItem {
  to: string;
  label: string;
  /** Etiqueta corta para la barra inferior de mobile. */
  mobileLabel?: string;
  icon: LucideIcon;
  /** En mobile aparece en el cajón "Más"; en desktop, en la barra. */
  section: 'operacion' | 'control' | 'sistema';
  end?: boolean;
  /**
   * Permiso requerido para que el ítem sea visible. Sale del catálogo del
   * backend (GET /auth/me); sin permiso definido = visible para toda sesión.
   */
  permission?: PermissionInput;
}

/** IDs de demo (FF000): las rutas del contrato exigen parámetros. */
export const DEMO_CAMPAIGN_ID = 'camp-001';
export const DEMO_SESSION_ID = 'ses-001';

export const NAV_ITEMS: NavItem[] = [
  {
    to: '/app/dashboard',
    label: 'Dashboard',
    mobileLabel: 'Inicio',
    icon: LayoutDashboard,
    section: 'operacion',
    end: true,
  },
  {
    to: '/app/inventarios',
    label: 'Inventarios',
    mobileLabel: 'Campañas',
    icon: Boxes,
    section: 'operacion',
    permission: 'inventory.read',
  },
  {
    to: `/app/conteo/${DEMO_SESSION_ID}`,
    label: 'Conteo',
    icon: ScanLine,
    section: 'operacion',
    permission: 'inventory.count',
  },
  {
    to: '/app/reconteos',
    label: 'Reconteos',
    icon: RotateCcw,
    section: 'operacion',
    permission: 'inventory.recount',
  },
  {
    to: `/app/conciliacion/${DEMO_CAMPAIGN_ID}`,
    label: 'Conciliación',
    icon: Scale,
    section: 'control',
    permission: 'inventory.reconcile',
  },
  {
    to: '/app/documentos',
    label: 'Documentos',
    icon: FileText,
    section: 'control',
    permission: 'exports.read',
  },
  {
    to: '/app/configuracion',
    label: 'Configuración',
    icon: Settings,
    section: 'sistema',
    permission: 'system.manage',
  },
];

/** Filtra la navegación con los permisos reales de /auth/me. */
export function visibleNavItems(
  items: readonly NavItem[] = NAV_ITEMS,
  granted: readonly string[] = [],
): NavItem[] {
  return items.filter((item) => item.permission === undefined || hasPermission(granted, item.permission));
}

/** Navegación principal de mobile: primeros destinos + cajón "Más". */
export function bottomNavItems(granted: readonly string[] = []): NavItem[] {
  return visibleNavItems(NAV_ITEMS, granted).slice(0, 3);
}

export function findNavItem(pathname: string): NavItem | undefined {
  let best: NavItem | undefined;
  for (const item of NAV_ITEMS) {
    if (item.end ? pathname === item.to : pathname.startsWith(item.to)) {
      if (!best || item.to.length > best.to.length) best = item;
    }
  }
  return best;
}

export function titleFor(pathname: string): string {
  return findNavItem(pathname)?.label ?? 'Página no encontrada';
}
