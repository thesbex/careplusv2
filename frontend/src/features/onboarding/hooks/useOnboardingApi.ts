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
