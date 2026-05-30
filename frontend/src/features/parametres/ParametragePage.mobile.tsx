/**
 * Screen 11 — Paramètres / Menu (mobile).
 * Acts as the "menu" tab on mobile bottom-bar — accessible to ALL roles.
 * Admin sections (cabinet settings, tariffs, users, etc.) are gated to
 * ADMIN/MEDECIN; non-admin users see only profile + logout.
 */
import { useNavigate } from 'react-router-dom';
import { MScreen } from '@/components/shell/MScreen';
import { MTopbar } from '@/components/shell/MTopbar';
import type { MobileTab } from '@/components/shell/MTabs';
import type { ComponentType, SVGProps } from 'react';
import {
  ChevronRight,
  Logout,
  File as FileIcon,
  Pill as PillIcon,
  Flask as FlaskIcon,
  Doc as DocIcon,
  Heart as HeartIcon,
  Needle as NeedleIcon,
  Box as BoxIcon,
  BarChart as BarChartIcon,
  Stetho as StethoIcon,
  Users,
  Chat as ChatIcon,
  Activity as ActivityIcon,
  Invoice as InvoiceIcon,
  Sparkles as SparklesIcon,
} from '@/components/icons';
import { useAuthStore } from '@/lib/auth/authStore';
import { performLogout } from '@/lib/auth/useAuth';
import { useVaccinationOverdueCount } from '@/features/vaccination/hooks/useVaccinationOverdueCount';
import { useGrossesseAlertsCount } from '@/features/grossesse/hooks/useGrossesseAlertsCount';
import { useStockAlertsCount } from '@/features/stock/hooks/useStockAlertsCount';
import { useChatUnreadCount } from '@/features/messages/hooks/useChatUnreadCount';
import { useClinicSettings } from './hooks/useSettings';
import { useActiveStayCount } from '@/features/hospitalisation/hooks/useStays';
import { isPureTech } from '@/lib/auth/roleHelpers';

const TAB_MAP: Record<MobileTab, string> = {
  agenda:   '/agenda',
  salle:    '/salle',
  patients: '/patients',
  factu:    '/facturation',
  menu:     '/parametres',
};

