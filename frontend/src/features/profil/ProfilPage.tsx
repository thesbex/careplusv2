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
import { useAuthStore } from '@/lib/auth/authStore';
import { SignatureSettingsSection } from '@/features/parametres/components/SignatureSettingsSection';
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
  const navigate = useNavigate();
  const user = useAuthStore((s) => s.user);
  const isMedecin = (user?.roles ?? []).includes('MEDECIN');

  return (
    <Screen
      active="agenda"
      title="Mon profil"
      sub={
        user
          ? `${user.firstName} ${user.lastName} · ${user.roles.join(' · ')}`
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
              <div style={{ fontWeight: 600, fontSize: 14, marginBottom: 4 }}>
                Identité
              </div>
              <div style={{ fontSize: 13, color: 'var(--ink-2)' }}>
                <div>
                  <strong>Nom :</strong> {user?.firstName} {user?.lastName}
                </div>
                <div>
                  <strong>Email :</strong> {user?.email}
                </div>
                <div>
                  <strong>Rôles :</strong> {(user?.roles ?? []).join(', ')}
                </div>
              </div>
            </div>

            <PasswordChangeSection />
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            {isMedecin && <SignatureSettingsSection />}
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
                La signature scannée n'est utilisée que par les médecins (sur les
                ordonnances, certificats et carnets de vaccination qu'ils génèrent).
              </div>
            )}
          </div>
        </div>
      </div>
    </Screen>
  );
}
