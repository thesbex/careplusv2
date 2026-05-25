/**
 * Onglet « Chambres & lits » de /parametres — référentiel hospitalisation (Slice A).
 * Visible uniquement si l'établissement a coché `hospitalizationEnabled`.
 *
 * 4 sections : Tableau des lits (board read-only) · Services · Chambres · Lits.
 * Écriture réservée MEDECIN/ADMIN ; le toggle de statut de lit est ouvert aussi
 * à SECRETAIRE/INFIRMIER (bureau des admissions / soignant).
 */
import { useState } from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/Button';
import { Field, FieldLabel } from '@/components/ui/Field';
import { Input } from '@/components/ui/Input';
import { Panel, PanelHeader } from '@/components/ui/Panel';
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
  useRooms,
  useUpdateBedStatus,
  useWards,
  type ManualBedStatus,
  type RoomClass,
  type WardView,
} from '../hooks/useHospitalization';

const SELECT_STYLE: React.CSSProperties = {
  height: 38,
  padding: '0 10px',
  border: '1px solid var(--border)',
  borderRadius: 'var(--r-md)',
  background: 'var(--bg)',
  fontFamily: 'inherit',
  fontSize: 13,
  width: '100%',
};

const ROOM_CLASSES: RoomClass[] = ['INDIVIDUELLE', 'DOUBLE', 'COMMUNE', 'SUITE', 'AUTRE'];
const MANUAL_STATUSES: ManualBedStatus[] = ['LIBRE', 'RESERVE', 'NETTOYAGE', 'HORS_SERVICE'];

function reportError(err: unknown) {
  const problem = toProblemDetail(err);
  if (problem.status === 403) {
    toast.error('Action réservée au médecin / administrateur.');
  } else {
    toast.error(problem.title, problem.detail ? { description: problem.detail } : undefined);
  }
}

// ── Services (wards) ─────────────────────────────────────────────────────

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
    <Panel data-testid="hosp-wards-section">
      <PanelHeader>Services / unités</PanelHeader>
      <div style={{ padding: 16 }}>
        {canManage && (
          <form
            onSubmit={(e) => void handleCreate(e)}
            style={{ display: 'grid', gridTemplateColumns: '160px 1fr auto', gap: 10, marginBottom: 14, alignItems: 'end' }}
          >
            <Field>
              <FieldLabel htmlFor="ward-code">Code *</FieldLabel>
              <Input id="ward-code" value={code} maxLength={32} onChange={(e) => setCode(e.target.value)} placeholder="MAT" />
            </Field>
            <Field>
              <FieldLabel htmlFor="ward-label">Libellé *</FieldLabel>
              <Input id="ward-label" value={label} maxLength={120} onChange={(e) => setLabel(e.target.value)} placeholder="Maternité" />
            </Field>
            <Button type="submit" variant="primary" disabled={creating}>
              {creating ? '…' : '+ Ajouter'}
            </Button>
          </form>
        )}
        {isLoading && <div style={{ color: 'var(--ink-3)', fontSize: 12 }}>Chargement…</div>}
        {error && <div style={{ color: 'var(--danger)', fontSize: 12 }}>{error}</div>}
        {!isLoading && wards.length === 0 && (
          <div style={{ color: 'var(--ink-3)', fontSize: 12 }}>Aucun service déclaré.</div>
        )}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          {wards.map((w) => (
            <div
              key={w.id}
              data-testid={`ward-row-${w.id}`}
              style={{
                display: 'flex', alignItems: 'center', gap: 12, padding: '8px 12px',
                background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 6,
                opacity: w.active ? 1 : 0.55,
              }}
            >
              <span style={{ fontSize: 12, fontWeight: 600, fontFamily: 'monospace', color: 'var(--ink-3)' }}>{w.code}</span>
              <span style={{ fontSize: 13, flex: 1 }}>{w.labelFr}</span>
              {!w.active && <span style={{ fontSize: 11, color: 'var(--ink-3)' }}>Inactif</span>}
              {canManage && w.active && (
                <Button size="sm" variant="ghost" onClick={() => void handleDeactivate(w)} aria-label={`Désactiver ${w.labelFr}`}>
                  Désactiver
                </Button>
              )}
            </div>
          ))}
        </div>
      </div>
    </Panel>
  );
}

// ── Chambres (rooms) ─────────────────────────────────────────────────────