export default function ParametrageMobilePage() {
  const navigate = useNavigate();
  const user = useAuthStore((s) => s.user);

  const isAdminOrDoctor =
    !!user && (user.roles.includes('ADMIN') || user.roles.includes('MEDECIN'));
  // QA9-15 — les charges (dépenses) du cabinet sont réservées à l'ADMIN.
  const isAdmin = !!user && user.roles.includes('ADMIN');
  // Pure-tech : on n'affiche que Messages + Mon profil + Déconnexion.
  // Pas de Dashboard, Cabinet, Suivi clinique, Catalogue.
  const pureTech = isPureTech(user?.roles);

  const vaccinationsBadge = useVaccinationOverdueCount() ?? 0;
  const grossessesBadge = useGrossesseAlertsCount() ?? 0;
  const stockBadge = useStockAlertsCount() ?? 0;
  const messagesBadge = useChatUnreadCount() ?? 0;
  const { settings } = useClinicSettings();
  const hospitalizationEnabled = settings?.hospitalizationEnabled ?? false;
  const sejoursBadge = useActiveStayCount(hospitalizationEnabled);
  // V070 — modules désactivés par l'admin : masqués du menu mobile (parité sidebar).
  const disabledModules = settings?.disabledModules ?? [];
  const modOn = (id: string) => !disabledModules.includes(id);

  const initials =
    user
      ? `${user.firstName.charAt(0)}${user.lastName.charAt(0)}`.toUpperCase()
      : '?';
  const roleLabel = user
    ? user.roles.includes('MEDECIN')
      ? 'Médecin'
      : user.roles.includes('ADMIN')
      ? 'Administrateur'
      : user.roles.includes('ASSISTANT')
      ? 'Assistant(e)'
      : 'Secrétaire'
    : '—';

  return (
    <MScreen
      tab="menu"
      topbar={<MTopbar title="Paramètres" />}
      onTabChange={(t) => navigate(TAB_MAP[t])}
    >
      {/* Profile header */}
      <div className="m-phead">
        <div
          className="cp-avatar"
          style={{ background: 'var(--primary)', width: 46, height: 46, fontSize: 15 }}
          aria-hidden="true"
        >
          {initials}
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div className="m-phead-name">
            {user ? `${user.firstName} ${user.lastName}` : '—'}
          </div>
          <div className="m-phead-meta">
            {roleLabel}
            {user?.email ? ` · ${user.email}` : ''}
          </div>
        </div>
      </div>

      <div className="mb-pad">
        {!pureTech && (
          <>
            <div className="m-section-h">
              <h3>Tableau de bord</h3>
            </div>
            <div className="m-card" style={{ marginBottom: 18 }}>
              <MenuRow
                Icon={BarChartIcon}
                label="Dashboard"
                hint="Indicateurs cabinet — KPIs et activité"
                onClick={() => navigate('/dashboard')}
              />
            </div>
          </>
        )}

        {!pureTech && (isAdminOrDoctor ? (
          <>
            <div className="m-section-h">
              <h3>Cabinet</h3>
            </div>
            <div className="m-card" style={{ marginBottom: 18 }}>
              <MenuRow
                Icon={FileIcon}
                label="Paramétrage du cabinet"
                hint="Identité, tarifs, utilisateurs, congés"
                onClick={() => {
                  // The desktop ParametragePage is feature-rich; force the
                  // desktop variant for the few admin tasks that need it.
                  window.location.href = '/parametres?desktop=1';
                }}
              />
              {isAdmin && modOn('charges') && (
                <MenuRow
                  Icon={InvoiceIcon}
                  label="Charges"
                  hint="Dépenses du cabinet — récapitulatif annuel"
                  onClick={() => navigate('/charges')}
                />
              )}
              {isAdmin && (
                <MenuRow
                  Icon={Users}
                  label="Personnel"
                  hint="RH — congés, absences, salaires"
                  onClick={() => navigate('/personnel')}
                />
              )}
            </div>
          </>
        ) : (
          <div
            style={{
              padding: 12,
              background: 'var(--bg-alt)',
              borderRadius: 'var(--r-lg)',
              fontSize: 12,
              color: 'var(--ink-3)',
              lineHeight: 1.5,
              marginBottom: 18,
            }}
          >
            Les paramètres du cabinet sont réservés à l’administrateur et au médecin.
          </div>
        ))}

        {!pureTech && (
          <>
            <div className="m-section-h">
              <h3>Suivi clinique</h3>
            </div>
            <div className="m-card" style={{ marginBottom: 18 }}>
              <MenuRow
                Icon={StethoIcon}
                label="Consultations"
                hint="Brouillons + signées"
                onClick={() => navigate('/consultations')}
              />
              {modOn('vaccinations') && (
                <MenuRow
                  Icon={NeedleIcon}
                  label="Vaccinations"
                  hint="Worklist + rappels en retard"
                  badge={vaccinationsBadge}
                  onClick={() => navigate('/vaccinations')}
                />
              )}
              {modOn('grossesses') && (
                <MenuRow
                  Icon={HeartIcon}
                  label="Grossesses"
                  hint="Suivi prénatal + alertes"
                  badge={grossessesBadge}
                  onClick={() => navigate('/grossesses')}
                />
              )}
              {modOn('stock') && (
                <MenuRow
                  Icon={BoxIcon}
                  label="Stock"
                  hint="Articles, lots, mouvements"
                  badge={stockBadge}
                  onClick={() => navigate('/stock')}
                />
              )}
              {hospitalizationEnabled && (
                <MenuRow
                  Icon={ActivityIcon}
                  label="Hospitalisation"
                  hint="Patients hospitalisés + séjours"
                  badge={sejoursBadge}
                  onClick={() => navigate('/hospitalisation')}
                />
              )}
            </div>
          </>
        )}

        <div className="m-section-h">
          <h3>Communication</h3>
        </div>
        <div className="m-card" style={{ marginBottom: 18 }}>
          {modOn('messages') && (
            <MenuRow
              Icon={ChatIcon}
              label="Messages"
              hint="Messagerie interne du cabinet"
              badge={messagesBadge}
              onClick={() => navigate('/messages')}
            />
          )}
          {isAdminOrDoctor && modOn('assistant') && (
            <MenuRow
              Icon={SparklesIcon}
              label="Assistant IA"
              hint="Aide à la décision clinique"
              onClick={() => navigate('/assistant')}
            />
          )}
        </div>

        {!pureTech && (
          <>
            <div className="m-section-h">
              <h3>Catalogues</h3>
            </div>
            <div className="m-card" style={{ marginBottom: 18 }}>
              <MenuRow
                Icon={PillIcon}
                label="Médicaments"
                hint="Référentiel Maroc"
                onClick={() => navigate('/catalogue')}
              />
              <MenuRow
                Icon={FlaskIcon}
                label="Analyses biologiques"
                hint="Tests de laboratoire"
                onClick={() => navigate('/catalogue/analyses')}
              />
              <MenuRow
                Icon={DocIcon}
                label="Radio / Imagerie"
                hint="Examens d’imagerie médicale"
                onClick={() => navigate('/catalogue/radio')}
              />
            </div>
          </>
        )}

        <div className="m-section-h">
          <h3>Compte</h3>
        </div>
        <div className="m-card">
          <MenuRow
            Icon={Users}
            label="Mon profil"
            hint="Identité, signature, mot de passe"
            onClick={() => navigate('/profil')}
          />
          <button
            type="button"
            className="m-row"
            onClick={performLogout}
            style={{
              width: '100%',
              textAlign: 'left',
              background: 'transparent',
              border: 0,
              fontFamily: 'inherit',
              font: 'inherit',
              cursor: 'pointer',
              WebkitTapHighlightColor: 'transparent',
              color: 'var(--danger)',
            }}
          >
            <div
              style={{
                width: 32,
                height: 32,
                borderRadius: 8,
                background: 'var(--danger-soft)',
                color: 'var(--danger)',
                display: 'grid',
                placeItems: 'center',
              }}
              aria-hidden="true"
            >
              <Logout />
            </div>
            <div className="m-row-pri">
              <div className="m-row-main" style={{ color: 'var(--danger)' }}>
                Déconnexion
              </div>
            </div>
          </button>
        </div>

        <div
          style={{
            marginTop: 24,
            fontSize: 11,
            color: 'var(--ink-3)',
            textAlign: 'center',
          }}
        >
          careplus · v1
        </div>
      </div>
    </MScreen>
  );
}

