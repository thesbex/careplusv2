import { useNavigate } from 'react-router-dom';
import { Pill } from '@/components/ui/Pill';
import { Button } from '@/components/ui/Button';
import { Warn } from '@/components/icons';
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
        {arrivals.map((p) => (
          <div key={p.name} className="ag-arrival-card">
            <div className="ag-arrival-row">
              <div style={{ fontWeight: 600, fontSize: 12.5 }}>{p.name}</div>
              <span className="tnum" style={{ fontSize: 11, color: 'var(--ink-3)' }}>
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
              <Button size="sm" variant="ghost">
                Dossier →
              </Button>
            </div>
          </div>
        ))}

        <div className="ag-arrivals-more">{remaining} autres RDV attendus aujourd'hui</div>
      </div>

      <div className="ag-arrivals-f">
        <Button
          style={{ width: '100%', justifyContent: 'center' }}
          onClick={() => navigate('/salle')}
        >
          Ouvrir la salle d'attente →
        </Button>
      </div>
    </>
  );
}
