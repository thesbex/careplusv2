/**
 * Lecture / écriture de l'apparence (V072). L'apparence est un champ protégé de
 * /settings/clinic (garde super admin backend, comme `language`). On renvoie
 * l'identité inchangée + le nouveau JSON d'apparence ; le cache clinic-settings
 * est mis à jour → AppearanceProvider re-applique le thème à toute l'app.
 */
import { useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { api } from '@/lib/api/client';
import { useClinicSettings, type ClinicSettings } from './useSettings';
import {
  applyAppearance,
  cacheAppearance,
  parseAppearance,
  readCachedAppearance,
  serializeAppearance,
  type Appearance,
} from '@/lib/theme/appearance';

export function useAppearance() {
  const { settings } = useClinicSettings();
  const qc = useQueryClient();
  const [saving, setSaving] = useState(false);

  // Source de vérité backend ; fallback cache local si l'apparence n'est pas
  // encore renvoyée (cabinet non configuré / backend antérieur à V072).
  const current: Appearance = settings?.appearance
    ? parseAppearance(settings.appearance)
    : readCachedAppearance();

  /** Aperçu instantané sans persister (utilisé pendant que l'utilisateur tweake). */
  function preview(next: Appearance) {
    applyAppearance(next);
  }

  /** Persiste l'apparence côté backend (super admin) puis met le cache à jour. */
  async function save(next: Appearance): Promise<void> {
    if (!settings) return;
    setSaving(true);
    try {
      const updated = await api
        .put<ClinicSettings>('/settings/clinic', {
          name: settings.name,
          address: settings.address,
          city: settings.city,
          phone: settings.phone,
          email: settings.email ?? '',
          inpe: settings.inpe ?? '',
          cnom: settings.cnom ?? '',
          ice: settings.ice ?? '',
          rib: settings.rib ?? '',
          appearance: serializeAppearance(next),
        })
        .then((r) => r.data);
      qc.setQueryData(['clinic-settings'], updated);
      applyAppearance(next);
      cacheAppearance(next);
    } finally {
      setSaving(false);
    }
  }

  return { current, preview, save, saving };
}
