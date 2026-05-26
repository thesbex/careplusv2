/**
 * Régression mobile — onglet « Séjours » du dossier patient (390 px).
 *
 * Bottle de la walk manual-qa du 2026-05-26 : le module hospitalisation avait
 * son worklist responsive mais l'onglet Séjours du dossier restait desktop-only.
 * On verrouille ici les deux invariants de parité :
 *   1. capability OFF  → l'onglet n'apparaît pas (cabinet GP simple).
 *   2. capability ON   → l'onglet apparaît et rend le séjour (StaysTab).
 */
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { createMemoryRouter, RouterProvider } from 'react-router-dom';
import DossierMobilePage from '../DossierPage.mobile';
import { PATIENT_MOHAMED_ALAMI } from '../fixtures';
import type { StayDetail } from '@/features/hospitalisation/hooks/useStays';

// Flag de capability + jeu de séjours pilotables par test (hoisted pour vi.mock).
const h = vi.hoisted(() => ({
  hospitalizationEnabled: false,
  stays: [] as StayDetail[],
}));

vi.mock('@/features/parametres/hooks/useSettings', () => ({
  useClinicSettings: () => ({ settings: { hospitalizationEnabled: h.hospitalizationEnabled } }),
}));

vi.mock('@/features/hospitalisation/hooks/useStays', () => ({
  usePatientStays: () => ({ stays: h.stays, isLoading: false, error: null }),
}));

// Hooks réseau du dossier — neutralisés (le test cible la parité d'onglet, pas les data).
vi.mock('@/features/consultation/hooks/useConsultations', () => ({
  useConsultations: () => ({ consultations: [], isLoading: false, error: null, refetch: () => Promise.resolve() }),
}));
vi.mock('@/features/salle-attente/hooks/useStartConsultation', () => ({
  useStartConsultation: () => ({ startConsultation: () => Promise.resolve({ id: 'c1' }), isPending: false, error: null }),
}));
vi.mock('@/features/prescription/hooks/usePrescriptions', () => ({
  usePrescriptionsForPatient: () => ({ prescriptions: [], isLoading: false, error: null }),
}));
vi.mock('@/features/facturation/hooks/useInvoices', () => ({
  useInvoicesForPatient: () => ({ invoices: [], isLoading: false, error: null }),
}));
vi.mock('../hooks/usePatient', () => ({
  usePatient: () => ({
    patient: PATIENT_MOHAMED_ALAMI,
    raw: { id: PATIENT_MOHAMED_ALAMI.id, firstName: 'Mohamed', lastName: 'Alami', gender: 'M', allergies: [], antecedents: [] },
    isLoading: false,
    error: null,
  }),
}));

function makeStay(): StayDetail {
  return {
    id: 'stay-qa-1',
    patientId: PATIENT_MOHAMED_ALAMI.id,
    patientFirstName: 'Mohamed',
    patientLastName: 'Alami',
    status: 'EN_COURS',
    admissionReason: 'QA mobile — vérif onglet Séjours',
    attendingPractitionerId: null,
    admittedAt: '2026-05-26T09:00:00Z',
    dischargedAt: null,
    dischargeType: null,
    dischargeSummary: null,
    invoiceId: null,
    assignments: [
      { id: 'a1', bedId: 'b1', bedLabel: 'Chambre 102 · Lit A', wardLabel: 'Maternité', dailyRate: 400, fromAt: '2026-05-26T09:00:00Z', toAt: null, nights: 1 },
    ],
    chargePreview: [],
    chargeTotal: 400,
  };
}

function renderMobileDossier() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  const router = createMemoryRouter(
    [
      { path: '/patients/:id', element: <DossierMobilePage /> },
      { path: '/agenda', element: <div>Agenda</div> },
    ],
    { initialEntries: ['/patients/PT-00482'] },
  );
  return render(
    <QueryClientProvider client={qc}>
      <RouterProvider router={router} />
    </QueryClientProvider>,
  );
}

describe('<DossierMobilePage /> — onglet Séjours (parité hospitalisation)', () => {
  it('masque l\'onglet Séjours quand l\'hospitalisation est désactivée', () => {
    h.hospitalizationEnabled = false;
    h.stays = [];
    renderMobileDossier();
    expect(screen.getByRole('tablist', { name: 'Sections' })).toBeInTheDocument();
    expect(screen.queryByRole('tab', { name: 'Séjours' })).not.toBeInTheDocument();
  });

  it('affiche l\'onglet Séjours et rend le séjour quand l\'hospitalisation est activée', async () => {
    h.hospitalizationEnabled = true;
    h.stays = [makeStay()];
    const user = userEvent.setup();
    renderMobileDossier();

    const sejoursTab = screen.getByRole('tab', { name: 'Séjours' });
    expect(sejoursTab).toBeInTheDocument();

    await user.click(sejoursTab);
    expect(sejoursTab).toHaveAttribute('aria-selected', 'true');

    // StaysTab rend le séjour EN_COURS : statut, motif, lit + coût total.
    expect(screen.getByTestId('patient-stay-stay-qa-1')).toBeInTheDocument();
    expect(screen.getByText('En cours')).toBeInTheDocument();
    expect(screen.getByText(/QA mobile — vérif onglet Séjours/)).toBeInTheDocument();
    expect(screen.getByText(/Chambre 102 · Lit A/)).toBeInTheDocument();
    expect(screen.getByText(/400 MAD/)).toBeInTheDocument();
  });
});
