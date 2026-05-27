/** Types de l'assistant IA (module ma.careplus.assistant, V064). */

export interface AiConfig {
  enabled: boolean;
  configured: boolean;
  provider: string;
  model: string;
}

export type AssistantRole = 'USER' | 'ASSISTANT';

export interface AssistantMessage {
  id: string;
  role: AssistantRole;
  content: string;
  createdAt: string;
}

export interface ConversationSummary {
  id: string;
  title: string;
  patientId: string | null;
  updatedAt: string;
}

export interface ConversationDetail {
  id: string;
  title: string;
  patientId: string | null;
  messages: AssistantMessage[];
}

export interface AskPayload {
  conversationId?: string;
  patientId?: string;
  message: string;
}
