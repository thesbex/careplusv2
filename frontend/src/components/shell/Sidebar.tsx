import { useEffect, useRef, useState, type ComponentType, type SVGProps } from 'react';
import { useNavigate } from 'react-router-dom';
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
  Needle,
  Box,
  BarChart,
  Logout,
  Eye,
  Chat,
  Activity,
  Sparkles,
  Search as SearchIcon,
} from '@/components/icons';
import { BrandWordmark } from '@/components/ui/BrandMark';
import { ConfigurableBrandMark } from '@/components/ui/ConfigurableBrandMark';
import { Avatar } from '@/components/ui/Avatar';
import { UserAvatar } from '@/features/messages/components/UserAvatar';
import { useAuthStore } from '@/lib/auth/authStore';
import { performLogout } from '@/lib/auth/useAuth';
import { useVaccinationOverdueCount } from '@/features/vaccination/hooks/useVaccinationOverdueCount';
import { useStockAlertsCount } from '@/features/stock/hooks/useStockAlertsCount';
import { useGrossesseAlertsCount } from '@/features/grossesse/hooks/useGrossesseAlertsCount';
import { useChatUnreadCount } from '@/features/messages/hooks/useChatUnreadCount';
import { useActiveStayCount } from '@/features/hospitalisation/hooks/useStays';
import { isPureTech } from '@/lib/auth/roleHelpers';
import { useT } from '@/lib/i18n/I18nProvider';
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
  | 'stock'
  | 'queueLab'
  | 'queueRadio'
  | 'messages';

/**
 * Surécran de navigation : SidebarScreen + les écrans optionnels gated par une
 * capacité (hospitalisation V054/V055). Gardé séparé de SidebarScreen pour ne
 * pas casser les `NAV_MAP` locaux (historiques) des pages, qui n'indexent que
 * les écrans de base. Le shell (Sidebar / navMap / AppLayout) utilise NavScreen.
 */
export type NavScreen = SidebarScreen | 'sejours' | 'charges' | 'personnel' | 'assistant';

interface NavItem {
  id: NavScreen;
  label: string;
  Icon: IconComponent;
  section: 'flux' | 'config';
  /** If set, the item is only rendered when the current user holds at least one of these role codes. */
  requiresRoles?: string[];
  /** If set, the item is only rendered when the current user has the permission. */
  requiresPermission?: string;
  /** V054/V055 — only rendered when the establishment has hospitalization enabled. */
  requiresHospitalization?: boolean;
}

const ITEMS: NavItem[] = [
  { id: 'dashboard', label: 'Dashboard', Icon: BarChart, section: 'flux' },
  { id: 'agenda', label: 'Agenda', Icon: Calendar, section: 'flux' },
  { id: 'patients', label: 'Patients', Icon: Users, section: 'flux' },
  { id: 'salle', label: "Salle d'attente", Icon: Waiting, section: 'flux' },
  { id: 'consult', label: 'Consultations', Icon: Stetho, section: 'flux' },
  { id: 'factu', label: 'Facturation', Icon: Invoice, section: 'flux', requiresPermission: 'INVOICE_READ' },
  { id: 'vaccinations', label: 'Vaccinations', Icon: Needle, section: 'flux' },
  { id: 'grossesses', label: 'Grossesses', Icon: Heart, section: 'flux' },
  { id: 'stock', label: 'Stock', Icon: Box, section: 'flux' },
  // V054/V055 — hospitalisation : visible uniquement si l'établissement a des lits.
  { id: 'sejours', label: 'Hospitalisation', Icon: Activity, section: 'flux', requiresHospitalization: true },
  // V038 — queue traitements internes : visible uniquement aux utilisateurs
  // qui ont le rôle correspondant (LAB / RADIO). MEDECIN/ADMIN gardent
  // l'accès via Paramètres + suivi par consultation.
  { id: 'queueLab', label: 'Laboratoire', Icon: Stetho, section: 'flux', requiresRoles: ['LAB'] },
  { id: 'queueRadio', label: 'Radiologie', Icon: Stetho, section: 'flux', requiresRoles: ['RADIO'] },
  { id: 'messages', label: 'Messages', Icon: Chat, section: 'flux' },
  // Assistant IA — aide à la décision clinique. Réservé MEDECIN / ADMIN.
  { id: 'assistant', label: 'Assistant IA', Icon: Sparkles, section: 'flux', requiresRoles: ['MEDECIN', 'ADMIN'] },
  { id: 'catalogue', label: 'Catalogue', Icon: Pill, section: 'config' },
  // QA9-15 — charges du cabinet (dépenses). ADMIN uniquement.
  { id: 'charges', label: 'Charges', Icon: Invoice, section: 'config', requiresRoles: ['ADMIN'] },
  // QA9-14 — personnel (RH) du cabinet. ADMIN uniquement.
  { id: 'personnel', label: 'Personnel', Icon: Users, section: 'config', requiresRoles: ['ADMIN'] },
  { id: 'params', label: 'Paramètres', Icon: Settings, section: 'config', requiresRoles: ['ADMIN'] },
];

