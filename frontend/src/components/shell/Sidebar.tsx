import { useEffect, useRef, useState, type ComponentType, type SVGProps } from 'react';
import {
  Calendar,
  Users,
  Waiting,
  Stetho,
  Invoice,
  Settings,
  ChevronDown,
  Pill,
  Heart,
  Box,
  BarChart,
} from '@/components/icons';
import { BrandMark } from '@/components/ui/BrandMark';
import { Avatar } from '@/components/ui/Avatar';
import { useAuthStore } from '@/lib/auth/authStore';
import { api } from '@/lib/api/client';
import { useVaccinationOverdueCount } from '@/features/vaccination/hooks/useVaccinationOverdueCount';
import { useStockAlertsCount } from '@/features/stock/hooks/useStockAlertsCount';
import { useGrossesseAlertsCount } from '@/features/grossesse/hooks/useGrossesseAlertsCount';
import {
  useClinicSettings,
  ESTABLISHMENT_TYPE_LABELS,
  type EstablishmentType,
} from '@/features/parametres/hooks/useSettings';

type IconComponent = ComponentType<SVGProps<SVGSVGElement>>;

export type SidebarScreen =
  | 'dashboard'
  | 'agenda'
  | 'patients'
  | 'salle'
  | 'consult'
  | 'factu'
  | 'catalogue'
  | 'params'
  | 'vaccinations'
  | 'grossesses'
  | 'stock';

interface NavItem {
  id: SidebarScreen;
  label: string;
  Icon: IconComponent;
  section: 'flux' | 'config';
  /** If set, the item is only rendered when the current user holds at least one of these role codes. */
  requiresRoles?: string[];
  /** If set, the item is only rendered when the current user has the permission. */
  requiresPermission?: string;
}

const ITEMS: NavItem[] = [
  { id: 'dashboard', label: 'Dashboard', Icon: BarChart, section: 'flux' },
  { id: 'agenda', label: 'Agenda', Icon: Calendar, section: 'flux' },
  { id: 'patients', label: 'Patients', Icon: Users, section: 'flux' },
  { id: 'salle', label: "Salle d'attente", Icon: Waiting, section: 'flux' },
  { id: 'consult', label: 'Consultations', Icon: Stetho, section: 'flux' },
  { id: 'factu', label: 'Facturation', Icon: Invoice, section: 'flux', requiresPermission: 'INVOICE_READ' },
  { id: 'vaccinations', label: 'Vaccinations', Icon: Heart, section: 'flux' },
  { id: 'grossesses', label: 'Grossesses', Icon: Heart, section: 'flux' },
  { id: 'stock', label: 'Stock', Icon: Box, section: 'flux' },
  { id: 'catalogue', label: 'Catalogue', Icon: Pill, section: 'config' },
  { id: 'params', label: 'Paramètres', Icon: Settings, section: 'config', requiresRoles: ['ADMIN'] },
];

export interface SidebarProps {
  active?: SidebarScreen;
  counts?: { salle?: number; vaccinations?: number; stock?: number; grossesses?: number };
  cabinet?: { name: string; city: string };
  user?: { name: string; role: string; initials: string };
  onNavigate?: (id: SidebarScreen) => void;
}

const ROLE_LABELS: Record<string, string> = {
  MEDECIN: 'Médecin',
  ADMIN: 'Administrateur',
  ASSISTANT: 'Assistant(e)',
  SECRETAIRE: 'Secrétaire',
};
const ROLE_PRIORITY = ['MEDECIN', 'ADMIN', 'ASSISTANT', 'SECRETAIRE'];

