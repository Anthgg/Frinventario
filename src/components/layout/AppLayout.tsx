import { LogOut, Menu } from 'lucide-react';
import { useRef, useState } from 'react';
import { NavLink, Outlet, useLocation } from 'react-router-dom';
import { useConnectionStatus } from '@/api/connection';
import { ApiError } from '@/api/errors';
import { BrandMark, Wordmark } from '@/components/BrandMark';
import { Badge } from '@/components/ui/Badge';
import { Button, IconButton } from '@/components/ui/Button';
import { Drawer } from '@/components/ui/Dialog';
import { useAuth } from '@/auth/AuthProvider';
import { primaryRoleLabel } from '@/auth/roles';
import {
  bottomNavItems,
  findNavItem,
  titleFor,
  visibleNavItems,
} from '@/routes/navigation';
import { SaveIndicator } from './SaveIndicator';
import styles from './AppLayout.module.css';

const SECTIONS: { id: 'operacion' | 'control' | 'sistema'; label: string }[] = [
  { id: 'operacion', label: 'Operación' },
  { id: 'control', label: 'Control' },
  { id: 'sistema', label: 'Sistema' },
];

/** Indicador discreto de conexión con el API (no es el offline de FF004). */
function ConnectionIndicator() {
  const state = useConnectionStatus();
  if (state === 'unknown') return null;
  return (
    <Badge
      tone={state === 'online' ? 'success' : 'danger'}
      dot
      className={styles.connBadge}
    >
      {state === 'online' ? 'Conectado' : 'Sin conexión'}
    </Badge>
  );
}

function UserBlock({ compact = false }: { compact?: boolean }) {
  const { user, roles, logout, endLocalSession } = useAuth();
  const [logoutError, setLogoutError] = useState<string | null>(null);
  const [loggingOut, setLoggingOut] = useState(false);

  const name = user?.display_name?.trim() || user?.email || 'Sin sesión';
  const initial = name.trim().charAt(0).toUpperCase();
  const roleLabel = primaryRoleLabel(roles);
  const secondary = roleLabel ?? user?.email ?? '';

  async function handleLogout() {
    if (loggingOut) return;
    setLoggingOut(true);
    setLogoutError(null);
    try {
      await logout();
    } catch (caught) {
      setLogoutError(ApiError.from(caught).message);
    } finally {
      setLoggingOut(false);
    }
  }

  return (
    <div className={[styles.user, compact ? styles.userCompact : ''].filter(Boolean).join(' ')}>
      <div className={styles.userRow}>
        <span className={styles.avatar} aria-hidden="true">
          {initial}
        </span>
        <div className={styles.userText}>
          <p className={styles.userName}>{name}</p>
          <p className={styles.userRole}>{secondary}</p>
        </div>
        <IconButton
          label="Cerrar sesión"
          size="sm"
          loading={loggingOut}
          onClick={() => {
            void handleLogout();
          }}
        >
          <LogOut size={15} />
        </IconButton>
      </div>

      {logoutError ? (
        <div className={styles.logoutError} role="alert">
          <p className={styles.logoutErrorText}>
            No se pudo cerrar la sesión en el servidor. Inténtalo de nuevo.
          </p>
          <div className={styles.logoutErrorActions}>
            <Button size="sm" variant="secondary" onClick={() => void handleLogout()}>
              Reintentar
            </Button>
            <Button size="sm" variant="ghost" onClick={endLocalSession}>
              Salir en este dispositivo
            </Button>
          </div>
        </div>
      ) : null}
    </div>
  );
}

function SidebarNav({ granted }: { granted: readonly string[] }) {
  const items = visibleNavItems(undefined, granted);
  return (
    <nav className={styles.nav} aria-label="Navegación principal">
      {SECTIONS.map((section) => {
        const sectionItems = items.filter((item) => item.section === section.id);
        if (sectionItems.length === 0) return null;
        return (
          <div key={section.id} className={styles.section}>
            <p className={styles.sectionTitle}>{section.label}</p>
            <ul className={styles.sectionList}>
              {sectionItems.map(({ to, label, icon: Icon, end }) => (
                <li key={to}>
                  <NavLink
                    to={to}
                    end={end}
                    title={label}
                    className={({ isActive }) =>
                      [styles.item, isActive ? styles.itemActive : ''].filter(Boolean).join(' ')
                    }
                  >
                    <Icon size={17} className={styles.itemIcon} aria-hidden="true" />
                    <span className={styles.itemLabel}>{label}</span>
                  </NavLink>
                </li>
              ))}
            </ul>
          </div>
        );
      })}
    </nav>
  );
}

