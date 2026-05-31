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
import { useT } from '@/lib/i18n/I18nProvider';

const TAB_MAP: Record<MobileTab, string> = {
  agenda:   '/agenda',
  salle:    '/salle',
  patients: '/patients',
  factu:    '/facturation',
  menu:     '/parametres',
};

export default function ParametrageMobilePage() {
  const navigate = useNavigate();
  const { t } = useT();
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
      ? t('role.MEDECIN')
      : user.roles.includes('ADMIN')
      ? t('role.ADMIN')
      : user.roles.includes('ASSISTANT')
      ? t('role.ASSISTANT')
      : t('role.SECRETAIRE')
    : '—';

  return (
    <MScreen
      tab="menu"
      topbar={<MTopbar title={t('nav.params')} />}
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
              <h3>{t('mnav.section.dashboard')}</h3>
            </div>
            <div className="m-card" style={{ marginBottom: 18 }}>
              <MenuRow
                Icon={BarChartIcon}
                label={t('nav.dashboard')}
                hint={t('mnav.dashboardHint')}
                onClick={() => navigate('/dashboard')}
              />
            </div>
          </>
        )}

        {!pureTech && (isAdminOrDoctor ? (
          <>
            <div className="m-section-h">
              <h3>{t('mnav.section.cabinet')}</h3>
            </div>
            <div className="m-card" style={{ marginBottom: 18 }}>
              <MenuRow
                Icon={FileIcon}
                label={t('mnav.cabinetConfig')}
                hint={t('mnav.cabinetConfigHint')}
                onClick={() => {
                  // The desktop ParametragePage is feature-rich; force the
                  // desktop variant for the few admin tasks that need it.
                  window.location.href = '/parametres?desktop=1';
                }}
              />
              {isAdmin && modOn('charges') && (
                <MenuRow
                  Icon={InvoiceIcon}
                  label={t('nav.charges')}
                  hint={t('mnav.chargesHint')}
                  onClick={() => navigate('/charges')}
                />
              )}
              {isAdmin && (
                <MenuRow
                  Icon={Users}
                  label={t('nav.personnel')}
                  hint={t('mnav.personnelHint')}
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
            {t('mnav.adminOnly')}
          </div>
        ))}

        {!pureTech && (
          <>
            <div className="m-section-h">
              <h3>{t('mnav.section.clinical')}</h3>
            </div>
            <div className="m-card" style={{ marginBottom: 18 }}>
              <MenuRow
                Icon={StethoIcon}
                label={t('nav.consult')}
                hint={t('mnav.consultHint')}
                onClick={() => navigate('/consultations')}
              />
              {modOn('vaccinations') && (
                <MenuRow
                  Icon={NeedleIcon}
                  label={t('nav.vaccinations')}
                  hint={t('mnav.vaccinationsHint')}
                  badge={vaccinationsBadge}
                  onClick={() => navigate('/vaccinations')}
                />
              )}
              {modOn('grossesses') && (
                <MenuRow
                  Icon={HeartIcon}
                  label={t('nav.grossesses')}
                  hint={t('mnav.grossessesHint')}
                  badge={grossessesBadge}
                  onClick={() => navigate('/grossesses')}
                />
              )}
              {modOn('stock') && (
                <MenuRow
                  Icon={BoxIcon}
                  label={t('nav.stock')}
                  hint={t('mnav.stockHint')}
                  badge={stockBadge}
                  onClick={() => navigate('/stock')}
                />
              )}
              {hospitalizationEnabled && (
                <MenuRow
                  Icon={ActivityIcon}
                  label={t('nav.sejours')}
                  hint={t('mnav.hospHint')}
                  badge={sejoursBadge}
                  onClick={() => navigate('/hospitalisation')}
                />
              )}
            </div>
          </>
        )}

        <div className="m-section-h">
          <h3>{t('mnav.section.comm')}</h3>
        </div>
        <div className="m-card" style={{ marginBottom: 18 }}>
          {modOn('messages') && (
            <MenuRow
              Icon={ChatIcon}
              label={t('nav.messages')}
              hint={t('mnav.messagesHint')}
              badge={messagesBadge}
              onClick={() => navigate('/messages')}
            />
          )}
          {isAdminOrDoctor && modOn('assistant') && (
            <MenuRow
              Icon={SparklesIcon}
              label={t('nav.assistant')}
              hint={t('mnav.assistantHint')}
              onClick={() => navigate('/assistant')}
            />
          )}
        </div>

        {!pureTech && (
          <>
            <div className="m-section-h">
              <h3>{t('mnav.section.catalogues')}</h3>
            </div>
            <div className="m-card" style={{ marginBottom: 18 }}>
              <MenuRow
                Icon={PillIcon}
                label={t('mnav.medications')}
                hint={t('mnav.medicationsHint')}
                onClick={() => navigate('/catalogue')}
              />
              <MenuRow
                Icon={FlaskIcon}
                label={t('mnav.labs')}
                hint={t('mnav.labsHint')}
                onClick={() => navigate('/catalogue/analyses')}
              />
              <MenuRow
                Icon={DocIcon}
                label={t('mnav.imaging')}
                hint={t('mnav.imagingHint')}
                onClick={() => navigate('/catalogue/radio')}
              />
            </div>
          </>
        )}

        <div className="m-section-h">
          <h3>{t('mnav.section.account')}</h3>
        </div>
        <div className="m-card">
          <MenuRow
            Icon={Users}
            label={t('mnav.profile')}
            hint={t('mnav.profileHint')}
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
                {t('mnav.logout')}
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
  const { t } = useT();
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
          aria-label={t('common.alertsAria', { n: badge })}
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
