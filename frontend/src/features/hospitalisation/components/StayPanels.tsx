/**
 * Panneaux séjour partagés desktop + mobile : admission, détail (transfert /
 * sortie / facturation). Logique unique pour garantir la parité 390 px.
 */
import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { Button } from '@/components/ui/Button';
import { Field, FieldLabel } from '@/components/ui/Field';
import { Input } from '@/components/ui/Input';
import { Panel, PanelHeader } from '@/components/ui/Panel';
import { api } from '@/lib/api/client';
import { toProblemDetail } from '@/lib/api/problemJson';
import { useBedBoard } from '../hooks/useHospitalization';
import {
  DISCHARGE_TYPE_LABELS,
  useAdmit,
  useCancelStay,
  useDischarge,
  useGenerateStayInvoice,
  useRecordStayVitals,
  useStayDetail,
  useStayVitals,
  useTransfer,
  type DischargeType,
  type StayVitalsPayload,
} from '../hooks/useStays';

export const SELECT_STYLE: React.CSSProperties = {
  height: 38, padding: '0 10px', border: '1px solid var(--border)', borderRadius: 'var(--r-md)',
  background: 'var(--bg)', fontFamily: 'inherit', fontSize: 13, width: '100%',
};

interface PatientHit { id: string; firstName: string; lastName: string; phone: string | null; }

export function reportError(err: unknown) {
  const p = toProblemDetail(err);
  toast.error(p.title, p.detail ? { description: p.detail } : undefined);
}

/** Liste des lits libres (board, statut LIBRE/RESERVE). */
export function useFreeBeds() {
  const { board } = useBedBoard();
  return useMemo(() => {
    const beds: { id: string; label: string }[] = [];
    for (const w of board.wards) {
      for (const r of w.rooms) {
        for (const b of r.beds) {
          if (b.status === 'LIBRE' || b.status === 'RESERVE') {
            beds.push({ id: b.id, label: `${w.wardLabel} · ${r.roomLabel} · ${b.code}` });
          }
        }
      }
    }
    return beds;
  }, [board]);
}

export function AdmissionForm({ onDone }: { onDone: () => void }) {
  const { admit, isPending } = useAdmit();
  const freeBeds = useFreeBeds();
  const [q, setQ] = useState('');
  const [hits, setHits] = useState<PatientHit[]>([]);
  const [selected, setSelected] = useState<PatientHit | null>(null);
  const [bedId, setBedId] = useState('');
  const [reason, setReason] = useState('');

  async function search(value: string) {
    setQ(value);
    if (value.trim().length < 2) { setHits([]); return; }
    try {
      const r = await api.get<{ content: PatientHit[] }>(
        `/patients?q=${encodeURIComponent(value.trim())}&size=8`);
      setHits(r.data.content);
    } catch { /* silencieux */ }
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!selected || !bedId) { toast.error('Patient et lit requis.'); return; }
    try {
      await admit({ patientId: selected.id, bedId, ...(reason.trim() ? { admissionReason: reason.trim() } : {}) });
      toast.success(`${selected.firstName} ${selected.lastName} admis(e).`);
      onDone();
    } catch (err) { reportError(err); }
  }

  return (
    <Panel data-testid="admission-form">
      <PanelHeader>Nouvelle admission</PanelHeader>
      <form onSubmit={(e) => void submit(e)} style={{ padding: 16, display: 'flex', flexDirection: 'column', gap: 12 }}>
        <Field>
          <FieldLabel htmlFor="adm-patient">Patient *</FieldLabel>
          {selected ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <span style={{ fontSize: 13, fontWeight: 600 }}>{selected.firstName} {selected.lastName}</span>
              <Button size="sm" variant="ghost" type="button" onClick={() => { setSelected(null); setQ(''); }}>Changer</Button>
            </div>
          ) : (
            <>
              <Input id="adm-patient" value={q} onChange={(e) => void search(e.target.value)}
                placeholder="Rechercher par nom, téléphone, CIN…" />
              {hits.length > 0 && (
                <div style={{ border: '1px solid var(--border)', borderRadius: 6, marginTop: 4, maxHeight: 200, overflow: 'auto' }}>
                  {hits.map((h) => (
                    <button key={h.id} type="button" onClick={() => { setSelected(h); setHits([]); }}
                      style={{ display: 'block', width: '100%', textAlign: 'left', padding: '8px 12px',
                        background: 'var(--surface)', border: 'none', borderBottom: '1px solid var(--border)',
                        cursor: 'pointer', fontSize: 13 }}>
                      {h.lastName} {h.firstName} {h.phone ? `· ${h.phone}` : ''}
                    </button>
                  ))}
                </div>
              )}
            </>
          )}
        </Field>
        <Field>
          <FieldLabel htmlFor="adm-bed">Lit *</FieldLabel>
          <select id="adm-bed" aria-label="Lit" value={bedId} onChange={(e) => setBedId(e.target.value)} style={SELECT_STYLE}>
            <option value="">— Choisir un lit libre —</option>
            {freeBeds.map((b) => <option key={b.id} value={b.id}>{b.label}</option>)}
          </select>
          {freeBeds.length === 0 && (
            <span style={{ fontSize: 11.5, color: 'var(--ink-3)' }}>Aucun lit libre. Configurez/libérez un lit d'abord.</span>
          )}
        </Field>
        <Field>
          <FieldLabel htmlFor="adm-reason">Motif d'admission</FieldLabel>
          <Input id="adm-reason" value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Surveillance post-opératoire…" />
        </Field>
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
          <Button type="button" onClick={onDone}>Annuler</Button>
          <Button type="submit" variant="primary" disabled={isPending}>{isPending ? 'Admission…' : 'Admettre'}</Button>
        </div>
      </form>
    </Panel>
  );
}

