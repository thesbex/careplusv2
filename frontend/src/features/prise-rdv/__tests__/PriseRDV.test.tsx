/**
 * Smoke tests for Prise de RDV — screen 02.
 *
 * Desktop: opens the Radix Dialog, checks form fields, close button.
 * Mobile: renders the full-screen form page.
 * Both: jest-axe a11y check.
 */
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { axe } from 'jest-axe';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { createMemoryRouter, RouterProvider } from 'react-router-dom';
import { PriseRDVDialog } from '../PriseRDVDialog';
import PriseRDVMobilePage from '../PriseRDVPage.mobile';
import { REASON_OPTIONS, MOBILE_SLOTS, AVAILABLE_SLOTS_HINT, PATIENT_SUGGESTIONS } from '../fixtures';

vi.mock('../hooks/useReasons', () => ({
  useReasons: () => ({ reasons: REASON_OPTIONS, isLoading: false, error: null }),
}));
vi.mock('../hooks/useAvailability', () => ({
  useAvailability: () => ({ slots: MOBILE_SLOTS, hintText: AVAILABLE_SLOTS_HINT, isLoading: false, error: null }),
}));
vi.mock('../hooks/usePatientSearch', () => ({
  usePatientSearch: () => ({ candidates: PATIENT_SUGGESTIONS, isLoading: false, error: null }),
}));
vi.mock('../hooks/useCreateAppointment', () => ({
  useCreateAppointment: () => ({ createAppointment: async () => ({ id: 'test-id' }), isPending: false, error: null }),
}));

// ── helpers ──────────────────────────────────────────────────────────────────

function makeQC() {
  return new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
}

function renderDialog(open = true) {
  const qc = makeQC();
  return render(
    <QueryClientProvider client={qc}>
      <PriseRDVDialog open={open} onOpenChange={() => {}} />
    </QueryClientProvider>,
  );
}

function renderMobilePage() {
  const qc = makeQC();
  const router = createMemoryRouter(
    [
      { path: '/rdv/new', element: <PriseRDVMobilePage /> },
      { path: '/agenda', element: <div>Agenda</div> },
    ],
    { initialEntries: ['/rdv/new'] },
  );
  return render(
    <QueryClientProvider client={qc}>
      <RouterProvider router={router} />
    </QueryClientProvider>,
  );
}

// ── Desktop dialog ────────────────────────────────────────────────────────────

