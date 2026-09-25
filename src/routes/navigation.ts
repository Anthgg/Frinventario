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

export interface NavItem {
  to: string;
  label: string;
  /** Etiqueta corta para la barra inferior de mobile. */
  mobileLabel?: string;
  icon: LucideIcon;
  /** En mobile aparece en el cajón "Más"; en desktop, en la barra. */
  section: 'operacion' | 'control' | 'sistema';
  end?: boolean;
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
  },
  { to: `/app/conteo/${DEMO_SESSION_ID}`, label: 'Conteo', icon: ScanLine, section: 'operacion' },
  { to: '/app/reconteos', label: 'Reconteos', icon: RotateCcw, section: 'operacion' },
  {
    to: `/app/conciliacion/${DEMO_CAMPAIGN_ID}`,
    label: 'Conciliación',
    icon: Scale,
    section: 'control',
  },
  { to: '/app/documentos', label: 'Documentos', icon: FileText, section: 'control' },
  { to: '/app/configuracion', label: 'Configuración', icon: Settings, section: 'sistema' },
];

/** Navegación principal de mobile: 4 destinos + cajón "Más". */
export const BOTTOM_NAV: NavItem[] = [
  NAV_ITEMS[0] as NavItem,
  NAV_ITEMS[1] as NavItem,
  NAV_ITEMS[2] as NavItem,
];

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
  return findNavItem(pathname)?.label ?? 'Dedalo';
}
