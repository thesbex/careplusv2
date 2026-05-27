/**
 * Notifications sortantes — types frontend (ADR-040).
 * Contrat backend (base axios = /api) :
 *   GET/POST/PUT/DELETE /notification-templates        (ADMIN)
 *   GET/PUT             /patients/{id}/notification-preferences
 */

export type NotificationEventKey =
  | 'APPOINTMENT_CREATED'
  | 'APPOINTMENT_REMINDER'
  | 'PRESCRIPTION_READY';

export type NotificationChannel = 'WHATSAPP' | 'EMAIL';

export const EVENT_LABELS: Record<NotificationEventKey, string> = {
  APPOINTMENT_CREATED: 'RDV créé',
  APPOINTMENT_REMINDER: 'Rappel (J-1)',
  PRESCRIPTION_READY: 'Ordonnance prête',
};

export const EVENT_ORDER: NotificationEventKey[] = [
  'APPOINTMENT_CREATED',
  'APPOINTMENT_REMINDER',
  'PRESCRIPTION_READY',
];

export const CHANNEL_LABELS: Record<NotificationChannel, string> = {
  WHATSAPP: 'WhatsApp',
  EMAIL: 'Email',
};

export const NOTIFICATION_PLACEHOLDERS = [
  '{{patientNom}}',
  '{{patientPrenom}}',
  '{{date}}',
  '{{heure}}',
  '{{medecin}}',
  '{{cabinet}}',
  '{{motif}}',
];

export interface NotificationTemplateView {
  id: string;
  eventKey: NotificationEventKey;
  channel: NotificationChannel;
  subject: string | null;
  body: string;
  whatsappTemplateName: string | null;
  active: boolean;
  createdAt?: string;
  updatedAt?: string;
}

export interface NotificationTemplateWriteRequest {
  eventKey: NotificationEventKey;
  channel: NotificationChannel;
  subject?: string;
  body: string;
  whatsappTemplateName?: string;
  active: boolean;
}

/** Préférences de notification d'un patient. channel: null = les deux canaux. */
export interface PatientNotificationPrefs {
  optIn: boolean;
  channel: 'WHATSAPP' | 'EMAIL' | 'BOTH' | null;
}