describe('<PriseRDVDialog />', () => {
  it('renders with the correct dialog title', () => {
    renderDialog();
    expect(screen.getByRole('dialog')).toBeInTheDocument();
    expect(screen.getByText('Nouveau rendez-vous')).toBeInTheDocument();
  });

  it('renders the three step labels', () => {
    renderDialog();
    expect(screen.getByText(/Étape 1 · Patient/i)).toBeInTheDocument();
    expect(screen.getByText(/Étape 2 · Créneau/i)).toBeInTheDocument();
    expect(screen.getByText(/Étape 3 · Motif/i)).toBeInTheDocument();
  });

  it('renders the patient search input empty by default', () => {
    renderDialog();
    const input = screen.getByPlaceholderText('Nom, téléphone ou CIN…');
    expect(input).toBeInTheDocument();
    expect(input).toHaveValue('');
  });

  it('shows the 3 patient candidates for default query', () => {
    renderDialog();
    expect(screen.getByText('Salma Bennani')).toBeInTheDocument();
    expect(screen.getByText('Salma Benkirane')).toBeInTheDocument();
    expect(screen.getByText('Salim Bouazzaoui')).toBeInTheDocument();
  });

  it('selecting a candidate highlights it', () => {
    renderDialog();
    const row = screen.getByRole('option', { name: /Salma Bennani/ });
    fireEvent.click(row);
    expect(row).toHaveAttribute('aria-selected', 'true');
  });

  it('renders date, time, and duration fields with sensible defaults', () => {
    renderDialog();
    // Date defaults to today in JJ/MM/AAAA
    const today = new Date();
    const dd = String(today.getDate()).padStart(2, '0');
    const mm = String(today.getMonth() + 1).padStart(2, '0');
    expect(screen.getByLabelText('Date')).toHaveValue(`${dd}/${mm}/${today.getFullYear()}`);
    expect(screen.getByLabelText('Heure')).toHaveValue('09:00');
    // Duration select defaults to 20 minutes
    const dur = screen.getByLabelText('Durée') as HTMLSelectElement;
    expect(dur.value).toBe('20');
  });

  it('renders all 6 reason type buttons', () => {
    renderDialog();
    [
      'Première consultation',
      'Consultation de suivi',
      'Renouvellement',
      'Résultats',
      'Vaccination',
      'Certificat',
    ].forEach((label) => {
      expect(screen.getByRole('button', { name: label })).toBeInTheDocument();
    });
  });

  it('auto-selects the first reason once reasons load', async () => {
    renderDialog();
    // Fixture REASON_OPTIONS[0] is "Première consultation"
    const btn = await screen.findByRole('button', { name: 'Première consultation' });
    expect(btn).toHaveAttribute('aria-pressed', 'true');
  });

  it('renders the notes textarea with correct placeholder', () => {
    renderDialog();
    expect(
      screen.getByPlaceholderText(
        /Apporter carnet de vaccination/,
      ),
    ).toBeInTheDocument();
  });

  it('renders the SMS confirmation checkbox checked by default', () => {
    renderDialog();
    const cb = screen.getByRole('checkbox', { name: /Envoyer un SMS de confirmation/ });
    expect(cb).toBeChecked();
  });

  it('renders Annuler and Confirmer le RDV footer buttons', () => {
    renderDialog();
    expect(screen.getByRole('button', { name: 'Annuler' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Confirmer le RDV' })).toBeInTheDocument();
  });

  it('renders the close button in the header', () => {
    renderDialog();
    expect(screen.getByRole('button', { name: 'Fermer' })).toBeInTheDocument();
  });

  it('renders the slot hint with available slots text', () => {
    renderDialog();
    expect(screen.getByText(/Créneaux libres vendredi/)).toBeInTheDocument();
    expect(screen.getByText('10:30')).toBeInTheDocument();
  });

  it('does not render when open=false', () => {
    renderDialog(false);
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('has no serious a11y violations when open', async () => {
    const { container } = renderDialog();
    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });
});

// ── Mobile page ───────────────────────────────────────────────────────────────

describe('<PriseRDVMobilePage />', () => {
  it('renders the mobile topbar with "Nouveau RDV" title', () => {
    renderMobilePage();
    expect(screen.getByText('Nouveau RDV')).toBeInTheDocument();
  });

  it('renders the step sub-label "Étape 2/3"', () => {
    renderMobilePage();
    expect(screen.getByText('Étape 2/3')).toBeInTheDocument();
  });

  it('renders the back button and Annuler action', () => {
    renderMobilePage();
    expect(screen.getByRole('button', { name: 'Retour' })).toBeInTheDocument();
    expect(screen.getByText('Annuler')).toBeInTheDocument();
  });

  it('renders the patient card with Changer button', () => {
    renderMobilePage();
    // No patientId in URL → shows "Aucun patient"
    expect(screen.getByText('Aucun patient')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Changer de patient' })).toBeInTheDocument();
  });

  it('renders the reason select with options from hook', () => {
    renderMobilePage();
    const select = screen.getByLabelText('Motif de consultation') as HTMLSelectElement;
    expect(select).toBeInTheDocument();
    // First option from REASON_OPTIONS fixture is 'premiere'
    expect(select.options.length).toBeGreaterThan(0);
  });

  it('renders the duration segmented control with 20 min active', () => {
    renderMobilePage();
    const btn = screen.getByRole('button', { name: '20 min' });
    expect(btn).toBeInTheDocument();
    expect(btn).toHaveAttribute('aria-pressed', 'true');
  });

  it('renders 10 slot buttons', () => {
    renderMobilePage();
    expect(screen.getByRole('button', { name: '10:30' })).toBeInTheDocument();
    // Check 10 slots rendered via group
    const slotGroup = screen.getByRole('group', { name: 'Créneaux disponibles' });
    expect(slotGroup.querySelectorAll('button').length).toBe(10);
  });

  it('no slot is selected by default (user must pick one)', () => {
    renderMobilePage();
    const slotGroup = screen.getByRole('group', { name: 'Créneaux disponibles' });
    const selected = Array.from(slotGroup.querySelectorAll('button')).filter(
      (b) => b.getAttribute('aria-pressed') === 'true',
    );
    expect(selected).toHaveLength(0);
  });

  it('selecting a slot marks it as selected', () => {
    renderMobilePage();
    const slot = screen.getByRole('button', { name: '10:30' });
    fireEvent.click(slot);
    expect(slot).toHaveAttribute('aria-pressed', 'true');
  });

  it('renders the notes textarea with correct placeholder', () => {
    renderMobilePage();
    expect(
      screen.getByPlaceholderText('Ex. Résultats du bilan disponibles'),
    ).toBeInTheDocument();
  });

  it('renders "Confirmer le rendez-vous" submit button', () => {
    renderMobilePage();
    expect(screen.getByRole('button', { name: /Confirmer le rendez-vous/ })).toBeInTheDocument();
  });

  it('does not render bottom tabs (noTabs)', () => {
    const { container } = renderMobilePage();
    // MTabs renders .mtabs — should not be present with noTabs
    expect(container.querySelector('.mtabs')).not.toBeInTheDocument();
  });

  it('has no serious a11y violations', async () => {
    const { container } = renderMobilePage();
    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });
});
