/**
 * Screen 03 — Dossier patient (desktop).
 * Ported from design/prototype/screens/dossier-patient.jsx.
 * Backend dependency: J3 patient module — currently uses fixtures via usePatient.
 * TODO(backend:J3): swap usePatient to real TanStack Query once GET /api/patients/:id ships.
 */
import { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Screen } from '@/components/shell/Screen';
import { usePatient } from './hooks/usePatient';
import { PatientHeader, AllergyStrip } from './components/PatientHeader';
import { DossierTabs, DossierTabPanel } from './components/DossierTabs';
import { TimelinePanel } from './components/TimelinePanel';
import { SummaryPanel } from './components/SummaryPanel';
import type { DossierTab } from './types';
import './dossier-patient.css';

export default function DossierPage() {
  const { id } = useParams<{ id?: string }>();
  const navigate = useNavigate();
  const { patient } = usePatient(id);
  const [tab, setTab] = useState<DossierTab>('timeline');

  return (
    <Screen
      active="patients"
      title="Patients"
      sub={`${patient.fullName} · Dossier N° ${patient.dossierNo}`}
      onNavigate={(navId) => {
        const map = {
          agenda: '/agenda',
          patients: '/patients',
          salle: '/salle',
          consult: '/consultations',
          factu: '/facturation',
          params: '/parametres',
        } as const;
        navigate(map[navId]);
      }}
    >
      <div style={{ display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0 }}>
        <PatientHeader patient={patient} />
        <AllergyStrip patient={patient} />

        <DossierTabs value={tab} onValueChange={setTab}>
          <DossierTabPanel value="timeline">
            <div className="dp-content">
              <TimelinePanel events={patient.timeline} />
              <SummaryPanel patient={patient} />
            </div>
          </DossierTabPanel>

          {/* Remaining tabs — placeholder content per prototype (tabs exist but only
              Chronologie is shown in the design). Future screens will fill these. */}
          <DossierTabPanel value="consults">
            <div style={{ padding: '20px 24px', color: 'var(--ink-3)', fontSize: 13 }}>
              14 consultations — à venir J5
            </div>
          </DossierTabPanel>

          <DossierTabPanel value="prescr">
            <div style={{ padding: '20px 24px', color: 'var(--ink-3)', fontSize: 13 }}>
              22 prescriptions — à venir J6
            </div>
          </DossierTabPanel>

          <DossierTabPanel value="analyses">
            <div style={{ padding: '20px 24px', color: 'var(--ink-3)', fontSize: 13 }}>
              9 analyses — à venir
            </div>
          </DossierTabPanel>

          <DossierTabPanel value="imagerie">
            <div style={{ padding: '20px 24px', color: 'var(--ink-3)', fontSize: 13 }}>
              3 imageries — à venir
            </div>
          </DossierTabPanel>

          <DossierTabPanel value="docs">
            <div style={{ padding: '20px 24px', color: 'var(--ink-3)', fontSize: 13 }}>
              7 documents — à venir
            </div>
          </DossierTabPanel>

          <DossierTabPanel value="factu">
            <div style={{ padding: '20px 24px', color: 'var(--ink-3)', fontSize: 13 }}>
              14 factures — à venir J7
            </div>
          </DossierTabPanel>
        </DossierTabs>
      </div>
    </Screen>
  );
}
