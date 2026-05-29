/**
 * Mur de lits — vue additionnelle de la page Hospitalisation (refresh, écran 04
 * « Hospitalisations — mur de lits »). Grille de lits par service, statut coloré,
 * occupant + durée de séjour. Lecture seule : un clic sur un lit occupé ouvre la
 * fiche séjour (réutilise StayDetailPanel via onOpenStay).
 *
 * Données : useBedBoard (lits + statut, occupation dérivée) joint à useStayQueue
 * par bedId (ajouté à StayQueueEntry) pour l'occupant. Aucun nouvel endpoint.
 */
import { useMemo, useState } from 'react';
import {
  BED_STATUS_LABELS,
  ROOM_CLASS_LABELS,
  useBedBoard,
  type BedStatus,
} from '../hooks/useHospitalization';
import { useStayQueue, type StayQueueEntry } from '../hooks/useStays';
import '../bed-wall.css';

const STATUS_CLASS: Record<BedStatus, string> = {
  LIBRE: 'libre',
  OCCUPE: 'occupe',
  RESERVE: 'reserve',
  NETTOYAGE: 'nettoy',
  HORS_SERVICE: 'hs',
};

const AVATAR_COLORS = ['#1E4DAB', '#0E5B3E', '#E1593C', '#7A5A35', '#3F6FAE', '#577243'];

function avatarColor(seed: string): string {
  let n = 0;
  for (let i = 0; i < seed.length; i++) n = (n + seed.charCodeAt(i)) % AVATAR_COLORS.length;
  return AVATAR_COLORS[n]!;
}

/** "25 mai · 14h" depuis un ISO. */
function entryLabel(iso: string): string {
  const d = new Date(iso);
  const date = d.toLocaleDateString('fr-MA', { day: 'numeric', month: 'short' });
  return `${date} · ${String(d.getHours()).padStart(2, '0')}h`;
}

function BedIcon() {
  return (
    <svg viewBox="0 0 18 18" aria-hidden="true">
      <rect x="3" y="6" width="12" height="6" rx="1" />
      <path d="M3 9h12" />
    </svg>
  );
}