function RoomsSection({ canManage }: { canManage: boolean }) {
  const { wards } = useWards();
  const { rooms, isLoading, error } = useRooms();
  const { createRoom, isPending: creating } = useCreateRoom();
  const { deactivateRoom } = useDeactivateRoom();
  const activeWards = wards.filter((w) => w.active);
  const [wardId, setWardId] = useState('');
  const [code, setCode] = useState('');
  const [label, setLabel] = useState('');
  const [roomClass, setRoomClass] = useState<RoomClass>('INDIVIDUELLE');
  const [dailyRate, setDailyRate] = useState('');

  const wardLabel = (id: string) => wards.find((w) => w.id === id)?.labelFr ?? '—';

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    if (!wardId || !code.trim() || !label.trim()) {
      toast.error('Service, code et libellé requis.');
      return;
    }
    try {
      await createRoom({
        wardId,
        code: code.trim(),
        labelFr: label.trim(),
        roomClass,
        dailyRate: Number(dailyRate) || 0,
      });
      toast.success('Chambre créée.');
      setCode('');
      setLabel('');
      setDailyRate('');
    } catch (err) {
      reportError(err);
    }
  }

  return (
    <Panel data-testid="hosp-rooms-section">
      <PanelHeader>Chambres</PanelHeader>
      <div style={{ padding: 16 }}>
        {canManage && (
          <form
            onSubmit={(e) => void handleCreate(e)}
            style={{ display: 'grid', gridTemplateColumns: '1fr 120px 1fr 160px 140px auto', gap: 10, marginBottom: 14, alignItems: 'end' }}
          >
            <Field>
              <FieldLabel htmlFor="room-ward">Service *</FieldLabel>
              <select id="room-ward" aria-label="Service" value={wardId} onChange={(e) => setWardId(e.target.value)} style={SELECT_STYLE}>
                <option value="">— Choisir —</option>
                {activeWards.map((w) => (
                  <option key={w.id} value={w.id}>{w.labelFr}</option>
                ))}
              </select>
            </Field>
            <Field>
              <FieldLabel htmlFor="room-code">Code *</FieldLabel>
              <Input id="room-code" value={code} maxLength={32} onChange={(e) => setCode(e.target.value)} placeholder="102" />
            </Field>
            <Field>
              <FieldLabel htmlFor="room-label">Libellé *</FieldLabel>
              <Input id="room-label" value={label} maxLength={120} onChange={(e) => setLabel(e.target.value)} placeholder="Chambre 102" />
            </Field>
            <Field>
              <FieldLabel htmlFor="room-class">Classe</FieldLabel>
              <select id="room-class" aria-label="Classe" value={roomClass} onChange={(e) => setRoomClass(e.target.value as RoomClass)} style={SELECT_STYLE}>
                {ROOM_CLASSES.map((c) => (
                  <option key={c} value={c}>{ROOM_CLASS_LABELS[c]}</option>
                ))}
              </select>
            </Field>
            <Field>
              <FieldLabel htmlFor="room-rate">Prix/jour (MAD)</FieldLabel>
              <Input id="room-rate" type="number" min={0} step="10" value={dailyRate} onChange={(e) => setDailyRate(e.target.value)} placeholder="400" />
            </Field>
            <Button type="submit" variant="primary" disabled={creating}>
              {creating ? '…' : '+ Ajouter'}
            </Button>
          </form>
        )}
        {isLoading && <div style={{ color: 'var(--ink-3)', fontSize: 12 }}>Chargement…</div>}
        {error && <div style={{ color: 'var(--danger)', fontSize: 12 }}>{error}</div>}
        {!isLoading && rooms.length === 0 && (
          <div style={{ color: 'var(--ink-3)', fontSize: 12 }}>Aucune chambre déclarée.</div>
        )}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          {rooms.map((r) => (
            <div
              key={r.id}
              data-testid={`room-row-${r.id}`}
              style={{
                display: 'flex', alignItems: 'center', gap: 12, padding: '8px 12px',
                background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 6,
                opacity: r.active ? 1 : 0.55, flexWrap: 'wrap',
              }}
            >
              <span style={{ fontSize: 12, fontWeight: 600, fontFamily: 'monospace', color: 'var(--ink-3)' }}>{r.code}</span>
              <span style={{ fontSize: 13, flex: 1, minWidth: 140 }}>{r.labelFr}</span>
              <span style={{ fontSize: 11.5, color: 'var(--ink-3)' }}>{wardLabel(r.wardId)}</span>
              <span style={{ fontSize: 11, padding: '2px 8px', borderRadius: 999, background: 'var(--bg-alt)', color: 'var(--ink-2)' }}>
                {ROOM_CLASS_LABELS[r.roomClass]}
              </span>
              <span style={{ fontSize: 12.5, fontWeight: 600 }}>{r.dailyRate.toLocaleString('fr-MA')} MAD/j</span>
              {!r.active && <span style={{ fontSize: 11, color: 'var(--ink-3)' }}>Inactive</span>}
              {canManage && r.active && (
                <Button size="sm" variant="ghost" onClick={() => void deactivateRoom(r.id).then(() => toast.success('Chambre désactivée.')).catch(reportError)} aria-label={`Désactiver ${r.labelFr}`}>
                  Désactiver
                </Button>
              )}
            </div>
          ))}
        </div>
      </div>
    </Panel>
  );
}

