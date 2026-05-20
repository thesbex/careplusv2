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
      <div style={{ padding: 24, maxWidth: 720 }}>
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

        {isMedecin && <SignatureSettingsSection />}
        {isMedecin && <ReferralContactsSection />}

        {!isMedecin && (
          <div
            style={{
              marginTop: 16,
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

        <PasswordChangeSection />
      </div>
    </Screen>
  );
}
