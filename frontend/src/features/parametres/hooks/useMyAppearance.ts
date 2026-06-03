/**
 * Apparence PERSONNELLE de l'utilisateur courant (V073).
 *
 * V072 a introduit un thème unique réglé par le super admin et appliqué à tous.
 * V073 permet à CHAQUE utilisateur de personnaliser son propre affichage. La
 * résolution effective (appliquée par {@link AppearanceProvider}) est :
 *
 *   override perso → défaut cabinet → défaut application.
 *
 * `appearance === null` côté backend = pas d'override → l'utilisateur suit le
 * défaut d'apparence du cabinet.
 */
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { api } from '@/lib/api/client';
import { useAuthStore } from '@/lib/auth/authStore';
import { useClinicSettings } from './useSettings';
import {
  APPEARANCE_DEFAULT,
  applyAppearance,
  cacheAppearance,
  parseAppearance,
  serializeAppearance,
  type Appearance,
} from '@/lib/theme/appearance';

interface MeAppearance {
  /** JSON d'apparence perso, ou null si l'utilisateur suit le défaut cabinet. */
  appearance: string | null;
}

const QUERY_KEY = ['my-appearance'] as const;

/**
 * Donnée brute de l'override perso. `data === undefined` tant que la requête
 * n'a pas répondu (ou n'est pas activée car non authentifié). Partagée (même
 * clé react-query) entre le provider et l'éditeur.
 */
export function useMyAppearanceData() {
  const authed = useAuthStore((s) => !!s.accessToken);
  const { data } = useQuery({
    queryKey: QUERY_KEY,
    // Un échec (endpoint absent sur un backend antérieur à V073, réseau…) est
    // traité comme « pas d'override » → on retombe sur le défaut cabinet/app
    // plutôt que de bloquer l'application du thème. Cf. useClinicSettings.
    queryFn: () =>
      api
        .get<MeAppearance>('/users/me/appearance')
        .then((r) => r.data)
        .catch(() => ({ appearance: null }) as MeAppearance),
    enabled: authed,
    staleTime: 60_000,
  });
  return { authed, data };
}

/**
 * Éditeur de l'apparence personnelle. `current` est le thème EFFECTIF que
 * l'utilisateur voit (override s'il existe, sinon défaut cabinet, sinon défaut
 * app) — c'est le point de départ de l'édition.
 */
export function useMyAppearance() {
  const qc = useQueryClient();
  const { settings } = useClinicSettings();
  const { data } = useMyAppearanceData();
  const [saving, setSaving] = useState(false);

  const myJson = data?.appearance ?? null;
  const hasOverride = !!myJson;
  const cabinetJson = settings?.appearance ?? null;

  const current: Appearance = myJson
    ? parseAppearance(myJson)
    : cabinetJson
      ? parseAppearance(cabinetJson)
      : { ...APPEARANCE_DEFAULT };

  /** Aperçu instantané non persisté. */
  function preview(next: Appearance) {
    applyAppearance(next);
  }

  /** Persiste l'override perso (PUT /users/me/appearance). */
  async function save(next: Appearance): Promise<void> {
    setSaving(true);
    try {
      const updated = await api
        .put<MeAppearance>('/users/me/appearance', { appearance: serializeAppearance(next) })
        .then((r) => r.data);
      qc.setQueryData(QUERY_KEY, updated);
      applyAppearance(next);
      cacheAppearance(next);
    } finally {
      setSaving(false);
    }
  }

  /** Efface l'override : l'utilisateur retombe sur le défaut d'apparence cabinet. */
  async function resetToCabinet(): Promise<void> {
    setSaving(true);
    try {
      const updated = await api
        .put<MeAppearance>('/users/me/appearance', { appearance: null })
        .then((r) => r.data);
      qc.setQueryData(QUERY_KEY, updated);
      const fallback = cabinetJson ? parseAppearance(cabinetJson) : { ...APPEARANCE_DEFAULT };
      applyAppearance(fallback);
      cacheAppearance(fallback);
    } finally {
      setSaving(false);
    }
  }

  return { current, hasOverride, preview, save, resetToCabinet, saving };
}
