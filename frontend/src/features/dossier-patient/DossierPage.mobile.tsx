/**
 * Screen 03 — Dossier patient (mobile).
 * Ported from design/prototype/mobile/screens.jsx:MDossier.
 * Backend dependency: J3 patient module — currently uses fixtures via usePatient.
 * TODO(backend:J3): swap usePatient to real TanStack Query once GET /api/patients/:id ships.
 */
import { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { MScreen } from '@/components/shell/MScreen';
import { MTopbar, MIconBtn } from '@/components/shell/MTopbar';
import type { MobileTab } from '@/components/shell/MTabs';
import { Warn, Phone, Calendar, Pill as PillIcon, File } from '@/components/icons';
import { usePatient } from './hooks/usePatient';
import type { MobileDossierTab } from './types';

const MOBILE_TIMELINE = [
  {
    date: '23 avr 2026',
    kind: 'Consultation',
    who: 'Dr. K. El Amrani',
    summary: 'TA 135/85 — Légère augmentation. Bilan lipidique demandé.',
  },
  {
    date: '25 mar 2026',
    kind: 'Analyse',
    who: 'Labo Atlas',
    summary: 'Cholestérol total 2.35 g/L, LDL 1.58 g/L, HDL 0.42 g/L',
  },
  {
    date: '18 mar 2026',
    kind: 'Consultation',
    who: 'Dr. K. El Amrani',
    summary: 'Examen cardiovasculaire normal.',
  },
];

const QUICK_ACTIONS = [
  { ico: Phone, lbl: 'Appeler' },
  { ico: Calendar, lbl: 'RDV' },
  { ico: PillIcon, lbl: 'Rx' },
  { ico: File, lbl: 'Notes' },
] as const;

export default function DossierMobilePage() {
  const { id } = useParams<{ id?: string }>();
  const navigate = useNavigate();
  const { patient } = usePatient(id);
  const [tab, setTab] = useState<MobileDossierTab>('historique');

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
          right={<MIconBtn icon="MoreH" label="Plus d'actions" />}
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
          {/* Mobile prototype shows "H · 58 ans · CIN BE 138 475" verbatim */}
          <div className="m-phead-meta">H · 58 ans · CIN BE 138 475</div>
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
        {/* Quick action buttons */}
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: '1fr 1fr 1fr 1fr',
            gap: 8,
            marginBottom: 16,
          }}
        >
          {QUICK_ACTIONS.map(({ ico: Ico, lbl }) => (
            <button
              key={lbl}
              type="button"
              style={{
                background: 'var(--bg-alt)',
                border: 0,
                borderRadius: 10,
                padding: '10px 4px',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: 4,
                color: 'var(--ink)',
                fontSize: 11,
                fontWeight: 550,
                cursor: 'pointer',
                fontFamily: 'inherit',
              }}
              aria-label={lbl}
            >
              <Ico aria-hidden="true" />
              <span>{lbl}</span>
            </button>
          ))}
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

        {/* Segmented tab control */}
        <div className="m-segmented" role="tablist" aria-label="Sections">
          {(['historique', 'analyses', 'admin'] as MobileDossierTab[]).map((t) => (
            <button
              key={t}
              type="button"
              role="tab"
              aria-selected={tab === t}
              className={tab === t ? 'on' : ''}
              onClick={() => setTab(t)}
            >
              {t === 'historique' ? 'Historique' : t === 'analyses' ? 'Analyses' : 'Admin.'}
            </button>
          ))}
        </div>

        {/* Timeline (visible in historique tab) */}
        {tab === 'historique' &&
          MOBILE_TIMELINE.map((e, i) => (
            <div className="m-card" key={i} style={{ marginBottom: 10 }}>
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
                  </span>
                </div>
                <div
                  style={{
                    fontSize: 13,
                    lineHeight: 1.5,
                    color: 'var(--ink-2)',
                    marginBottom: 4,
                  }}
                >
                  {e.summary}
                </div>
                <div style={{ fontSize: 11, color: 'var(--ink-3)' }}>{e.who}</div>
              </div>
            </div>
          ))}

        {tab === 'analyses' && (
          <div style={{ color: 'var(--ink-3)', fontSize: 13, padding: '8px 0' }}>
            Analyses — à venir
          </div>
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
    </MScreen>
  );
}
