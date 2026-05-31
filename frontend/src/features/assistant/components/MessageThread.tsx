import { useT } from '@/lib/i18n/I18nProvider';
import type { AssistantMessage } from '../types';

/** Rend le fil de messages USER / ASSISTANT + un indicateur « en train d'écrire ». */
export function MessageThread({
  messages,
  pending,
}: {
  messages: AssistantMessage[];
  pending: boolean;
}) {
  const { t } = useT();
  return (
    <div className="cp-ai-msgs">
      {messages.map((m) => (
        <div key={m.id} className={`cp-ai-msg ${m.role === 'USER' ? 'is-user' : 'is-ai'}`}>
          <div className="cp-ai-msg-role">{m.role === 'USER' ? t('ai.roleUser') : t('ai.roleAssistant')}</div>
          <div className="cp-ai-msg-body">{m.content}</div>
        </div>
      ))}
      {pending && (
        <div className="cp-ai-msg is-ai">
          <div className="cp-ai-msg-role">{t('ai.roleAssistant')}</div>
          <div className="cp-ai-msg-body cp-ai-typing" aria-label={t('ai.typing')}>
            <span />
            <span />
            <span />
          </div>
        </div>
      )}
    </div>
  );
}