function MoreDrawer({
  open,
  onOpenChange,
  returnFocus,
  granted,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  returnFocus: () => void;
  granted: readonly string[];
}) {
  const visible = visibleNavItems(undefined, granted);
  const primary = new Set(bottomNavItems(granted).map((item) => item.to));
  const extra = visible.filter((item) => !primary.has(item.to));

  return (
    <Drawer
      open={open}
      onOpenChange={onOpenChange}
      title="Más secciones"
      description="Operación y control fuera de la barra principal."
      closeLabel="Cerrar menú"
      footer={<UserBlock />}
      returnFocus={returnFocus}
    >
      <nav aria-label="Navegación adicional">
        <ul className={styles.drawerList}>
          {extra.map(({ to, label, icon: Icon, end }) => (
            <li key={to}>
              <NavLink
                to={to}
                end={end}
                onClick={() => onOpenChange(false)}
                className={({ isActive }) =>
                  [styles.item, isActive ? styles.itemActive : ''].filter(Boolean).join(' ')
                }
              >
                <Icon size={17} className={styles.itemIcon} aria-hidden="true" />
                <span className={styles.itemLabel}>{label}</span>
              </NavLink>
            </li>
          ))}
        </ul>
      </nav>
    </Drawer>
  );
}

export function AppLayout() {
  const { pathname } = useLocation();
  const { permissions } = useAuth();
  const [moreOpen, setMoreOpen] = useState(false);
  const moreTriggerRef = useRef<HTMLButtonElement>(null);
  const title = titleFor(pathname);
  const active = findNavItem(pathname);
  const sectionLabel = active
    ? (SECTIONS.find((section) => section.id === active.section)?.label ?? '')
    : '';
  const crumbs = ['Dedalo', sectionLabel, title].filter(Boolean);
  const granted = permissions;
  const bottomItems = bottomNavItems(granted);

  return (
    <div className={styles.shell}>
      <a className={styles.skip} href="#contenido">
        Saltar al contenido
      </a>

      <aside className={styles.sidebar}>
        <div className={styles.brand}>
          <BrandMark size={26} />
          <Wordmark />
        </div>
        <SidebarNav granted={granted} />
        <div className={styles.sidebarFoot}>
          <UserBlock />
        </div>
      </aside>

      <div className={styles.main}>
        <header className={styles.topbar}>
          <div className={styles.topbarLead}>
            <span className={styles.mobileBrand}>
              <BrandMark size={22} />
            </span>
            <nav className={styles.crumbs} aria-label="Ubicación">
              {crumbs.map((crumb, index) => (
                <span key={crumb} className={styles.crumbPiece}>
                  {index > 0 ? (
                    <span className={styles.crumbSep} aria-hidden="true">
                      /
                    </span>
                  ) : null}
                  <span className={index === crumbs.length - 1 ? styles.crumbCurrent : undefined}>
                    {crumb}
                  </span>
                </span>
              ))}
            </nav>
          </div>
          <div className={styles.topbarActions}>
            <Badge tone="hilo" className={styles.mockBadge}>
              UI_MOCK
            </Badge>
            <ConnectionIndicator />
            <SaveIndicator state="saved" />
            <span className={styles.topbarUser}>
              <UserBlock compact />
            </span>
            <span className={styles.topbarMenu}>
              <IconButton
                label="Abrir más secciones"
                onClick={(event) => {
                  moreTriggerRef.current = event.currentTarget;
                  setMoreOpen(true);
                }}
                aria-expanded={moreOpen}
              >
                <Menu size={18} />
              </IconButton>
            </span>
          </div>
        </header>

        <main className={styles.content} id="contenido">
          <Outlet />
        </main>
      </div>

      <nav className={styles.bottomNav} aria-label="Navegación principal (móvil)">
        {bottomItems.map(({ to, label, mobileLabel, icon: Icon, end }) => (
          <NavLink
            key={to}
            to={to}
            end={end}
            className={({ isActive }) =>
              [styles.bottomItem, isActive ? styles.bottomItemActive : '']
                .filter(Boolean)
                .join(' ')
            }
          >
            <Icon size={19} aria-hidden="true" />
            <span className={styles.bottomLabel}>{mobileLabel ?? label}</span>
          </NavLink>
        ))}
        <button
          type="button"
          className={styles.bottomItem}
          aria-expanded={moreOpen}
          aria-haspopup="dialog"
          onClick={(event) => {
            moreTriggerRef.current = event.currentTarget;
            setMoreOpen(true);
          }}
        >
          <Menu size={19} aria-hidden="true" />
          <span className={styles.bottomLabel}>Más</span>
        </button>
      </nav>

      <MoreDrawer
        open={moreOpen}
        onOpenChange={setMoreOpen}
        returnFocus={() => moreTriggerRef.current?.focus()}
        granted={granted}
      />
    </div>
  );
}
