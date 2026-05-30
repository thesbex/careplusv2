/**
 * Applique le thème d'apparence (V072) à toute l'app. Lit le champ `appearance`
 * de /settings/clinic (réglage cabinet, super admin) et écrit les variables CSS
 * sur <html>. Met aussi le cache local à jour pour un démarrage sans flash au
 * prochain chargement. Doit être monté SOUS le QueryClientProvider.
 */
import { useEffect, type ReactNode } from 'react';
import { useClinicSettings } from '@/features/parametres/hooks/useSettings';
import { applyAppearance, cacheAppearance, parseAppearance, readCachedAppearance } from './appearance';

export function AppearanceProvider({ children }: { children: ReactNode }) {
  const { settings } = useClinicSettings();
  const appearanceJson = settings?.appearance ?? null;

  useEffect(() => {
    // Tant que les settings ne sont pas chargés (settings === null), on laisse le
    // thème déjà appliqué depuis le cache (cf. main.tsx) — pas de réinitialisation.
    if (!settings) return;
    // Le backend est la source de vérité ; mais s'il ne renvoie PAS d'apparence
    // (cabinet jamais configuré, ou backend antérieur à V072), on retombe sur le
    // dernier thème connu (cache local) plutôt que de réinitialiser au défaut.
    const cfg = appearanceJson ? parseAppearance(appearanceJson) : readCachedAppearance();
    applyAppearance(cfg);
    cacheAppearance(cfg);
  }, [settings, appearanceJson]);

  return <>{children}</>;
}