// ── Lits (beds) ──────────────────────────────────────────────────────────

function BedsSection({ canManage, canSetStatus }: { canManage: boolean; canSetStatus: boolean }) {
  const { rooms } = useRooms();
  const { beds, isLoading, error } = useBeds();
  const { createBed, isPending: creating } = useCreateBed();
  const { deactivateBed } = useDeactivateBed();
  const { updateBedStatus } = useUpdateBedStatus();
  const activeRooms = rooms.filter((r) => r.active);
  const [roomId, setRoomId] = useState('');
  const [code, setCode] = useState('');

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

  return (
    <Panel data-testid="hosp-beds-section">
      <PanelHeader>Lits</PanelHeader>
      <div style={{ padding: 16 }}>
        {canManage && (
          <form
            onSubmit={(e) => void handleCreate(e)}
            style={{ display: 'grid', gridTemplateColumns: '1fr 160px auto', gap: 10, marginBottom: 14, alignItems: 'end' }}
          >
            <Field>
              <FieldLabel htmlFor="bed-room">Chambre *</FieldLabel>
              <select id="bed-room" aria-label="Chambre" value={roomId} onChange={(e) => setRoomId(e.target.value)} style={SELECT_STYLE}>
                <option value="">— Choisir —</option>
                {activeRooms.map((r) => (
                  <option key={r.id} value={r.id}>{r.labelFr}</option>
                ))}
              </select>
            </Field>
            <Field>
              <FieldLabel htmlFor="bed-code">Code lit *</FieldLabel>
              <Input id="bed-code" value={code} maxLength={32} onChange={(e) => setCode(e.target.value)} placeholder="Lit A" />
            </Field>
            <Button type="submit" variant="primary" disabled={creating}>
              {creating ? '…' : '+ Ajouter'}
            </Button>
          </form>
        )}
        {isLoading && <div style={{ color: 'var(--ink-3)', fontSize: 12 }}>Chargement…</div>}
        {error && <div style={{ color: 'var(--danger)', fontSize: 12 }}>{error}</div>}
        {!isLoading && beds.length === 0 && (
          <div style={{ color: 'var(--ink-3)', fontSize: 12 }}>Aucun lit déclaré.</div>
        )}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          {beds.map((b) => (
            <div
              key={b.id}
              data-testid={`bed-row-${b.id}`}
              style={{
                display: 'flex', alignItems: 'center', gap: 12, padding: '8px 12px',
                background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 6,
                opacity: b.active ? 1 : 0.55, flexWrap: 'wrap',
              }}
            >
              <span style={{ fontSize: 13, fontWeight: 600, flex: 1, minWidth: 120 }}>{b.code}</span>
              <span style={{ fontSize: 11.5, color: 'var(--ink-3)' }}>{roomLabel(b.roomId)}</span>
              {b.status === 'OCCUPE' || !canSetStatus ? (
                <span style={{ fontSize: 12, padding: '2px 10px', borderRadius: 999, background: 'var(--bg-alt)', color: 'var(--ink-2)' }}>
                  {BED_STATUS_LABELS[b.status]}
                </span>
              ) : (
                <select
                  aria-label={`Statut du lit ${b.code}`}
                  value={b.status}
                  onChange={(e) => void handleStatus(b.id, e.target.value as ManualBedStatus)}
                  style={{ ...SELECT_STYLE, width: 150, height: 32 }}
                >
                  {MANUAL_STATUSES.map((s) => (
                    <option key={s} value={s}>{BED_STATUS_LABELS[s]}</option>
                  ))}
                </select>
              )}
              {!b.active && <span style={{ fontSize: 11, color: 'var(--ink-3)' }}>Inactif</span>}
              {canManage && b.active && (
                <Button size="sm" variant="ghost" onClick={() => void deactivateBed(b.id).then(() => toast.success('Lit désactivé.')).catch(reportError)} aria-label={`Désactiver ${b.code}`}>
                  Désactiver
                </Button>
              )}
            </div>
          ))}
        </div>
      </div>
    </Panel>
  );
}

// ── Tableau des lits (board) ─────────────────────────────────────────────

