import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ConsentTemplatesTab } from '../components/ConsentTemplatesTab';
import type { ConsentTemplateView } from '../types';

const TEMPLATES: ConsentTemplateView[] = [
  {
    id: 'ct-1',
    type: 'ACTE_OPERATOIRE',
    title: "Consentement à l'acte opératoire",
    body: 'Je soussigné {{patientNom}} consens à…',
    active: true,
    createdAt: '2026-05-01T08:00:00Z',
    updatedAt: '2026-05-01T08:00:00Z',
  },
  {
    id: 'ct-2',
    type: 'PARTAGE_DOSSIER',
    title: 'Partage du dossier médical',
    body: 'Le patient autorise le partage…',
    active: false,
    createdAt: '2026-05-02T08:00:00Z',
    updatedAt: '2026-05-02T08:00:00Z',
  },
];

const useConsentTemplatesMock = vi.fn(() => ({
  templates: TEMPLATES,
  isLoading: false,
  error: null,
}));
const createMock = vi.fn(() => Promise.resolve());
const updateMock = vi.fn(() => Promise.resolve());
const removeMock = vi.fn(() => Promise.resolve());

vi.mock('../hooks/useConsentTemplates', () => ({
  useConsentTemplates: () => useConsentTemplatesMock(),
  useCreateConsentTemplate: () => ({ create: createMock, isPending: false }),
  useUpdateConsentTemplate: () => ({ update: updateMock, isPending: false }),
  useDeleteConsentTemplate: () => ({ remove: removeMock, isPending: false }),
}));

function renderTab() {
  const qc = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return render(
    <QueryClientProvider client={qc}>
      <ConsentTemplatesTab />
    </QueryClientProvider>,
  );
}

beforeEach(() => {
  useConsentTemplatesMock.mockClear();
  createMock.mockClear();
});

describe('<ConsentTemplatesTab />', () => {
  it('renders a row per template with FR type label, title and status', () => {
    renderTab();
    expect(screen.getByText("Consentement à l'acte opératoire")).toBeInTheDocument();
    expect(screen.getByText('Partage du dossier médical')).toBeInTheDocument();
    // FR type labels
    expect(screen.getByText('Acte opératoire')).toBeInTheDocument();
    expect(screen.getByText('Partage du dossier')).toBeInTheDocument();
    // Active / inactive status chips
    expect(screen.getByText('Actif')).toBeInTheDocument();
    expect(screen.getByText('Inactif')).toBeInTheDocument();
  });

  it('opens the add-template drawer when clicking "Ajouter un modèle"', () => {
    renderTab();
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /Ajouter un modèle/i }));
    expect(screen.getByRole('dialog')).toBeInTheDocument();
    expect(screen.getByText('Nouveau modèle de consentement')).toBeInTheDocument();
    // Form controls present
    expect(screen.getByLabelText(/Titre/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/Corps/i)).toBeInTheDocument();
    // Placeholder hint visible
    expect(screen.getByText('{{patientNom}}')).toBeInTheDocument();
  });
});
