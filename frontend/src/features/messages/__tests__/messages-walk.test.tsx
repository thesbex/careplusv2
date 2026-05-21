/**
 * Messagerie d'équipe — smoke tests post-ADR-035 v2.
 *
 * Le test précédent (V1) testait les fixtures hardcodées (channels nominales,
 * patients spécifiques, bulles "Reçu Khadija…"). Depuis V048, toutes les données
 * viennent du backend → on mock les hooks et on vérifie que la structure
 * iso-maquette se monte correctement avec data minimale.
 *
 * Run: npm test -- --run features/messages/messages-walk
 */
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { createMemoryRouter, RouterProvider } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { ReactNode } from 'react';

// ── Mock shell components (sortent de scope du smoke) ───────────────────────
vi.mock('@/components/shell/Screen', () => ({
  Screen: ({
    children,
    title,
    topbarRight,
  }: {
    children: ReactNode;
    title: string;
    topbarRight?: ReactNode;
  }) => (
    <div data-testid="screen">
      <header>
        <h1>{title}</h1>
        <div data-testid="topbar-right">{topbarRight}</div>
      </header>
      <div className="cp-content">
        <div className="cp-workspace">{children}</div>
      </div>
    </div>
  ),
}));

vi.mock('@/components/shell/MScreen', () => ({
  MScreen: ({
    children,
    topbar,
    fab,
  }: {
    children: ReactNode;
    topbar?: ReactNode;
    fab?: ReactNode;
  }) => (
    <div className="cp-mobile">
      {topbar}
      <div className="mb scroll">{children}</div>
      {fab}
    </div>
  ),
}));

// ── Mock API client. Les hooks fetchent depuis ce client. ───────────────────
vi.mock('@/lib/api/client', () => ({
  api: {
    get: vi.fn((url: string) => {
      if (url === '/chat/channels') {
        return Promise.resolve({
          data: [
            { id: 'ch-1', name: 'urgences', sub: 'Coordination', unread: 2, mentions: 1, members: 5 },
            { id: 'ch-2', name: 'général', sub: 'Espace équipe', unread: 0, mentions: 0, members: 5 },
          ],
        });
      }
      if (url === '/chat/direct-messages') return Promise.resolve({ data: [] });
      if (url === '/chat/patient-threads') return Promise.resolve({ data: [] });
      if (url === '/chat/team') {
        return Promise.resolve({
          data: [
            { id: 'me', name: 'Dr. Test', role: 'Médecin', initials: 'DT', color: '#1E5AA8', presence: 'self' },
            { id: 'b', name: 'Fatima', role: 'Secrétaire', initials: 'FZ', color: '#3F7A3A', presence: 'on' },
          ],
        });
      }
      if (url.startsWith('/chat/conversations/')) {
        return Promise.resolve({
          data: {
            id: 'ch-1',
            kind: 'CHANNEL',
            name: 'urgences',
            topic: 'Coordination des cas urgents',
            color: '#A8321E',
            members: [
              { id: 'me', name: 'Dr. Test', role: 'Médecin', initials: 'DT', color: '#1E5AA8', presence: 'self' },
            ],
            lastMessageAt: null,
            unreadCount: 0,
            pinnedMessageId: null,
            pinnedMessageBody: null,
            patientId: null,
            patientName: null,
            patientCode: null,
          },
        });
      }
      return Promise.resolve({ data: [] });
    }),
    post: vi.fn(() => Promise.resolve({ data: {} })),
    delete: vi.fn(() => Promise.resolve({ data: {} })),
  },
}));

vi.mock('@/lib/auth/authStore', () => ({
  useAuthStore: (sel: (s: { user: { id: string; firstName: string; lastName: string } }) => unknown) =>
    sel({ user: { id: 'me', firstName: 'Dr.', lastName: 'Test' } }),
}));

import MessagesPage from '../MessagesPage';
import MessagesMobilePage from '../MessagesPage.mobile';
import MConversationMobilePage from '../MConversationPage.mobile';

function withProviders(element: ReactNode, initialPath = '/messages') {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const router = createMemoryRouter(
    [
      { path: '/messages', element },
      { path: '/messages/:conversationId', element },
    ],
    { initialEntries: [initialPath] },
  );
  return render(
    <QueryClientProvider client={qc}>
      <RouterProvider router={router} />
    </QueryClientProvider>,
  );
}

describe('Messagerie — desktop', () => {
  it('rend le titre + le CTA Nouveau message', () => {
    withProviders(<MessagesPage />);
    expect(screen.getByRole('heading', { name: 'Messages équipe' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Nouveau message/ })).toBeInTheDocument();
  });

  it('liste les sections du rail gauche (Canaux / Messages directs / Fils patient)', () => {
    withProviders(<MessagesPage />);
    expect(screen.getByText('Canaux')).toBeInTheDocument();
    expect(screen.getByText('Messages directs')).toBeInTheDocument();
    expect(screen.getByText('Fils patient')).toBeInTheDocument();
  });
});

describe('Messagerie — mobile liste', () => {
  it('rend le titre + 3 onglets de filtre', () => {
    withProviders(<MessagesMobilePage />);
    expect(screen.getByText('Messages')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Tout/ })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Mentions/ })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Non lus/ })).toBeInTheDocument();
  });
});

describe('Messagerie — mobile conversation', () => {
  it('rend le topbar avec back arrow + bouton Envoyer', () => {
    withProviders(<MConversationMobilePage />, '/messages/ch-1');
    expect(screen.getByRole('button', { name: 'Retour' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Envoyer' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Pièce jointe' })).toBeInTheDocument();
  });
});
