/**
 * Mon profil — page accessible à tout utilisateur authentifié.
 *
 * Aujourd'hui : gestion de la signature scannée (V035 — per-médecin).
 * Plus tard : édition du nom, email, téléphone, mot de passe, etc.
 *
 * Pourquoi une page séparée plutôt que /parametres : /parametres est passé
 * en ADMIN-only (V034) ; or chaque médecin doit pouvoir gérer SA signature
 * sans demander à un admin. Cette page n'expose QUE les réglages personnels
 * du user connecté — aucun toggle cabinet n'y est accessible.
 */
import { useNavigate } from 'react-router-dom';
import { Screen } from '@/components/shell/Screen';
import { MScreen } from '@/components/shell/MScreen';
import { MTopbar, MIconBtn } from '@/components/shell/MTopbar';
import { useIsMobile } from '@/lib/responsive/useMediaQuery';
import { useT } from '@/lib/i18n/I18nProvider';
import { useAuthStore } from '@/lib/auth/authStore';
import { SignatureSettingsSection } from '@/features/parametres/components/SignatureSettingsSection';
import { PrescriptionTemplatesTab } from '@/features/parametres/components/PrescriptionTemplatesTab';
import { LetterTemplatesTab } from '@/features/confrere/components/LetterTemplatesTab';
import { LunchBreakSection } from './components/LunchBreakSection';
import { SoapTemplatesTab } from '@/features/consultation/components/SoapTemplatesTab';
import { PasswordChangeSection } from './components/PasswordChangeSection';
import { ProfilePhotoSection } from './components/ProfilePhotoSection';
import { ReferralContactsSection } from './components/ReferralContactsSection';

const NAV_MAP = {
  dashboard: '/dashboard',
  agenda: '/agenda',
  patients: '/patients',
  salle: '/salle',
  consult: '/consultations',
  factu: '/facturation',
  vaccinations: '/vaccinations',
  grossesses: '/grossesses',
  stock: '/stock',
  queueLab: '/queue/lab',
  queueRadio: '/queue/radio',
  messages: '/messages',
  catalogue: '/catalogue',
  params: '/parametres',
} as const;

