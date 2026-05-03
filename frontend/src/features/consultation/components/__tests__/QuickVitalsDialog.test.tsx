/**
 * QuickVitalsDialog tests — prouvent le contrat anti-régression :
 *
 *   "Si je modifie UN champ, les autres déjà renseignés ne sont PAS effacés."
 *
 * On vérifie le comportement bout-en-bout : ouverture du dialog avec des
 * constantes existantes (`current` prop) → modification d'un seul champ →
 * inspection du body POST envoyé au backend.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { QuickVitalsDialog } from '../QuickVitalsDialog';
import type { VitalsApi } from '../../hooks/useLatestVitals';

const mockPost = vi.fn();
vi.mock('@/lib/api/client', () => ({
  api: {
    post: (...args: unknown[]) => mockPost(...args),
    get: vi.fn(),
    interceptors: { request: { use: vi.fn() }, response: { use: vi.fn() } },
  },
}));

const EXISTING: VitalsApi = {
  id: 'vit-1',
  patientId: 'pat-1',
  appointmentId: null,
  consultationId: 'cons-1',
  systolicMmhg: 120,
  diastolicMmhg: 80,
  heartRateBpm: 72,
  spo2Percent: 98,
  temperatureC: 36.8,
  weightKg: 72.5,
  heightCm: 178,
  bmi: 22.9,
  glycemiaGPerL: null,
  recordedAt: '2026-04-30T17:00:00Z',
  recordedBy: null,
  notes: null,
};

function renderDialog(props: Partial<React.ComponentProps<typeof QuickVitalsDialog>> = {}) {
  const qc = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  const onOpenChange = vi.fn();
  const utils = render(
    <QueryClientProvider client={qc}>
      <QuickVitalsDialog
        open={true}
        onOpenChange={onOpenChange}
        consultationId="cons-1"
        appointmentId={null}
        patientId="pat-1"
        current={EXISTING}
        {...props}
      />
    </QueryClientProvider>,
  );
  return { ...utils, onOpenChange };
}

beforeEach(() => {
  mockPost.mockReset();
  mockPost.mockResolvedValue({ data: EXISTING });
});

describe('<QuickVitalsDialog />', () => {
  it('pré-remplit les 7 champs avec les valeurs courantes à l\'ouverture', () => {
    renderDialog();
    expect((screen.getByLabelText(/Systolique/i) as HTMLInputElement).value).toBe('120');
    expect((screen.getByLabelText(/Diastolique/i) as HTMLInputElement).value).toBe('80');
    expect((screen.getByLabelText(/FC/i) as HTMLInputElement).value).toBe('72');
    expect((screen.getByLabelText(/SpO/i) as HTMLInputElement).value).toBe('98');
    expect((screen.getByLabelText(/T°/i) as HTMLInputElement).value).toBe('36,8');
    expect((screen.getByLabelText(/Poids/i) as HTMLInputElement).value).toBe('72,5');
    expect((screen.getByLabelText(/Taille/i) as HTMLInputElement).value).toBe('178');
  });

  it('NE PERD PAS les valeurs non-touchées quand on ne modifie qu\'un seul champ', async () => {
    const user = userEvent.setup();
    renderDialog();

    // L'utilisateur modifie SEULEMENT la systolique : 120 → 135.
    const sys = screen.getByLabelText(/Systolique/i) as HTMLInputElement;
    await user.clear(sys);
    await user.type(sys, '135');

    // Sauvegarde.
    await user.click(screen.getByRole('button', { name: /Enregistrer/i }));

    await waitFor(() => expect(mockPost).toHaveBeenCalledTimes(1));
    const body = mockPost.mock.calls[0]?.[1] as Record<string, unknown>;

    // Le champ modifié contient bien la nouvelle valeur.
    expect(body.systolicMmhg).toBe(135);
    // Les 6 autres champs conservent leur valeur précédente — PAS null.
    expect(body.diastolicMmhg).toBe(80);
    expect(body.heartRateBpm).toBe(72);
    expect(body.spo2Percent).toBe(98);
    expect(body.temperatureC).toBe(36.8);
    expect(body.weightKg).toBe(72.5);
    expect(body.heightCm).toBe(178);
  });

  it('vide explicitement un champ → envoie null pour ce champ uniquement', async () => {
    const user = userEvent.setup();
    renderDialog();

    // L'utilisateur efface la SpO₂ volontairement.
    const spo2 = screen.getByLabelText(/SpO/i) as HTMLInputElement;
    await user.clear(spo2);

    await user.click(screen.getByRole('button', { name: /Enregistrer/i }));

    await waitFor(() => expect(mockPost).toHaveBeenCalledTimes(1));
    const body = mockPost.mock.calls[0]?.[1] as Record<string, unknown>;

    expect(body.spo2Percent).toBeNull();
    // Les autres restent intacts.
    expect(body.systolicMmhg).toBe(120);
    expect(body.heartRateBpm).toBe(72);
    expect(body.temperatureC).toBe(36.8);
  });

  it('démarre vide si aucune constante précédente (current=null)', () => {
    renderDialog({ current: null });
    expect((screen.getByLabelText(/Systolique/i) as HTMLInputElement).value).toBe('');
    expect((screen.getByLabelText(/T°/i) as HTMLInputElement).value).toBe('');
  });

  it('tolère les BigDecimal sérialisés en string par le backend', () => {
    const bigDecAsString = {
      ...EXISTING,
      // Simule Jackson `WRITE_BIGDECIMAL_AS_PLAIN` ou `@JsonFormat(STRING)`.
      temperatureC: '36.8' as unknown as number,
      weightKg: '72.5' as unknown as number,
      bmi: '22.9' as unknown as number,
    };
    renderDialog({ current: bigDecAsString });
    expect((screen.getByLabelText(/T°/i) as HTMLInputElement).value).toBe('36,8');
    expect((screen.getByLabelText(/Poids/i) as HTMLInputElement).value).toBe('72,5');
  });
});
