/**
 * CancelAppointmentDialog tests — pin le contrat "retirer un patient de la
 * liste d'attente" :
 *
 *   - Le dialog rend le nom du patient + l'avertissement "statut Annulé"
 *   - Click Retirer → DELETE /api/appointments/{id}
 *   - Motif saisi → envoyé dans le body { reason: ... }
 *   - Motif vide → body absent
 *   - Aucun appointmentId → bouton Retirer désactivé
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { CancelAppointmentDialog } from '../CancelAppointmentDialog';

const mockDelete = vi.fn();
vi.mock('@/lib/api/client', () => ({
  api: {
    delete: (...args: unknown[]) => mockDelete(...args),
    get: vi.fn(),
    post: vi.fn(),
    interceptors: { request: { use: vi.fn() }, response: { use: vi.fn() } },
  },
}));

function renderDialog(props: Partial<React.ComponentProps<typeof CancelAppointmentDialog>> = {}) {
  const qc = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  const onOpenChange = vi.fn();
  const onCancelled = vi.fn();
  const utils = render(
    <QueryClientProvider client={qc}>
      <CancelAppointmentDialog
        open={true}
        onOpenChange={onOpenChange}
        appointmentId="apt-1"
        patientName="Mohamedd Alami"
        onCancelled={onCancelled}
        {...props}
      />
    </QueryClientProvider>,
  );
  return { ...utils, onOpenChange, onCancelled };
}

beforeEach(() => {
  mockDelete.mockReset();
  mockDelete.mockResolvedValue({ data: {} });
});

describe('<CancelAppointmentDialog />', () => {
  it('rend le nom du patient et le futur statut Annulé', () => {
    renderDialog();
    expect(screen.getByText(/Retirer de la liste d'attente/i)).toBeInTheDocument();
    expect(screen.getByText(/Mohamedd Alami/)).toBeInTheDocument();
    expect(screen.getByText(/Annulé/)).toBeInTheDocument();
  });

  it('motif saisi → DELETE /appointments/apt-1 avec body { reason }', async () => {
    const user = userEvent.setup();
    const { onOpenChange, onCancelled } = renderDialog();

    const reason = screen.getByPlaceholderText(/empêchement/i) as HTMLTextAreaElement;
    await user.type(reason, 'Empêchement personnel');

    await user.click(screen.getByRole('button', { name: /^Retirer$/ }));

    await waitFor(() => expect(mockDelete).toHaveBeenCalledTimes(1));
    expect(mockDelete).toHaveBeenCalledWith(
      '/appointments/apt-1',
      expect.objectContaining({ data: { reason: 'Empêchement personnel' } }),
    );
    await waitFor(() => expect(onCancelled).toHaveBeenCalled());
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it('motif vide → body absent (data: undefined)', async () => {
    const user = userEvent.setup();
    renderDialog();

    await user.click(screen.getByRole('button', { name: /^Retirer$/ }));

    await waitFor(() => expect(mockDelete).toHaveBeenCalledTimes(1));
    const opts = mockDelete.mock.calls[0]?.[1] as { data?: unknown };
    expect(opts?.data).toBeUndefined();
  });

  it('appointmentId nul → bouton Retirer désactivé', () => {
    renderDialog({ appointmentId: null });
    const retirer = screen.getByRole('button', { name: /^Retirer$/ }) as HTMLButtonElement;
    expect(retirer.disabled).toBe(true);
  });

  it('Click "Garder dans la liste" ne déclenche pas le DELETE', async () => {
    const user = userEvent.setup();
    renderDialog();
    await user.click(screen.getByRole('button', { name: /Garder dans la liste/i }));
    expect(mockDelete).not.toHaveBeenCalled();
  });
});
