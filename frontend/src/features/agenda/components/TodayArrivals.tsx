import { useNavigate } from 'react-router-dom';
import { Pill } from '@/components/ui/Pill';
import { Button } from '@/components/ui/Button';
import { Warn, ChevronRight } from '@/components/icons';
import type { Arrival } from '../types';

const STATUS_LABEL: Record<Arrival['status'], string> = {
  arrived: 'Arrivé',
  vitals: 'En attente constantes',
  consult: 'En consultation',
};

interface TodayArrivalsProps {
  arrivals: Arrival[];
  date?: string;
  updatedAt?: string;
  /** How many other RDVs are expected today (count minus the visible arrivals). */
  remaining?: number;
  /** Map id → { initials, color, name } pour rendre la pastille médecin
      à côté du nom patient (multi-praticien only, iso maquette 2026-05-28). */
  practitionerMap?: Record<string, { initials: string; color: string; name: string }>;
}

function defaultDate(): string {
  return new Date().toLocaleDateString('fr-MA', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  });
}

function defaultUpdatedAt(): string {
  return new Date().toLocaleTimeString('fr-MA', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  });
}

export function TodayArrivals({
  arrivals,
  date,
  updatedAt,
  remaining = 5,
  practitionerMap,
}: TodayArrivalsProps) {
  const displayDate = date ?? defaultDate();
  const displayUpdatedAt = updatedAt ?? defaultUpdatedAt();
  const navigate = useNavigate();
  return (
    <>
      <div className="ag-arrivals-h">
        <div className="ag-arrivals-h-top">
          <div style={{ fontSize: 13, fontWeight: 600 }}>Arrivées du jour</div>
          <div className="tnum" style={{ fontSize: 11, color: 'var(--ink-3)' }}>
            {arrivals.length} patient{arrivals.length > 1 ? 's' : ''}
          </div>
        </div>
        <div style={{ fontSize: 11, color: 'var(--ink-3)', marginTop: 2 }}>
          {displayDate} · mise à jour {displayUpdatedAt}
        </div>
      </div>

      <div className="ag-arrivals-list scroll">
        {arrivals.map((p) => {
          const pract = p.practitionerId ? practitionerMap?.[p.practitionerId] : undefined;
          return (
          <div key={p.name} className="ag-arrival-card">
            <div className="ag-arrival-row">
              <div style={{ fontWeight: 600, fontSize: 12.5, display: 'flex', alignItems: 'center', gap: 6, minWidth: 0 }}>
                {pract && (
                  <span
                    className="ag-doctor-avatar"
                    style={{ background: pract.color, width: 20, height: 20, fontSize: 9.5 }}
                    title={pract.name}
                    aria-label={pract.name}
                  >
                    {pract.initials}
                  </span>
                )}
                <span style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', minWidth: 0 }}>
                  {p.name}
                </span>
              </div>
              <span className="tnum" style={{ fontSize: 11, color: 'var(--ink-3)', flexShrink: 0 }}>
                RDV {p.apt}
              </span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 6, flexWrap: 'wrap' }}>
              <Pill status={p.status} dot>
                {STATUS_LABEL[p.status]}
              </Pill>
              {p.allergy && (
                <Pill status="allergy">
                  <Warn /> {p.allergy}
                </Pill>
              )}
            </div>
            <div className="ag-arrival-foot">
              <span className="tnum" style={{ fontSize: 11, color: 'var(--ink-3)' }}>
                {p.status === 'arrived' ? "Vient d'arriver" : `Depuis ${p.since}`}
              </span>
              <Button size="sm" variant="ghost" className="ag-arrival-dossier">
                Dossier
                <ChevronRight />
              </Button>
            </div>
          </div>
          );
        })}

        <div className="ag-arrivals-more">{remaining} autres RDV attendus aujourd'hui</div>
      </div>

      <div className="ag-arrivals-f">
        <Button
          style={{ width: '100%', justifyContent: 'center' }}
          onClick={() => navigate('/salle')}
        >
          Ouvrir la salle d'attente
          <ChevronRight />
        </Button>
      </div>
    </>
  );
}