export function StayDetailPanel({ stayId, onClose }: { stayId: string; onClose: () => void }) {
  const navigate = useNavigate();
  const { stay, isLoading } = useStayDetail(stayId);
  const freeBeds = useFreeBeds();
  const { transfer, isPending: transferring } = useTransfer();
  const { discharge, isPending: discharging } = useDischarge();
  const { generateInvoice, isPending: billing } = useGenerateStayInvoice();
  const { cancelStay } = useCancelStay();
  const { vitals } = useStayVitals(stayId);
  const { recordVitals, isPending: recVit } = useRecordStayVitals();
  const [transferBed, setTransferBed] = useState('');
  const [dischargeType, setDischargeType] = useState<DischargeType>('DOMICILE');
  const [summary, setSummary] = useState('');
  const [vit, setVit] = useState<Record<string, string>>({});

  if (isLoading || !stay) {
    return <Panel><div style={{ padding: 16, color: 'var(--ink-3)', fontSize: 12 }}>Chargement…</div></Panel>;
  }

  async function doTransfer() {
    if (!transferBed) { toast.error('Choisir un lit.'); return; }
    try { await transfer({ stayId, bedId: transferBed }); toast.success('Patient transféré.'); setTransferBed(''); }
    catch (err) { reportError(err); }
  }
  async function doDischarge() {
    try { await discharge({ stayId, dischargeType, ...(summary.trim() ? { dischargeSummary: summary.trim() } : {}) });
      toast.success('Sortie enregistrée.'); }
    catch (err) { reportError(err); }
  }
  async function doInvoice() {
    try { const r = await generateInvoice(stayId);
      toast.success('Facture de séjour générée.', { description: 'Ouverture dans Facturation…' });
      navigate(`/facturation?invoice=${(r as { invoiceId: string }).invoiceId}`); }
    catch (err) { reportError(err); }
  }
  async function doCancel() {
    if (!confirm('Annuler cette admission ? Le lit sera libéré.')) return;
    try { await cancelStay(stayId); toast.success('Admission annulée.'); onClose(); }
    catch (err) { reportError(err); }
  }
  function num(k: string): number | undefined {
    const n = Number(vit[k]);
    return vit[k] && !Number.isNaN(n) ? n : undefined;
  }
  async function doVitals() {
    const payload: StayVitalsPayload = {};
    const sys = num('sys'); if (sys !== undefined) payload.systolicMmhg = sys;
    const dia = num('dia'); if (dia !== undefined) payload.diastolicMmhg = dia;
    const temp = num('temp'); if (temp !== undefined) payload.temperatureC = temp;
    const fc = num('fc'); if (fc !== undefined) payload.heartRateBpm = fc;
    const spo2 = num('spo2'); if (spo2 !== undefined) payload.spo2Percent = spo2;
    const gly = num('gly'); if (gly !== undefined) payload.glycemiaGPerL = gly;
    if (vit.notes?.trim()) payload.notes = vit.notes.trim();
    if (Object.keys(payload).length === 0) { toast.error('Saisir au moins une constante.'); return; }
    try { await recordVitals({ stayId, payload }); toast.success('Constantes enregistrées.'); setVit({}); }
    catch (err) { reportError(err); }
  }
  async function doPdf() {
    try {
      const r = await api.get(`/hospitalization/stays/${stayId}/summary-pdf`, { responseType: 'blob' });
      const url = URL.createObjectURL(r.data as Blob);
      window.open(url, '_blank');
    } catch (err) { reportError(err); }
  }

  return (
    <Panel data-testid="stay-detail">
      <PanelHeader>
        <span>{stay.patientFirstName} {stay.patientLastName} — séjour</span>
        <span style={{ marginLeft: 'auto', fontSize: 11, padding: '2px 10px', borderRadius: 999,
          background: 'var(--bg-alt)', color: 'var(--ink-2)' }}>{stay.status}</span>
      </PanelHeader>
      <div style={{ padding: 16, display: 'flex', flexDirection: 'column', gap: 14 }}>
        <div>
          <div style={{ fontSize: 12, fontWeight: 600, marginBottom: 6 }}>Affectations (ADT)</div>
          {stay.assignments.map((a) => (
            <div key={a.id} style={{ fontSize: 12.5, padding: '6px 0', borderBottom: '1px solid var(--border)' }}>
              {a.bedLabel} · {a.dailyRate.toLocaleString('fr-MA')} MAD/j · {a.nights} nuit(s)
              {a.toAt ? '' : ' · (courant)'}
            </div>
          ))}
        </div>
        <div style={{ background: 'var(--surface-2)', borderRadius: 6, padding: 12 }}>
          <div style={{ fontSize: 12, fontWeight: 600, marginBottom: 6 }}>Aperçu facturation — coût quotidien</div>
          {stay.chargePreview.map((c, i) => (
            <div key={i} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12.5 }}>
              <span>{c.description} ({c.quantity} × {c.unitPrice.toLocaleString('fr-MA')})</span>
              <span style={{ fontWeight: 600 }}>{c.lineTotal.toLocaleString('fr-MA')} MAD</span>
            </div>
          ))}
          <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 6, paddingTop: 6,
            borderTop: '1px solid var(--border)', fontSize: 13, fontWeight: 700 }}>
            <span>Total hébergement</span><span>{stay.chargeTotal.toLocaleString('fr-MA')} MAD</span>
          </div>
        </div>

        {stay.status === 'EN_COURS' && (
          <>
            <div style={{ display: 'flex', gap: 8, alignItems: 'flex-end' }}>
              <Field style={{ flex: 1 }}>
                <FieldLabel htmlFor="tr-bed">Transférer vers</FieldLabel>
                <select id="tr-bed" aria-label="Lit de transfert" value={transferBed}
                  onChange={(e) => setTransferBed(e.target.value)} style={SELECT_STYLE}>
                  <option value="">— Lit libre —</option>
                  {freeBeds.map((b) => <option key={b.id} value={b.id}>{b.label}</option>)}
                </select>
              </Field>
              <Button type="button" disabled={transferring} onClick={() => void doTransfer()}>Transférer</Button>
            </div>
            <div style={{ border: '1px solid var(--border)', borderRadius: 6, padding: 12 }}>
              <div style={{ fontSize: 12, fontWeight: 600, marginBottom: 8 }}>Sortie médicale</div>
              <Field>
                <FieldLabel htmlFor="dis-type">Type de sortie</FieldLabel>
                <select id="dis-type" aria-label="Type de sortie" value={dischargeType}
                  onChange={(e) => setDischargeType(e.target.value as DischargeType)} style={SELECT_STYLE}>
                  {Object.entries(DISCHARGE_TYPE_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                </select>
              </Field>
              <Field>
                <FieldLabel htmlFor="dis-sum">Compte-rendu (optionnel)</FieldLabel>
                <Input id="dis-sum" value={summary} onChange={(e) => setSummary(e.target.value)} placeholder="Évolution favorable…" />
              </Field>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 8 }}>
                <Button type="button" variant="ghost" onClick={() => void doCancel()}>Annuler l'admission</Button>
                <Button type="button" variant="primary" disabled={discharging} onClick={() => void doDischarge()}>
                  Enregistrer la sortie
                </Button>
              </div>
            </div>
          </>
        )}

        {stay.status === 'EN_COURS' && (
          <div style={{ border: '1px solid var(--border)', borderRadius: 6, padding: 12 }}>
            <div style={{ fontSize: 12, fontWeight: 600, marginBottom: 8 }}>Constantes au lit</div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8 }}>
              <Field><FieldLabel htmlFor="v-sys">TA syst.</FieldLabel>
                <Input id="v-sys" type="number" value={vit.sys ?? ''} onChange={(e) => setVit({ ...vit, sys: e.target.value })} placeholder="120" /></Field>
              <Field><FieldLabel htmlFor="v-dia">TA diast.</FieldLabel>
                <Input id="v-dia" type="number" value={vit.dia ?? ''} onChange={(e) => setVit({ ...vit, dia: e.target.value })} placeholder="80" /></Field>
              <Field><FieldLabel htmlFor="v-temp">T° (°C)</FieldLabel>
                <Input id="v-temp" type="number" step="0.1" value={vit.temp ?? ''} onChange={(e) => setVit({ ...vit, temp: e.target.value })} placeholder="37.0" /></Field>
              <Field><FieldLabel htmlFor="v-fc">FC (bpm)</FieldLabel>
                <Input id="v-fc" type="number" value={vit.fc ?? ''} onChange={(e) => setVit({ ...vit, fc: e.target.value })} placeholder="72" /></Field>
              <Field><FieldLabel htmlFor="v-spo2">SpO₂ (%)</FieldLabel>
                <Input id="v-spo2" type="number" value={vit.spo2 ?? ''} onChange={(e) => setVit({ ...vit, spo2: e.target.value })} placeholder="98" /></Field>
              <Field><FieldLabel htmlFor="v-gly">Glycémie</FieldLabel>
                <Input id="v-gly" type="number" step="0.01" value={vit.gly ?? ''} onChange={(e) => setVit({ ...vit, gly: e.target.value })} placeholder="1.0" /></Field>
            </div>
            <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 8 }}>
              <Button type="button" variant="primary" disabled={recVit} onClick={() => void doVitals()}>
                {recVit ? 'Enregistrement…' : 'Enregistrer les constantes'}
              </Button>
            </div>
            {vitals.length > 0 && (
              <div style={{ marginTop: 10, fontSize: 11.5, color: 'var(--ink-3)' }}>
                {vitals.slice(0, 5).map((v) => (
                  <div key={v.id} style={{ padding: '3px 0', borderTop: '1px solid var(--border)' }}>
                    {new Date(v.recordedAt).toLocaleString('fr-MA')} ·
                    {v.systolicMmhg && v.diastolicMmhg ? ` TA ${v.systolicMmhg}/${v.diastolicMmhg}` : ''}
                    {v.temperatureC ? ` · T° ${v.temperatureC}` : ''}
                    {v.heartRateBpm ? ` · FC ${v.heartRateBpm}` : ''}
                    {v.spo2Percent ? ` · SpO₂ ${v.spo2Percent}%` : ''}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {stay.status === 'SORTI' && (
          <Button type="button" variant="primary" disabled={billing} onClick={() => void doInvoice()}>
            {billing ? 'Génération…' : 'Générer la facture de séjour'}
          </Button>
        )}
        {stay.status === 'FACTURE' && stay.invoiceId && (
          <Button type="button" variant="primary" onClick={() => navigate(`/facturation?invoice=${stay.invoiceId}`)}>
            Voir la facture
          </Button>
        )}
        {(stay.status === 'SORTI' || stay.status === 'FACTURE') && (
          <Button type="button" onClick={() => void doPdf()}>Télécharger le compte-rendu (PDF)</Button>
        )}

        <Button type="button" onClick={onClose}>Fermer</Button>
      </div>
    </Panel>
  );
}
