import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api/client';
import { useAuthStore } from '@/lib/auth/authStore';
import type {
  AiConfig,
  AskPayload,
  ConversationDetail,
  ConversationSummary,
} from '../types';

const DOCTOR_ROLES = ['MEDECIN', 'ADMIN'] as const;

function useIsDoctor(): boolean {
  const user = useAuthStore((s) => s.user);
  return !!user && DOCTOR_ROLES.some((r) => user.roles.includes(r));
}

/** État du provider IA — sert à activer/désactiver l'IHM. */
export function useAiConfig() {
  const isDoctor = useIsDoctor();
  const { data, isLoading, error } = useQuery({
    queryKey: ['assistant', 'config'],
    queryFn: () => api.get<AiConfig>('/assistant/config').then((r) => r.data),
    enabled: isDoctor,
    staleTime: 5 * 60_000,
  });
  return {
    config: data ?? null,
    isLoading,
    error: error ? 'ai.errLoadConfig' : null,
  };
}

/** Mes conversations, plus récentes d'abord. */
export function useAssistantConversations() {
  const isDoctor = useIsDoctor();
  const { data, isLoading, error } = useQuery({
    queryKey: ['assistant', 'conversations'],
    queryFn: () =>
      api.get<ConversationSummary[]>('/assistant/conversations').then((r) => r.data),
    enabled: isDoctor,
    staleTime: 30_000,
  });
  return { conversations: data ?? [], isLoading, error: error ? 'ai.errLoadList' : null };
}

/** Détail (fil de messages) d'une conversation. */
export function useAssistantConversation(conversationId: string | null) {
  const { data, isLoading, error } = useQuery({
    queryKey: ['assistant', 'conversation', conversationId],
    queryFn: () =>
      api
        .get<ConversationDetail>(`/assistant/conversations/${conversationId}`)
        .then((r) => r.data),
    enabled: !!conversationId,
    staleTime: 10_000,
  });
  return { conversation: data ?? null, isLoading, error: error ? 'ai.errLoadConversation' : null };
}

/** Pose une question : crée ou poursuit une conversation. */
export function useAsk() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: AskPayload) =>
      api.post<ConversationDetail>('/assistant/ask', payload).then((r) => r.data),
    onSuccess: (detail) => {
      qc.setQueryData(['assistant', 'conversation', detail.id], detail);
      void qc.invalidateQueries({ queryKey: ['assistant', 'conversations'] });
    },
  });
}

/** Supprime une conversation. */
export function useDeleteConversation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (conversationId: string) =>
      api.delete(`/assistant/conversations/${conversationId}`).then((r) => r.data),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['assistant', 'conversations'] });
    },
  });
}
