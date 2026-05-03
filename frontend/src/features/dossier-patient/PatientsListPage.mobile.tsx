/**
 * Patients list — mobile.
 * Search-and-tap + bouton flottant « + » pour créer un dossier.
 *
 * Avant 2026-05-01, la création était désactivée sur mobile (« le formulaire
 * est trop dense pour un téléphone »). Les secrétaires sur tablette en salle
 * d'attente n'avaient donc aucun moyen de créer un nouveau patient sans
 * basculer sur PC. NewPatientMobileSheet propose une variante condensée des
 * champs essentiels (état civil + contact + photo), les sections denses
 * (allergies/antécédents/mutuelle/historique) restent côté desktop.
 */
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { MScreen } from '@/components/shell/MScreen';
import { MTopbar } from '@/components/shell/MTopbar';
import type { MobileTab } from '@/components/shell/MTabs';
import { Search, ChevronRight, Plus } from '@/components/icons';
import { useAuthStore } from '@/lib/auth/authStore';
import { usePatientList } from './hooks/usePatientList';
import { NewPatientMobileSheet } from './components/NewPatientMobileSheet';

function toAge(birthDate: string): number {
  const d = new Date(birthDate);
  const now = new Date();
  let age = now.getFullYear() - d.getFullYear();
  const m = now.getMonth() - d.getMonth();
  if (m < 0 || (m === 0 && now.getDate() < d.getDate())) age--;
  return age;
}

const TAB_MAP: Record<MobileTab, string> = {
  agenda:   '/agenda',
  salle:    '/salle',
  patients: '/patients',
  factu:    '/facturation',
  menu:     '/parametres',
};

export default function PatientsListMobilePage() {
  const navigate = useNavigate();
  const [q, setQ] = useState('');
  const [showNew, setShowNew] = useState(false);
  const { patients, total, isLoading, error } = usePatientList(q);
  // QA3-3 — backward-compat: legacy sessions sans `permissions` gardent
  // l'ancien comportement (création autorisée). Le gate s'engage dès que
  // le backend remonte la liste.
  const userPerms = useAuthStore((s) => s.user?.permissions);
  const canCreatePatient = userPerms == null || userPerms.includes('PATIENT_CREATE');

  return (
    <MScreen
      tab="patients"
      topbar={<MTopbar brand title="Patients" />}
      onTabChange={(t) => navigate(TAB_MAP[t])}
      fab={
        canCreatePatient ? (
          <button
            type="button"
            aria-label="Nouveau patient"
            onClick={() => setShowNew(true)}
            style={{
              position: 'fixed',
              right: 16,
              bottom: 76,
              width: 56,
              height: 56,
              borderRadius: '50%',
              border: 0,
              background: 'var(--primary)',
              color: 'var(--on-primary, #fff)',
              boxShadow: '0 4px 14px rgba(0,0,0,0.18)',
              display: 'grid',
              placeItems: 'center',
              cursor: 'pointer',
              zIndex: 30,
            }}
          >
            <Plus aria-hidden="true" />
          </button>
        ) : undefined
      }
    >
      <div className="mb-pad">
        {/* Search — uses .m-search token for visual consistency. */}
        <label className="m-search">
          <Search aria-hidden="true" />
          <input
            type="search"
            placeholder="Rechercher par nom, prénom ou CIN…"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            aria-label="Rechercher un patient"
            style={{
              flex: 1,
              border: 0,
              outline: 'none',
              background: 'transparent',
              fontFamily: 'inherit',
              fontSize: 14,
              color: 'var(--ink)',
            }}
          />
        </label>

        <div
          style={{
            fontSize: 12,
            color: 'var(--ink-3)',
            marginBottom: 8,
          }}
        >
          {isLoading ? 'Chargement…' : `${total} patient${total !== 1 ? 's' : ''}`}
        </div>

        {error && (
          <div style={{ color: 'var(--danger)', fontSize: 13, marginBottom: 8 }}>
            {error}
          </div>
        )}

        <div className="m-card">
          {!isLoading && patients.length === 0 ? (
            <div
              style={{
                padding: '32px 16px',
                textAlign: 'center',
                color: 'var(--ink-3)',
                fontSize: 13,
              }}
            >
              {q ? 'Aucun patient trouvé.' : 'Aucun patient enregistré.'}
            </div>
          ) : (
            patients.map((p, i) => (
              <button
                key={p.id}
                type="button"
                onClick={() => navigate(`/patients/${p.id}`)}
                className="m-row"
                style={{
                  width: '100%',
                  textAlign: 'left',
                  background: 'transparent',
                  border: 0,
                  borderTop: i === 0 ? 'none' : '1px solid var(--border-soft)',
                  fontFamily: 'inherit',
                  font: 'inherit',
                  cursor: 'pointer',
                  WebkitTapHighlightColor: 'transparent',
                }}
              >
                <div
                  className="cp-avatar"
                  style={{
                    width: 38,
                    height: 38,
                    borderRadius: 10,
                    fontSize: 13,
                    background: 'var(--primary)',
                  }}
                  aria-hidden="true"
                >
                  {p.firstName.charAt(0)}
                  {p.lastName.charAt(0)}
                </div>
                <div className="m-row-pri">
                  <div className="m-row-main">
                    {p.firstName} {p.lastName}
                    {p.tier === 'PREMIUM' && (
                      <span
                        className="m-pill"
                        aria-label="Patient Premium"
                        style={{
                          marginLeft: 6,
                          fontSize: 10,
                          padding: '2px 6px',
                          background: 'var(--amber-soft)',
                          color: 'var(--amber)',
                        }}
                      >
                        Premium
                      </span>
                    )}
                  </div>
                  <div className="m-row-sub">
                    {p.gender === 'M' ? 'H' : p.gender === 'F' ? 'F' : p.gender}
                    {p.birthDate ? ` · ${toAge(p.birthDate)} ans` : ''}
                    {p.cin ? ` · ${p.cin}` : ''}
                    {p.city ? ` · ${p.city}` : ''}
                  </div>
                </div>
                <ChevronRight aria-hidden="true" />
              </button>
            ))
          )}
        </div>

        <div
          style={{
            marginTop: 16,
            padding: 12,
            background: 'var(--bg-alt)',
            borderRadius: 'var(--r-lg)',
            fontSize: 12,
            color: 'var(--ink-3)',
            lineHeight: 1.5,
          }}
        >
          Astuce : appuyez sur le bouton « + » pour créer un nouveau patient.
          Pour saisir allergies, antécédents, mutuelle ou documents historiques,
          utilisez la version desktop (formulaire complet à onglets).
        </div>
      </div>

      <NewPatientMobileSheet
        open={showNew}
        onOpenChange={setShowNew}
        onCreated={(id) => {
          setShowNew(false);
          navigate(`/patients/${id}`);
        }}
      />
    </MScreen>
  );
}
