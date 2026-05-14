/**
 * Hooks specific to the onboarding wizard (steps 2 — Médecin, 3 — Horaires,
 * 6 — Documents). They wrap endpoints that were added in the parallel-sync
 * J-day delivery alongside this wizard:
 *
 *   GET/PUT /api/settings/working-hours        — V040 Day×Slots replace-all
 *   GET     /api/settings/document-templates    — V001 seed metadata only
 *   PUT     /api/admin/users/{id}              — practitioner credentials
 *
 * Per-step hooks live here (rather than scattered in each step file) so the
 * wizard's data graph stays in one place. Paramétrage will share these later.
 */
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api/client';

// ── Onboarding gate state ───────────────────────────────────────────────────

export type OnboardingStepKey =
  | 'cabinet'
  | 'medecin'
  | 'horaires'
  | 'equipe'
  | 'tarifs'
  | 'documents'
  | 'recap';

export interface OnboardingStateView {
  completed: boolean;
  completedAt: string | null;
  currentStep: OnboardingStepKey | null;
}

const DEFAULT_STATE: OnboardingStateView = {
  completed: false,
  completedAt: null,
  currentStep: null,
};

export function useOnboardingState() {
  const { data, isLoading } = useQuery({
    queryKey: ['onboarding-state'],
    queryFn: () =>
      api
        .get<OnboardingStateView>('/settings/onboarding/state')
        .then((r) => r.data)
        .catch(() => DEFAULT_STATE),
    staleTime: 10_000,
  });
  return { state: data ?? DEFAULT_STATE, isLoading };
}

export function useUpdateOnboardingStep() {
  const qc = useQueryClient();
  const mutation = useMutation({
    mutationFn: (step: OnboardingStepKey) =>
      api
        .put<OnboardingStateView>('/settings/onboarding/state', { step })
        .then((r) => r.data),
    onSuccess: (data) => qc.setQueryData(['onboarding-state'], data),
  });
  return { updateStep: mutation.mutateAsync, isPending: mutation.isPending };
}

export function useCompleteOnboarding() {
  const qc = useQueryClient();
  const mutation = useMutation({
    mutationFn: () =>
      api
        .post<OnboardingStateView>('/settings/onboarding/complete', {})
        .then((r) => r.data),
    onSuccess: (data) => qc.setQueryData(['onboarding-state'], data),
  });
  return { complete: mutation.mutateAsync, isPending: mutation.isPending };
}

// ── Working hours ───────────────────────────────────────────────────────────

export interface WorkingHoursSlot {
  startTime: string; // HH:mm
  endTime: string;
}

export interface WorkingHoursDay {
  dayOfWeek: number; // 1..7 (ISO, Mon..Sun)
  active: boolean;
  slots: WorkingHoursSlot[];
}

export interface WorkingHoursView {
  days: WorkingHoursDay[];
}

/** Empty week — placeholder until backend returns the seed. */
const EMPTY_WEEK: WorkingHoursView = {
  days: Array.from({ length: 7 }, (_, i) => ({
    dayOfWeek: i + 1,
    active: false,
    slots: [],
  })),
};

export function useWorkingHours() {
  const { data, isLoading } = useQuery({
    queryKey: ['working-hours'],
    queryFn: () =>
      api.get<WorkingHoursView>('/settings/working-hours').then((r) => r.data),
    staleTime: 60_000,
  });
  return { workingHours: data ?? EMPTY_WEEK, isLoading };
}

export function useUpdateWorkingHours() {
  const qc = useQueryClient();
  const mutation = useMutation({
    mutationFn: (form: WorkingHoursView) =>
      api
        .put<WorkingHoursView>('/settings/working-hours', form)
        .then((r) => r.data),
    onSuccess: (data) => qc.setQueryData(['working-hours'], data),
  });
  return { updateWorkingHours: mutation.mutateAsync, isPending: mutation.isPending };
}

// ── Document templates ──────────────────────────────────────────────────────

export interface DocumentTemplateMeta {
  id: string;
  type: string;
  pageFormat: string;
  templateBytes: number;
  updatedAt: string;
}

/** Human label for a template type code. */
export const TEMPLATE_TYPE_LABELS: Record<string, string> = {
  ORDONNANCE: 'Ordonnance',
  ORDONNANCE_SECURISEE: 'Ordonnance sécurisée',
  BON_ANALYSE: 'Bon d’analyse',
  BON_RADIO: 'Bon de radiologie',
  CERTIFICAT: 'Certificat médical',
  ARRET_TRAVAIL: 'Arrêt de travail',
  FACTURE: 'Facture',
  RECU: 'Reçu',
};

const EMPTY_TEMPLATES: DocumentTemplateMeta[] = [];

