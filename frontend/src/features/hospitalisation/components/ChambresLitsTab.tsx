/**
 * Onglet « Chambres & lits » de /parametres — référentiel hospitalisation.
 * Refresh iso-maquette « careplus refresh - chambres & lits.html » :
 *   header + bandeau rôle + légende statuts, puis 6 panneaux numérotés
 *   (Tableau des lits · Services · Chambres · Lits · Facturation · Cloisonnement).
 *
 * Écriture réservée MEDECIN/ADMIN (canManage) ; le statut manuel d'un lit est
 * ouvert aussi à SECRETAIRE/INFIRMIER (canSetStatus). Suppression physique
 * autorisée seulement si aucun historique → sinon bandeau d'erreur ambre inline.
 */
import { useMemo, useState } from 'react';
import { toast } from 'sonner';
import { SelectMenu } from '@/components/ui/SelectMenu';
import { useAuthStore } from '@/lib/auth/authStore';
import { toProblemDetail } from '@/lib/api/problemJson';
import { useAgendaIsolation, useUpdateAgendaIsolation } from '@/features/parametres/hooks/useAgendaIsolation';
import { OrphanRolesPanel } from '@/features/parametres/components/OrphanRolesPanel';
import {
  BED_STATUS_LABELS,
  ROOM_CLASS_LABELS,
  useBedBoard,
  useBeds,
  useCreateBed,
  useCreateRoom,
  useCreateWard,
  useDeactivateBed,
  useDeactivateRoom,
  useDeactivateWard,
  useDeleteBed,
  useDeleteRoom,
  useRooms,
  useUpdateBedStatus,
  useWards,
  type BedStatus,
  type ManualBedStatus,
  type RoomClass,
  type WardView,
} from '../hooks/useHospitalization';
import '../chambres-lits.css';

const ROOM_CLASSES: RoomClass[] = ['INDIVIDUELLE', 'DOUBLE', 'COMMUNE', 'SUITE', 'AUTRE'];
const MANUAL_STATUSES: ManualBedStatus[] = ['LIBRE', 'RESERVE', 'NETTOYAGE', 'HORS_SERVICE'];

/** Classe CSS de pastille / dot pour un statut de lit. */
const STATUS_CLASS: Record<BedStatus, string> = {
  LIBRE: 'libre',
  OCCUPE: 'occupe',
  RESERVE: 'reserve',
  NETTOYAGE: 'nettoy',
  HORS_SERVICE: 'hs',
};

function reportError(err: unknown) {
  const problem = toProblemDetail(err);
  if (problem.status === 403) {
    toast.error('Action réservée au médecin / administrateur.');
  } else {
    toast.error(problem.title, problem.detail ? { description: problem.detail } : undefined);
  }
}

function PlusIcon() {
  return (
    <svg viewBox="0 0 18 18" aria-hidden="true">
      <path d="M9 3v12M3 9h12" />
    </svg>
  );
}

// ── Panel 1 — Tableau des lits (lecture seule) ────────────────────────────

