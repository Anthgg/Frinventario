import { LogOut, Menu } from 'lucide-react';
import { useState } from 'react';
import { NavLink, Outlet, useLocation } from 'react-router-dom';
import { BrandMark, Wordmark } from '@/components/BrandMark';
import { Badge } from '@/components/ui/Badge';
import { IconButton } from '@/components/ui/Button';import { Drawer } from '@/components/ui/Dialog';
import { useAuth } from '@/auth/AuthProvider';
import { BOTTOM_NAV, findNavItem, NAV_ITEMS, titleFor } from '@/routes/navigation';
import { SaveIndicator } from './SaveIndicator';
import styles from './AppLayout.module.css';

const SECTIONS: { id: 'operacion' | 'control' | 'sistema'; label: string }[] = [
  { id: 'operacion', label: 'Operación' },
  { id: 'control', label: 'Control' },
  { id: 'sistema', label: 'Sistema' },
];

function UserBlock({ compact = false }: { compact?: boolean }) {
  const { user, isDemo, logout } = useAuth();
  const initial = (user?.display_name ?? user?.email ?? '?').trim().charAt(0).toUpperCase();

  return (
    <div className={[styles.user, compact ? styles.userCompact : ''].filter(Boolean).join(' ')}>
      <span className={styles.avatar} aria-hidden="true">
        {initial}
      </span>
      <div className={styles.userText}>
        <p className={styles.userName}>{user?.display_name ?? 'Sin sesión'}</p>
        <p className={styles.userRole}>{isDemo ? 'Sesión demo · UI_MOCK' : (user?.email ?? '')}</p>
      </div>
      <IconButton
        label="Cerrar sesión"
        size="sm"
        onClick={() => {
          void logout();
        }}
      >
        <LogOut size={15} />
      </IconButton>
    </div>
  );
}

function SidebarNav() {
  return (
    <nav className={styles.nav} aria-label="Navegación principal">
      {SECTIONS.map((section) => {
        const items = NAV_ITEMS.filter((item) => item.section === section.id);
        if (items.length === 0) return null;
        return (
          <div key={section.id} className={styles.section}>
            <p className={styles.sectionTitle}>{section.label}</p>
            <ul className={styles.sectionList}>
              {items.map(({ to, label, icon: Icon, end }) => (
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

function MoreDrawer({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
  const extra = NAV_ITEMS.filter(
    (item) => !BOTTOM_NAV.some((bottom) => bottom.to === item.to),
  );

  return (
    <Drawer
      open={open}
      onOpenChange={onOpenChange}
      title="Más secciones"
      description="Operación y control fuera de la barra principal."
      closeLabel="Cerrar menú"
      footer={<UserBlock />}
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
  const [moreOpen, setMoreOpen] = useState(false);
  const title = titleFor(pathname);
  const active = findNavItem(pathname);
  const sectionLabel = active
    ? (SECTIONS.find((section) => section.id === active.section)?.label ?? '')
    : '';
  const crumbs = ['Dedalo', sectionLabel, title].filter(Boolean);

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
        <SidebarNav />
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
            <SaveIndicator state="saved" />
            <span className={styles.topbarUser}>
              <UserBlock compact />
            </span>
            <span className={styles.topbarMenu}>
              <IconButton
                label="Abrir más secciones"
                onClick={() => setMoreOpen(true)}
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
        {BOTTOM_NAV.map(({ to, label, mobileLabel, icon: Icon, end }) => (
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
          onClick={() => setMoreOpen(true)}
        >
          <Menu size={19} aria-hidden="true" />
          <span className={styles.bottomLabel}>Más</span>
        </button>
      </nav>

      <MoreDrawer open={moreOpen} onOpenChange={setMoreOpen} />
    </div>
  );
}
