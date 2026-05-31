/**
 * Panneaux séjour partagés desktop + mobile : admission, détail (transfert /
 * sortie / facturation). Logique unique pour garantir la parité 390 px.
 */
import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { Button } from '@/components/ui/Button';
import { Field, FieldLabel } from '@/components/ui/Field';
import { Input, Select } from '@/components/ui/Input';
import { Panel, PanelHeader } from '@/components/ui/Panel';
import { api } from '@/lib/api/client';
import { toProblemDetail } from '@/lib/api/problemJson';
import { useT } from '@/lib/i18n/I18nProvider';
import { usePrestationCatalog } from '@/features/prestation/hooks/usePrestations';
import { useBedBoard } from '../hooks/useHospitalization';
import {
  DISCHARGE_TYPE_KEYS,
  useAddStayPrestation,
  useAdmit,
  useCancelStay,
  useDeleteStayPrestation,
  useDischarge,
  useConfirmDischarge,
  useRecordStayVitals,
  useStayDetail,
  useStayPrestations,
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
  const { t } = useT();
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
    if (!selected || !bedId) { toast.error(t('hospit.admission.errRequired')); return; }
    try {
      await admit({ patientId: selected.id, bedId, ...(reason.trim() ? { admissionReason: reason.trim() } : {}) });
      toast.success(t('hospit.admission.success', { name: `${selected.firstName} ${selected.lastName}` }));
      onDone();
    } catch (err) { reportError(err); }
  }

  return (
    <Panel data-testid="admission-form">
      <PanelHeader>{t('hospit.admission.title')}</PanelHeader>
      <form onSubmit={(e) => void submit(e)} style={{ padding: 16, display: 'flex', flexDirection: 'column', gap: 12 }}>
        <Field>
          <FieldLabel htmlFor="adm-patient">{t('hospit.admission.patient')}</FieldLabel>
          {selected ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <span style={{ fontSize: 13, fontWeight: 600 }}>{selected.firstName} {selected.lastName}</span>
              <Button size="sm" variant="ghost" type="button" onClick={() => { setSelected(null); setQ(''); }}>{t('hospit.admission.change')}</Button>
            </div>
          ) : (
            <>
              <Input id="adm-patient" value={q} onChange={(e) => void search(e.target.value)}
                placeholder={t('hospit.admission.patientPlaceholder')} />
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
          <FieldLabel htmlFor="adm-bed">{t('hospit.admission.bed')}</FieldLabel>
          <Select id="adm-bed" aria-label={t('hospit.admission.bedAria')} value={bedId} onChange={(e) => setBedId(e.target.value)} style={SELECT_STYLE}>
            <option value="">{t('hospit.admission.chooseFreeBed')}</option>
            {freeBeds.map((b) => <option key={b.id} value={b.id}>{b.label}</option>)}
          </Select>
          {freeBeds.length === 0 && (
            <span style={{ fontSize: 11.5, color: 'var(--ink-3)' }}>{t('hospit.admission.noFreeBed')}</span>
          )}
        </Field>
        <Field>
          <FieldLabel htmlFor="adm-reason">{t('hospit.admission.reason')}</FieldLabel>
          <Input id="adm-reason" value={reason} onChange={(e) => setReason(e.target.value)} placeholder={t('hospit.admission.reasonPlaceholder')} />
        </Field>
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
          <Button type="button" onClick={onDone}>{t('hospit.admission.cancel')}</Button>
          <Button type="submit" variant="primary" disabled={isPending}>{isPending ? t('hospit.admission.admitting') : t('hospit.admission.admit')}</Button>
        </div>
      </form>
    </Panel>
  );
}

/**
 * Section Prestations du séjour (QA10-2) : liste + formulaire d'ajout inline.
 * L'acte du catalogue préremplit label + prix ; saisie libre possible.
 * Réutilisée par desktop + mobile via StayDetailPanel (parité 390 px).
 */
