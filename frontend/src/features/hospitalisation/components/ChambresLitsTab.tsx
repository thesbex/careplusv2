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
import { useT, type I18nContextValue } from '@/lib/i18n/I18nProvider';
import {
  BED_STATUS_KEYS,
  ROOM_CLASS_KEYS,
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

type T = I18nContextValue['t'];

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

/**
 * Rend une chaîne traduite contenant des segments `<b>…</b>` en JSX (les autres
 * balises ne sont pas interprétées). `t()` renvoyant une chaîne plate, on parse
 * ici plutôt que d'utiliser dangerouslySetInnerHTML.
 */
function RichText({ text }: { text: string }) {
  const parts = text.split(/(<b>.*?<\/b>)/g);
  return (
    <>
      {parts.map((p, i) =>
        p.startsWith('<b>') && p.endsWith('</b>')
          ? <b key={i}>{p.slice(3, -4)}</b>
          : <span key={i}>{p}</span>,
      )}
    </>
  );
}

function reportError(err: unknown, t: T) {
  const problem = toProblemDetail(err);
  if (problem.status === 403) {
    toast.error(t('hospit.cl.error403'));
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
  const { t } = useT();
  const { board, isLoading, error } = useBedBoard();
  const totalBeds = useMemo(
    () => board.wards.reduce((s, w) => s + w.rooms.reduce((n, r) => n + r.beds.length, 0), 0),
    [board],
  );

  return (
    <section className="cl-panel" data-testid="hosp-board-section">
      <div className="cl-panel-h">
        <span className="ix">01</span>
        <h3>{t('hospit.cl.board.title')}</h3>
        <span className="meta">{t('hospit.cl.board.meta')}</span>
        {board.wards.length > 0 && (
          <span className="right">
            {t(
              totalBeds > 1
                ? (board.wards.length > 1 ? 'hospit.cl.board.summaryBoth' : 'hospit.cl.board.summaryBedsPlural')
                : (board.wards.length > 1 ? 'hospit.cl.board.summaryWardsPlural' : 'hospit.cl.board.summary'),
              { beds: totalBeds, wards: board.wards.length },
            )}
          </span>
        )}
      </div>
      <div className="cl-panel-b">
        {isLoading && <div className="cl-empty">{t('hospit.cl.board.loading')}</div>}
        {error && <div className="cl-empty" style={{ color: 'var(--danger)' }}>{t(error)}</div>}
        {!isLoading && board.wards.length === 0 && (
          <div className="cl-empty">{t('hospit.cl.board.empty')}</div>
        )}
        {board.wards.map((w) => {
          const beds = w.rooms.reduce((n, r) => n + r.beds.length, 0);
          return (
            <div className="cl-svc-group" key={w.wardId}>
              <div className="cl-svc-h">
                <span className="scode">{w.wardCode}</span>
                <span className="sname">{w.wardLabel}</span>
                <span className="scount">
                  {t(
                    w.rooms.length > 1
                      ? (beds > 1 ? 'hospit.cl.board.svcCountBoth' : 'hospit.cl.board.svcCountRoomsPlural')
                      : (beds > 1 ? 'hospit.cl.board.svcCountBedsPlural' : 'hospit.cl.board.svcCount'),
                    { rooms: w.rooms.length, beds },
                  )}
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
                      {t('hospit.cl.board.rateLine', { roomClass: t(ROOM_CLASS_KEYS[r.roomClass]), rate: r.dailyRate.toLocaleString('fr-MA') })}
                    </div>
                    <div className="beds">
                      {r.beds.length === 0 && <span className="cl-ro-hint">{t('hospit.cl.board.noBed')}</span>}
                      {r.beds.map((b) => (
                        <span className={`cl-bedchip ${STATUS_CLASS[b.status]}`} key={b.id}>
                          <span className="d" />
                          {b.code}
                          <span className="st">· {t(BED_STATUS_KEYS[b.status])}</span>
                        </span>
                      ))}
                    </div>
                  </div>
                ))}
                {w.rooms.length === 0 && <span className="cl-ro-hint">{t('hospit.cl.board.noRoom')}</span>}
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
  const { t } = useT();
  const { wards, isLoading, error } = useWards();
  const { createWard, isPending: creating } = useCreateWard();
  const { deactivateWard } = useDeactivateWard();
  const [code, setCode] = useState('');
  const [label, setLabel] = useState('');

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    if (!code.trim() || !label.trim()) {
      toast.error(t('hospit.cl.wards.errRequired'));
      return;
    }
    try {
      await createWard({ code: code.trim(), labelFr: label.trim() });
      toast.success(t('hospit.cl.wards.created'));
      setCode('');
      setLabel('');
    } catch (err) {
      reportError(err, t);
    }
  }

  async function handleDeactivate(w: WardView) {
    if (!confirm(t('hospit.cl.wards.confirmDeactivate', { label: w.labelFr }))) return;
    try {
      await deactivateWard(w.id);
      toast.success(t('hospit.cl.wards.deactivated'));
    } catch (err) {
      reportError(err, t);
    }
  }

  return (
    <section className="cl-panel" data-testid="hosp-wards-section">
      <div className="cl-panel-h"><span className="ix">02</span><h3>{t('hospit.cl.wards.title')}</h3></div>
      <div className="cl-panel-b">
        {canManage && (
          <form className="cl-addform svc" onSubmit={(e) => void handleCreate(e)}>
            <div className="cl-field">
              <label className="cl-lbl" htmlFor="ward-code">{t('hospit.cl.wards.code')} <span className="req">*</span></label>
              <input id="ward-code" className="cl-inp mono" value={code} maxLength={32}
                onChange={(e) => setCode(e.target.value)} placeholder={t('hospit.cl.wards.codePlaceholder')} />
            </div>
            <div className="cl-field">
              <label className="cl-lbl" htmlFor="ward-label">{t('hospit.cl.wards.label')} <span className="req">*</span></label>
              <input id="ward-label" className="cl-inp" value={label} maxLength={120}
                onChange={(e) => setLabel(e.target.value)} placeholder={t('hospit.cl.wards.labelPlaceholder')} />
            </div>
            <button type="submit" className="cl-btn-add" disabled={creating}>
              <PlusIcon /> {creating ? t('hospit.cl.wards.adding') : t('hospit.cl.wards.add')}
            </button>
          </form>
        )}
        {isLoading && <div className="cl-empty">{t('hospit.cl.wards.loading')}</div>}
        {error && <div className="cl-empty" style={{ color: 'var(--danger)' }}>{t(error)}</div>}
        {!isLoading && wards.length === 0 && <div className="cl-empty">{t('hospit.cl.wards.empty')}</div>}
        {wards.length > 0 && (
          <div className="cl-rhead svc"><span>{t('hospit.cl.wards.colCode')}</span><span>{t('hospit.cl.wards.colLabel')}</span><span /></div>
        )}
        <div className="cl-rows svc">
          {wards.map((w) => (
            <div className={`cl-rrow${w.active ? '' : ' off'}`} key={w.id} data-testid={`ward-row-${w.id}`}>
              <span className="code">{w.code}</span>
              <span className="name">
                {w.labelFr}
                {!w.active && <span className="cl-badge-off">{t('hospit.cl.wards.inactive')}</span>}
              </span>
              <div className="acts">
                {canManage && w.active && (
                  <button type="button" className="cl-btn-ghost"
                    onClick={() => void handleDeactivate(w)} aria-label={t('hospit.cl.wards.deactivateAria', { label: w.labelFr })}>
                    {t('hospit.cl.wards.deactivate')}
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
  const { t } = useT();
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
      toast.error(t('hospit.cl.rooms.errRequired'));
      return;
    }
    const rate = Number(dailyRate);
    if (!dailyRate.trim() || Number.isNaN(rate) || rate <= 0) {
      toast.error(t('hospit.cl.rooms.errRate'));
      return;
    }
    try {
      await createRoom({ wardId, code: code.trim(), labelFr: label.trim(), roomClass, dailyRate: rate });
      toast.success(t('hospit.cl.rooms.created'));
      setCode('');
      setLabel('');
      setDailyRate('');
    } catch (err) {
      reportError(err, t);
    }
  }

  async function handleDeactivate(id: string) {
    try {
      await deactivateRoom(id);
      toast.success(t('hospit.cl.rooms.deactivated'));
    } catch (err) {
      reportError(err, t);
    }
  }

  async function handleDelete(id: string, labelFr: string) {
    if (!confirm(t('hospit.cl.rooms.confirmDelete', { label: labelFr }))) return;
    setDelErr(null);
    try {
      await deleteRoom(id);
      toast.success(t('hospit.cl.rooms.deleted'));
    } catch (err) {
      const p = toProblemDetail(err);
      if (p.code === 'ROOM_HAS_BEDS_DELETE') {
        setDelErr(id);
        return;
      }
      reportError(err, t);
    }
  }

  return (
    <section className="cl-panel" data-testid="hosp-rooms-section">
      <div className="cl-panel-h"><span className="ix">03</span><h3>{t('hospit.cl.rooms.title')}</h3></div>
      <div className="cl-panel-b">
        {canManage && (
          <form className="cl-addform cham" onSubmit={(e) => void handleCreate(e)}>
            <div className="cl-field">
              <label className="cl-lbl" htmlFor="room-ward">{t('hospit.cl.rooms.ward')} <span className="req">*</span></label>
              <SelectMenu id="room-ward" className="cl-selm" ariaLabel={t('hospit.cl.rooms.wardAria')} value={wardId}
                onChange={(e) => setWardId(e.target.value)}
                options={[{ value: '', label: t('hospit.cl.rooms.choose') },
                  ...activeWards.map((w) => ({ value: w.id, label: w.labelFr }))]} />
            </div>
            <div className="cl-field">
              <label className="cl-lbl" htmlFor="room-code">{t('hospit.cl.rooms.code')} <span className="req">*</span></label>
              <input id="room-code" className="cl-inp mono" value={code} maxLength={32}
                onChange={(e) => setCode(e.target.value)} placeholder={t('hospit.cl.rooms.codePlaceholder')} />
            </div>
            <div className="cl-field">
              <label className="cl-lbl" htmlFor="room-label">{t('hospit.cl.rooms.label')} <span className="req">*</span></label>
              <input id="room-label" className="cl-inp" value={label} maxLength={120}
                onChange={(e) => setLabel(e.target.value)} placeholder={t('hospit.cl.rooms.labelPlaceholder')} />
            </div>
            <div className="cl-field">
              <label className="cl-lbl" htmlFor="room-class">{t('hospit.cl.rooms.class')}</label>
              <SelectMenu id="room-class" className="cl-selm" ariaLabel={t('hospit.cl.rooms.classAria')} value={roomClass}
                onChange={(e) => setRoomClass(e.target.value as RoomClass)}
                options={ROOM_CLASSES.map((c) => ({ value: c, label: t(ROOM_CLASS_KEYS[c]) }))} />
            </div>
            <div className="cl-field">
              <label className="cl-lbl" htmlFor="room-rate">{t('hospit.cl.rooms.rate')} <span className="req">*</span></label>
              <input id="room-rate" className="cl-inp mono" type="number" min={1} step="10" required
                value={dailyRate} onChange={(e) => setDailyRate(e.target.value)} placeholder={t('hospit.cl.rooms.ratePlaceholder')} />
            </div>
            <button type="submit" className="cl-btn-add" disabled={creating}>
              <PlusIcon /> {creating ? t('hospit.cl.rooms.adding') : t('hospit.cl.rooms.add')}
            </button>
          </form>
        )}
        {isLoading && <div className="cl-empty">{t('hospit.cl.rooms.loading')}</div>}
        {error && <div className="cl-empty" style={{ color: 'var(--danger)' }}>{t(error)}</div>}
        {!isLoading && rooms.length === 0 && <div className="cl-empty">{t('hospit.cl.rooms.empty')}</div>}
        {rooms.length > 0 && (
          <div className="cl-rhead cham">
            <span>{t('hospit.cl.rooms.colCode')}</span><span>{t('hospit.cl.rooms.colRoom')}</span><span>{t('hospit.cl.rooms.colWard')}</span>
            <span>{t('hospit.cl.rooms.colClass')}</span><span>{t('hospit.cl.rooms.colRate')}</span><span />
          </div>
        )}
        <div className="cl-rows cham">
          {rooms.map((r) => (
            <div key={r.id} data-testid={`room-row-${r.id}`}>
              <div className={`cl-rrow${r.active ? '' : ' off'}`}>
                <span className="code">{r.code}</span>
                <span className="name">
                  {r.labelFr}
                  {!r.active && <span className="cl-badge-off">{t('hospit.cl.rooms.inactive')}</span>}
                </span>
                <span className="sub">{wardLabel(r.wardId)}</span>
                <span><span className="cl-cls"><span className="d" />{t(ROOM_CLASS_KEYS[r.roomClass])}</span></span>
                <span className="price">{t('hospit.cl.rooms.rateValue', { rate: r.dailyRate.toLocaleString('fr-MA') })}</span>
                <div className="acts">
                  {canManage && r.active && (
                    <button type="button" className="cl-btn-ghost"
                      onClick={() => void handleDeactivate(r.id)} aria-label={t('hospit.cl.rooms.deactivateAria', { label: r.labelFr })}>
                      {t('hospit.cl.rooms.deactivate')}
                    </button>
                  )}
                  {canManage && (
                    <button type="button" className="cl-btn-ghost danger"
                      onClick={() => void handleDelete(r.id, r.labelFr)} aria-label={t('hospit.cl.rooms.deleteAria', { label: r.labelFr })}>
                      {t('hospit.cl.rooms.delete')}
                    </button>
                  )}
                </div>
              </div>
              {delErr === r.id && (
                <div className="cl-errstrip" role="alert">
                  <div className="ic">!</div>
                  <div className="t"><b>{t('hospit.cl.rooms.notEmptyTitle')}</b> {t('hospit.cl.rooms.notEmptyHint')}</div>
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
  const { t } = useT();
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
      toast.error(t('hospit.cl.beds.errRequired'));
      return;
    }
    try {
      await createBed({ roomId, code: code.trim() });
      toast.success(t('hospit.cl.beds.created'));
      setCode('');
    } catch (err) {
      reportError(err, t);
    }
  }

  async function handleStatus(id: string, status: ManualBedStatus) {
    try {
      await updateBedStatus({ id, status });
    } catch (err) {
      reportError(err, t);
    }
  }

  async function handleDeactivate(id: string) {
    try {
      await deactivateBed(id);
      toast.success(t('hospit.cl.beds.deactivated'));
    } catch (err) {
      reportError(err, t);
    }
  }

  async function handleDelete(id: string, bedCode: string) {
    if (!confirm(t('hospit.cl.beds.confirmDelete', { code: bedCode }))) return;
    setDelErr(null);
    try {
      await deleteBed(id);
      toast.success(t('hospit.cl.beds.deleted'));
    } catch (err) {
      const p = toProblemDetail(err);
      if (p.code === 'BED_HAS_HISTORY') {
        setDelErr(id);
        return;
      }
      reportError(err, t);
    }
  }

  return (
    <section className="cl-panel" data-testid="hosp-beds-section">
      <div className="cl-panel-h"><span className="ix">04</span><h3>{t('hospit.cl.beds.title')}</h3></div>
      <div className="cl-panel-b">
        {canManage && (
          <form className="cl-addform lit" onSubmit={(e) => void handleCreate(e)}>
            <div className="cl-field">
              <label className="cl-lbl" htmlFor="bed-room">{t('hospit.cl.beds.room')} <span className="req">*</span></label>
              <SelectMenu id="bed-room" className="cl-selm" ariaLabel={t('hospit.cl.beds.roomAria')} value={roomId}
                onChange={(e) => setRoomId(e.target.value)}
                options={[{ value: '', label: t('hospit.cl.beds.choose') },
                  ...activeRooms.map((r) => ({ value: r.id, label: r.labelFr }))]} />
            </div>
            <div className="cl-field">
              <label className="cl-lbl" htmlFor="bed-code">{t('hospit.cl.beds.code')} <span className="req">*</span></label>
              <input id="bed-code" className="cl-inp" value={code} maxLength={32}
                onChange={(e) => setCode(e.target.value)} placeholder={t('hospit.cl.beds.codePlaceholder')} />
            </div>
            <button type="submit" className="cl-btn-add" disabled={creating}>
              <PlusIcon /> {creating ? t('hospit.cl.beds.adding') : t('hospit.cl.beds.add')}
            </button>
          </form>
        )}
        {isLoading && <div className="cl-empty">{t('hospit.cl.beds.loading')}</div>}
        {error && <div className="cl-empty" style={{ color: 'var(--danger)' }}>{t(error)}</div>}
        {!isLoading && beds.length === 0 && <div className="cl-empty">{t('hospit.cl.beds.empty')}</div>}
        {beds.length > 0 && (
          <div className="cl-rhead lit"><span>{t('hospit.cl.beds.colCode')}</span><span>{t('hospit.cl.beds.colRoom')}</span><span>{t('hospit.cl.beds.colStatus')}</span><span /></div>
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
                          <span className="d" />{t(BED_STATUS_KEYS[b.status])}
                        </span>
                        {b.status === 'OCCUPE' && <span className="cl-ro-hint">{t('hospit.cl.beds.derivedStay')}</span>}
                      </>
                    ) : (
                      <span className={`cl-statsel ${STATUS_CLASS[b.status]}`}>
                        <span className="d" />
                        <select aria-label={t('hospit.cl.beds.statusAria', { code: b.code })} value={b.status}
                          onChange={(e) => void handleStatus(b.id, e.target.value as ManualBedStatus)}>
                          {MANUAL_STATUSES.map((s) => <option key={s} value={s}>{t(BED_STATUS_KEYS[s])}</option>)}
                        </select>
                      </span>
                    )}
                  </span>
                  <div className="acts">
                    {canManage && b.active && (
                      <button type="button" className="cl-btn-ghost"
                        onClick={() => void handleDeactivate(b.id)} aria-label={t('hospit.cl.beds.deactivateAria', { code: b.code })}>
                        {t('hospit.cl.beds.deactivate')}
                      </button>
                    )}
                    {canManage && (
                      <button type="button" className="cl-btn-ghost danger"
                        onClick={() => void handleDelete(b.id, b.code)} aria-label={t('hospit.cl.beds.deleteAria', { code: b.code })}>
                        {t('hospit.cl.beds.delete')}
                      </button>
                    )}
                  </div>
                </div>
                {delErr === b.id && (
                  <div className="cl-errstrip" role="alert">
                    <div className="ic">!</div>
                    <div className="t"><b>{t('hospit.cl.beds.inUseTitle')}</b> {t('hospit.cl.beds.inUseHint')}</div>
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
  const { t } = useT();
  const { settings, stayBillingDayRule } = useAgendaIsolation();
  const { updateAgendaIsolation, isPending } = useUpdateAgendaIsolation();

  async function change(rule: 'NUITS' | 'JOURS_ENTAMES') {
    if (!settings) return;
    try {
      await updateAgendaIsolation({ settings, stayBillingDayRule: rule });
      toast.success(t('hospit.cl.rule.updated'));
    } catch (err) {
      reportError(err, t);
    }
  }

  return (
    <section className="cl-panel" data-testid="hosp-day-rule-section">
      <div className="cl-panel-h">
        <span className="ix">05</span>
        <h3>{t('hospit.cl.rule.title')}</h3>
      </div>
      <div className="cl-panel-b">
        <p className="cl-help" style={{ margin: '0 0 14px', fontSize: 12.5, maxWidth: 680 }}>
          <RichText text={t('hospit.cl.rule.help', {
            nuits: `<b>${t('hospit.cl.rule.helpNuits')}</b>`,
            jours: `<b>${t('hospit.cl.rule.helpJours')}</b>`,
          })} />
        </p>
        <div className="cl-rule-row">
          <div className="cl-field" style={{ maxWidth: 340 }}>
            <label className="cl-lbl" htmlFor="day-rule">{t('hospit.cl.rule.label')}</label>
            <SelectMenu id="day-rule" className="cl-selm" ariaLabel={t('hospit.cl.rule.aria')}
              value={stayBillingDayRule} disabled={!canManage || isPending}
              onChange={(e) => void change(e.target.value as 'NUITS' | 'JOURS_ENTAMES')}
              options={[{ value: 'NUITS', label: t('hospit.cl.rule.optNuits') },
                { value: 'JOURS_ENTAMES', label: t('hospit.cl.rule.optJours') }]} />
          </div>
        </div>
        <div className="cl-rule-help">
          <div className="c">
            <div className="k"><span className="d" />{t('hospit.cl.rule.nuitsTitle')}</div>
            <p><RichText text={t('hospit.cl.rule.nuitsExample')} /></p>
          </div>
          <div className="c alt">
            <div className="k"><span className="d" />{t('hospit.cl.rule.joursTitle')}</div>
            <p><RichText text={t('hospit.cl.rule.joursExample')} /></p>
          </div>
        </div>
      </div>
    </section>
  );
}

// ── Tab ────────────────────────────────────────────────────────────────────

export function ChambresLitsTab() {
  const { t } = useT();
  const roles = useAuthStore((s) => s.user?.roles ?? []);
  const canManage = roles.includes('MEDECIN') || roles.includes('ADMIN');
  const canSetStatus = canManage || roles.includes('SECRETAIRE') || roles.includes('INFIRMIER');

  return (
    <div className="cl">
      <div className="cl-head">
        <h2>{t('hospit.cl.title')}</h2>
        <p>{t('hospit.cl.intro')}</p>
      </div>

      {canManage ? (
        <div className="cl-role-note">
          <div className="ic">i</div>
          <div className="t"><RichText text={t('hospit.cl.role.manager')} /></div>
        </div>
      ) : (
        <div className="cl-role-note">
          <div className="ic">i</div>
          <div className="t">
            {canSetStatus ? t('hospit.cl.role.setStatus') : t('hospit.cl.role.readonly')}
          </div>
        </div>
      )}

      <div className="cl-legend">
        <span className="lt">{t('hospit.cl.legend.title')}</span>
        <span className="it"><span className="d" style={{ background: 'var(--success)' }} />{t('hospit.cl.legend.libre')}</span>
        <span className="it"><span className="d" style={{ background: 'var(--danger)' }} />{t('hospit.cl.legend.occupe')} <span className="sm">{t('hospit.cl.legend.derivedStay')}</span></span>
        <span className="it"><span className="d" style={{ background: 'var(--primary)' }} />{t('hospit.cl.legend.reserve')}</span>
        <span className="it"><span className="d" style={{ background: 'var(--amber)' }} />{t('hospit.cl.legend.nettoyage')}</span>
        <span className="it"><span className="d" style={{ background: '#8b8b8b' }} />{t('hospit.cl.legend.horsService')}</span>
        <span className="note">{t('hospit.cl.legend.note')}</span>
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
