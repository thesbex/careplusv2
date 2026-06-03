/**
 * Applique le thème d'apparence à toute l'app. Résout, dans l'ordre :
 *
 *   override perso (V073, /users/me/appearance)
 *     → défaut cabinet (V072, /settings/clinic)
 *       → dernier thème connu (cache local)
 *         → défaut application.
 *
 * Écrit les variables CSS sur <html> et met le cache local à jour pour un
 * démarrage sans flash au prochain chargement. Doit être monté SOUS le
 * QueryClientProvider. (cf. lib/theme/appearance.ts pour l'application réelle.)
 */
import { useEffect, type ReactNode } from 'react';
import { useClinicSettings } from '@/features/parametres/hooks/useSettings';
import { useMyAppearanceData } from '@/features/parametres/hooks/useMyAppearance';
import { applyAppearance, cacheAppearance, parseAppearance, readCachedAppearance } from './appearance';

export function AppearanceProvider({ children }: { children: ReactNode }) {
  const { settings } = useClinicSettings();
  const { authed, data: myData } = useMyAppearanceData();

  const cabinetJson = settings?.appearance ?? null;
  const myJson = myData?.appearance ?? null;

  useEffect(() => {
    // Non authentifié (écran de login) : on garde le thème déjà appliqué depuis
    // le cache (cf. main.tsx) — pas de réinitialisation.
    if (!authed) return;
    // Authentifié : on attend de connaître l'override perso pour éviter
    // d'appliquer le défaut cabinet puis de « flasher » vers le perso.
    if (myData === undefined) return;

    // override perso → défaut cabinet → dernier thème connu (cache).
    const effectiveJson = myJson ?? cabinetJson;
    const cfg = effectiveJson ? parseAppearance(effectiveJson) : readCachedAppearance();
    applyAppearance(cfg);
    cacheAppearance(cfg);
  }, [authed, myData, settings, myJson, cabinetJson]);

  return <>{children}</>;
}
