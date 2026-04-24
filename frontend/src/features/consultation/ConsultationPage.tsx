/**
 * Screen 06 — Consultation (SOAP) desktop.
 * Ported verbatim from design/prototype/screens/consultation.jsx (EcranConsultation).
 *
 * Layout: 3-column grid (280px patient context | flex-1 SOAP editor | 320px quick actions).
 * Backend dependency: J5 consultation module — currently uses fixtures via useConsultation.
 * TODO(backend:J5): swap useConsultation to real TanStack Query once
 *   GET /api/consultations/:id and PUT /api/consultations/:id ship.
 */
import { useNavigate, useParams } from 'react-router-dom';
import { Screen } from '@/components/shell/Screen';
import { Button } from '@/components/ui/Button';
import { Panel } from '@/components/ui/Panel';
import { Pill } from '@/components/ui/Pill';
import { Check, Doc, Clipboard, Print } from '@/components/icons';
import { PatientContextCard } from './components/PatientContextCard';
import { SoapEditor, ActionBtn, DocRow } from './components/SoapEditor';
import { SignatureLock } from './components/SignatureLock';
import { useConsultation } from './hooks/useConsultation';
import './consultation.css';

export default function ConsultationPage() {
  const navigate = useNavigate();
  const { id } = useParams<{ id?: string }>();
  const { patient, session } = useConsultation(id);

  return (
    <Screen
      active="consult"
      title="Consultation en cours"
      sub={`${session.patientName} · Débutée à ${session.startedAt}`}
      onNavigate={(id) => {
        const map = {
          agenda: '/agenda',
          patients: '/patients',
          salle: '/salle',
          consult: '/consultations',
          factu: '/facturation',
          params: '/parametres',
        } as const;
        navigate(map[id]);
      }}
    >
      <div className="cs-layout">
        {/* Left: patient at a glance */}
        <PatientContextCard patient={patient} />

        {/* Center: SOAP notes */}
        <div className="cs-soap-col">
          <div className="cs-soap-toolbar">
            <Pill status="consult" dot>
              En consultation
            </Pill>
            <span className="tnum" style={{ fontSize: 12, color: 'var(--ink-3)' }}>
              {session.box} · Démarrée {session.startedAt} ·{' '}
              <strong style={{ color: 'var(--ink)' }}>{session.timer}</strong>
            </span>
            <div style={{ marginLeft: 'auto', display: 'flex', gap: 8 }}>
              <Button size="sm">
                <Doc /> Modèles
              </Button>
              <Button size="sm">
                <Clipboard /> CIM-10
              </Button>
            </div>
          </div>

          <div className="cs-soap-body scroll">
            <SoapEditor
              subjectif={session.soap.subjectif}
              objectif={session.soap.objectif}
              diagnoses={session.diagnoses}
              plan={session.plan}
            />
          </div>

          <div className="cs-soap-footer">
            <span className="cs-autosave">
              <Check aria-hidden="true" /> Enregistré automatiquement · {session.autoSavedAt}
            </span>
            <div style={{ marginLeft: 'auto', display: 'flex', gap: 8 }}>
              <Button>Suspendre</Button>
              <Button>
                <Print /> Certificat
              </Button>
              <SignatureLock />
            </div>
          </div>
        </div>

        {/* Right: actions rapides */}
        <div className="cs-actions-col scroll">
          <div className="cs-section-h">Actions</div>

          <div className="cs-actions-list">
            <ActionBtn
              icon="Pill"
              color="primary"
              label="Prescription médicaments"
              sub="Ordonnance · 1 en cours"
            />
            <ActionBtn icon="Flask" label="Bon d'analyses" sub="Biologie médicale" />
            <ActionBtn icon="Scan" label="Bon d'imagerie" sub="Radio · écho · IRM" />
            <ActionBtn icon="Doc" label="Certificat médical" />
            <ActionBtn icon="Calendar" label="Prochain RDV" />
          </div>

          <div className="cs-section-h" style={{ marginTop: 18 }}>
            Documents générés
          </div>
          <div className="cs-docs-list">
            <DocRow title="Ordonnance — 3 médicaments" meta="Non signée · brouillon" />
          </div>

          <div className="cs-section-h" style={{ marginTop: 18 }}>
            Facturation
          </div>
          <Panel className="cs-billing-panel">
            <div className="cs-billing-row">
              <span style={{ color: 'var(--ink-3)' }}>Consultation</span>
              <span className="tnum">250,00 MAD</span>
            </div>
            <div className="cs-billing-total">
              <span>Total à régler</span>
              <span className="tnum">250,00 MAD</span>
            </div>
          </Panel>
        </div>
      </div>
    </Screen>
  );
}