export default function ProfilPage() {
  const { t } = useT();
  const navigate = useNavigate();
  const isMobile = useIsMobile();
  const user = useAuthStore((s) => s.user);
  const isMedecin = (user?.roles ?? []).includes('MEDECIN');
  const rolesLabel = (sep: string) => (user?.roles ?? []).map((r) => t(`role.${r}`)).join(sep);

  // Section groups — two grid columns on desktop, stacked single column on mobile.
  const leftColumn = (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <ProfilePhotoSection />
      <div
        style={{
          background: 'var(--surface)',
          border: '1px solid var(--border)',
          borderRadius: 'var(--r-md)',
          padding: 18,
        }}
      >
        <div style={{ fontWeight: 600, fontSize: 14, marginBottom: 4 }}>{t('profil.identity.title')}</div>
        <div style={{ fontSize: 13, color: 'var(--ink-2)' }}>
          <div>
            <strong>{t('profil.identity.name')}</strong> {user?.firstName} {user?.lastName}
          </div>
          <div>
            <strong>{t('profil.identity.email')}</strong> {user?.email}
          </div>
          <div>
            <strong>{t('profil.identity.roles')}</strong> {rolesLabel(', ')}
          </div>
        </div>
      </div>
      <PasswordChangeSection />
    </div>
  );

  const rightColumn = (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      {isMedecin && <SignatureSettingsSection />}
      {isMedecin && user && <LunchBreakSection practitionerId={user.id} />}
      {isMedecin && <ReferralContactsSection />}
      {!isMedecin && (
        <div
          style={{
            padding: 14,
            border: '1px dashed var(--border)',
            borderRadius: 'var(--r-md)',
            fontSize: 12,
            color: 'var(--ink-3)',
          }}
        >
          {t('profil.signatureNote')}
        </div>
      )}
    </div>
  );

  // R-bug : modèles d'ordonnance propres au médecin. Le backend
  // (PrescriptionTemplate, FK practitioner_id) autorise déjà le MEDECIN en CRUD ;
  // ils n'étaient exposés que dans /parametres (admin). On les remonte ici, sur
  // le profil personnel, en pleine largeur (table large) sous la grille.
  const templatesSection = isMedecin ? (
    <div
      style={{
        background: 'var(--surface)',
        border: '1px solid var(--border)',
        borderRadius: 'var(--r-md)',
        padding: 18,
      }}
    >
      <div style={{ fontWeight: 600, fontSize: 14, marginBottom: 4 }}>
        {t('profil.templates.rx.title')}
      </div>
      <div style={{ fontSize: 12.5, color: 'var(--ink-3)', marginBottom: 14 }}>
        {t('profil.templates.rx.hint')}
      </div>
      <PrescriptionTemplatesTab />
    </div>
  ) : null;

  // Modèles de consultation SOAP (bouton « Modèles » de l'écran consultation).
  const soapTemplatesSection = isMedecin ? (
    <div
      style={{
        background: 'var(--surface)',
        border: '1px solid var(--border)',
        borderRadius: 'var(--r-md)',
        padding: 18,
      }}
    >
      <div style={{ fontWeight: 600, fontSize: 14, marginBottom: 4 }}>
        {t('profil.templates.soap.title')}
      </div>
      <div style={{ fontSize: 12.5, color: 'var(--ink-3)', marginBottom: 14 }}>
        {t('profil.templates.soap.hint')}
      </div>
      <SoapTemplatesTab />
    </div>
  ) : null;

  // Modèles de courrier au confrère propres au médecin (titre + contenu).
  // Backend : owner_user_id (V065) + écriture MEDECIN sur ses propres modèles ;
  // l'admin garde les modèles cabinet partagés dans /parametres.
  const letterTemplatesSection = isMedecin ? (
    <div
      style={{
        background: 'var(--surface)',
        border: '1px solid var(--border)',
        borderRadius: 'var(--r-md)',
        padding: 18,
      }}
    >
      <div style={{ fontWeight: 600, fontSize: 14, marginBottom: 4 }}>
        {t('profil.templates.letter.title')}
      </div>
      <div style={{ fontSize: 12.5, color: 'var(--ink-3)', marginBottom: 14 }}>
        {t('profil.templates.letter.hint')}
      </div>
      <LetterTemplatesTab mode="own" />
    </div>
  ) : null;

  // Mobile: wrap in MScreen so the page has a working back affordance (→ menu
  // hub) + bottom tabs. Before this, /profil rendered the desktop Screen whose
  // only nav is the sidebar — hidden on mobile, stranding the user with no way
  // back. Single column also avoids the desktop grid's 420px min overflowing a
  // 390px viewport.
  if (isMobile) {
    return (
      <MScreen
        tab="menu"
        topbar={
          <MTopbar
            left={
              <MIconBtn
                icon="ChevronLeft"
                label={t('profil.back')}
                onClick={() => navigate('/parametres')}
              />
            }
            title={t('profil.title')}
          />
        }
      >
        <div style={{ padding: 16, display: 'flex', flexDirection: 'column', gap: 16 }}>
          {leftColumn}
          {rightColumn}
          {templatesSection}
          {soapTemplatesSection}
          {letterTemplatesSection}
        </div>
      </MScreen>
    );
  }

  return (
    <Screen
      active="agenda"
      title={t('profil.title')}
      sub={
        user
          ? `${user.firstName} ${user.lastName} · ${rolesLabel(' · ')}`
          : ''
      }
      onNavigate={(id) => navigate(NAV_MAP[id])}
    >
      <div
        style={{
          padding: 24,
          // .cp-workspace est overflow:hidden — sans ce wrapper scrollable,
          // la liste des confrères et les sections suivantes sortaient du
          // viewport sans ascenseur. flex:1 + min-height:0 + overflow:auto =
          // scroll vertical natif sur le contenu de la page profil.
          flex: 1,
          minHeight: 0,
          overflow: 'auto',
        }}
      >
        {/* R036 — layout 2 colonnes sur écran large pour exploiter la moitié
            droite (avant : maxWidth 720 → moitié droite blanche). Les sections
            sont équilibrées : identité+password à gauche, signature+confrères
            à droite. Sous 1024 px on retombe en 1 colonne (lecture mobile). */}
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(420px, 1fr))',
            gap: 16,
            alignItems: 'start',
            maxWidth: 1280,
          }}
        >
          {leftColumn}
          {rightColumn}
        </div>
        {templatesSection && (
          <div style={{ marginTop: 16, maxWidth: 1280 }}>{templatesSection}</div>
        )}
        {soapTemplatesSection && (
          <div style={{ marginTop: 16, maxWidth: 1280 }}>{soapTemplatesSection}</div>
        )}
        {letterTemplatesSection && (
          <div style={{ marginTop: 16, maxWidth: 1280 }}>{letterTemplatesSection}</div>
        )}
      </div>
    </Screen>
  );
}
