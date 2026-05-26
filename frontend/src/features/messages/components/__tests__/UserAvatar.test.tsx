/**
 * QA9-1/QA9-3 (suivi .xlsx 2026-05-26) — la photo de profil d'un collègue doit
 * apparaître dans le chat (en-tête de conversation, liste des contacts, picker
 * « Nouveau message »). UserAvatar centralise ce rendu : <img> si hasPhoto,
 * sinon initiales colorées, avec fallback silencieux sur erreur.
 *
 * Ces tests verrouillent : (1) fallback initiales sans photo, (2) fusion du
 * style override — indispensable pour la pastille ronde de l'en-tête, (3) rendu
 * <img> quand la photo est servie par GET /api/users/{id}/photo.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';

const getMock = vi.fn();
vi.mock('@/lib/api/client', () => ({ api: { get: (...a: unknown[]) => getMock(...a) } }));

import { UserAvatar } from '../UserAvatar';

beforeEach(() => {
  getMock.mockReset();
  // jsdom n'implémente pas createObjectURL — on le stub pour le chemin photo.
  vi.stubGlobal('URL', {
    ...URL,
    createObjectURL: vi.fn(() => 'blob:mock-url'),
    revokeObjectURL: vi.fn(),
  });
});

describe('<UserAvatar />', () => {
  it('rend les initiales (pas de photo) quand hasPhoto=false', () => {
    render(<UserAvatar userId="u1" hasPhoto={false} initials="YE" color="#1E5AA8" size={26} />);
    expect(screen.getByText('YE')).toBeInTheDocument();
    expect(document.querySelector('img')).toBeNull();
    expect(getMock).not.toHaveBeenCalled();
  });

  it('fusionne le style override (pastille ronde de l\'en-tête de conversation)', () => {
    const { container } = render(
      <UserAvatar userId="u1" hasPhoto={false} initials="YE" color="#1E5AA8" size={26}
        style={{ borderRadius: '50%', marginLeft: -8 }} />,
    );
    const box = container.firstElementChild as HTMLElement;
    expect(box).toHaveStyle({ borderRadius: '50%' });
    expect(box).toHaveStyle({ marginLeft: '-8px' });
  });

  it('rend une <img> quand la photo est servie par /users/{id}/photo', async () => {
    getMock.mockResolvedValue({ data: new ArrayBuffer(8), headers: { 'content-type': 'image/png' } });
    render(<UserAvatar userId="u1" hasPhoto initials="YE" color="#1E5AA8" size={26} />);
    await waitFor(() => expect(document.querySelector('img')).not.toBeNull());
    expect(getMock).toHaveBeenCalledWith('/users/u1/photo', { responseType: 'arraybuffer' });
    expect((document.querySelector('img') as HTMLImageElement).src).toContain('blob:');
  });

  it('retombe sur les initiales si le fetch de la photo échoue', async () => {
    getMock.mockRejectedValue(new Error('404'));
    render(<UserAvatar userId="u1" hasPhoto initials="YE" color="#1E5AA8" size={26} />);
    await waitFor(() => expect(getMock).toHaveBeenCalled());
    expect(screen.getByText('YE')).toBeInTheDocument();
    expect(document.querySelector('img')).toBeNull();
  });
});
