/**
 * VitalIcon — petit composant utilitaire ajouté en F3 (2026-05-06).
 *
 * Vérifie :
 *   1. Une icône SVG est rendue pour chaque clé valide du mapping.
 *   2. Une clé inconnue ne casse pas le rendu (retour `null`, pas d'erreur).
 *   3. La className personnalisée remplace le défaut `vital-icon`.
 */
import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/react';
import { VitalIcon, type VitalKey } from '../VitalIcon';

const ALL_KEYS: VitalKey[] = [
  'ta', 'fc', 'fr', 'temp', 'spo2', 'poids', 'taille',
  'imc', 'glycemie', 'abdo', 'cranien',
];

describe('<VitalIcon />', () => {
  it('rend un SVG pour chaque clé valide du mapping', () => {
    for (const key of ALL_KEYS) {
      const { container, unmount } = render(<VitalIcon vital={key} />);
      const svg = container.querySelector('svg');
      expect(svg, `key=${key} doit produire un SVG`).not.toBeNull();
      // Toutes les icônes maison sont 16×16, stroke 1.5, currentColor.
      expect(svg?.getAttribute('width')).toBe('16');
      expect(svg?.getAttribute('height')).toBe('16');
      unmount();
    }
  });

  it('retourne null pour une clé inconnue (fallback silencieux)', () => {
    // Force une clé hors-mapping pour vérifier que rien ne crash.
    const { container } = render(
      <VitalIcon vital={'inconnu' as VitalKey} />,
    );
    expect(container.querySelector('svg')).toBeNull();
    expect(container.firstChild).toBeNull();
  });

  it('applique la className passée en prop (override du défaut)', () => {
    const { container } = render(
      <VitalIcon vital="ta" className="custom-class" />,
    );
    const svg = container.querySelector('svg');
    expect(svg?.getAttribute('class')).toBe('custom-class');
    expect(svg?.getAttribute('class')).not.toContain('vital-icon');
  });

  it('utilise la classe `vital-icon` par défaut si non fournie', () => {
    const { container } = render(<VitalIcon vital="fc" />);
    const svg = container.querySelector('svg');
    expect(svg?.getAttribute('class')).toBe('vital-icon');
  });
});