export function Sidebar({
  active = 'agenda',
  counts,
  cabinet,
  user,
  onNavigate,
}: SidebarProps) {
  // V034 — sidebar reads clinic settings to derive the right "Cabinet/Clinique/Hôpital…
  // <name> · <city>" sub-label dynamically. Default fallback only when the settings
  // are unloaded (cold boot, 401, or first install with no row yet) — no more
  // hardcoded "Cab. El Amrani". If the caller passed an explicit `cabinet` prop
  // (mostly tests), it wins.
  const { settings } = useClinicSettings();
  const resolvedCabinet = cabinet ?? buildCabinetLabel(settings);
  // Sans `counts` explicite on n'affiche aucun badge — c'est <Screen> qui
  // souscrit à useQueue() et nous passe la valeur live.
  const safeCounts = counts ?? {};

  // Vaccination overdue badge — polled every 30 s.
  // Only active when the caller didn't provide an explicit vaccinations count.
  const liveVaccinations = useVaccinationOverdueCount(safeCounts.vaccinations === undefined);
  const vaccinationsBadge = safeCounts.vaccinations ?? liveVaccinations ?? 0;

  // Stock alerts badge — polled every 30 s (lowStock + expiringSoon).
  const liveStock = useStockAlertsCount(safeCounts.stock === undefined);
  const stockBadge = safeCounts.stock ?? liveStock ?? 0;

  // Grossesses alerts badge — polled every 30 s (pregnancies with active alerts).
  const liveGrossesses = useGrossesseAlertsCount(safeCounts.grossesses === undefined);
  const grossessesBadge = safeCounts.grossesses ?? liveGrossesses ?? 0;
  const sessionUser = useAuthStore((s) => s.user);
  const userRoles = sessionUser?.roles ?? [];
  const userPerms = sessionUser?.permissions;

  const visible = ITEMS.filter((i) => {
    if (i.requiresRoles && !i.requiresRoles.some((r) => userRoles.includes(r))) return false;
    // Backward-compat: hide only when permissions array is populated and the
    // permission is missing. Legacy sessions keep all items visible.
    if (i.requiresPermission && userPerms != null && !userPerms.includes(i.requiresPermission)) {
      return false;
    }
    return true;
  });
  const flux = visible.filter((i) => i.section === 'flux');
  const config = visible.filter((i) => i.section === 'config');
  const resolvedUser =
    user ??
    (sessionUser
      ? {
          name: `${sessionUser.firstName} ${sessionUser.lastName}`.trim(),
          role:
            ROLE_LABELS[
              ROLE_PRIORITY.find((r) => sessionUser.roles.includes(r)) ?? sessionUser.roles[0] ?? ''
            ] ?? 'Utilisateur',
          initials: `${sessionUser.firstName?.[0] ?? ''}${sessionUser.lastName?.[0] ?? ''}`.toUpperCase(),
        }
      : { name: '—', role: 'Non connecté', initials: '?' });

  return (
    <nav className="cp-sidebar" aria-label="Navigation principale">
      <div className="cp-brand">
        <BrandMark size="sm" />
        <div style={{ minWidth: 0 }}>
          <div className="cp-brand-name">{resolvedCabinet.name}</div>
          <div className="cp-brand-cab">{resolvedCabinet.city}</div>
        </div>
      </div>

      <div className="cp-nav-section">Flux patient</div>
      {flux.map((it) => (
        <NavButton
          key={it.id}
          item={it}
          active={active === it.id}
          badge={
            it.id === 'salle'
              ? safeCounts.salle
              : it.id === 'vaccinations'
              ? (vaccinationsBadge > 0 ? vaccinationsBadge : undefined)
              : it.id === 'grossesses'
              ? (grossessesBadge > 0 ? grossessesBadge : undefined)
              : it.id === 'stock'
              ? (stockBadge > 0 ? stockBadge : undefined)
              : undefined
          }
          onClick={() => onNavigate?.(it.id)}
        />
      ))}

      <div className="cp-nav-section">Configuration</div>
      {config.map((it) => (
        <NavButton
          key={it.id}
          item={it}
          active={active === it.id}
          onClick={() => onNavigate?.(it.id)}
        />
      ))}

      <UserChip user={resolvedUser} />
    </nav>
  );
}

