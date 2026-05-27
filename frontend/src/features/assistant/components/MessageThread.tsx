import type { AssistantMessage } from '../types';

/** Rend le fil de messages USER / ASSISTANT + un indicateur « en train d'écrire ». */
export function MessageThread({
  messages,
  pending,
}: {
  messages: AssistantMessage[];
  pending: boolean;
}) {
  return (
    <div className="cp-ai-msgs">
      {messages.map((m) => (
        <div key={m.id} className={`cp-ai-msg ${m.role === 'USER' ? 'is-user' : 'is-ai'}`}>
          <div className="cp-ai-msg-role">{m.role === 'USER' ? 'Vous' : 'Assistant'}</div>
          <div className="cp-ai-msg-body">{m.content}</div>
        </div>
      ))}
      {pending && (
        <div className="cp-ai-msg is-ai">
          <div className="cp-ai-msg-role">Assistant</div>
          <div className="cp-ai-msg-body cp-ai-typing" aria-label="L'assistant rédige une réponse">
            <span />
            <span />
            <span />
          </div>
        </div>
      )}
    </div>
  );
}