export function BedWall({ onOpenStay }: { onOpenStay: (stayId: string) => void }) {
  const { board, isLoading, error } = useBedBoard();
  const { stays } = useStayQueue();
  const [wardFilter, setWardFilter] = useState<string>('ALL');

  // bedId → séjour occupant (la queue peut être filtrée par cloisonnement → occupant absent toléré).
  const occByBed = useMemo(() => {
    const m = new Map<string, StayQueueEntry>();
    for (const s of stays) if (s.bedId) m.set(s.bedId, s);
    return m;
  }, [stays]);

  // Aplatir tous les lits + compter les statuts.
  const allBeds = useMemo(
    () => board.wards.flatMap((w) => w.rooms.flatMap((r) => r.beds.map((b) => ({ ...b, room: r, ward: w })))),
    [board],
  );
  const total = allBeds.length;
  const count = (s: BedStatus) => allBeds.filter((b) => b.status === s).length;
  const occupied = count('OCCUPE');
  const rate = total > 0 ? Math.round((occupied / total) * 100) : 0;

  const wardsShown = board.wards.filter((w) => wardFilter === 'ALL' || w.wardId === wardFilter);

  if (isLoading) return <div className="bw-empty-board">Chargement du mur de lits…</div>;
  if (error) return <div className="bw-empty-board" style={{ color: 'var(--danger)' }}>{error}</div>;
  if (total === 0) {
    return (
      <div className="bw-empty-board">
        Aucun lit configuré. Déclarez vos services, chambres et lits dans Paramètres → Chambres &amp; lits.
      </div>
    );
  }

  return (
    <div className="bw">
      {/* KPIs */}
      <div className="bw-kpis">
        <div className="bw-kpi hero">
          <div className="k">Taux d'occupation</div>
          <div className="v">{rate}<span className="u">%</span></div>
          <div className="d"><b>{occupied}</b> / {total} lits occupés</div>
        </div>
        <div className="bw-kpi">
          <div className="k"><span className="dot" style={{ background: 'var(--success)' }} />Lits libres</div>
          <div className="v">{count('LIBRE')}</div>
          <div className="d">disponibles immédiatement</div>
        </div>
        <div className="bw-kpi">
          <div className="k"><span className="dot" style={{ background: 'var(--amber)' }} />En nettoyage</div>
          <div className="v">{count('NETTOYAGE')}</div>
          <div className="d">à préparer</div>
        </div>
        <div className="bw-kpi">
          <div className="k"><span className="dot" style={{ background: 'var(--primary)' }} />Réservés</div>
          <div className="v">{count('RESERVE')}</div>
          <div className="d">affectation à venir</div>
        </div>
      </div>

      {/* Legend + ward filter */}
      <div className="bw-bar">
        <span className="lt">Statut</span>
        <span className="it"><span className="sq" style={{ background: 'var(--success)' }} />Libre</span>
        <span className="it"><span className="sq" style={{ background: 'var(--primary)' }} />Réservé</span>
        <span className="it"><span className="sq" style={{ background: 'var(--danger)' }} />Occupé</span>
        <span className="it"><span className="sq" style={{ background: 'var(--amber)' }} />Nettoyage</span>
        <span className="it"><span className="sq" style={{ background: 'var(--ink-3)' }} />Hors service</span>
        {board.wards.length > 1 && (
          <div className="filters">
            <button type="button" className={`bw-chip${wardFilter === 'ALL' ? ' on' : ''}`}
              onClick={() => setWardFilter('ALL')}>Tous</button>
            {board.wards.map((w) => (
              <button key={w.wardId} type="button"
                className={`bw-chip${wardFilter === w.wardId ? ' on' : ''}`}
                onClick={() => setWardFilter(w.wardId)}>{w.wardLabel}</button>
            ))}
          </div>
        )}
      </div>

      {/* Ward sections */}
      {wardsShown.map((w) => {
        const beds = w.rooms.flatMap((r) => r.beds.map((b) => ({ ...b, room: r })));
        return (
          <div key={w.wardId}>
            <div className="bw-section-title">
              {w.wardLabel}
              <span className="cnt">{beds.length} lit{beds.length > 1 ? 's' : ''}</span>
              <span className="ln" />
            </div>
            <div className="bw-grid">
              {beds.map((b) => {
                const cls = STATUS_CLASS[b.status];
                const occ = b.status === 'OCCUPE' ? occByBed.get(b.id) : undefined;
                const interactive = !!occ;
                const Tag = interactive ? 'button' : 'div';
                return (
                  <Tag
                    key={b.id}
                    type={interactive ? 'button' : undefined}
                    className={`bw-bed ${cls}${b.active ? '' : ' off'}`}
                    onClick={interactive ? () => onOpenStay(occ!.stayId) : undefined}
                    data-testid={`bw-bed-${b.id}`}
                  >
                    <div className="top">
                      <div>
                        <div className="lbl">Lit · {b.code}</div>
                        <h4>{b.room.roomLabel}</h4>
                        <div className="room">
                          {ROOM_CLASS_LABELS[b.room.roomClass]} · {w.wardLabel}
                        </div>
                      </div>
                      <span className={`bw-pill ${cls}`}>{BED_STATUS_LABELS[b.status]}</span>
                    </div>

                    {occ ? (
                      <>
                        <div className="pat">
                          <div className="av" style={{ background: avatarColor(occ.patientId) }}>
                            {`${occ.patientFirstName.charAt(0)}${occ.patientLastName.charAt(0)}`.toUpperCase()}
                          </div>
                          <div className="info">
                            <b>{occ.patientLastName} {occ.patientFirstName}</b>
                            <span>{occ.admissionReason ?? 'Motif non renseigné'}</span>
                          </div>
                        </div>
                        <div className="stay">
                          <span>Entrée <b>{entryLabel(occ.admittedAt)}</b></span>
                          <span><b>J+{occ.daysSoFar}</b></span>
                        </div>
                      </>
                    ) : (
                      <div className="empty">
                        <BedIcon />
                        <div>
                          {b.status === 'LIBRE' && 'Disponible immédiatement'}
                          {b.status === 'RESERVE' && 'Réservé · affectation à venir'}
                          {b.status === 'NETTOYAGE' && 'En préparation'}
                          {b.status === 'HORS_SERVICE' && 'Hors service'}
                          {b.status === 'OCCUPE' && 'Occupé'}
                        </div>
                      </div>
                    )}
                  </Tag>
                );
              })}
              {beds.length === 0 && (
                <div className="bw-empty-board" style={{ gridColumn: '1 / -1' }}>Aucun lit dans ce service.</div>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
