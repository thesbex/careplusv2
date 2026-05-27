/**
 * /assistant — Assistant IA (mobile 390 px). Réservé MEDECIN / ADMIN.
 *
 * Vue empilée : barre d'actions (nouvelle / liste), fil de discussion, composer
 * ancré en bas. La liste des conversations s'ouvre en panneau dépliable.
 */
import { useEffect, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Screen } from '@/components/shell/Screen';
import { Send, Plus, Chat, Trash, Sparkles } from '@/components/icons';
import {
  useAiConfig,
  useAssistantConversations,
  useAssistantConversation,
  useAsk,
  useDeleteConversation,
} from './hooks/useAssistant';
import { MessageThread } from './components/MessageThread';
import './assistant.css';

export default function AssistantPageMobile() {
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
  const [listOpen, setListOpen] = useState(false);
  const [pendingPatient, setPendingPatient] = useState<{ id: string; name: string } | null>(
    patientId ? { id: patientId, name: patientName ?? 'ce patient' } : null,
  );
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [conversation?.messages.length, ask.isPending]);

  const configured = config?.configured ?? false;
  const canSend = configured && draft.trim().length > 0 && !ask.isPending;

  function startNew() {
    setSelectedId(null);
    setDraft('');
    setListOpen(false);
    setParams({}, { replace: true });
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
      /* erreur rendue via ask.isError */
    }
  }

  return (
    <Screen active="assistant" title="Assistant IA" sub={config ? config.model : ''}>
      <div className="cp-ai-mobile">
        <div className="cp-ai-mobile-actions">
          <button type="button" className="cp-ai-new" onClick={startNew}>
            <Plus />
            <span>Nouvelle</span>
          </button>
          <button type="button" className="cp-ai-new is-ghost" onClick={() => setListOpen((v) => !v)}>
            <Chat />
            <span>Conversations ({conversations.length})</span>
          </button>
        </div>

        {listOpen && (
          <div className="cp-ai-mobile-list" role="list">
            {conversations.length === 0 && <p className="cp-ai-empty-rail">Aucune conversation.</p>}
            {conversations.map((c) => (
              <div key={c.id} role="listitem" className="cp-ai-conv">
                <button
                  type="button"
                  className="cp-ai-conv-btn"
                  onClick={() => {
                    setSelectedId(c.id);
                    setPendingPatient(null);
                    setListOpen(false);
                    setParams({ c: c.id }, { replace: true });
                  }}
                >
                  {c.patientId && <span className="cp-ai-conv-tag">⚕</span>}
                  <span className="cp-ai-conv-title">{c.title}</span>
                </button>
                <button
                  type="button"
                  className="cp-ai-conv-del"
                  aria-label="Supprimer"
                  onClick={() => void del.mutateAsync(c.id).then(() => selectedId === c.id && startNew())}
                >
                  <Trash />
                </button>
              </div>
            ))}
          </div>
        )}

        {!configured && (
          <div className="cp-ai-banner" role="status">
            <strong>Assistant non configuré.</strong> Clé API manquante côté serveur.
          </div>
        )}

        {!selectedId && pendingPatient && (
          <div className="cp-ai-context-note" role="status">
            Contexte joint : dossier de <strong>{pendingPatient.name}</strong>.
            <button type="button" className="cp-ai-context-clear" onClick={() => setPendingPatient(null)}>
              Retirer
            </button>
          </div>
        )}

        <div className="cp-ai-thread">
          {!conversation && !ask.isPending && (
            <div className="cp-ai-welcome">
              <Sparkles />
              <h2>Comment puis-je vous aider ?</h2>
            </div>
          )}
          {conversation && <MessageThread messages={conversation.messages} pending={ask.isPending} />}
          {!conversation && ask.isPending && <MessageThread messages={[]} pending />}
          <div ref={endRef} />
        </div>

        {ask.isError && (
          <p className="cp-ai-error" role="alert">
            L'assistant n'a pas pu répondre.
          </p>
        )}

        <div className="cp-ai-composer">
          <textarea
            className="cp-ai-input"
            placeholder={configured ? 'Votre question…' : 'Indisponible'}
            value={draft}
            disabled={!configured || ask.isPending}
            rows={2}
            onChange={(e) => setDraft(e.target.value)}
          />
          <button
            type="button"
            className="cp-ai-send"
            disabled={!canSend}
            onClick={() => void send()}
            aria-label="Envoyer"
          >
            <Send />
          </button>
        </div>
      </div>
    </Screen>
  );
}
