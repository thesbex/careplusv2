/**
 * Smoke tests for Consultation (SOAP) — screen 06.
 * Covers: desktop + mobile render with mocked fixtures, SOAP fields,
 * accordion toggle on mobile, sign button opens confirmation dialog, a11y (jest-axe).
 *
 * Per ADR-018: run only this suite during development:
 *   npm test -- --run features/consultation
 */
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { axe } from 'jest-axe';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { createMemoryRouter, RouterProvider } from 'react-router-dom';
import ConsultationPage from '../ConsultationPage';
import ConsultationMobilePage from '../ConsultationPage.mobile';

// ── Helpers ──────────────────────────────────────────────

function renderDesktop() {
  const qc = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  const router = createMemoryRouter(
    [
      { path: '/consultations', element: <ConsultationPage /> },
      { path: '/agenda', element: <div>Agenda</div> },
      { path: '/patients', element: <div>Patients</div> },
      { path: '/salle', element: <div>Salle</div> },
      { path: '/facturation', element: <div>Facturation</div> },
      { path: '/parametres', element: <div>Paramètres</div> },
    ],
    { initialEntries: ['/consultations'] },
  );
  return render(
    <QueryClientProvider client={qc}>
      <RouterProvider router={router} />
    </QueryClientProvider>,
  );
}

function renderMobile() {
  const router = createMemoryRouter(
    [
      { path: '/consultations', element: <ConsultationMobilePage /> },
      { path: '/agenda', element: <div>Agenda</div> },
      { path: '/patients', element: <div>Patients</div> },
    ],
    { initialEntries: ['/consultations'] },
  );
  return render(<RouterProvider router={router} />);
}

// ── Desktop suite ────────────────────────────────────────

describe('<ConsultationPage /> (desktop)', () => {
  it('renders Screen shell with "Consultation en cours" title and patient sub', () => {
    const { container } = renderDesktop();
    expect(container.querySelector('.cp-topbar-title')).toHaveTextContent(
      'Consultation en cours',
    );
    expect(container.querySelector('.cp-topbar-sub')).toHaveTextContent('Mohamed Alami');
    expect(container.querySelector('.cp-topbar-sub')).toHaveTextContent('09:12');
  });

  it('renders patient context: name, age/sex, allergy, conditions', () => {
    renderDesktop();
    expect(screen.getByText('Mohamed Alami')).toBeInTheDocument();
    expect(screen.getByText(/52 ans/)).toBeInTheDocument();
    expect(screen.getByText(/Allergie : Pénicilline/)).toBeInTheDocument();
    expect(screen.getByText(/HTA · dyslipidémie/)).toBeInTheDocument();
  });

  it('renders vitals panel with TA and IMC (both amber-warned)', () => {
    renderDesktop();
    expect(screen.getByText('Constantes 09:04')).toBeInTheDocument();
    expect(screen.getByText('135 / 85')).toBeInTheDocument();
    expect(screen.getByText('27,4')).toBeInTheDocument();
  });

  it('renders current medications', () => {
    renderDesktop();
    expect(screen.getByText('Amlodipine 5 mg')).toBeInTheDocument();
    expect(screen.getByText('Atorvastatine 20 mg')).toBeInTheDocument();
    expect(screen.getByText('Aspirine 100 mg')).toBeInTheDocument();
  });

  it('renders SOAP section headers', () => {
    renderDesktop();
    expect(screen.getByText(/Subjectif — anamnèse/)).toBeInTheDocument();
    expect(screen.getByText(/Objectif — examen/)).toBeInTheDocument();
    expect(screen.getByText(/Appréciation — diagnostic/)).toBeInTheDocument();
    expect(screen.getByText(/Plan — conduite à tenir/)).toBeInTheDocument();
  });

  it('renders SOAP subjectif text verbatim from fixture', () => {
    renderDesktop();
    expect(
      screen.getByText(/Patient hypertendu connu depuis 2018/),
    ).toBeInTheDocument();
  });

  it('renders diagnosis pills with CIM-10 codes', () => {
    renderDesktop();
    expect(screen.getByText('I10')).toBeInTheDocument();
    expect(screen.getByText(/Hypertension essentielle/)).toBeInTheDocument();
    expect(screen.getByText('E78.5')).toBeInTheDocument();
    expect(screen.getByText(/Dyslipidémie non précisée/)).toBeInTheDocument();
  });

  it('renders plan lines', () => {
    renderDesktop();
    expect(screen.getByText(/Prescription — ajustement Amlodipine/)).toBeInTheDocument();
    expect(screen.getByText(/Analyses — bilan lipidique/)).toBeInTheDocument();
  });

  it('renders "En consultation" status pill', () => {
    renderDesktop();
    expect(screen.getByText(/En consultation/)).toBeInTheDocument();
  });

  it('renders toolbar buttons: Modèles and CIM-10', () => {
    renderDesktop();
    expect(screen.getByRole('button', { name: /Modèles/ })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /CIM-10/ })).toBeInTheDocument();
  });

  it('renders footer: autosave text, Suspendre, Certificat, Clôturer', () => {
    renderDesktop();
    expect(screen.getByText(/Enregistré automatiquement/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Suspendre/ })).toBeInTheDocument();
    // "Certificat" appears in both footer and quick-actions panel — use getAllByRole
    expect(screen.getAllByRole('button', { name: /Certificat/ }).length).toBeGreaterThanOrEqual(1);
    expect(screen.getByRole('button', { name: /Clôturer et facturer/ })).toBeInTheDocument();
  });

  it('renders quick actions panel: Prescription, Bon d\'analyses, Bon d\'imagerie', () => {
    renderDesktop();
    expect(screen.getByRole('button', { name: /Prescription médicaments/ })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Bon d'analyses/ })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Bon d'imagerie/ })).toBeInTheDocument();
  });

  it('renders generated document row', () => {
    renderDesktop();
    expect(screen.getByText(/Ordonnance — 3 médicaments/)).toBeInTheDocument();
    expect(screen.getByText(/Non signée · brouillon/)).toBeInTheDocument();
  });

  it('renders billing panel with 250,00 MAD', () => {
    renderDesktop();
    expect(screen.getAllByText('250,00 MAD').length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText('Total à régler')).toBeInTheDocument();
  });

  it('opens sign confirmation dialog on Clôturer click', async () => {
    const user = userEvent.setup();
    renderDesktop();
    const signBtn = screen.getByRole('button', { name: /Clôturer et facturer/ });
    await user.click(signBtn);
    expect(
      screen.getByRole('dialog', { name: /Signer et verrouiller la consultation/ }),
    ).toBeInTheDocument();
    expect(screen.getByText(/Cette action va verrouiller la consultation/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Confirmer et clôturer/ })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Annuler/ })).toBeInTheDocument();
  });

  it('closes dialog on Annuler click', async () => {
    const user = userEvent.setup();
    renderDesktop();
    await user.click(screen.getByRole('button', { name: /Clôturer et facturer/ }));
    await user.click(screen.getByRole('button', { name: /Annuler/ }));
    expect(
      screen.queryByRole('dialog', { name: /Signer et verrouiller la consultation/ }),
    ).not.toBeInTheDocument();
  });

  it('has no a11y violations', async () => {
    const { container } = renderDesktop();
    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });
});

