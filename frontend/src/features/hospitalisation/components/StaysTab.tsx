/**
 * Onglet « Séjours » du dossier patient — historique des hospitalisations.
 */
import { usePatientStays, type StayStatus } from '../hooks/useStays';

const STATUS_LABEL: Record<StayStatus, string> = {
  EN_COURS: 'En cours',
  SORTI: 'Sorti',
  FACTURE: 'Facturé',
  ANNULE: 'Annulé',
};

const STATUS_COLOR: Record<StayStatus, string> = {
  EN_COURS: '#dc2626',
  SORTI: '#d97706',
  FACTURE: '#16a34a',
  ANNULE: '#6b7280',
};

function fmt(iso: string | null): string {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('fr-MA');
}

export function StaysTab({ patientId }: { patientId: string }) {
  const { stays, isLoading, error } = usePatientStays(patientId);

  if (isLoading) return <div style={{ padding: 16, color: 'var(--ink-3)', fontSize: 12 }}>Chargement…</div>;
  if (error) return <div style={{ padding: 16, color: 'var(--danger)', fontSize: 12 }}>{error}</div>;
  if (stays.length === 0) {
    return <div style={{ padding: 16, color: 'var(--ink-3)', fontSize: 13 }}>Aucun séjour hospitalier.</div>;
  }

  return (
    <div style={{ padding: 16, display: 'flex', flexDirection: 'column', gap: 10 }}>
      {stays.map((s) => (
        <div key={s.id} data-testid={`patient-stay-${s.id}`}
          style={{ border: '1px solid var(--border)', borderRadius: 8, padding: 12 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6 }}>
            <span style={{ fontSize: 13, fontWeight: 600 }}>
              {fmt(s.admittedAt)} → {fmt(s.dischargedAt)}
            </span>
            <span style={{ marginLeft: 'auto', fontSize: 11, padding: '2px 10px', borderRadius: 999,
              background: 'var(--bg-alt)', color: STATUS_COLOR[s.status], fontWeight: 600 }}>
              {STATUS_LABEL[s.status]}
            </span>
          </div>
          {s.admissionReason && (
            <div style={{ fontSize: 12, color: 'var(--ink-3)' }}>Motif : {s.admissionReason}</div>
          )}
          <div style={{ fontSize: 12, color: 'var(--ink-3)' }}>
            {s.assignments.map((a) => a.bedLabel).filter(Boolean).join(' → ') || '—'}
            {' · '}{s.chargeTotal.toLocaleString('fr-MA')} MAD
          </div>
          {s.dischargeSummary && (
            <div style={{ fontSize: 12, marginTop: 4 }}>{s.dischargeSummary}</div>
          )}
        </div>
      ))}
    </div>
  );
}
