import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api/client';
import { useT, type I18nContextValue } from '@/lib/i18n/I18nProvider';
import type { Lang } from '@/lib/i18n/index';
import type { ApiConversation, ApiMessage } from '../api-types';
import type { ChatMessage, Conversation, MessageDay, TeamMember } from '../types';

/** Map de Lang → locale BCP-47 pour le formatage des dates (jour, heure). */
const LOCALE: Record<Lang, string> = {
  fr: 'fr-FR',
  en: 'en-GB',
  ar: 'ar-MA',
  es: 'es-ES',
};

/**
 * Récupère la conversation + ses messages, et mappe vers la shape `Conversation`
 * attendue par les composants existants (messages groupés par jour).
 */
export function useConversation(conversationId: string | null | undefined) {
  const { t, lang } = useT();
  const locale = LOCALE[lang] ?? 'fr-FR';
  return useQuery({
    // `lang` dans la clé : les libellés de jour / heure sont dérivés selon la
    // langue, on re-mappe donc quand le super admin change la langue.
    queryKey: ['chat', 'conversation', conversationId, lang],
    enabled: !!conversationId,
    queryFn: async (): Promise<Conversation> => {
      const [convRes, msgsRes] = await Promise.all([
        api.get<ApiConversation>(`/chat/conversations/${conversationId}`),
        api.get<ApiMessage[]>(`/chat/conversations/${conversationId}/messages?limit=200`),
      ]);
      const conv = convRes.data;
      const msgs = msgsRes.data;

      const members: TeamMember[] = conv.members.map((m) => ({
        id: m.id,
        name: m.name,
        role: m.role,
        initials: m.initials,
        color: m.color,
        online: m.presence,
        hasPhoto: m.hasPhoto ?? false,
      }));

      const days = groupByDay(msgs, t, locale);

      const result: Conversation = {
        id: conv.id,
        kind: conv.kind === 'DM' ? 'dm' : conv.kind === 'CHANNEL' ? 'channel' : 'patient',
        name: conv.name,
        topic: conv.topic ?? '',
        members,
        pinned: conv.pinnedMessageId ? 1 : 0,
        messages: days,
      };
      if (conv.pinnedMessageBody) result.pinnedBody = conv.pinnedMessageBody;
      return result;
    },
    refetchInterval: 5_000,
    staleTime: 2_000,
  });
}

function groupByDay(msgs: ApiMessage[], t: I18nContextValue['t'], locale: string): MessageDay[] {
  const map = new Map<string, ChatMessage[]>();
  const dayOrder: string[] = [];
  for (const m of msgs) {
    const d = new Date(m.createdAt);
    const day = formatDayLabel(d, t, locale);
    if (!map.has(day)) {
      map.set(day, []);
      dayOrder.push(day);
    }
    const sender: TeamMember = {
      id: m.sender.id,
      name: m.sender.name,
      role: m.sender.role,
      initials: m.sender.initials,
      color: m.sender.color,
      online: m.sender.presence,
      hasPhoto: m.sender.hasPhoto ?? false,
    };
    const cm: ChatMessage = {
      u: sender,
      time: d.toLocaleTimeString(locale, { hour: '2-digit', minute: '2-digit' }),
      text: m.body,
    };
    if (m.urgent) cm.urgent = true;
    if (m.mentions.length > 0) cm.mentions = m.mentions.map((x) => x.name);
    if (m.reactions.length > 0) {
      cm.reactions = m.reactions.map((r) => ({ emoji: r.emoji, count: r.count }));
    }
    if (m.reply) {
      cm.reply = {
        count: m.reply.count,
        last: relativeFromIso(m.reply.lastAt, t, locale),
      };
    }
    if (m.patient) {
      cm.patient = {
        name: m.patient.name,
        id: m.patient.pid,
        recordId: m.patient.id,
        age: m.patient.age ?? 0,
      };
    }
    if (m.attachment) {
      cm.attachment = {
        id: m.attachment.id,
        filename: m.attachment.filename,
        mime: m.attachment.mime,
        sizeBytes: m.attachment.sizeBytes,
      };
    }
    map.get(day)!.push(cm);
  }
  return dayOrder.map((day) => ({ day, msgs: map.get(day)! }));
}

function formatDayLabel(d: Date, t: I18nContextValue['t'], locale: string): string {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const yest = new Date(today);
  yest.setDate(today.getDate() - 1);
  const dDay = new Date(d);
  dDay.setHours(0, 0, 0, 0);
  const dateLabel = d.toLocaleDateString(locale, { weekday: 'long', day: '2-digit', month: 'long' });
  if (dDay.getTime() === today.getTime()) {
    return `${t('chat.day.today')} · ${dateLabel}`;
  }
  if (dDay.getTime() === yest.getTime()) {
    return `${t('chat.day.yesterday')} · ${dateLabel}`;
  }
  return dateLabel;
}

function relativeFromIso(iso: string | null, t: I18nContextValue['t'], locale: string): string {
  if (!iso) return '';
  const d = new Date(iso);
  const delta = Date.now() - d.getTime();
  const min = Math.round(delta / 60000);
  if (min < 1) return t('chat.ago.now');
  if (min < 60) return t('chat.ago.minutes', { n: min });
  const h = Math.round(min / 60);
  if (h < 24) return t('chat.ago.hours', { n: h });
  return d.toLocaleDateString(locale);
}
