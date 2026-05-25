import { useMemo } from 'react';
import { useChannels } from './useChannels';
import { useDirectMessages } from './useDirectMessages';
import { usePatientThreads } from './usePatientThreads';
import type { MobileListItem } from '../types';

/**
 * Dérive la liste mobile unifiée (channels + DMs + patient threads) trié par
 * dernière activité (les items sans timestamp finissent en queue). Reprend la
 * shape `MobileListItem` exigée par MessagesPage.mobile.
 */
export function useMobileList() {
  const channelsQ = useChannels();
  const dmsQ = useDirectMessages();
  const threadsQ = usePatientThreads();

  const items = useMemo<MobileListItem[]>(() => {
    const chans = (channelsQ.data ?? []).map<MobileListItem>((c) => ({
      kind: 'channel',
      id: c.id,
      name: '#' + c.name,
      sub: c.sub ?? '',
      time: '',
      unread: c.unread,
      mentions: c.mentions,
      members: c.members,
    }));
    const dms = (dmsQ.data ?? []).map<MobileListItem>((d) => ({
      kind: 'dm',
      id: d.id,
      name: d.contact.name,
      role: d.contact.role,
      sub: d.last,
      time: d.time,
      unread: d.unread,
      mentions: d.mentions,
      avatar: { initials: d.contact.initials, color: d.contact.color },
      userId: d.contact.id,
      hasPhoto: d.contact.hasPhoto ?? false,
      online: d.contact.online,
    }));
    const threads = (threadsQ.data ?? []).map<MobileListItem>((p) => ({
      kind: 'patient',
      id: p.id,
      name: p.patient,
      sub: p.subj,
      pid: p.pid,
      time: p.time,
      unread: 0,
      mentions: 0,
      participants: p.participants,
    }));
    return [...chans, ...threads, ...dms];
  }, [channelsQ.data, dmsQ.data, threadsQ.data]);

  return {
    items,
    isLoading: channelsQ.isLoading || dmsQ.isLoading || threadsQ.isLoading,
  };
}
