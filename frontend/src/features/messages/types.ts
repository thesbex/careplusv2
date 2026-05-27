/**
 * Types pour la messagerie d'équipe.
 * V1 mockup IHM — toutes les données sont en dur dans `fixtures.ts`. Aucune
 * persistance, aucun endpoint backend. Les types vivent ici pour que le port
 * du prototype reste discipliné côté React.
 */

export type Presence = 'on' | 'away' | 'off' | 'self';

export interface TeamMember {
  id: string;
  name: string;
  role: string;
  initials: string;
  color: string;
  online: Presence;
  hasPhoto?: boolean;
}

export interface Channel {
  id: string;
  name: string;
  sub: string;
  unread: number;
  mentions: number;
  members: number;
}

export interface DirectMessage {
  id: string;
  contact: TeamMember;
  last: string;
  time: string;
  unread: number;
  mentions: number;
}

export interface PatientThread {
  id: string;
  patient: string;
  pid: string;
  subj: string;
  participants: number;
  time: string;
  open: boolean;
  color: string;
}

export interface MessageReaction {
  emoji: string;
  count: number;
}

export interface MessageReply {
  count: number;
  last: string;
}

export interface PatientAttach {
  name: string;
  /** Code patient affiché (ex. PT-00489). */
  id: string;
  /** UUID navigable du dossier (route /patients/:recordId). */
  recordId: string;
  age: number;
}

export interface MessageAttachment {
  id: string;
  filename: string;
  mime: string;
  sizeBytes: number;
}

export interface ChatMessage {
  u: TeamMember;
  time: string;
  text: string;
  mentions?: string[];
  reactions?: MessageReaction[];
  reply?: MessageReply;
  patient?: PatientAttach;
  urgent?: boolean;
  attachment?: MessageAttachment;
}

export interface MessageDay {
  day: string;
  msgs: ChatMessage[];
}

export interface Conversation {
  id: string;
  kind: 'channel' | 'dm' | 'patient';
  name: string;
  topic?: string;
  members?: TeamMember[];
  pinned?: number;
  /** Corps du message épinglé, si pinned > 0. Vient de l'API. */
  pinnedBody?: string;
  messages?: MessageDay[];
  typing?: string;
}

export type MobileListKind = 'channel' | 'dm' | 'patient';

export interface MobileListItem {
  kind: MobileListKind;
  id: string;
  name: string;
  sub: string;
  time: string;
  unread: number;
  mentions: number;
  urgent?: boolean;
  members?: number;
  pid?: string;
  participants?: number;
  avatar?: { initials: string; color: string };
  /** V052 — id user + flag photo, pour rendre l'avatar photo dans la liste DM. */
  userId?: string;
  hasPhoto?: boolean;
  online?: Presence;
  role?: string;
  sent?: boolean;
  read?: boolean;
}