const STATUS_COLORS: Record<string, string> = {
  LIBRE: '#16a34a',
  OCCUPE: '#dc2626',
  RESERVE: '#d97706',
  NETTOYAGE: '#2563eb',
  HORS_SERVICE: '#6b7280',
};

function BedBoardSection() {
  const { board, isLoading, error } = useBedBoard();

  return (
    <Panel data-testid="hosp-board-section">
      <PanelHeader>Tableau des lits</PanelHeader>
      <div style={{ padding: 16 }}>
        {isLoading && <div style={{ color: 'var(--ink-3)', fontSize: 12 }}>Chargement…</div>}
        {error && <div style={{ color: 'var(--danger)', fontSize: 12 }}>{error}</div>}
        {!isLoading && board.wards.length === 0 && (
          <div style={{ color: 'var(--ink-3)', fontSize: 12 }}>
            Aucun service / lit configuré. Ajoutez un service puis des chambres et des lits ci-dessous.
          </div>
        )}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {board.wards.map((w) => (
            <div key={w.wardId}>
              <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 8 }}>{w.wardLabel}</div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10 }}>
                {w.rooms.map((r) => (
                  <div key={r.roomId} style={{ border: '1px solid var(--border)', borderRadius: 8, padding: 10, minWidth: 160 }}>
                    <div style={{ fontSize: 12.5, fontWeight: 600 }}>{r.roomLabel}</div>
                    <div style={{ fontSize: 11, color: 'var(--ink-3)', marginBottom: 8 }}>
                      {ROOM_CLASS_LABELS[r.roomClass]} · {r.dailyRate.toLocaleString('fr-MA')} MAD/j
                    </div>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                      {r.beds.length === 0 && <span style={{ fontSize: 11, color: 'var(--ink-3)' }}>—</span>}
                      {r.beds.map((b) => (
                        <span
                          key={b.id}
                          title={BED_STATUS_LABELS[b.status]}
                          style={{
                            display: 'inline-flex', alignItems: 'center', gap: 5,
                            fontSize: 11, padding: '3px 8px', borderRadius: 6,
                            background: 'var(--surface)', border: '1px solid var(--border)',
                          }}
                        >
                          <span style={{ width: 8, height: 8, borderRadius: 999, background: STATUS_COLORS[b.status] ?? '#999' }} />
                          {b.code}
                        </span>
                      ))}
                    </div>
                  </div>
                ))}
                {w.rooms.length === 0 && <span style={{ fontSize: 11, color: 'var(--ink-3)' }}>Aucune chambre.</span>}
              </div>
            </div>
          ))}
        </div>
      </div>
    </Panel>
  );
}

// ── Règle de facturation (D2) ────────────────────────────────────────────

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
    <Panel data-testid="hosp-day-rule-section">
      <PanelHeader>Facturation du séjour — comptage des journées</PanelHeader>
      <div style={{ padding: 16 }}>
        <div style={{ fontSize: 12, color: 'var(--ink-3)', marginBottom: 10 }}>
          Détermine comment les nuits sont comptées sur la facture de séjour. « Nuits » compte les
          nuits passées ; « Jours entamés » compte le jour d'entrée ET de sortie (usage clinique fréquent).
        </div>
        <select
          aria-label="Règle de comptage des journées"
          value={stayBillingDayRule}
          disabled={!canManage || isPending}
          onChange={(e) => void change(e.target.value as 'NUITS' | 'JOURS_ENTAMES')}
          style={{ ...SELECT_STYLE, maxWidth: 280 }}
        >
          <option value="NUITS">Nuits (par défaut)</option>
          <option value="JOURS_ENTAMES">Jours entamés (entrée + sortie)</option>
        </select>
      </div>
    </Panel>
  );
}

// ── Tab ──────────────────────────────────────────────────────────────────

export function ChambresLitsTab() {
  const roles = useAuthStore((s) => s.user?.roles ?? []);
  const canManage = roles.includes('MEDECIN') || roles.includes('ADMIN');
  const canSetStatus = canManage || roles.includes('SECRETAIRE') || roles.includes('INFIRMIER');

  return (
    <>
      <BedBoardSection />
      <div style={{ height: 16 }} />
      <WardsSection canManage={canManage} />
      <div style={{ height: 16 }} />
      <RoomsSection canManage={canManage} />
      <div style={{ height: 16 }} />
      <BedsSection canManage={canManage} canSetStatus={canSetStatus} />
      <div style={{ height: 16 }} />
      <DayRuleSection canManage={canManage} />
      <div style={{ height: 16 }} />
      <OrphanRolesPanel module="hospitalization" />
    </>
  );
}
