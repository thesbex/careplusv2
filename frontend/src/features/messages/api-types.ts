/**
 * Types miroirs des DTOs backend (ma.careplus.chat). Distincts de `types.ts`
 * qui décrit la shape UI ; on traduit `api → ui` dans les hooks.
 */
import type { Presence } from './types';

export interface ApiTeamMember {
  id: string;
  name: string;
  role: string;
  initials: string;
  color: string;
  presence: Presence;
  /** V052 — true si le user a une photo de profil (GET /api/users/{id}/photo). */
  hasPhoto?: boolean;
}

export interface ApiChannel {
  id: string;
  name: string;
  sub: string;
  unread: number;
  mentions: number;
  members: number;
}

export interface ApiDirectMessage {
  id: string;
  contact: ApiTeamMember;
  last: string;
  time: string;
  unread: number;
  mentions: number;
}

export interface ApiPatientThread {
  id: string;
  patient: string;
  pid: string;
  subj: string;
  participants: number;
  time: string;
  open: boolean;
  color: string;
}

export interface ApiAttachedPatient {
  id: string;
  name: string;
  pid: string;
  age: number | null;
}

export interface ApiMentionedUser {
  userId: string;
  name: string;
}

export interface ApiReactionGroup {
  emoji: string;
  count: number;
  reactedByMe: boolean;
}

export interface ApiReplyMeta {
  count: number;
  lastAt: string | null;
  lastSenderName: string;
}

export interface ApiAttachment {
  id: string;
  filename: string;
  mime: string;
  sizeBytes: number;
}

export interface ApiMessage {
  id: string;
  conversationId: string;
  parentMessageId: string | null;
  senderId: string;
  sender: ApiTeamMember;
  body: string;
  createdAt: string;
  urgent: boolean;
  pinned: boolean;
  readByRecipient: boolean;
  patient: ApiAttachedPatient | null;
  mentions: ApiMentionedUser[];
  reactions: ApiReactionGroup[];
  reply: ApiReplyMeta | null;
  attachment: ApiAttachment | null;
}

export interface ApiConversation {
  id: string;
  kind: 'DM' | 'CHANNEL' | 'PATIENT_THREAD';
  name: string;
  topic: string | null;
  color: string | null;
  members: ApiTeamMember[];
  lastMessageAt: string | null;
  unreadCount: number;
  pinnedMessageId: string | null;
  pinnedMessageBody: string | null;
  patientId: string | null;
  patientName: string | null;
  patientCode: string | null;
}

export interface ApiUnreadCount {
  total: number;
}