export function StayPrestationsSection({ stayId, editable }: { stayId: string; editable: boolean }) {
  const { t } = useT();
  const { prestations } = useStayPrestations(stayId);
  const { prestations: catalog } = usePrestationCatalog(false);
  const { addPrestation, isPending: adding } = useAddStayPrestation(stayId);
  const { deletePrestation } = useDeleteStayPrestation(stayId);
  const [actId, setActId] = useState('');
  const [label, setLabel] = useState('');
  const [price, setPrice] = useState('');
  const [qty, setQty] = useState('1');

  const total = prestations.reduce((s, p) => s + p.lineTotal, 0);

  function pickAct(id: string) {
    setActId(id);
    const act = catalog.find((c) => c.id === id);
    if (act) {
      setLabel(act.label);
      setPrice(String(act.defaultPrice));
    }
  }

  async function add() {
    const trimmed = label.trim();
    const priceNum = Number(price);
    const qtyNum = Number(qty);
    if (!trimmed) { toast.error(t('hospit.prest.errLabel')); return; }
    if (!price || Number.isNaN(priceNum) || priceNum < 0) { toast.error(t('hospit.prest.errPrice')); return; }
    const payload = {
      label: trimmed,
      unitPrice: priceNum,
      ...(actId ? { actId } : {}),
      ...(qty && !Number.isNaN(qtyNum) ? { quantity: qtyNum } : {}),
    };
    try {
      await addPrestation(payload);
      toast.success(t('hospit.prest.addedToast'));
      setActId(''); setLabel(''); setPrice(''); setQty('1');
    } catch (err) { reportError(err); }
  }

  async function remove(id: string) {
    try {
      await deletePrestation(id);
      toast.success(t('hospit.prest.removedToast'));
    } catch (err) {
      const p = toProblemDetail(err);
      if (p.code === 'STAY_ALREADY_INVOICED') { toast.error(t('hospit.prest.alreadyInvoiced')); return; }
      reportError(err);
    }
  }

  return (
    <div style={{ border: '1px solid var(--border)', borderRadius: 6, padding: 12 }} data-testid="stay-prestations">
      <div style={{ fontSize: 12, fontWeight: 600, marginBottom: 8 }}>{t('hospit.prest.title')}</div>
      {prestations.length === 0 && (
        <div style={{ fontSize: 12, color: 'var(--ink-3)' }}>{t('hospit.prest.empty')}</div>
      )}
      {prestations.map((p) => (
        <div key={p.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          fontSize: 12.5, padding: '5px 0', borderBottom: '1px solid var(--border)' }}>
          <span>{t('hospit.prest.line', { label: p.label, qty: p.quantity, unitPrice: p.unitPrice.toLocaleString('fr-MA') })}</span>
          <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ fontWeight: 600 }}>{p.lineTotal.toLocaleString('fr-MA')} MAD</span>
            {editable && (
              <button type="button" aria-label={t('hospit.prest.removeAria', { label: p.label })} onClick={() => void remove(p.id)}
                style={{ border: 'none', background: 'none', cursor: 'pointer', color: 'var(--danger, #c0392b)',
                  fontSize: 15, lineHeight: 1, padding: '0 4px' }}>×</button>
            )}
          </span>
        </div>
      ))}
      <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 6, paddingTop: 6,
        borderTop: '1px solid var(--border)', fontSize: 13, fontWeight: 700 }}>
        <span>{t('hospit.prest.total')}</span>
        <span data-testid="stay-prestations-total">{total.toLocaleString('fr-MA')} MAD</span>
      </div>

      {editable && (
        <div style={{ marginTop: 10, display: 'flex', flexDirection: 'column', gap: 8 }}>
          <div style={{ fontSize: 12, fontWeight: 600 }}>{t('hospit.prest.add')}</div>
          <Field>
            <FieldLabel htmlFor="pr-act">{t('hospit.prest.act')}</FieldLabel>
            <Select id="pr-act" aria-label={t('hospit.prest.actAria')} value={actId}
              onChange={(e) => pickAct(e.target.value)} style={SELECT_STYLE}>
              <option value="">{t('hospit.prest.freeEntry')}</option>
              {catalog.map((c) => (
                <option key={c.id} value={c.id}>{t('hospit.prest.actOption', { label: c.label, price: c.defaultPrice })}</option>
              ))}
            </Select>
          </Field>
          <Field>
            <FieldLabel htmlFor="pr-label">{t('hospit.prest.label')}</FieldLabel>
            <Input id="pr-label" value={label} onChange={(e) => setLabel(e.target.value)}
              placeholder={t('hospit.prest.labelPlaceholder')} />
          </Field>
          <div style={{ display: 'flex', gap: 8 }}>
            <Field style={{ flex: 1 }}>
              <FieldLabel htmlFor="pr-price">{t('hospit.prest.unitPrice')}</FieldLabel>
              <Input id="pr-price" type="number" min="0" step="0.01" value={price}
                onChange={(e) => setPrice(e.target.value)} placeholder="50" />
            </Field>
            <Field style={{ width: 90 }}>
              <FieldLabel htmlFor="pr-qty">{t('hospit.prest.qty')}</FieldLabel>
              <Input id="pr-qty" type="number" min="1" step="1" value={qty}
                onChange={(e) => setQty(e.target.value)} />
            </Field>
          </div>
          <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
            <Button type="button" variant="primary" disabled={adding} onClick={() => void add()}>
              {adding ? t('hospit.prest.adding') : t('hospit.prest.addBtn')}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

export function StayDetailPanel({ stayId, onClose }: { stayId: string; onClose: () => void }) {
  const { t } = useT();
  const navigate = useNavigate();
  const { stay, isLoading } = useStayDetail(stayId);
  const freeBeds = useFreeBeds();
  const { transfer, isPending: transferring } = useTransfer();
  const { discharge, isPending: discharging } = useDischarge();
  const { confirmDischarge, isPending: confirming } = useConfirmDischarge();
  const { cancelStay } = useCancelStay();
  const { vitals } = useStayVitals(stayId);
  const { recordVitals, isPending: recVit } = useRecordStayVitals();
  const [transferBed, setTransferBed] = useState('');
  const [dischargeType, setDischargeType] = useState<DischargeType>('DOMICILE');
  const [summary, setSummary] = useState('');
  const [vit, setVit] = useState<Record<string, string>>({});
  const [tab, setTab] = useState<'apercu' | 'prestations' | 'constantes' | 'sortie'>('apercu');

  if (isLoading || !stay) {
    return <Panel><div style={{ padding: 16, color: 'var(--ink-3)', fontSize: 12 }}>{t('hospit.detail.loading')}</div></Panel>;
  }

  async function doTransfer() {
    if (!transferBed) { toast.error(t('hospit.transfer.errBed')); return; }
    try { await transfer({ stayId, bedId: transferBed }); toast.success(t('hospit.transfer.success')); setTransferBed(''); }
    catch (err) { reportError(err); }
  }
  async function doDischarge() {
    try { await discharge({ stayId, dischargeType, ...(summary.trim() ? { dischargeSummary: summary.trim() } : {}) });
      toast.success(t('hospit.discharge.successTitle'), {
        description: t('hospit.discharge.successDesc') }); }
    catch (err) { reportError(err); }
  }
  async function doConfirmDischarge() {
    try { await confirmDischarge(stayId); toast.success(t('hospit.discharge.confirmedTitle')); }
    catch (err) { reportError(err); }
  }
  async function doCancel() {
    if (!confirm(t('hospit.cancel.confirm'))) return;
    try { await cancelStay(stayId); toast.success(t('hospit.cancel.success')); onClose(); }
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
    if (Object.keys(payload).length === 0) { toast.error(t('hospit.vitals.errMin')); return; }
    try { await recordVitals({ stayId, payload }); toast.success(t('hospit.vitals.savedToast')); setVit({}); }
    catch (err) { reportError(err); }
  }
  async function doPdf() {
    try {
      const r = await api.get(`/hospitalization/stays/${stayId}/summary-pdf`, { responseType: 'blob' });
      const url = URL.createObjectURL(r.data as Blob);
      // <a download> plutôt que window.open : appelé après l'await, window.open
      // est bloqué par le bloqueur de pop-up (ADR-038).
      const a = document.createElement('a');
      a.href = url;
      a.download = `compte-rendu-sejour-${stayId.slice(0, 8)}.pdf`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 1_000);
    } catch (err) { reportError(err); }
  }

  return (
    <Panel data-testid="stay-detail">
      <PanelHeader>
        <span>{stay.patientFirstName} {stay.patientLastName} — {t('hospit.detail.headerSuffix')}</span>
        <span style={{ marginLeft: 'auto', fontSize: 11, padding: '2px 10px', borderRadius: 999,
          background: 'var(--bg-alt)', color: 'var(--ink-2)' }}>{t(`hospit.status.${stay.status}`)}</span>
      </PanelHeader>
      <div style={{ padding: 16, display: 'flex', flexDirection: 'column', gap: 14 }}>
        {/* Onglets — réorganisation ergonomie (backlog 2026-05-29) : éviter le
            mur d'informations en empilant les sections sous des onglets. */}
        <div
          role="tablist"
          aria-label={t('hospit.detail.tabsAria')}
          style={{ display: 'flex', gap: 2, background: 'var(--bg-alt)', padding: 2, borderRadius: 6, flexWrap: 'wrap' }}
        >
          {([
            { id: 'apercu', label: t('hospit.detail.tab.apercu') },
            { id: 'prestations', label: t('hospit.detail.tab.prestations') },
            { id: 'constantes', label: t('hospit.detail.tab.constantes') },
            ...(stay.status === 'EN_COURS' ? [{ id: 'sortie', label: t('hospit.detail.tab.sortie') }] : []),
          ] as const).map((tb) => {
            const on = tab === tb.id;
            return (
              <button
                key={tb.id}
                type="button"
                role="tab"
                aria-selected={on}
                onClick={() => setTab(tb.id as typeof tab)}
                style={{
                  flex: 1, minWidth: 110, padding: '6px 10px', border: 'none', borderRadius: 4,
                  cursor: 'pointer', fontFamily: 'inherit', fontSize: 12, fontWeight: on ? 600 : 500,
                  background: on ? 'var(--surface)' : 'transparent', color: on ? 'var(--ink)' : 'var(--ink-3)',
                  boxShadow: on ? '0 0 0 1px var(--border)' : 'none',
                }}
              >
                {tb.label}
              </button>
            );
          })}
        </div>

        {tab === 'apercu' && (
          <>
            <div>
              <div style={{ fontSize: 12, fontWeight: 600, marginBottom: 6 }}>{t('hospit.detail.assignments')}</div>
              {stay.assignments.map((a) => (
                <div key={a.id} style={{ fontSize: 12.5, padding: '6px 0', borderBottom: '1px solid var(--border)' }}>
                  {t('hospit.detail.assignmentLine', { bed: a.bedLabel ?? '—', rate: a.dailyRate.toLocaleString('fr-MA'), nights: a.nights })}
                  {a.toAt ? '' : t('hospit.detail.current')}
                </div>
              ))}
            </div>
            <div style={{ background: 'var(--surface-2)', borderRadius: 6, padding: 12 }}>
              <div style={{ fontSize: 12, fontWeight: 600, marginBottom: 6 }}>{t('hospit.detail.billingPreview')}</div>
              {stay.chargePreview.map((c, i) => (
                <div key={i} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12.5 }}>
                  <span>{c.description} ({c.quantity} × {c.unitPrice.toLocaleString('fr-MA')})</span>
                  <span style={{ fontWeight: 600 }}>{c.lineTotal.toLocaleString('fr-MA')} MAD</span>
                </div>
              ))}
              <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 6, paddingTop: 6,
                borderTop: '1px solid var(--border)', fontSize: 13, fontWeight: 700 }}>
                <span>{t('hospit.detail.lodgingTotal')}</span><span>{stay.chargeTotal.toLocaleString('fr-MA')} MAD</span>
              </div>
            </div>
            {(stay.pendingConsultationInvoices?.length ?? 0) > 0 && (
              <div style={{ background: 'var(--surface-2)', borderRadius: 6, padding: 12 }}>
                <div style={{ fontSize: 12, fontWeight: 600, marginBottom: 6 }}>
                  {t('hospit.detail.consultsOfStay')}
                </div>
                {stay.pendingConsultationInvoices!.map((pc) => (
                  <div key={pc.invoiceId} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12.5 }}>
                    <span>
                      {pc.number ?? t('hospit.detail.consultDraft')}
                      {pc.consultDate ? ` · ${new Date(pc.consultDate).toLocaleDateString('fr-MA')}` : ''}
                    </span>
                    <span style={{ fontWeight: 600 }}>{pc.netAmount.toLocaleString('fr-MA')} MAD</span>
                  </div>
                ))}
              </div>
            )}
            {/* Sortie en 2 temps : la facture est émise à la « Préparation de la
                sortie » ; « Confirmer la sortie » est refusée tant qu'elle n'est pas
                réglée (garde backend STAY_INVOICE_UNPAID). */}
            {stay.status === 'SORTI' && (
              <>
                {stay.invoiceId && (
                  <Button type="button" onClick={() => navigate(`/facturation?invoice=${stay.invoiceId}`)}>
                    {t('hospit.detail.viewCollectInvoice')}
                  </Button>
                )}
                <Button type="button" variant="primary" disabled={confirming}
                  onClick={() => void doConfirmDischarge()}>
                  {confirming ? t('hospit.detail.confirming') : t('hospit.detail.confirmDischarge')}
                </Button>
              </>
            )}
            {stay.status === 'FACTURE' && (
              <>
                <div style={{ fontSize: 12.5, color: 'var(--success, #0e5b3e)', fontWeight: 600 }}>
                  {t('hospit.detail.closedPaid')}
                </div>
                {stay.invoiceId && (
                  <Button type="button" onClick={() => navigate(`/facturation?invoice=${stay.invoiceId}`)}>
                    {t('hospit.detail.viewInvoice')}
                  </Button>
                )}
              </>
            )}
            {(stay.status === 'SORTI' || stay.status === 'FACTURE') && (
              <Button type="button" onClick={() => void doPdf()}>{t('hospit.detail.downloadPdf')}</Button>
            )}
          </>
        )}

        {tab === 'prestations' && (
          <StayPrestationsSection stayId={stayId} editable={stay.status === 'EN_COURS'} />
        )}

        {tab === 'constantes' && (
          <div style={{ border: '1px solid var(--border)', borderRadius: 6, padding: 12 }}>
            <div style={{ fontSize: 12, fontWeight: 600, marginBottom: 8 }}>{t('hospit.vitals.title')}</div>
            {stay.status === 'EN_COURS' && (
              <>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8 }}>
                  <Field><FieldLabel htmlFor="v-sys">{t('hospit.vitals.sys')}</FieldLabel>
                    <Input id="v-sys" type="number" value={vit.sys ?? ''} onChange={(e) => setVit({ ...vit, sys: e.target.value })} placeholder="120" /></Field>
                  <Field><FieldLabel htmlFor="v-dia">{t('hospit.vitals.dia')}</FieldLabel>
                    <Input id="v-dia" type="number" value={vit.dia ?? ''} onChange={(e) => setVit({ ...vit, dia: e.target.value })} placeholder="80" /></Field>
                  <Field><FieldLabel htmlFor="v-temp">{t('hospit.vitals.temp')}</FieldLabel>
                    <Input id="v-temp" type="number" step="0.1" value={vit.temp ?? ''} onChange={(e) => setVit({ ...vit, temp: e.target.value })} placeholder="37.0" /></Field>
                  <Field><FieldLabel htmlFor="v-fc">{t('hospit.vitals.fc')}</FieldLabel>
                    <Input id="v-fc" type="number" value={vit.fc ?? ''} onChange={(e) => setVit({ ...vit, fc: e.target.value })} placeholder="72" /></Field>
                  <Field><FieldLabel htmlFor="v-spo2">{t('hospit.vitals.spo2')}</FieldLabel>
                    <Input id="v-spo2" type="number" value={vit.spo2 ?? ''} onChange={(e) => setVit({ ...vit, spo2: e.target.value })} placeholder="98" /></Field>
                  <Field><FieldLabel htmlFor="v-gly">{t('hospit.vitals.gly')}</FieldLabel>
                    <Input id="v-gly" type="number" step="0.01" value={vit.gly ?? ''} onChange={(e) => setVit({ ...vit, gly: e.target.value })} placeholder="1.0" /></Field>
                </div>
                <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 8 }}>
                  <Button type="button" variant="primary" disabled={recVit} onClick={() => void doVitals()}>
                    {recVit ? t('hospit.vitals.recording') : t('hospit.vitals.record')}
                  </Button>
                </div>
              </>
            )}
            {vitals.length > 0 ? (
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
            ) : (
              <div style={{ marginTop: 8, fontSize: 12, color: 'var(--ink-3)' }}>{t('hospit.vitals.empty')}</div>
            )}
          </div>
        )}

        {tab === 'sortie' && stay.status === 'EN_COURS' && (
          <>
            <div style={{ display: 'flex', gap: 8, alignItems: 'flex-end' }}>
              <Field style={{ flex: 1 }}>
                <FieldLabel htmlFor="tr-bed">{t('hospit.sortie.transferTo')}</FieldLabel>
                <Select id="tr-bed" aria-label={t('hospit.sortie.transferBedAria')} value={transferBed}
                  onChange={(e) => setTransferBed(e.target.value)} style={SELECT_STYLE}>
                  <option value="">{t('hospit.sortie.freeBed')}</option>
                  {freeBeds.map((b) => <option key={b.id} value={b.id}>{b.label}</option>)}
                </Select>
              </Field>
              <Button type="button" disabled={transferring} onClick={() => void doTransfer()}>{t('hospit.sortie.transfer')}</Button>
            </div>
            <div style={{ border: '1px solid var(--border)', borderRadius: 6, padding: 12 }}>
              <div style={{ fontSize: 12, fontWeight: 600, marginBottom: 4 }}>{t('hospit.sortie.medicalTitle')}</div>
              <div style={{ fontSize: 11.5, color: 'var(--ink-3)', marginBottom: 8, lineHeight: 1.45 }}>
                {t('hospit.sortie.medicalHint')}
              </div>
              <Field>
                <FieldLabel htmlFor="dis-type">{t('hospit.sortie.type')}</FieldLabel>
                <Select id="dis-type" aria-label={t('hospit.sortie.typeAria')} value={dischargeType}
                  onChange={(e) => setDischargeType(e.target.value as DischargeType)} style={SELECT_STYLE}>
                  {Object.entries(DISCHARGE_TYPE_KEYS).map(([k, keyStr]) => <option key={k} value={k}>{t(keyStr)}</option>)}
                </Select>
              </Field>
              <Field>
                <FieldLabel htmlFor="dis-sum">{t('hospit.sortie.summary')}</FieldLabel>
                <Input id="dis-sum" value={summary} onChange={(e) => setSummary(e.target.value)} placeholder={t('hospit.sortie.summaryPlaceholder')} />
              </Field>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 8 }}>
                <Button type="button" variant="ghost" onClick={() => void doCancel()}>{t('hospit.sortie.cancelAdmission')}</Button>
                <Button type="button" variant="primary" disabled={discharging} onClick={() => void doDischarge()}>
                  {discharging ? t('hospit.sortie.preparing') : t('hospit.sortie.prepare')}
                </Button>
              </div>
            </div>
          </>
        )}

        <Button type="button" onClick={onClose}>{t('hospit.detail.close')}</Button>
      </div>
    </Panel>
  );
}