function BedBoardSection() {
  const { board, isLoading, error } = useBedBoard();
  const totalBeds = useMemo(
    () => board.wards.reduce((s, w) => s + w.rooms.reduce((n, r) => n + r.beds.length, 0), 0),
    [board],
  );

  return (
    <section className="cl-panel" data-testid="hosp-board-section">
      <div className="cl-panel-h">
        <span className="ix">01</span>
        <h3>Tableau des lits</h3>
        <span className="meta">· vue d'ensemble · lecture seule</span>
        {board.wards.length > 0 && (
          <span className="right">
            {totalBeds} lit{totalBeds > 1 ? 's' : ''} · {board.wards.length} service
            {board.wards.length > 1 ? 's' : ''}
          </span>
        )}
      </div>
      <div className="cl-panel-b">
        {isLoading && <div className="cl-empty">Chargement…</div>}
        {error && <div className="cl-empty" style={{ color: 'var(--danger)' }}>{error}</div>}
        {!isLoading && board.wards.length === 0 && (
          <div className="cl-empty">
            Aucun service / lit configuré. Ajoutez un service puis des chambres et des lits ci-dessous.
          </div>
        )}
        {board.wards.map((w) => {
          const beds = w.rooms.reduce((n, r) => n + r.beds.length, 0);
          return (
            <div className="cl-svc-group" key={w.wardId}>
              <div className="cl-svc-h">
                <span className="scode">{w.wardCode}</span>
                <span className="sname">{w.wardLabel}</span>
                <span className="scount">
                  · {w.rooms.length} chambre{w.rooms.length > 1 ? 's' : ''} · {beds} lit{beds > 1 ? 's' : ''}
                </span>
              </div>
              <div className="cl-mini-grid">
                {w.rooms.map((r) => (
                  <div className="cl-mini" key={r.roomId}>
                    <div className="ch">
                      <b>{r.roomLabel}</b>
                      <span className="cc">{r.roomCode}</span>
                    </div>
                    <div className="cm">
                      {ROOM_CLASS_LABELS[r.roomClass]} · {r.dailyRate.toLocaleString('fr-MA')} MAD/j
                    </div>
                    <div className="beds">
                      {r.beds.length === 0 && <span className="cl-ro-hint">Aucun lit</span>}
                      {r.beds.map((b) => (
                        <span className={`cl-bedchip ${STATUS_CLASS[b.status]}`} key={b.id}>
                          <span className="d" />
                          {b.code}
                          <span className="st">· {BED_STATUS_LABELS[b.status]}</span>
                        </span>
                      ))}
                    </div>
                  </div>
                ))}
                {w.rooms.length === 0 && <span className="cl-ro-hint">Aucune chambre.</span>}
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}

// ── Panel 2 — Services / unités ───────────────────────────────────────────

function WardsSection({ canManage }: { canManage: boolean }) {
  const { wards, isLoading, error } = useWards();
  const { createWard, isPending: creating } = useCreateWard();
  const { deactivateWard } = useDeactivateWard();
  const [code, setCode] = useState('');
  const [label, setLabel] = useState('');

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    if (!code.trim() || !label.trim()) {
      toast.error('Code et libellé requis.');
      return;
    }
    try {
      await createWard({ code: code.trim(), labelFr: label.trim() });
      toast.success('Service créé.');
      setCode('');
      setLabel('');
    } catch (err) {
      reportError(err);
    }
  }

  async function handleDeactivate(w: WardView) {
    if (!confirm(`Désactiver le service « ${w.labelFr} » ?`)) return;
    try {
      await deactivateWard(w.id);
      toast.success('Service désactivé.');
    } catch (err) {
      reportError(err);
    }
  }

  return (
    <section className="cl-panel" data-testid="hosp-wards-section">
      <div className="cl-panel-h"><span className="ix">02</span><h3>Services / unités</h3></div>
      <div className="cl-panel-b">
        {canManage && (
          <form className="cl-addform svc" onSubmit={(e) => void handleCreate(e)}>
            <div className="cl-field">
              <label className="cl-lbl" htmlFor="ward-code">Code <span className="req">*</span></label>
              <input id="ward-code" className="cl-inp mono" value={code} maxLength={32}
                onChange={(e) => setCode(e.target.value)} placeholder="MAT" />
            </div>
            <div className="cl-field">
              <label className="cl-lbl" htmlFor="ward-label">Libellé <span className="req">*</span></label>
              <input id="ward-label" className="cl-inp" value={label} maxLength={120}
                onChange={(e) => setLabel(e.target.value)} placeholder="Maternité" />
            </div>
            <button type="submit" className="cl-btn-add" disabled={creating}>
              <PlusIcon /> {creating ? 'Ajout…' : 'Ajouter'}
            </button>
          </form>
        )}
        {isLoading && <div className="cl-empty">Chargement…</div>}
        {error && <div className="cl-empty" style={{ color: 'var(--danger)' }}>{error}</div>}
        {!isLoading && wards.length === 0 && <div className="cl-empty">Aucun service déclaré.</div>}
        {wards.length > 0 && (
          <div className="cl-rhead svc"><span>Code</span><span>Libellé</span><span /></div>
        )}
        <div className="cl-rows svc">
          {wards.map((w) => (
            <div className={`cl-rrow${w.active ? '' : ' off'}`} key={w.id} data-testid={`ward-row-${w.id}`}>
              <span className="code">{w.code}</span>
              <span className="name">
                {w.labelFr}
                {!w.active && <span className="cl-badge-off">Inactif</span>}
              </span>
              <div className="acts">
                {canManage && w.active && (
                  <button type="button" className="cl-btn-ghost"
                    onClick={() => void handleDeactivate(w)} aria-label={`Désactiver ${w.labelFr}`}>
                    Désactiver
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

// ── Panel 3 — Chambres ────────────────────────────────────────────────────

function RoomsSection({ canManage }: { canManage: boolean }) {
  const { wards } = useWards();
  const { rooms, isLoading, error } = useRooms();
  const { createRoom, isPending: creating } = useCreateRoom();
  const { deactivateRoom } = useDeactivateRoom();
  const { deleteRoom } = useDeleteRoom();
  const activeWards = wards.filter((w) => w.active);
  const [wardId, setWardId] = useState('');
  const [code, setCode] = useState('');
  const [label, setLabel] = useState('');
  const [roomClass, setRoomClass] = useState<RoomClass>('INDIVIDUELLE');
  const [dailyRate, setDailyRate] = useState('');
  const [delErr, setDelErr] = useState<string | null>(null); // room id avec erreur "non vide"

  const wardLabel = (id: string) => wards.find((w) => w.id === id)?.labelFr ?? '—';

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    if (!wardId || !code.trim() || !label.trim()) {
      toast.error('Service, code et libellé requis.');
      return;
    }
    const rate = Number(dailyRate);
    if (!dailyRate.trim() || Number.isNaN(rate) || rate <= 0) {
      toast.error('Prix/jour requis (supérieur à 0).');
      return;
    }
    try {
      await createRoom({ wardId, code: code.trim(), labelFr: label.trim(), roomClass, dailyRate: rate });
      toast.success('Chambre créée.');
      setCode('');
      setLabel('');
      setDailyRate('');
    } catch (err) {
      reportError(err);
    }
  }

  async function handleDeactivate(id: string) {
    try {
      await deactivateRoom(id);
      toast.success('Chambre désactivée.');
    } catch (err) {
      reportError(err);
    }
  }

  async function handleDelete(id: string, labelFr: string) {
    if (!confirm(`Supprimer définitivement la chambre « ${labelFr} » ?`)) return;
    setDelErr(null);
    try {
      await deleteRoom(id);
      toast.success('Chambre supprimée.');
    } catch (err) {
      const p = toProblemDetail(err);
      if (p.code === 'ROOM_HAS_BEDS_DELETE') {
        setDelErr(id);
        return;
      }
      reportError(err);
    }
  }

  return (
    <section className="cl-panel" data-testid="hosp-rooms-section">
      <div className="cl-panel-h"><span className="ix">03</span><h3>Chambres</h3></div>
      <div className="cl-panel-b">
        {canManage && (
          <form className="cl-addform cham" onSubmit={(e) => void handleCreate(e)}>
            <div className="cl-field">
              <label className="cl-lbl" htmlFor="room-ward">Service <span className="req">*</span></label>
              <SelectMenu id="room-ward" className="cl-selm" ariaLabel="Service" value={wardId}
                onChange={(e) => setWardId(e.target.value)}
                options={[{ value: '', label: '— Choisir —' },
                  ...activeWards.map((w) => ({ value: w.id, label: w.labelFr }))]} />
            </div>
            <div className="cl-field">
              <label className="cl-lbl" htmlFor="room-code">Code <span className="req">*</span></label>
              <input id="room-code" className="cl-inp mono" value={code} maxLength={32}
                onChange={(e) => setCode(e.target.value)} placeholder="102" />
            </div>
            <div className="cl-field">
              <label className="cl-lbl" htmlFor="room-label">Libellé <span className="req">*</span></label>
              <input id="room-label" className="cl-inp" value={label} maxLength={120}
                onChange={(e) => setLabel(e.target.value)} placeholder="Chambre 102" />
            </div>
            <div className="cl-field">
              <label className="cl-lbl" htmlFor="room-class">Classe</label>
              <SelectMenu id="room-class" className="cl-selm" ariaLabel="Classe" value={roomClass}
                onChange={(e) => setRoomClass(e.target.value as RoomClass)}
                options={ROOM_CLASSES.map((c) => ({ value: c, label: ROOM_CLASS_LABELS[c] }))} />
            </div>
            <div className="cl-field">
              <label className="cl-lbl" htmlFor="room-rate">Prix/jour (MAD) <span className="req">*</span></label>
              <input id="room-rate" className="cl-inp mono" type="number" min={1} step="10" required
                value={dailyRate} onChange={(e) => setDailyRate(e.target.value)} placeholder="400" />
            </div>
            <button type="submit" className="cl-btn-add" disabled={creating}>
              <PlusIcon /> {creating ? 'Ajout…' : 'Ajouter'}
            </button>
          </form>
        )}
        {isLoading && <div className="cl-empty">Chargement…</div>}
        {error && <div className="cl-empty" style={{ color: 'var(--danger)' }}>{error}</div>}
        {!isLoading && rooms.length === 0 && <div className="cl-empty">Aucune chambre déclarée.</div>}
        {rooms.length > 0 && (
          <div className="cl-rhead cham">
            <span>Code</span><span>Chambre</span><span>Service</span>
            <span>Classe</span><span>Prix/jour</span><span />
          </div>
        )}
        <div className="cl-rows cham">
          {rooms.map((r) => (
            <div key={r.id} data-testid={`room-row-${r.id}`}>
              <div className={`cl-rrow${r.active ? '' : ' off'}`}>
                <span className="code">{r.code}</span>
                <span className="name">
                  {r.labelFr}
                  {!r.active && <span className="cl-badge-off">Inactive</span>}
                </span>
                <span className="sub">{wardLabel(r.wardId)}</span>
                <span><span className="cl-cls"><span className="d" />{ROOM_CLASS_LABELS[r.roomClass]}</span></span>
                <span className="price">{r.dailyRate.toLocaleString('fr-MA')} MAD/j</span>
                <div className="acts">
                  {canManage && r.active && (
                    <button type="button" className="cl-btn-ghost"
                      onClick={() => void handleDeactivate(r.id)} aria-label={`Désactiver ${r.labelFr}`}>
                      Désactiver
                    </button>
                  )}
                  {canManage && (
                    <button type="button" className="cl-btn-ghost danger"
                      onClick={() => void handleDelete(r.id, r.labelFr)} aria-label={`Supprimer ${r.labelFr}`}>
                      Supprimer
                    </button>
                  )}
                </div>
              </div>
              {delErr === r.id && (
                <div className="cl-errstrip" role="alert">
                  <div className="ic">!</div>
                  <div className="t"><b>Chambre non vide.</b> Supprimez d'abord ses lits, ou désactivez-la.</div>
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

// ── Panel 4 — Lits ────────────────────────────────────────────────────────

function BedsSection({ canManage, canSetStatus }: { canManage: boolean; canSetStatus: boolean }) {
  const { rooms } = useRooms();
  const { beds, isLoading, error } = useBeds();
  const { createBed, isPending: creating } = useCreateBed();
  const { deactivateBed } = useDeactivateBed();
  const { deleteBed } = useDeleteBed();
  const { updateBedStatus } = useUpdateBedStatus();
  const activeRooms = rooms.filter((r) => r.active);
  const [roomId, setRoomId] = useState('');
  const [code, setCode] = useState('');
  const [delErr, setDelErr] = useState<string | null>(null); // bed id avec erreur "déjà utilisé"

  const roomLabel = (id: string) => rooms.find((r) => r.id === id)?.labelFr ?? '—';

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    if (!roomId || !code.trim()) {
      toast.error('Chambre et code requis.');
      return;
    }
    try {
      await createBed({ roomId, code: code.trim() });
      toast.success('Lit créé.');
      setCode('');
    } catch (err) {
      reportError(err);
    }
  }

  async function handleStatus(id: string, status: ManualBedStatus) {
    try {
      await updateBedStatus({ id, status });
    } catch (err) {
      reportError(err);
    }
  }

  async function handleDeactivate(id: string) {
    try {
      await deactivateBed(id);
      toast.success('Lit désactivé.');
    } catch (err) {
      reportError(err);
    }
  }

  async function handleDelete(id: string, bedCode: string) {
    if (!confirm(`Supprimer définitivement le lit « ${bedCode} » ?`)) return;
    setDelErr(null);
    try {
      await deleteBed(id);
      toast.success('Lit supprimé.');
    } catch (err) {
      const p = toProblemDetail(err);
      if (p.code === 'BED_HAS_HISTORY') {
        setDelErr(id);
        return;
      }
      reportError(err);
    }
  }

  return (
    <section className="cl-panel" data-testid="hosp-beds-section">
      <div className="cl-panel-h"><span className="ix">04</span><h3>Lits</h3></div>
      <div className="cl-panel-b">
        {canManage && (
          <form className="cl-addform lit" onSubmit={(e) => void handleCreate(e)}>
            <div className="cl-field">
              <label className="cl-lbl" htmlFor="bed-room">Chambre <span className="req">*</span></label>
              <SelectMenu id="bed-room" className="cl-selm" ariaLabel="Chambre" value={roomId}
                onChange={(e) => setRoomId(e.target.value)}
                options={[{ value: '', label: '— Choisir —' },
                  ...activeRooms.map((r) => ({ value: r.id, label: r.labelFr }))]} />
            </div>
            <div className="cl-field">
              <label className="cl-lbl" htmlFor="bed-code">Code lit <span className="req">*</span></label>
              <input id="bed-code" className="cl-inp" value={code} maxLength={32}
                onChange={(e) => setCode(e.target.value)} placeholder="Lit A" />
            </div>
            <button type="submit" className="cl-btn-add" disabled={creating}>
              <PlusIcon /> {creating ? 'Ajout…' : 'Ajouter'}
            </button>
          </form>
        )}
        {isLoading && <div className="cl-empty">Chargement…</div>}
        {error && <div className="cl-empty" style={{ color: 'var(--danger)' }}>{error}</div>}
        {!isLoading && beds.length === 0 && <div className="cl-empty">Aucun lit déclaré.</div>}
        {beds.length > 0 && (
          <div className="cl-rhead lit"><span>Code</span><span>Chambre</span><span>Statut</span><span /></div>
        )}
        <div className="cl-rows lit">
          {beds.map((b) => {
            const occupiedOrLocked = b.status === 'OCCUPE' || !canSetStatus;
            return (
              <div key={b.id} data-testid={`bed-row-${b.id}`}>
                <div className={`cl-rrow${b.active ? '' : ' off'}`}>
                  <span className="code">{b.code}</span>
                  <span className="sub">{roomLabel(b.roomId)}</span>
                  <span>
                    {occupiedOrLocked ? (
                      <>
                        <span className={`cl-litpill ${STATUS_CLASS[b.status]}`}>
                          <span className="d" />{BED_STATUS_LABELS[b.status]}
                        </span>
                        {b.status === 'OCCUPE' && <span className="cl-ro-hint">· dérivé du séjour</span>}
                      </>
                    ) : (
                      <span className={`cl-statsel ${STATUS_CLASS[b.status]}`}>
                        <span className="d" />
                        <select aria-label={`Statut du lit ${b.code}`} value={b.status}
                          onChange={(e) => void handleStatus(b.id, e.target.value as ManualBedStatus)}>
                          {MANUAL_STATUSES.map((s) => <option key={s} value={s}>{BED_STATUS_LABELS[s]}</option>)}
                        </select>
                      </span>
                    )}
                  </span>
                  <div className="acts">
                    {canManage && b.active && (
                      <button type="button" className="cl-btn-ghost"
                        onClick={() => void handleDeactivate(b.id)} aria-label={`Désactiver ${b.code}`}>
                        Désactiver
                      </button>
                    )}
                    {canManage && (
                      <button type="button" className="cl-btn-ghost danger"
                        onClick={() => void handleDelete(b.id, b.code)} aria-label={`Supprimer ${b.code}`}>
                        Supprimer
                      </button>
                    )}
                  </div>
                </div>
                {delErr === b.id && (
                  <div className="cl-errstrip" role="alert">
                    <div className="ic">!</div>
                    <div className="t"><b>Lit déjà utilisé.</b> Désactivez-le plutôt que de le supprimer.</div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}

// ── Panel 5 — Facturation (règle de comptage) ─────────────────────────────

function DayRuleSection({ canManage }: { canManage: boolean }) {
  const { settings, stayBillingDayRule } = useAgendaIsolation();
  const { updateAgendaIsolation, isPending } = useUpdateAgendaIsolation();

  async function change(rule: 'NUITS' | 'JOURS_ENTAMES') {
    if (!settings) return;
    try {
      await updateAgendaIsolation({ settings, stayBillingDayRule: rule });
      toast.success('Règle de facturation mise à jour.');
    } catch (err) {
      reportError(err);
    }
  }

  return (
    <section className="cl-panel" data-testid="hosp-day-rule-section">
      <div className="cl-panel-h">
        <span className="ix">05</span>
        <h3>Facturation du séjour — comptage des journées</h3>
      </div>
      <div className="cl-panel-b">
        <p className="cl-help" style={{ margin: '0 0 14px', fontSize: 12.5, maxWidth: 680 }}>
          Détermine comment les journées d'hospitalisation sont comptées sur la facture. Le mode{' '}
          <b>Nuits</b> facture chaque nuit passée ; le mode <b>Jours entamés</b> facture le jour
          d'entrée et le jour de sortie comme deux journées pleines.
        </p>
        <div className="cl-rule-row">
          <div className="cl-field" style={{ maxWidth: 340 }}>
            <label className="cl-lbl" htmlFor="day-rule">Règle de comptage des journées</label>
            <SelectMenu id="day-rule" className="cl-selm" ariaLabel="Règle de comptage des journées"
              value={stayBillingDayRule} disabled={!canManage || isPending}
              onChange={(e) => void change(e.target.value as 'NUITS' | 'JOURS_ENTAMES')}
              options={[{ value: 'NUITS', label: 'Nuits (par défaut)' },
                { value: 'JOURS_ENTAMES', label: 'Jours entamés (entrée + sortie)' }]} />
          </div>
        </div>
        <div className="cl-rule-help">
          <div className="c">
            <div className="k"><span className="d" />Nuits (par défaut)</div>
            <p>Entrée mardi, sortie jeudi → <b>2 journées</b> facturées (mardi→mercredi, mercredi→jeudi).</p>
          </div>
          <div className="c alt">
            <div className="k"><span className="d" />Jours entamés</div>
            <p>Entrée mardi, sortie jeudi → <b>3 journées</b> facturées (mardi, mercredi, jeudi).</p>
          </div>
        </div>
      </div>
    </section>
  );
}

// ── Tab ────────────────────────────────────────────────────────────────────

export function ChambresLitsTab() {
  const roles = useAuthStore((s) => s.user?.roles ?? []);
  const canManage = roles.includes('MEDECIN') || roles.includes('ADMIN');
  const canSetStatus = canManage || roles.includes('SECRETAIRE') || roles.includes('INFIRMIER');

  return (
    <div className="cl">
      <div className="cl-head">
        <h2>Chambres &amp; lits</h2>
        <p>
          Référentiel des unités d'hospitalisation : déclarez vos services, chambres et lits, et
          définissez les règles de facturation du séjour.
        </p>
      </div>

      {canManage ? (
        <div className="cl-role-note">
          <div className="ic">i</div>
          <div className="t">
            Vous consultez la <b>vue gestionnaire</b> : ajout, désactivation et suppression sont
            disponibles. Les <b>secrétaires et infirmier·e·s</b> peuvent uniquement changer le statut
            manuel d'un lit ; les autres rôles sont en lecture seule.
          </div>
        </div>
      ) : (
        <div className="cl-role-note">
          <div className="ic">i</div>
          <div className="t">
            {canSetStatus
              ? "Vous pouvez changer le statut manuel d'un lit. L'ajout, la désactivation et la suppression sont réservés aux gestionnaires."
              : 'Référentiel en lecture seule. Les modifications sont réservées aux gestionnaires.'}
          </div>
        </div>
      )}

      <div className="cl-legend">
        <span className="lt">Statuts des lits</span>
        <span className="it"><span className="d" style={{ background: 'var(--success)' }} />Libre</span>
        <span className="it"><span className="d" style={{ background: 'var(--danger)' }} />Occupé <span className="sm">· dérivé séjour</span></span>
        <span className="it"><span className="d" style={{ background: 'var(--primary)' }} />Réservé</span>
        <span className="it"><span className="d" style={{ background: 'var(--amber)' }} />Nettoyage</span>
        <span className="it"><span className="d" style={{ background: '#8b8b8b' }} />Hors service</span>
        <span className="note">L'occupation prime sur le statut manuel.</span>
      </div>

      <BedBoardSection />
      <WardsSection canManage={canManage} />
      <RoomsSection canManage={canManage} />
      <BedsSection canManage={canManage} canSetStatus={canSetStatus} />
      <DayRuleSection canManage={canManage} />
      <OrphanRolesPanel module="hospitalization" calm sectionNumber="06" />
    </div>
  );
}