function UserChip({ user }: { user: { name: string; role: string; initials: string } }) {
  const [open, setOpen] = useState(false);
  const [pending, setPending] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const clear = useAuthStore((s) => s.clear);

  useEffect(() => {
    if (!open) return;
    function onDocClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener('mousedown', onDocClick);
    return () => document.removeEventListener('mousedown', onDocClick);
  }, [open]);

  async function handleLogout() {
    setPending(true);
    try {
      await api.post('/auth/logout');
    } catch {
      // Even if the server errors, we clear the local session.
    } finally {
      clear();
      setPending(false);
      setOpen(false);
      window.location.href = '/login';
    }
  }

  return (
    <div ref={ref} style={{ position: 'relative', marginTop: 'auto' }}>
      <button
        type="button"
        className="cp-user-chip"
        style={{ width: '100%', cursor: 'pointer', textAlign: 'left' }}
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
      >
        <Avatar initials={user.initials} />
        <div style={{ minWidth: 0, flex: 1 }}>
          <div className="cp-user-name">{user.name}</div>
          <div className="cp-user-role">{user.role}</div>
        </div>
        <span style={{ color: 'var(--ink-4)' }} aria-hidden="true">
          <ChevronDown />
        </span>
      </button>
      {open && (
        <div
          role="menu"
          style={{
            position: 'absolute',
            bottom: 'calc(100% + 6px)',
            left: 0,
            right: 0,
            background: 'var(--surface)',
            border: '1px solid var(--border)',
            borderRadius: 'var(--r-md)',
            boxShadow: '0 4px 12px rgba(0,0,0,0.08)',
            padding: 4,
            zIndex: 10,
          }}
        >
          <button
            type="button"
            role="menuitem"
            onClick={() => {
              setOpen(false);
              window.location.href = '/profil';
            }}
            style={{
              width: '100%',
              padding: '8px 10px',
              background: 'transparent',
              border: 'none',
              borderRadius: 'var(--r-sm)',
              textAlign: 'left',
              fontSize: 12,
              cursor: 'pointer',
              color: 'var(--ink)',
            }}
          >
            Mon profil
          </button>
          <button
            type="button"
            role="menuitem"
            onClick={() => void handleLogout()}
            disabled={pending}
            style={{
              width: '100%',
              padding: '8px 10px',
              background: 'transparent',
              border: 'none',
              borderRadius: 'var(--r-sm)',
              textAlign: 'left',
              fontSize: 12,
              cursor: 'pointer',
              color: 'var(--ink)',
            }}
          >
            {pending ? 'Déconnexion…' : 'Se déconnecter'}
          </button>
        </div>
      )}
    </div>
  );
}

function NavButton({
  item,
  active,
  badge,
  onClick,
}: {
  item: NavItem;
  active: boolean;
  badge?: number | undefined;
  onClick: () => void;
}) {
  const { Icon, label } = item;
  return (
    <button
      type="button"
      className={`cp-nav-item ${active ? 'active' : ''}`}
      aria-current={active ? 'page' : undefined}
      onClick={onClick}
    >
      <span className="ico">
        <Icon />
      </span>
      <span>{label}</span>
      {typeof badge === 'number' && badge > 0 && (
        <span className="cp-nav-badge" aria-label={`${badge} en attente`}>
          {badge}
        </span>
      )}
    </button>
  );
}

/**
 * Compose le sous-titre de la sidebar à partir des settings cabinet :
 *   "<Type> <name> · <city>"  → ex. "Clinique El Amrani · Casablanca"
 * Si le type est 'AUTRE' (label vide) ou inconnu, on n'affiche que le nom.
 * Le `name` du brand (ligne du dessus) reste toujours "careplus" (l'identité
 * du produit), seule la ligne secondaire reflète l'établissement.
 */
function buildCabinetLabel(settings: { name?: string; city?: string; establishmentType?: EstablishmentType } | null): {
  name: string;
  city: string;
} {
  if (!settings || !settings.name) {
    return { name: 'careplus', city: '' };
  }
  const typeLabel = settings.establishmentType
    ? ESTABLISHMENT_TYPE_LABELS[settings.establishmentType] ?? ''
    : '';
  const prefixed = typeLabel ? `${typeLabel} ${settings.name}` : settings.name;
  const city = settings.city ? `${prefixed} · ${settings.city}` : prefixed;
  return { name: 'careplus', city };
}