// ── Mobile suite ─────────────────────────────────────────

describe('<ConsultationMobilePage />', () => {
  it('renders mobile topbar with "Consultation" title and patient sub', () => {
    const { container } = renderMobile();
    expect(container.querySelector('.mt-title')).toHaveTextContent('Consultation');
    expect(container.querySelector('.mt-sub')).toHaveTextContent('Mohamed Alami');
  });

  it('renders patient context strip with name, meta and allergy pill', () => {
    renderMobile();
    expect(screen.getByText('Mohamed Alami')).toBeInTheDocument();
    expect(screen.getByText(/HTA · TA 135\/85/)).toBeInTheDocument();
    expect(screen.getByText(/Pénicilline/)).toBeInTheDocument();
  });

  it('renders 4 vitals tiles', () => {
    renderMobile();
    expect(screen.getByText('TA')).toBeInTheDocument();
    expect(screen.getByText('FC')).toBeInTheDocument();
    expect(screen.getByText('T°')).toBeInTheDocument();
    expect(screen.getByText('SpO₂')).toBeInTheDocument();
  });

  it('renders all 4 SOAP accordion sections initially open', () => {
    renderMobile();
    expect(screen.getByText('Subjectif')).toBeInTheDocument();
    expect(screen.getByText('Objectif')).toBeInTheDocument();
    expect(screen.getByText('Analyse')).toBeInTheDocument();
    expect(screen.getByText('Plan')).toBeInTheDocument();
    // Content should be visible (not hidden) because all start open
    expect(screen.getByText(/céphalées matinales/)).toBeInTheDocument();
    expect(screen.getByText(/TA 135\/85 à 2 reprises/)).toBeInTheDocument();
  });

  it('toggles accordion section on click', async () => {
    const user = userEvent.setup();
    renderMobile();
    const subjectifBtn = screen.getByRole('button', { name: /Subjectif/ });
    // Initially open — content visible
    expect(subjectifBtn).toHaveAttribute('aria-expanded', 'true');
    // Click to close
    await user.click(subjectifBtn);
    expect(subjectifBtn).toHaveAttribute('aria-expanded', 'false');
    // Click to reopen
    await user.click(subjectifBtn);
    expect(subjectifBtn).toHaveAttribute('aria-expanded', 'true');
  });

  it('renders Rx and Clôturer action buttons', () => {
    renderMobile();
    expect(screen.getByRole('button', { name: /Prescription/ })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Clôturer/ })).toBeInTheDocument();
  });

  it('has no a11y violations', async () => {
    const { container } = renderMobile();
    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });
});
