/**
 * Screen 03 — Dossier patient (mobile).
 * Ported from design/prototype/mobile/screens.jsx:MDossier.
 * Backend dependency: J3 patient module — currently uses fixtures via usePatient.
 * TODO(backend:J3): swap usePatient to real TanStack Query once GET /api/patients/:id ships.
 */
import { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { MScreen } from '@/components/shell/MScreen';
import { MTopbar, MIconBtn } from '@/components/shell/MTopbar';
import type { MobileTab } from '@/components/shell/MTabs';
import { Warn, Phone, Calendar, Stetho, Lock } from '@/components/icons';
import { useStartConsultation } from '@/features/salle-attente/hooks/useStartConsultation';
import { useConsultations } from '@/features/consultation/hooks/useConsultations';
import { usePrescriptionsForPatient } from '@/features/prescription/hooks/usePrescriptions';
import { useInvoicesForPatient } from '@/features/facturation/hooks/useInvoices';
import { STATUS_LABEL as INVOICE_STATUS_LABEL } from '@/features/facturation/types';
import { usePatient } from './hooks/usePatient';
import { VitalsEvolutionPanel } from './components/VitalsEvolutionPanel';
import { EditPatientMobileSheet } from './components/EditPatientMobileSheet';
import type { MobileDossierTab } from './types';

export default function DossierMobilePage() {
  const { id } = useParams<{ id?: string }>();
  const navigate = useNavigate();
  const { patient, raw, isLoading } = usePatient(id);
  const [tab, setTab] = useState<MobileDossierTab>('historique');
  const [showEdit, setShowEdit] = useState(false);
  const { startConsultation, isPending: isStartingConsult } = useStartConsultation();
  const { consultations: patientConsultations } = useConsultations(
    raw?.id ? { patientId: raw.id } : {},
  );
  const { prescriptions: patientPrescriptions } = usePrescriptionsForPatient(raw?.id);
  const { invoices: patientInvoices } = useInvoicesForPatient(raw?.id);

  async function handleStartConsultation() {
    if (!raw) return;
    try {
      const created = await startConsultation({ patientId: raw.id });
      void navigate(`/consultations/${created.id}`);
    } catch {
      toast.error('Impossible de démarrer la consultation', {
        description: 'Le rôle MEDECIN est requis pour cette action.',
      });
    }
  }

  if (isLoading || !patient) {
    return (
      <MScreen tab="patients" onTabChange={(t) => navigate({ agenda: '/agenda', salle: '/salle', patients: '/patients', factu: '/facturation', menu: '/parametres' }[t])} topbar={<MTopbar title="Dossier patient" />}>
        <div style={{ padding: 24, color: 'var(--ink-3)', fontSize: 13 }}>
          {isLoading ? 'Chargement…' : 'Patient introuvable.'}
        </div>
      </MScreen>
    );
  }

  return (
    <MScreen
      tab="patients"
      onTabChange={(t: MobileTab) => {
        const map: Record<MobileTab, string> = {
          agenda: '/agenda',
          salle: '/salle',
          patients: '/patients',
          factu: '/facturation',
          menu: '/parametres',
        };
        navigate(map[t]);
      }}
      topbar={
        <MTopbar
          left={<MIconBtn icon="ChevronLeft" label="Retour" onClick={() => navigate(-1)} />}
          title="Dossier patient"
          right={
            <MIconBtn
              icon="Edit"
              label="Modifier le patient"
              onClick={() => setShowEdit(true)}
            />
          }
        />
      }
    >
      {/* Patient header */}
      <div className="m-phead">
        <div
          className="cp-avatar"
          style={{ background: 'var(--primary)', width: 46, height: 46, fontSize: 15 }}
          aria-hidden="true"
        >
          {patient.initials}
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div className="m-phead-name">{patient.fullName}</div>
          <div className="m-phead-meta">
            {[patient.sex, patient.age > 0 ? `${patient.age} ans` : null, patient.cin ? `CIN ${patient.cin}` : null]
              .filter(Boolean)
              .join(' · ') || '—'}
          </div>
        </div>
      </div>

      {/* Allergy strip */}
      <div
        style={{
          background: 'var(--amber-soft)',
          padding: '10px 16px',
          borderBottom: '1px solid var(--border)',
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          color: 'var(--amber)',
          fontSize: 13,
          fontWeight: 600,
        }}
        role="alert"
        aria-label="Allergie connue"
      >
        <Warn aria-hidden="true" />
        <span>Allergie : {patient.allergies[0]}</span>
      </div>

      <div className="mb-pad">
        {/* Primary CTA — start consultation (POST /consultations) */}
        <button
          type="button"
          className="m-btn primary"
          style={{ height: 44, marginBottom: 16 }}
          disabled={isStartingConsult}
          onClick={() => {
            void handleStartConsultation();
          }}
        >
          <Stetho aria-hidden="true" />{' '}
          {isStartingConsult ? 'Démarrage…' : 'Démarrer consultation'}
        </button>

        {/* Rx / Notes need a consultation context — omitted vs. prototype 4-grid. */}
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: '1fr 1fr',
            gap: 8,
            marginBottom: 16,
          }}
        >
          {(() => {
            const phoneHref =
              raw?.phone ? `tel:${raw.phone.replace(/\s+/g, '')}` : null;
            const tileStyle = {
              background: 'var(--bg-alt)',
              border: 0,
              borderRadius: 10,
              padding: '10px 4px',
              display: 'flex',
              flexDirection: 'column' as const,
              alignItems: 'center' as const,
              gap: 4,
              color: 'var(--ink)',
              fontSize: 11,
              fontWeight: 550,
              cursor: 'pointer',
              fontFamily: 'inherit',
              textDecoration: 'none',
            };
            return (
              <>
                {phoneHref ? (
                  <a href={phoneHref} style={tileStyle} aria-label={`Appeler ${patient.fullName}`}>
                    <Phone aria-hidden="true" />
                    <span>Appeler</span>
                  </a>
                ) : (
                  <button type="button" disabled style={{ ...tileStyle, opacity: 0.5, cursor: 'default' }} aria-label="Appeler (numéro indisponible)">
                    <Phone aria-hidden="true" />
                    <span>Appeler</span>
                  </button>
                )}
                <button
                  type="button"
                  style={tileStyle}
                  aria-label="Prendre un rendez-vous"
                  onClick={() => {
                    if (!raw) return;
                    const params = new URLSearchParams({
                      patientId: raw.id,
                      patientName: patient.fullName,
                    });
                    void navigate(`/rdv/new?${params.toString()}`);
                  }}
                >
                  <Calendar aria-hidden="true" />
                  <span>RDV</span>
                </button>
              </>
            );
          })()}
        </div>

        {/* Key info card */}
        <div className="m-card" style={{ marginBottom: 14 }}>
          <div
            style={{
              padding: '10px 14px',
              borderBottom: '1px solid var(--border-soft)',
              fontSize: 12,
              fontWeight: 600,
              textTransform: 'uppercase',
              letterSpacing: '0.06em',
              color: 'var(--ink-3)',
            }}
          >
            Antécédents
          </div>
          <div style={{ padding: '10px 14px', fontSize: 13, lineHeight: 1.55 }}>
            {patient.antecedents}
          </div>
          <div
            style={{
              padding: '10px 14px',
              borderTop: '1px solid var(--border-soft)',
              fontSize: 12,
              fontWeight: 600,
              textTransform: 'uppercase',
              letterSpacing: '0.06em',
              color: 'var(--ink-3)',
            }}
          >
            Traitement chronique
          </div>
          <div style={{ padding: '10px 14px', fontSize: 13, lineHeight: 1.6 }}>
            {patient.currentMedications.map((m) => (
              <div key={m.name}>
                · {m.name} — {m.posology}
              </div>
            ))}
          </div>
        </div>

        {/* Segmented tab control — horizontally scrollable to fit 5 tabs */}
        <div
          role="tablist"
          aria-label="Sections"
          style={{
            display: 'flex',
            gap: 6,
            overflowX: 'auto',
            paddingBottom: 8,
            marginBottom: 8,
            WebkitOverflowScrolling: 'touch',
          }}
        >
          {(['historique', 'consults', 'vitals', 'rx', 'factu', 'admin'] as MobileDossierTab[]).map(
            (t) => {
              const label =
                t === 'historique'
                  ? 'Historique'
                  : t === 'consults'
                  ? `Consult. (${patientConsultations.length})`
                  : t === 'vitals'
                  ? 'Constantes'
                  : t === 'rx'
                  ? `Ordo. (${patientPrescriptions.length})`
                  : t === 'factu'
                  ? `Factures (${patientInvoices.length})`
                  : 'Admin.';
              const on = tab === t;
              return (
                <button
                  key={t}
                  type="button"
                  role="tab"
                  aria-selected={on}
                  onClick={() => setTab(t)}
                  style={{
                    flexShrink: 0,
                    height: 32,
                    padding: '0 14px',
                    borderRadius: 16,
                    border: `1px solid ${on ? 'var(--primary)' : 'var(--border)'}`,
                    background: on ? 'var(--primary-soft)' : 'var(--surface)',
                    color: on ? 'var(--primary)' : 'var(--ink-2)',
                    fontSize: 12,
                    fontWeight: 600,
                    fontFamily: 'inherit',
                    cursor: 'pointer',
                    whiteSpace: 'nowrap',
                  }}
                >
                  {label}
                </button>
              );
            },
          )}
        </div>

        {/* Timeline (visible in historique tab) — wired to patient.timeline. */}
        {tab === 'historique' && patient.timeline.length === 0 && (
          <div style={{ color: 'var(--ink-3)', fontSize: 13, padding: '8px 0' }}>
            Aucun événement enregistré.
          </div>
        )}
        {tab === 'historique' &&
          patient.timeline.map((e, i) => (
            <div className="m-card" key={`${e.date}-${i}`} style={{ marginBottom: 10 }}>
              <div style={{ padding: '12px 14px' }}>
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 8,
                    marginBottom: 4,
                  }}
                >
                  <span
                    style={{
                      fontSize: 11,
                      fontWeight: 600,
                      color: 'var(--primary)',
                      textTransform: 'uppercase',
                      letterSpacing: '0.06em',
                    }}
                  >
                    {e.kind}
                  </span>
                  <span style={{ fontSize: 11, color: 'var(--ink-4)' }}>•</span>
                  <span
                    style={{
                      fontSize: 12,
                      color: 'var(--ink-3)',
                      fontVariantNumeric: 'tabular-nums',
                    }}
                  >
                    {e.date}
                    {e.time ? ` · ${e.time}` : ''}
                  </span>
                </div>
                {(e.title || e.summary) && (
                  <div
                    style={{
                      fontSize: 13,
                      lineHeight: 1.5,
                      color: 'var(--ink-2)',
                      marginBottom: 4,
                    }}
                  >
                    {e.summary ?? e.title}
                  </div>
                )}
                {e.who && <div style={{ fontSize: 11, color: 'var(--ink-3)' }}>{e.who}</div>}
              </div>
            </div>
          ))}

        {tab === 'consults' && (
          <>
            {patientConsultations.length === 0 ? (
              <div style={{ color: 'var(--ink-3)', fontSize: 13, padding: '8px 0' }}>
                Aucune consultation enregistrée.
              </div>
            ) : (
              <div className="m-card">
                {patientConsultations.map((c, i) => {
                  const isSigned = c.status === 'SIGNEE';
                  return (
                    <button
                      key={c.id}
                      type="button"
                      onClick={() => navigate(`/consultations/${c.id}`)}
                      className="m-row"
                      style={{
                        width: '100%',
                        textAlign: 'left',
                        background: 'transparent',
                        border: 0,
                        borderTop:
                          i === 0 ? 'none' : '1px solid var(--border-soft)',
                        fontFamily: 'inherit',
                        font: 'inherit',
                        cursor: 'pointer',
                        WebkitTapHighlightColor: 'transparent',
                      }}
                    >
                      <div className="m-row-pri">
                        <div className="m-row-main">
                          Consultation #{c.id.slice(0, 8).toUpperCase()}
                        </div>
                        <div className="m-row-sub">
                          {new Date(c.startedAt).toLocaleDateString('fr-MA', {
                            day: '2-digit',
                            month: 'short',
                            year: 'numeric',
                          })}
                          {c.motif ? ` · ${c.motif.slice(0, 40)}` : ''}
                        </div>
                      </div>
                      <span
                        className={`m-pill ${isSigned ? 'done' : 'consult'}`}
                        style={{ marginRight: 6 }}
                      >
                        {isSigned ? (
                          <>
                            <Lock aria-hidden="true" /> Signée
                          </>
                        ) : (
                          'Brouillon'
                        )}
                      </span>
                    </button>
                  );
                })}
              </div>
            )}
          </>
        )}

        {tab === 'vitals' && <VitalsEvolutionPanel patientId={patient.id} />}

        {tab === 'rx' && (
          <>
            {patientPrescriptions.length === 0 ? (
              <div style={{ color: 'var(--ink-3)', fontSize: 13, padding: '8px 0' }}>
                Aucune ordonnance enregistrée.
              </div>
            ) : (
              <div className="m-card">
                {patientPrescriptions.map((p, i) => (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => navigate(`/prescriptions/${p.id}`)}
                    className="m-row"
                    style={{
                      width: '100%',
                      textAlign: 'left',
                      background: 'transparent',
                      border: 0,
                      borderTop:
                        i === 0 ? 'none' : '1px solid var(--border-soft)',
                      fontFamily: 'inherit',
                      font: 'inherit',
                      cursor: 'pointer',
                      WebkitTapHighlightColor: 'transparent',
                    }}
                  >
                    <div className="m-row-pri">
                      <div className="m-row-main">
                        {p.type ?? 'Ordonnance'} ·{' '}
                        {p.lines.length} ligne{p.lines.length > 1 ? 's' : ''}
                      </div>
                      <div className="m-row-sub">
                        {new Date(p.issuedAt).toLocaleDateString('fr-MA', {
                          day: '2-digit',
                          month: 'short',
                          year: 'numeric',
                        })}
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </>
        )}

        {tab === 'factu' && (
          <>
            {patientInvoices.length === 0 ? (
              <div style={{ color: 'var(--ink-3)', fontSize: 13, padding: '8px 0' }}>
                Aucune facture enregistrée.
              </div>
            ) : (
              <div className="m-card">
                {patientInvoices.map((inv, i) => {
                  const paid = inv.payments.reduce((s, x) => s + x.amount, 0);
                  return (
                    <button
                      key={inv.id}
                      type="button"
                      onClick={() => navigate(`/facturation/${inv.id}/apercu`)}
                      className="m-row"
                      style={{
                        width: '100%',
                        textAlign: 'left',
                        background: 'transparent',
                        border: 0,
                        borderTop:
                          i === 0 ? 'none' : '1px solid var(--border-soft)',
                        fontFamily: 'inherit',
                        font: 'inherit',
                        cursor: 'pointer',
                        WebkitTapHighlightColor: 'transparent',
                      }}
                    >
                      <div className="m-row-pri">
                        <div className="m-row-main">
                          {inv.number ??
                            `BR-${inv.id.slice(0, 8).toUpperCase()}`}{' '}
                          <span
                            style={{
                              fontSize: 11,
                              color: 'var(--ink-3)',
                              fontWeight: 500,
                            }}
                          >
                            · {INVOICE_STATUS_LABEL[inv.status]}
                          </span>
                        </div>
                        <div className="m-row-sub">
                          {new Date(
                            inv.issuedAt ?? inv.createdAt,
                          ).toLocaleDateString('fr-MA')}
                        </div>
                      </div>
                      <div style={{ textAlign: 'right' }}>
                        <div
                          className="tnum"
                          style={{ fontSize: 13, fontWeight: 600 }}
                        >
                          {inv.netAmount.toFixed(2).replace('.', ',')} MAD
                        </div>
                        {paid > 0 && (
                          <div
                            className="tnum"
                            style={{
                              fontSize: 11,
                              color: '#2E7D32',
                              marginTop: 2,
                            }}
                          >
                            {paid.toFixed(2).replace('.', ',')} payé
                          </div>
                        )}
                      </div>
                    </button>
                  );
                })}
              </div>
            )}
          </>
        )}

        {tab === 'admin' && (
          <div className="m-card">
            {patient.admin.map((a) => (
              <div
                key={a.k}
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  padding: '12px 14px',
                  borderBottom: '1px solid var(--border-soft)',
                  fontSize: 13,
                }}
              >
                <span style={{ color: 'var(--ink-3)' }}>{a.k}</span>
                <span className="tnum" style={{ fontWeight: 550 }}>
                  {a.v}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>

      {raw && (
        <EditPatientMobileSheet
          open={showEdit}
          onOpenChange={setShowEdit}
          patient={raw}
        />
      )}
    </MScreen>
  );
}
