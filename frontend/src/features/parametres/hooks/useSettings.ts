import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api/client';
import { useT } from '@/lib/i18n/I18nProvider';

export type EstablishmentType =
  | 'CABINET'
  | 'CLINIQUE'
  | 'HOPITAL'
  | 'CENTRE_MEDICAL'
  | 'AUTRE';

export interface ClinicSettings {
  id: string;
  name: string;
  address: string;
  city: string;
  phone: string;
  email: string | null;
  inpe: string | null;
  cnom: string | null;
  ice: string | null;
  rib: string | null;
  agendaStrictIsolation?: boolean;
  /** V034 — type d'établissement (drives label "Cabinet/Clinique/..." dans IHM + PDFs). */
  establishmentType?: EstablishmentType;
  /** V034 — capacité radiologie interne. */
  imagingInternal?: boolean;
  /** V034 — capacité laboratoire interne. */
  labInternal?: boolean;
  /** V057 — capacité pharmacie interne (fourniture de médicaments). */
  pharmacyInternal?: boolean;
  /** V037 — true si un logo est configuré (bytes via GET /settings/clinic/logo). */
  hasLogo?: boolean;
  /** V042 — Registre du Commerce. */
  rc?: string | null;
  /** V042 — Identifiant Fiscal. Note: clé JSON `ifNo` car `if` est mot réservé. */
  ifNo?: string | null;
  /** V042 — Forme juridique. */
  legalForm?: string | null;
  /** V054 — true => module hospitalisation (lits, séjours) actif. */
  hospitalizationEnabled?: boolean;
  /** V070 — codes des modules désactivés par l'admin (vide/absent = tous activés). */
  disabledModules?: string[];
  /** V071 — langue de l'application (fr|en|ar|es). Réglée par le super admin. */
  language?: string;
  /** V072 — apparence (JSON : police / ambiance / accent / mode sombre). Réglée par le super admin. */
  appearance?: string | null;
}

/** V070 — modules secondaires débrayables par l'admin (id ↔ libellé de nav). */
export const TOGGLEABLE_MODULES: { id: string; label: string }[] = [
  { id: 'vaccinations', label: 'Vaccinations' },
  { id: 'grossesses', label: 'Grossesses' },
  { id: 'stock', label: 'Stock' },
  { id: 'messages', label: 'Messages' },
  { id: 'assistant', label: 'Assistant IA' },
  { id: 'charges', label: 'Charges' },
];

export interface ClinicSettingsForm {
  name: string;
  address: string;
  city: string;
  phone: string;
  email: string;
  inpe: string;
  cnom: string;
  ice: string;
  rib: string;
  /** V034 — optional ; backend laisse la valeur courante si absent. */
  establishmentType?: EstablishmentType;
  imagingInternal?: boolean;
  labInternal?: boolean;
  /** V057 — capacité pharmacie interne. */
  pharmacyInternal?: boolean;
  /** V042 — mentions légales étendues. Optional (null = ne pas toucher). */
  rc?: string;
  ifNo?: string;
  legalForm?: string;
  /** V054 — capacité hospitalisation. Optional (null = ne pas toucher). */
  hospitalizationEnabled?: boolean;
  /** V070 — modules désactivés. Optional (absent = ne pas toucher). */
  disabledModules?: string[];
  /** V071 — langue de l'application. Optional (absent = ne pas toucher). */
  language?: string;
  /** V072 — apparence (JSON). Optional (absent = ne pas toucher). */
  appearance?: string;
}

/**
 * Mapping enum → label humain. Utilisé pour le préfixe sidebar + les drop-
 * downs UI. 'AUTRE' rend chaîne vide pour ne pas afficher quelque chose
 * d'incongru si l'admin n'a pas su catégoriser.
 */
export const ESTABLISHMENT_TYPE_LABELS: Record<EstablishmentType, string> = {
  CABINET: 'Cabinet',
  CLINIQUE: 'Clinique',
  HOPITAL: 'Hôpital',
  CENTRE_MEDICAL: 'Centre médical',
  AUTRE: '',
};

export interface TierConfig {
  id: string;
  tier: 'NORMAL' | 'PREMIUM';
  discountPercent: number;
}

export function useClinicSettings() {
  const { t } = useT();
  const { data, isLoading, error } = useQuery({
    queryKey: ['clinic-settings'],
    queryFn: () =>
      api
        .get<ClinicSettings>('/settings/clinic')
        .then((r) => r.data)
        .catch(() => null),
    staleTime: 60_000,
  });

  return {
    settings: data ?? null,
    isLoading,
    error: error ? t('settings.errors.loadSettings') : null,
  };
}

export function useUpdateClinicSettings() {
  const qc = useQueryClient();
  const mutation = useMutation({
    mutationFn: (form: ClinicSettingsForm) =>
      api.put<ClinicSettings>('/settings/clinic', form).then((r) => r.data),
    onSuccess: (data) => {
      qc.setQueryData(['clinic-settings'], data);
    },
  });
  return {
    update: mutation.mutateAsync,
    isPending: mutation.isPending,
  };
}

// Stable empty fallback — without it, `data ?? []` returns a fresh `[]` on every
// render and any `useEffect(..., [tiers])` consumer ends up in an infinite loop
// (TarifsTab triggered "Maximum update depth exceeded" before this was added).
const EMPTY_TIERS: TierConfig[] = [];

export function useTiers() {
  const { data, isLoading } = useQuery({
    queryKey: ['tier-config'],
    queryFn: () => api.get<TierConfig[]>('/settings/tiers').then((r) => r.data),
    staleTime: 60_000,
  });
  return { tiers: data ?? EMPTY_TIERS, isLoading };
}

export function useUpdateTierDiscount() {
  const qc = useQueryClient();
  const mutation = useMutation({
    mutationFn: ({ tier, discountPercent }: { tier: 'NORMAL' | 'PREMIUM'; discountPercent: number }) =>
      api
        .put<TierConfig>(`/settings/tiers/${tier}`, { tier, discountPercent })
        .then((r) => r.data),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['tier-config'] });
    },
  });
  return {
    updateTier: mutation.mutateAsync,
    isPending: mutation.isPending,
  };
}
