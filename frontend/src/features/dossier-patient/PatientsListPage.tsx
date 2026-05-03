import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Screen } from '@/components/shell/Screen';
import { Input } from '@/components/ui/Input';
import { Search, Users } from '@/components/icons';
import { usePatientList } from './hooks/usePatientList';

function toAge(birthDate: string): number {
  const d = new Date(birthDate);
  const now = new Date();
  let age = now.getFullYear() - d.getFullYear();
  const m = now.getMonth() - d.getMonth();
  if (m < 0 || (m === 0 && now.getDate() < d.getDate())) age--;
  return age;
}

export default function PatientsListPage() {
  const navigate = useNavigate();
  const [q, setQ] = useState('');
  const { patients, total, isLoading, error } = usePatientList(q);

  return (
    <Screen
      active="patients"
      title="Patients"
      sub={isLoading ? 'Chargement…' : `${total} patient${total !== 1 ? 's' : ''}`}
      onNavigate={(id) => {
        const map = {
          agenda: '/agenda',
          patients: '/patients',
          salle: '/salle',
          consult: '/consultations',
          factu: '/facturation',
          params: '/parametres',
        } as const;
        navigate(map[id]);
      }}
    >
      <div style={{ display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0, padding: '16px 24px', gap: 16 }}>
        {/* Search bar */}
        <div style={{ position: 'relative', maxWidth: 440 }}>
          <span style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: 'var(--ink-3)', pointerEvents: 'none' }}>
            <Search aria-hidden="true" />
          </span>
          <Input
            placeholder="Rechercher par nom, prénom ou CIN…"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            style={{ paddingLeft: 34 }}
            aria-label="Rechercher un patient"
          />
        </div>

        {error && (
          <div style={{ color: 'var(--danger)', fontSize: 13 }}>{error}</div>
        )}

        {/* Patient list */}
        <div style={{ flex: 1, overflowY: 'auto', minHeight: 0 }}>
          {isLoading ? (
            <div style={{ color: 'var(--ink-3)', fontSize: 13, padding: '12px 0' }}>Chargement…</div>
          ) : patients.length === 0 ? (
            <div style={{ color: 'var(--ink-3)', fontSize: 13, padding: '12px 0' }}>
              {q ? 'Aucun patient trouvé.' : 'Aucun patient enregistré.'}
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
              {patients.map((p) => (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => navigate(`/patients/${p.id}`)}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 12,
                    padding: '10px 14px',
                    border: '1px solid var(--border)',
                    borderRadius: 8,
                    background: 'var(--surface)',
                    cursor: 'pointer',
                    textAlign: 'left',
                    fontFamily: 'inherit',
                    transition: 'background 0.1s',
                  }}
                  onMouseEnter={(e) => (e.currentTarget.style.background = 'var(--bg-alt)')}
                  onMouseLeave={(e) => (e.currentTarget.style.background = 'var(--surface)')}
                >
                  <div
                    className="cp-avatar"
                    style={{ width: 36, height: 36, fontSize: 13, flexShrink: 0, background: 'var(--primary)' }}
                    aria-hidden="true"
                  >
                    {p.firstName.charAt(0)}{p.lastName.charAt(0)}
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 13, fontWeight: 600 }}>
                      {p.firstName} {p.lastName}
                    </div>
                    <div style={{ fontSize: 11.5, color: 'var(--ink-3)', marginTop: 1 }}>
                      {p.gender === 'M' ? 'H' : p.gender === 'F' ? 'F' : p.gender}
                      {p.birthDate ? ` · ${toAge(p.birthDate)} ans` : ''}
                      {p.cin ? ` · ${p.cin}` : ''}
                      {p.city ? ` · ${p.city}` : ''}
                    </div>
                  </div>
                  <span style={{ color: 'var(--ink-3)', flexShrink: 0 }}>
                    <Users aria-hidden="true" />
                  </span>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    </Screen>
  );
}