export interface SidebarProps {
  active?: NavScreen;
  counts?: { salle?: number; vaccinations?: number; stock?: number; grossesses?: number };
  cabinet?: { name: string; city: string };
  /** `id` ajouté (2026-05-28) pour le rendu UserAvatar avec photo de profil
      bas-gauche. Absent → on retombe sur les initiales (tests / cold boot). */
  user?: { id?: string; name: string; role: string; initials: string };
  onNavigate?: (id: NavScreen) => void;
}

/** Normalise pour la recherche de menus : minuscules + accents retirés (#123). */
function normalizeText(s: string): string {
  return s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
}

const ROLE_KEY: Record<string, string> = {
  MEDECIN: 'role.MEDECIN',
  ADMIN: 'role.ADMIN',
  ASSISTANT: 'role.ASSISTANT',
  SECRETAIRE: 'role.SECRETAIRE',
  RECEPTIONNISTE: 'role.RECEPTIONNISTE',
  INFIRMIER: 'role.INFIRMIER',
};
const ROLE_PRIORITY = ['MEDECIN', 'ADMIN', 'ASSISTANT', 'SECRETAIRE', 'RECEPTIONNISTE', 'INFIRMIER'];

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
  const { t } = useT();
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

  // Chat unread badge — polled every 30 s.
  const liveMessages = useChatUnreadCount();
  const messagesBadge = liveMessages ?? 0;

  // V054/V055 — hospitalisation : item + badge visibles seulement si l'établissement
  // a coché « hospitalise des patients ». Invisible pour un cabinet GP.
  const hospitalizationEnabled = settings?.hospitalizationEnabled ?? false;
  const sejoursBadge = useActiveStayCount(hospitalizationEnabled);

  // V070 — modules secondaires désactivés par l'admin (masqués de la nav).
  // Liste vide / absente = tout activé (aucune régression sur les installs existantes).
  const disabledModules = settings?.disabledModules ?? [];

  const sessionUser = useAuthStore((s) => s.user);
  const userRoles = sessionUser?.roles ?? [];
  const userPerms = sessionUser?.permissions;

  // Cloisonnement RBAC strict pour les techniciens (LAB / RADIO seul) :
  // ils ne doivent voir QUE leur queue de traitement interne, jamais agenda/
  // patients/factu/etc. — sinon fuite UX. Un user avec LAB+MEDECIN garde
  // l'accès complet (pas pure-tech).
  const pureTech = isPureTech(userRoles);
  const visible = ITEMS.filter((i) => {
    if (i.requiresRoles && !i.requiresRoles.some((r) => userRoles.includes(r))) return false;
    if (i.requiresPermission && userPerms != null && !userPerms.includes(i.requiresPermission)) {
      return false;
    }
    if (i.requiresHospitalization && !hospitalizationEnabled) return false;
    // V070 — module désactivé par l'admin : masqué pour tous les utilisateurs.
    if (disabledModules.includes(i.id)) return false;
    // Pure-tech : on cache toute la sidebar SAUF les items strictement
    // restreints à LAB/RADIO (queueLab, queueRadio) + Messages (collaboration
    // équipe inter-rôles, légitime même côté technicien).
    if (pureTech && i.id !== 'queueLab' && i.id !== 'queueRadio' && i.id !== 'messages') {
      return false;
    }
    return true;
  });
  const flux = visible.filter((i) => i.section === 'flux');
  const config = visible.filter((i) => i.section === 'config');

  // #123 — zone de recherche des menus pour un accès rapide. Filtre les items
  // visibles (insensible casse/accents) ; navigue sur clic ou Entrée. Quand une
  // recherche est active on rend une liste plate « Résultats » à la place des
  // deux sections, pour aller droit au but.
  const [menuQuery, setMenuQuery] = useState('');
  const normalizedQuery = normalizeText(menuQuery.trim());
  const menuMatches = normalizedQuery
    ? visible.filter((i) => normalizeText(i.label).includes(normalizedQuery))
    : [];
  const resolvedUser =
    user ??
    (sessionUser
      ? {
          id: sessionUser.id,
          name: `${sessionUser.firstName} ${sessionUser.lastName}`.trim(),
          role: t(
            ROLE_KEY[
              ROLE_PRIORITY.find((r) => sessionUser.roles.includes(r)) ?? sessionUser.roles[0] ?? ''
            ] ?? 'role.user',
          ),
          initials: `${sessionUser.firstName?.[0] ?? ''}${sessionUser.lastName?.[0] ?? ''}`.toUpperCase(),
        }
      : { name: '—', role: t('role.notConnected'), initials: '?' });

  return (
    <nav className="cp-sidebar" aria-label={t('ui.nav.main')}>
      <div className="cp-brand">
        <ConfigurableBrandMark />
        <div className="cp-brand-name">
          {resolvedCabinet.name === 'careplus' ? (
            <BrandWordmark />
          ) : (
            resolvedCabinet.name
          )}
        </div>
        <div className="cp-brand-cab">{resolvedCabinet.city}</div>
      </div>

      {/* #123 — recherche rapide des menus / fonctionnalités. */}
      <div className="cp-nav-search">
        <span className="cp-nav-search-ico" aria-hidden="true"><SearchIcon /></span>
        <input
          type="search"
          className="cp-nav-search-input"
          value={menuQuery}
          onChange={(e) => setMenuQuery(e.target.value)}
          placeholder={t('nav.search.placeholder')}
          aria-label={t('ui.nav.searchMenu')}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && menuMatches[0]) {
              onNavigate?.(menuMatches[0].id);
              setMenuQuery('');
            } else if (e.key === 'Escape') {
              setMenuQuery('');
            }
          }}
        />
      </div>

      {normalizedQuery ? (
        <>
          <div className="cp-nav-section">{t('nav.search.results')}</div>
          {menuMatches.length === 0 && (
            <div className="cp-nav-empty">{t('nav.search.empty')}</div>
          )}
          {menuMatches.map((it) => (
            <NavButton
              key={it.id}
              item={it}
              label={t('nav.' + it.id)}
              active={active === it.id}
              onClick={() => { onNavigate?.(it.id); setMenuQuery(''); }}
            />
          ))}
        </>
      ) : (
      <>
      <div className="cp-nav-section">{t('nav.section.flux')}</div>
      {flux.map((it) => (
        <NavButton
          key={it.id}
          item={it}
          label={t('nav.' + it.id)}
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
              : it.id === 'messages'
              ? (messagesBadge > 0 ? messagesBadge : undefined)
              : it.id === 'sejours'
              ? (sejoursBadge > 0 ? sejoursBadge : undefined)
              : undefined
          }
          onClick={() => onNavigate?.(it.id)}
        />
      ))}

      <div className="cp-nav-section">{t('nav.section.config')}</div>
      {config.map((it) => (
        <NavButton
          key={it.id}
          item={it}
          label={t('nav.' + it.id)}
          active={active === it.id}
          onClick={() => onNavigate?.(it.id)}
        />
      ))}
      </>
      )}

      <UserChip user={resolvedUser} />
    </nav>
  );
}

