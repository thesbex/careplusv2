/**
 * Patients list — mobile.
 * Search-and-tap. Patient creation is desktop-only (the form is too dense
 * for a phone) — a hint message points the user there.
 */
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { MScreen } from '@/components/shell/MScreen';
import { MTopbar } from '@/components/shell/MTopbar';
import type { MobileTab } from '@/components/shell/MTabs';
import { Search, ChevronRight } from '@/components/icons';
import { usePatientList } from './hooks/usePatientList';

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
  const { patients, total, isLoading, error } = usePatientList(q);

  return (
    <MScreen
      tab="patients"
      topbar={<MTopbar brand title="Patients" />}
      onTabChange={(t) => navigate(TAB_MAP[t])}
    >
      <div className="mb-pad">
        {/* Search */}
        <div style={{ position: 'relative', marginBottom: 12 }}>
          <span
            style={{
              position: 'absolute',
              left: 12,
              top: '50%',
              transform: 'translateY(-50%)',
              color: 'var(--ink-3)',
              pointerEvents: 'none',
            }}
            aria-hidden="true"
          >
            <Search />
          </span>
          <input
            type="search"
            className="m-input"
            placeholder="Rechercher par nom, prénom ou CIN…"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            aria-label="Rechercher un patient"
            style={{ paddingLeft: 36 }}
          />
        </div>

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
                    {p.tier === 'PREMIUM' && (
                      <span aria-label="Patient Premium" style={{ marginRight: 4 }}>
                        🌟
                      </span>
                    )}
                    {p.firstName} {p.lastName}
                  </div>
                  <div
                    style={{
                      fontSize: 11.5,
                      color: 'var(--ink-3)',
                      marginTop: 2,
                    }}
                  >
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
            borderRadius: 8,
            fontSize: 12,
            color: 'var(--ink-3)',
            lineHeight: 1.5,
          }}
        >
          La création de patient se fait depuis la version desktop (formulaire complet
          avec onglets personnel / médical et téléversement de documents).
        </div>
      </div>
    </MScreen>
  );
}