function MenuRow({
  Icon,
  label,
  hint,
  badge,
  onClick,
}: {
  Icon?: ComponentType<SVGProps<SVGSVGElement>>;
  label: string;
  hint?: string;
  badge?: number;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      className="m-row"
      onClick={onClick}
      style={{
        width: '100%',
        textAlign: 'left',
        background: 'transparent',
        border: 0,
        fontFamily: 'inherit',
        font: 'inherit',
        cursor: 'pointer',
        WebkitTapHighlightColor: 'transparent',
      }}
    >
      {Icon && (
        <div
          style={{
            width: 32,
            height: 32,
            borderRadius: 8,
            background: 'var(--primary-soft)',
            color: 'var(--primary)',
            display: 'grid',
            placeItems: 'center',
            flexShrink: 0,
          }}
          aria-hidden="true"
        >
          <Icon />
        </div>
      )}
      <div className="m-row-pri">
        <div className="m-row-main">{label}</div>
        {hint && <div className="m-row-sub">{hint}</div>}
      </div>
      {typeof badge === 'number' && badge > 0 && (
        <span
          aria-label={`${badge} alerte${badge > 1 ? 's' : ''}`}
          style={{
            minWidth: 20,
            height: 20,
            padding: '0 6px',
            borderRadius: 999,
            background: 'var(--danger)',
            color: 'white',
            fontSize: 11,
            fontWeight: 600,
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            marginRight: 4,
          }}
        >
          {badge}
        </span>
      )}
      <ChevronRight aria-hidden="true" />
    </button>
  );
}
