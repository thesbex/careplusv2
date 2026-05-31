/**
 * /assistant — Assistant IA (desktop). Réservé MEDECIN / ADMIN.
 *
 * Layout 2 colonnes : rail des conversations + fil de discussion / composer.
 * Provider configurable côté backend (Gemini par défaut) ; l'IHM lit
 * /assistant/config pour s'activer ou afficher l'état « non configuré ».
 *
 * Query params :
 *   ?c=<conversationId>  ouvre une conversation existante
 *   ?patient=<id>&patientName=<nom>  prépare une conversation contextuelle
 *   (le prochain message joint le résumé clinique du dossier au modèle).
 */
import { useEffect, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Screen } from '@/components/shell/Screen';
import { Sparkles, Send, Plus, Trash } from '@/components/icons';
import { useT } from '@/lib/i18n/I18nProvider';
import {
  useAiConfig,
  useAssistantConversations,
  useAssistantConversation,
  useAsk,
  useDeleteConversation,
} from './hooks/useAssistant';
import { MessageThread } from './components/MessageThread';
import './assistant.css';

export default function AssistantPage() {
  const { t } = useT();
  const [params, setParams] = useSearchParams();
  const patientId = params.get('patient');
  const patientName = params.get('patientName');

  const { config } = useAiConfig();
  const { conversations } = useAssistantConversations();
  const [selectedId, setSelectedId] = useState<string | null>(params.get('c'));
  const { conversation } = useAssistantConversation(selectedId);
  const ask = useAsk();
  const del = useDeleteConversation();

  const [draft, setDraft] = useState('');
  // Contexte patient en attente pour la PROCHAINE nouvelle conversation.
  const [pendingPatient, setPendingPatient] = useState<{ id: string; name: string } | null>(
    patientId ? { id: patientId, name: patientName ?? t('ai.thisPatient') } : null,
  );
  const threadEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    threadEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [conversation?.messages.length, ask.isPending]);

  const configured = config?.configured ?? false;
  const canSend = configured && draft.trim().length > 0 && !ask.isPending;

  function startNew() {
    setSelectedId(null);
    setDraft('');
    setParams({}, { replace: true });
  }

  function selectConversation(id: string) {
    setSelectedId(id);
    setPendingPatient(null);
    setParams({ c: id }, { replace: true });
  }

  async function send() {
    const message = draft.trim();
    if (!message || ask.isPending || !configured) return;
    try {
      const detail = await ask.mutateAsync({
        message,
        ...(selectedId ? { conversationId: selectedId } : {}),
        ...(!selectedId && pendingPatient ? { patientId: pendingPatient.id } : {}),
      });
      setSelectedId(detail.id);
      setDraft('');
      setPendingPatient(null);
      setParams({ c: detail.id }, { replace: true });
    } catch {
      /* l'erreur est rendue sous le composer via ask.isError */
    }
  }

  async function remove(id: string) {
    await del.mutateAsync(id);
    if (selectedId === id) startNew();
  }

  return (
    <Screen
      active="assistant"
      title={t('ai.title')}
      sub={config ? `${providerLabel(config.provider)} · ${config.model}` : t('ai.subDefault')}
    >
      <div className="cp-ai-layout">
        {/* ── Rail conversations ── */}
        <aside className="cp-ai-rail" aria-label={t('ai.conversationsAria')}>
          <button type="button" className="cp-ai-new" onClick={startNew}>
            <Plus />
            <span>{t('ai.newConversation')}</span>
          </button>
          <div className="cp-ai-conv-list" role="list">
            {conversations.length === 0 && (
              <p className="cp-ai-empty-rail">{t('ai.emptyRail')}</p>
            )}
            {conversations.map((c) => (
              <div
                key={c.id}
                role="listitem"
                className={`cp-ai-conv ${selectedId === c.id ? 'is-active' : ''}`}
              >
                <button type="button" className="cp-ai-conv-btn" onClick={() => selectConversation(c.id)}>
                  {c.patientId && <span className="cp-ai-conv-tag" title={t('ai.linkedToRecord')}>⚕</span>}
                  <span className="cp-ai-conv-title">{c.title}</span>
                </button>
                <button
                  type="button"
                  className="cp-ai-conv-del"
                  aria-label={t('ai.deleteConversation')}
                  onClick={() => remove(c.id)}
                >
                  <Trash />
                </button>
              </div>
            ))}
          </div>
        </aside>

        {/* ── Fil + composer ── */}
        <section className="cp-ai-main">
          {!configured && (
            <div className="cp-ai-banner" role="status">
              <strong>{t('ai.notConfigured')}</strong> {t('ai.notConfiguredHint')}
            </div>
          )}

          {!selectedId && pendingPatient && (
            <div className="cp-ai-context-note" role="status">
              {t('ai.contextNote', { name: pendingPatient.name })}
              <button type="button" className="cp-ai-context-clear" onClick={() => setPendingPatient(null)}>
                {t('ai.contextClear')}
              </button>
            </div>
          )}

          <div className="cp-ai-thread">
            {!conversation && !ask.isPending && (
              <div className="cp-ai-welcome">
                <Sparkles />
                <h2>{t('ai.welcomeTitle')}</h2>
                <p>
                  {t('ai.welcomeText')}
                </p>
              </div>
            )}
            {conversation && (
              <MessageThread messages={conversation.messages} pending={ask.isPending} />
            )}
            {!conversation && ask.isPending && <MessageThread messages={[]} pending />}
            <div ref={threadEndRef} />
          </div>

          {ask.isError && (
            <p className="cp-ai-error" role="alert">
              {t('ai.error')}
            </p>
          )}

          <div className="cp-ai-composer">
            <textarea
              className="cp-ai-input"
              placeholder={configured ? t('ai.placeholder') : t('ai.placeholderUnavailable')}
              value={draft}
              disabled={!configured || ask.isPending}
              rows={2}
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  void send();
                }
              }}
            />
            <button
              type="button"
              className="cp-ai-send"
              disabled={!canSend}
              onClick={() => void send()}
              aria-label={t('ai.send')}
            >
              <Send />
            </button>
          </div>
        </section>
      </div>
    </Screen>
  );
}

function providerLabel(provider: string): string {
  const map: Record<string, string> = {
    gemini: 'Google Gemini',
    openai: 'OpenAI',
    groq: 'Groq',
    ollama: 'Ollama (local)',
    anthropic: 'Claude',
  };
  return map[provider] ?? provider;
}
