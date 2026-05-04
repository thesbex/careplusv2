/**
 * Screen 11 — Paramètres / Menu (mobile).
 * Acts as the "menu" tab on mobile bottom-bar — accessible to ALL roles.
 * Admin sections (cabinet settings, tariffs, users, etc.) are gated to
 * ADMIN/MEDECIN; non-admin users see only profile + logout.
 */
import { useState } from 'react';
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
  Box as BoxIcon,
} from '@/components/icons';
import { useAuthStore } from '@/lib/auth/authStore';
import { api } from '@/lib/api/client';
import { useVaccinationOverdueCount } from '@/features/vaccination/hooks/useVaccinationOverdueCount';
import { useGrossesseAlertsCount } from '@/features/grossesse/hooks/useGrossesseAlertsCount';
import { useStockAlertsCount } from '@/features/stock/hooks/useStockAlertsCount';

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
  const clear = useAuthStore((s) => s.clear);
  const [pending, setPending] = useState(false);

  const isAdminOrDoctor =
    !!user && (user.roles.includes('ADMIN') || user.roles.includes('MEDECIN'));

  const vaccinationsBadge = useVaccinationOverdueCount() ?? 0;
  const grossessesBadge = useGrossesseAlertsCount() ?? 0;
  const stockBadge = useStockAlertsCount() ?? 0;

  async function handleLogout() {
    setPending(true);
    try {
      await api.post('/auth/logout');
    } catch {
      // Local clear even if server errors out.
    } finally {
      clear();
      setPending(false);
      window.location.href = '/login';
    }
  }

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
        {isAdminOrDoctor ? (
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
        )}

        <div className="m-section-h">
          <h3>Suivi clinique</h3>
        </div>
        <div className="m-card" style={{ marginBottom: 18 }}>
          <MenuRow
            Icon={HeartIcon}
            label="Vaccinations"
            hint="Worklist + rappels en retard"
            badge={vaccinationsBadge}
            onClick={() => navigate('/vaccinations')}
          />
          <MenuRow
            Icon={HeartIcon}
            label="Grossesses"
            hint="Suivi prénatal + alertes"
            badge={grossessesBadge}
            onClick={() => navigate('/grossesses')}
          />
          <MenuRow
            Icon={BoxIcon}
            label="Stock"
            hint="Articles, lots, mouvements"
            badge={stockBadge}
            onClick={() => navigate('/stock')}
          />
        </div>

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

        <div className="m-section-h">
          <h3>Compte</h3>
        </div>
        <div className="m-card">
          <button
            type="button"
            className="m-row"
            disabled={pending}
            onClick={() => {
              void handleLogout();
            }}
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
                {pending ? 'Déconnexion…' : 'Déconnexion'}
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
