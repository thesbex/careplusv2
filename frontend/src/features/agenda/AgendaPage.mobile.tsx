/**
 * M01 — Agenda mobile (single-day timeline with a horizontal day-tab strip).
 * Ported from design/prototype/mobile/screens.jsx:MAgenda.
 */
import { useNavigate } from 'react-router-dom';
import { MScreen } from '@/components/shell/MScreen';
import { MTopbar, MIconBtn } from '@/components/shell/MTopbar';
import type { MobileTab } from '@/components/shell/MTabs';
import { Plus, Warn } from '@/components/icons';

const DAYS = [
  { k: 'lun', l: 'Lun', n: '21' },
  { k: 'mar', l: 'Mar', n: '22' },
  { k: 'mer', l: 'Mer', n: '23' },
  { k: 'jeu', l: 'Jeu', n: '24', on: true },
  { k: 'ven', l: 'Ven', n: '25' },
  { k: 'sam', l: 'Sam', n: '26' },
  { k: 'dim', l: 'Dim', n: '27' },
];

type MobileStatus = 'done' | 'arrived' | 'consult' | 'confirmed';

interface Rdv {
  t: string;
  dur: string;
  name: string;
  reason: string;
  status: MobileStatus;
  allergy?: string;
}

const RDVS: Rdv[] = [
  { t: '09:00', dur: '15 min', name: 'Laila Bouhlal', reason: 'Contrôle tension', status: 'done' },
  { t: '09:30', dur: '30 min', name: 'Ahmed Cherkaoui', reason: 'Suivi HTA', status: 'arrived', allergy: 'Aspirine' },
  { t: '10:30', dur: '30 min', name: 'Youness Alaoui', reason: 'Bilan sanguin', status: 'consult' },
  { t: '11:15', dur: '15 min', name: 'Khadija Tahiri', reason: 'Contrôle diabète', status: 'confirmed' },
  { t: '14:00', dur: '20 min', name: 'Sanae Kettani', reason: 'Suivi grossesse', status: 'confirmed' },
  { t: '15:00', dur: '15 min', name: 'Driss Benkirane', reason: 'Renouvellement', status: 'confirmed' },
];

const STATUS_LABEL: Record<MobileStatus, string> = {
  confirmed: 'Confirmé',
  arrived: 'Arrivé',
  consult: 'En consult.',
  done: 'Terminé',
};

export default function AgendaMobilePage() {
  const navigate = useNavigate();
  return (
    <MScreen
      tab="agenda"
      topbar={
        <MTopbar
          brand
          left={<MIconBtn icon="Menu" label="Menu" />}
          right={
            <>
              <MIconBtn icon="Search" label="Rechercher" />
              <MIconBtn icon="Bell" badge label="Notifications" />
            </>
          }
        />
      }
      onTabChange={(tab: MobileTab) => {
        const map: Record<MobileTab, string> = {
          agenda: '/agenda',
          salle: '/salle',
          patients: '/patients',
          factu: '/facturation',
          menu: '/parametres',
        };
        navigate(map[tab]);
      }}
      fab={
        <button
          className="m-fab"
          type="button"
          aria-label="Nouveau RDV"
          style={{ border: 0, cursor: 'pointer' }}
        >
          <Plus />
        </button>
      }
    >
      <div className="m-daytabs" role="tablist" aria-label="Jour">
        {DAYS.map((d) => (
          <button
            key={d.k}
            type="button"
            className={`m-daytab ${d.on ? 'on' : ''}`}
            role="tab"
            aria-selected={!!d.on}
            style={{ border: 0, cursor: 'pointer', fontFamily: 'inherit' }}
          >
            <div className="dl">{d.l}</div>
            <div className="dn">{d.n}</div>
          </button>
        ))}
      </div>

      <div className="mb-pad" style={{ paddingTop: 14, paddingBottom: 24 }}>
        <div className="m-section-h">
          <h3>Jeudi 24 avril · {RDVS.length} rendez-vous</h3>
        </div>

        <div className="m-tl">
          {RDVS.map((r, i) => (
            <div key={i} className="m-tl-row">
              <div className="m-tl-hour">{r.t}</div>
              <div className="m-tl-col filled">
                <div className={`m-tl-block ${r.status}`}>
                  <div className="m-tl-block-h">
                    <span className="m-tl-block-time">
                      {r.t} · {r.dur}
                    </span>
                    <span className={`m-pill ${r.status}`} style={{ marginLeft: 'auto' }}>
                      {STATUS_LABEL[r.status]}
                    </span>
                  </div>
                  <div className="m-tl-block-name">{r.name}</div>
                  <div className="m-tl-block-reason">{r.reason}</div>
                  {r.allergy && (
                    <div className="m-pill allergy" style={{ marginTop: 8 }}>
                      <Warn /> {r.allergy}
                    </div>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </MScreen>
  );
}