export function useDocumentTemplates() {
  const { data, isLoading } = useQuery({
    queryKey: ['document-templates'],
    queryFn: () =>
      api
        .get<DocumentTemplateMeta[]>('/settings/document-templates')
        .then((r) => r.data),
    staleTime: 60_000,
  });
  return { templates: data ?? EMPTY_TEMPLATES, isLoading };
}

// ── Catalog acts (nomenclature) ─────────────────────────────────────────────

export interface ActMeta {
  id: string;
  code: string | null;
  name: string;
  type: string;
  active: boolean;
  defaultPrice: number | string | null;
  cnopsEligible: boolean;
  cnssEligible: boolean;
  ramedEligible: boolean;
}

const EMPTY_ACTS: ActMeta[] = [];

export function useCatalogActs() {
  const { data, isLoading } = useQuery({
    queryKey: ['catalog-acts'],
    queryFn: () => api.get<ActMeta[]>('/catalog/acts').then((r) => r.data),
    staleTime: 60_000,
  });
  return { acts: data ?? EMPTY_ACTS, isLoading };
}

// ── Practitioner credentials (current admin) ────────────────────────────────

export interface PractitionerCredentialsForm {
  specialty: string;
  inpe: string;
  cnom: string;
  cnops: string;
}

export interface MeProfile {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  specialty: string | null;
  inpe: string | null;
  cnom: string | null;
  cnops: string | null;
}

export function useMeProfile() {
  const { data, isLoading } = useQuery({
    queryKey: ['me-profile'],
    queryFn: () => api.get<MeProfile>('/users/me').then((r) => r.data),
    staleTime: 30_000,
  });
  return { me: data ?? null, isLoading };
}

export function useUpdatePractitionerCredentials() {
  const qc = useQueryClient();
  const mutation = useMutation({
    mutationFn: async (args: { userId: string; form: PractitionerCredentialsForm }) => {
      const payload = {
        specialty: args.form.specialty,
        inpe: args.form.inpe,
        cnom: args.form.cnom,
        cnops: args.form.cnops,
      };
      return api
        .put<MeProfile>(`/admin/users/${args.userId}`, payload)
        .then((r) => r.data);
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['me-profile'] });
    },
  });
  return { updateCredentials: mutation.mutateAsync, isPending: mutation.isPending };
}

// ── Practitioner signature ──────────────────────────────────────────────────

export interface SignatureMeta {
  mime: string;
  uploadedAt: string;
  sizeBytes: number;
}

export function useUserSignature(userId: string | null) {
  const { data } = useQuery({
    queryKey: ['user-signature-meta', userId],
    queryFn: async () => {
      if (!userId) return null;
      const r = await api.get<SignatureMeta>(`/practitioners/${userId}/signature/meta`);
      return r.status === 204 ? null : r.data;
    },
    enabled: !!userId,
    staleTime: 30_000,
  });
  return { signatureMeta: data ?? null };
}

// ── Clinic logo ─────────────────────────────────────────────────────────────

export interface LogoMeta {
  mime: string;
  uploadedAt: string;
  sizeBytes: number;
}

export function useClinicLogoMeta(hasLogo: boolean) {
  // Only fire the query when the parent flag says the bytes exist — saves a 204
  // round-trip on first onboarding visits where no logo has ever been set.
  const { data } = useQuery({
    queryKey: ['clinic-logo-meta'],
    queryFn: async () => {
      const r = await api.get<LogoMeta>('/settings/clinic/logo/meta');
      return r.status === 204 ? null : r.data;
    },
    enabled: hasLogo,
    staleTime: 30_000,
  });
  return { logoMeta: data ?? null };
}

export function useUploadClinicLogo() {
  const qc = useQueryClient();
  const mutation = useMutation({
    mutationFn: async (file: File) => {
      const fd = new FormData();
      fd.append('file', file);
      const r = await api.put<LogoMeta>('/settings/clinic/logo', fd, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      return r.data;
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['clinic-settings'] });
      void qc.invalidateQueries({ queryKey: ['clinic-logo-meta'] });
    },
  });
  return { upload: mutation.mutateAsync, isPending: mutation.isPending };
}

export function useUploadUserSignature() {
  const qc = useQueryClient();
  const mutation = useMutation({
    mutationFn: async (args: { userId: string; file: File }) => {
      const fd = new FormData();
      fd.append('file', args.file);
      const r = await api.put<SignatureMeta>(
        `/practitioners/${args.userId}/signature`,
        fd,
        { headers: { 'Content-Type': 'multipart/form-data' } },
      );
      return r.data;
    },
    onSuccess: (_, vars) => {
      void qc.invalidateQueries({ queryKey: ['user-signature-meta', vars.userId] });
    },
  });
  return { upload: mutation.mutateAsync, isPending: mutation.isPending };
}
