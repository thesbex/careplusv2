/**
 * Grossesse module — component tests (Étape 4 frontend).
 * Run only this slice during development :
 *   cd frontend && npx vitest run features/grossesse
 *
 * Covers (>= 10 scenarios) :
 *  - PregnancyTab : empty state when no current pregnancy
 *  - PregnancyTab : SA + DPA + 8-chip plan when EN_COURS
 *  - PregnancyVisitDrawer : HU hidden if SA<20, visible if SA>=20
 *  - PregnancyVisitDrawer : TA out of range → error message
 *  - PregnancyUltrasoundDrawer : correctsDueDate visible only if T1_DATATION
 *  - PregnancyDeclareDialog : LMP in future → zod error
 *  - PregnancyCloseDialog : outcome required
 *  - CreateChildDialog : sex required
 *  - BioPanelButton : click → calls hook + propagates template
 *  - PregnancyAlertsBanner : one row per alert, severity CSS class
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

const noop = (): void => undefined;

import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';
import type { ReactNode } from 'react';

// ── Auth mock — default MEDECIN ────────────────────────────────────────────
vi.mock('@/lib/auth/authStore', () => ({
  useAuthStore: vi.fn(
    (selector: (s: { user: { roles: string[]; permissions: string[] } | null }) => unknown) =>
      selector({ user: { roles: ['MEDECIN'], permissions: [] } }),
  ),
}));

// ── Hook mocks ─────────────────────────────────────────────────────────────
vi.mock('../hooks/useCurrentPregnancy', () => ({ useCurrentPregnancy: vi.fn() }));
vi.mock('../hooks/usePregnancies', () => ({ usePregnancies: vi.fn() }));
vi.mock('../hooks/usePregnancyVisits', () => ({ usePregnancyVisits: vi.fn() }));
vi.mock('../hooks/usePregnancyUltrasounds', () => ({ usePregnancyUltrasounds: vi.fn() }));
vi.mock('../hooks/usePregnancyAlerts', () => ({ usePregnancyAlerts: vi.fn() }));
vi.mock('../hooks/usePregnancyPlan', () => ({ usePregnancyPlan: vi.fn() }));
vi.mock('../hooks/useDeclarePregnancy', () => ({
  useDeclarePregnancy: vi.fn(() => ({ mutateAsync: vi.fn().mockResolvedValue({ id: 'preg-new' }), isPending: false })),
}));
vi.mock('../hooks/useClosePregnancy', () => ({
  useClosePregnancy: vi.fn(() => ({ mutateAsync: vi.fn().mockResolvedValue({}), isPending: false })),
}));
vi.mock('../hooks/useCreateChildFromPregnancy', () => ({
  useCreateChildFromPregnancy: vi.fn(() => ({
    mutateAsync: vi.fn().mockResolvedValue({ childPatientId: 'child-1', pregnancyId: 'preg-1' }),
    isPending: false,
  })),
}));
vi.mock('../hooks/useRecordVisit', () => ({
  useRecordVisit: vi.fn(() => ({ mutateAsync: vi.fn().mockResolvedValue({}), isPending: false })),
}));
vi.mock('../hooks/useRecordUltrasound', () => ({
  useRecordUltrasound: vi.fn(() => ({ mutateAsync: vi.fn().mockResolvedValue({}), isPending: false })),
}));
vi.mock('../hooks/useBioPanelTemplate', () => ({
  useBioPanelTemplate: vi.fn(),
}));

// ── Imports after mocks ────────────────────────────────────────────────────
import { useCurrentPregnancy } from '../hooks/useCurrentPregnancy';
import { usePregnancies } from '../hooks/usePregnancies';
import { usePregnancyVisits } from '../hooks/usePregnancyVisits';
import { usePregnancyUltrasounds } from '../hooks/usePregnancyUltrasounds';
import { usePregnancyAlerts } from '../hooks/usePregnancyAlerts';
import { usePregnancyPlan } from '../hooks/usePregnancyPlan';
import { useBioPanelTemplate } from '../hooks/useBioPanelTemplate';
import { PregnancyTab } from '../components/PregnancyTab';
import { PregnancyVisitDrawer } from '../components/PregnancyVisitDrawer';
import { PregnancyUltrasoundDrawer } from '../components/PregnancyUltrasoundDrawer';
import { PregnancyDeclareDialog } from '../components/PregnancyDeclareDialog';
import { PregnancyCloseDialog } from '../components/PregnancyCloseDialog';
import { CreateChildDialog } from '../components/CreateChildDialog';
import { BioPanelButton } from '../components/BioPanelButton';
import { PregnancyAlertsBanner } from '../components/PregnancyAlertsBanner';
import type { Pregnancy, PregnancyAlert } from '../types';

// ── Fixtures ───────────────────────────────────────────────────────────────
function makePregnancy(overrides: Partial<Pregnancy> = {}): Pregnancy {
  return {
    id: 'preg-1',
    patientId: 'patient-1',
    startedAt: '2026-01-01',
    lmpDate: '2025-12-01',
    dueDate: '2026-09-07',
    dueDateSource: 'NAEGELE',
    status: 'EN_COURS',
    endedAt: null,
    outcome: null,
    childPatientId: null,
    fetuses: [{ label: 'Fœtus unique' }],
    notes: null,
    saWeeks: 22,
    saDays: 3,
    gravidity: 1,
    parity: 0,
    abortions: 0,
    livingChildren: 0,
    version: 0,
    createdAt: '2026-01-01T00:00:00Z',
    updatedAt: '2026-01-01T00:00:00Z',
    ...overrides,
  };
}

function makeQC() {
  return new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
}

function renderWithQC(ui: ReactNode) {
  const qc = makeQC();
  return render(
    <MemoryRouter>
      <QueryClientProvider client={qc}>{ui}</QueryClientProvider>
    </MemoryRouter>,
  );
}

beforeEach(() => {
  vi.mocked(usePregnancies).mockReturnValue({ pregnancies: [], isLoading: false, error: null });
  vi.mocked(usePregnancyVisits).mockReturnValue({ visits: [], isLoading: false, error: null });
  vi.mocked(usePregnancyUltrasounds).mockReturnValue({ ultrasounds: [], isLoading: false, error: null });
  vi.mocked(usePregnancyAlerts).mockReturnValue({ alerts: [], isLoading: false, error: null });
  vi.mocked(usePregnancyPlan).mockReturnValue({ plan: [], isLoading: false, error: null });
  vi.mocked(useBioPanelTemplate).mockReturnValue({
    mutateAsync: vi.fn().mockResolvedValue({
      id: 't1',
      name: 'Bilan T1',
      type: 'LAB',
      lines: [{ labTestId: 'l1', labTestCode: 'NFS' }],
      lineCount: 1,
      updatedAt: '2026-05-03T00:00:00Z',
    }),
    isPending: false,
  } as unknown as ReturnType<typeof useBioPanelTemplate>);
});

// ── Tests ──────────────────────────────────────────────────────────────────

describe('PregnancyTab — empty', () => {
  it('renders "Pas de grossesse en cours" when useCurrentPregnancy returns null', () => {
    vi.mocked(useCurrentPregnancy).mockReturnValue({
      pregnancy: null,
      isLoading: false,
      error: null,
    });
    renderWithQC(<PregnancyTab patientId="p-1" />);
    expect(screen.getByText(/Pas de grossesse en cours/i)).toBeInTheDocument();
    // RBAC=MEDECIN → button visible
    expect(screen.getByRole('button', { name: /Déclarer une grossesse/i })).toBeInTheDocument();
  });
});

describe('PregnancyTab — EN_COURS', () => {
  it('renders SA, DPA and 8 plan chips', () => {
    vi.mocked(useCurrentPregnancy).mockReturnValue({
      pregnancy: makePregnancy(),
      isLoading: false,
      error: null,
    });
    vi.mocked(usePregnancyPlan).mockReturnValue({
      plan: [12, 20, 26, 30, 34, 36, 38, 40].map((sa, i) => ({
        id: `plan-${i}`,
        pregnancyId: 'preg-1',
        targetSaWeeks: sa,
        targetDate: '2026-03-01',
        toleranceDays: 14,
        status: i < 2 ? 'HONOREE' : 'PLANIFIEE',
        appointmentId: null,
        consultationId: null,
      })),
      isLoading: false,
      error: null,
    });
    renderWithQC(<PregnancyTab patientId="p-1" />);
    expect(screen.getByText(/SA actuelle/)).toBeInTheDocument();
    expect(screen.getByText(/DPA/)).toBeInTheDocument();
    // 8 plan chips
    const chips = screen.getAllByText(/^SA \d+$/);
    expect(chips.length).toBe(8);
  });
});

describe('PregnancyVisitDrawer — contextual fields', () => {
  it('hides HU when SA<20', () => {
    renderWithQC(
      <PregnancyVisitDrawer
        pregnancy={makePregnancy({ saWeeks: 14, saDays: 0 })}
        open={true}
        onOpenChange={noop}
      />,
    );
    // HU label should not be present
    expect(screen.queryByLabelText(/Hauteur utérine/)).not.toBeInTheDocument();
    // BCF should be present (SA>=12)
    expect(screen.getByLabelText(/Bruits du cœur fœtal/)).toBeInTheDocument();
  });

  it('shows HU when SA>=20', () => {
    renderWithQC(
      <PregnancyVisitDrawer
        pregnancy={makePregnancy({ saWeeks: 22, saDays: 0 })}
        open={true}
        onOpenChange={noop}
      />,
    );
    expect(screen.getByLabelText(/Hauteur utérine/)).toBeInTheDocument();
  });

  it('shows TA range error when systolic out of range', async () => {
    renderWithQC(
      <PregnancyVisitDrawer
        pregnancy={makePregnancy({ saWeeks: 22, saDays: 0 })}
        open={true}
        onOpenChange={noop}
      />,
    );
    const syst = screen.getByLabelText('TA systolique');
    fireEvent.change(syst, { target: { value: '250' } });
    fireEvent.submit(syst.closest('form')!);
    await waitFor(() => {
      expect(screen.getByText(/TA systolique hors plage/)).toBeInTheDocument();
    });
  });
});

describe('PregnancyUltrasoundDrawer — correctsDueDate gating', () => {
  it('shows correctsDueDate checkbox when kind=T1_DATATION (default)', () => {
    renderWithQC(
      <PregnancyUltrasoundDrawer
        pregnancy={makePregnancy()}
        open={true}
        onOpenChange={noop}
      />,
    );
    expect(screen.getByTestId('us-corrects-duedate')).toBeInTheDocument();
  });

  it('hides correctsDueDate when switching to T2_MORPHO', () => {
    renderWithQC(
      <PregnancyUltrasoundDrawer
        pregnancy={makePregnancy()}
        open={true}
        onOpenChange={noop}
      />,
    );
    const select = screen.getByLabelText(/Type d'échographie/);
    fireEvent.change(select, { target: { value: 'T2_MORPHO' } });
    expect(screen.queryByTestId('us-corrects-duedate')).not.toBeInTheDocument();
  });
});

describe('PregnancyDeclareDialog — DDR validation', () => {
  it('shows zod error when LMP is in the future', async () => {
    renderWithQC(
      <PregnancyDeclareDialog
        patientId="p-1"
        open={true}
        onOpenChange={noop}
      />,
    );
    const lmp = screen.getByLabelText(/Date des dernières règles/);
    // 2 days in future
    const future = new Date();
    future.setDate(future.getDate() + 2);
    const y = future.getFullYear();
    const m = String(future.getMonth() + 1).padStart(2, '0');
    const d = String(future.getDate()).padStart(2, '0');
    fireEvent.change(lmp, { target: { value: `${y}-${m}-${d}` } });
    fireEvent.submit(lmp.closest('form')!);
    await waitFor(() => {
      expect(screen.getByText(/ne peut pas être dans le futur/i)).toBeInTheDocument();
    });
  });
});

describe('PregnancyCloseDialog — outcome required', () => {
  it('shows error when outcome left blank', async () => {
    renderWithQC(
      <PregnancyCloseDialog
        pregnancyId="preg-1"
        patientId="p-1"
        open={true}
        onOpenChange={noop}
      />,
    );
    // Submit without selecting an outcome
    const endedAt = screen.getByLabelText(/Date de fin/);
    fireEvent.submit(endedAt.closest('form')!);
    await waitFor(() => {
      // Zod error message OR fallback "Issue requise"
      expect(
        screen.getByText(/Issue requise|Required|Invalid enum value/i),
      ).toBeInTheDocument();
    });
  });
});

describe('CreateChildDialog — sex required', () => {
  it('shows error when sex is missing', async () => {
    renderWithQC(
      <CreateChildDialog
        pregnancyId="preg-1"
        patientId="p-1"
        open={true}
        onOpenChange={noop}
      />,
    );
    const firstName = screen.getByLabelText(/Prénom/);
    fireEvent.change(firstName, { target: { value: 'Yassine' } });
    fireEvent.submit(firstName.closest('form')!);
    await waitFor(() => {
      expect(
        screen.getByText(/Sexe requis|Required|Invalid enum value/i),
      ).toBeInTheDocument();
    });
  });
});

describe('BioPanelButton — click flow', () => {
  it('calls useBioPanelTemplate then onTemplateLoaded', async () => {
    const mutate = vi.fn().mockResolvedValue({
      id: 't1',
      name: 'Bilan T1',
      type: 'LAB' as const,
      lines: [{ labTestId: 'lab-1', labTestCode: 'NFS' }],
      lineCount: 1,
      updatedAt: '2026-05-03T00:00:00Z',
    });
    vi.mocked(useBioPanelTemplate).mockReturnValue({
      mutateAsync: mutate,
      isPending: false,
    } as unknown as ReturnType<typeof useBioPanelTemplate>);
    const onTemplateLoaded = vi.fn();
    renderWithQC(
      <BioPanelButton
        pregnancyId="preg-1"
        trimester="T2"
        onTemplateLoaded={onTemplateLoaded}
      />,
    );
    fireEvent.click(screen.getByRole('button', { name: /Prescrire bilan T2/i }));
    await waitFor(() => {
      expect(mutate).toHaveBeenCalledWith({ pregnancyId: 'preg-1', trimester: 'T2' });
      expect(onTemplateLoaded).toHaveBeenCalledTimes(1);
    });
  });
});

describe('PregnancyAlertsBanner', () => {
  it('renders one row per alert with severity-specific CSS class', () => {
    const alerts: PregnancyAlert[] = [
      {
        code: 'HTA_GRAVIDIQUE',
        label: 'HTA gravidique',
        severity: 'WARNING',
        since: '2026-04-12',
      },
      {
        code: 'TERME_DEPASSE',
        label: 'Terme dépassé',
        severity: 'CRITICAL',
        since: '2026-04-20',
      },
    ];
    renderWithQC(<PregnancyAlertsBanner alerts={alerts} />);
    expect(screen.getByTestId('gr-alert-HTA_GRAVIDIQUE')).toHaveClass('severity-WARNING');
    expect(screen.getByTestId('gr-alert-TERME_DEPASSE')).toHaveClass('severity-CRITICAL');
    expect(screen.getByText('HTA gravidique')).toBeInTheDocument();
    expect(screen.getByText('Terme dépassé')).toBeInTheDocument();
  });

  it('renders nothing when alerts is empty', () => {
    const { container } = renderWithQC(<PregnancyAlertsBanner alerts={[]} />);
    expect(container.querySelector('.gr-alerts')).toBeNull();
  });
});