function UserChip({ user }: { user: { id?: string; name: string; role: string; initials: string } }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const navigate = useNavigate();
  const { t } = useT();

  useEffect(() => {
    if (!open) return;
    function onDocClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener('mousedown', onDocClick);
    return () => document.removeEventListener('mousedown', onDocClick);
  }, [open]);

  function handleLogout() {
    setOpen(false);
    performLogout();
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
        {/* 2026-05-28 — user request: afficher la photo de profil si dispo
            (sinon UserAvatar retombe silencieusement sur les initiales). On
            tente toujours le fetch quand on a un userId — coût d'un 404 si
            pas de photo, négligeable. Plus tard, étendre AuthUser avec
            hasPhoto depuis /users/me évite le 404. */}
        {user.id ? (
          <UserAvatar
            userId={user.id}
            hasPhoto={true}
            initials={user.initials}
            color="var(--ds2-navy, var(--primary))"
            size={36}
            style={{ borderRadius: 8 }}
          />
        ) : (
          <Avatar initials={user.initials} />
        )}
        <div style={{ minWidth: 0, flex: 1 }}>
          <div className="cp-user-name">{user.name}</div>
          <div className="cp-user-role">{user.role}</div>
        </div>
        <span style={{ color: 'var(--ink-4)' }} aria-hidden="true">
          <ChevronDown />
        </span>
      </button>
      {open && (
        <div role="menu" className="cp-user-menu">
          <button
            type="button"
            role="menuitem"
            className="cp-user-menu-item"
            onClick={() => {
              setOpen(false);
              navigate('/profil');
            }}
          >
            <Eye />
            {t('mnav.profile')}
          </button>
          <button
            type="button"
            role="menuitem"
            className="cp-user-menu-item is-danger"
            onClick={handleLogout}
          >
            <Logout />
            {t('mnav.logout')}
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
  label,
}: {
  item: NavItem;
  active: boolean;
  badge?: number | undefined;
  onClick: () => void;
  /** #122 — libellé traduit ; à défaut on retombe sur item.label (français). */
  label?: string;
}) {
  const { Icon } = item;
  const { t } = useT();
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
      <span>{label ?? item.label}</span>
      {typeof badge === 'number' && badge > 0 && (
        <span className="cp-nav-badge" aria-label={t('ui.nav.badge', { n: badge })}>
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
  // Skip the prefix if the cabinet name already starts with it
  // (e.g. user named the cabinet "Cabinet test" → don't render "Cabinet Cabinet test").
  const alreadyPrefixed =
    typeLabel && settings.name.toLowerCase().startsWith(typeLabel.toLowerCase());
  const prefixed = typeLabel && !alreadyPrefixed
    ? `${typeLabel} ${settings.name}`
    : settings.name;
  const city = settings.city ? `${prefixed} · ${settings.city}` : prefixed;
  return { name: 'careplus', city };
}
