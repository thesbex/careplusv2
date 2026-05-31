/**
 * AttachmentChip — V053.
 *
 * Bulle d'une pièce jointe dans un message chat. Click → ouvre le binaire
 * dans un nouvel onglet via blob URL (le JWT est in-memory, donc on passe
 * par axios pour récupérer le contenu — même pattern que QueuePage.viewResult).
 */
import { toast } from 'sonner';
import { File as FileIcon } from '@/components/icons';
import { api } from '@/lib/api/client';
import { useT, type I18nContextValue } from '@/lib/i18n/I18nProvider';
import type { MessageAttachment } from '../types';

function formatSize(bytes: number, t: I18nContextValue['t']): string {
  if (bytes < 1024) return t('chat.size.bytes', { n: bytes });
  if (bytes < 1024 * 1024) return t('chat.size.kb', { n: (bytes / 1024).toFixed(0) });
  return t('chat.size.mb', { n: (bytes / (1024 * 1024)).toFixed(1) });
}

export function AttachmentChip({ a }: { a: MessageAttachment }) {
  const { t } = useT();
  async function open() {
    try {
      const res = await api.get(`/chat/attachments/${a.id}/content`, {
        responseType: 'arraybuffer',
      });
      const ctype = (res.headers['content-type'] as string) ?? a.mime ?? 'application/octet-stream';
      const blob = new Blob([res.data as ArrayBuffer], { type: ctype });
      const url = URL.createObjectURL(blob);
      window.open(url, '_blank', 'noopener,noreferrer');
      setTimeout(() => URL.revokeObjectURL(url), 60_000);
    } catch {
      toast.error(t('chat.attach.openFailed'));
    }
  }
  return (
    <button
      type="button"
      onClick={() => void open()}
      title={a.filename}
      style={{
        marginTop: 6,
        display: 'inline-flex',
        alignItems: 'center',
        gap: 8,
        padding: '7px 11px',
        border: '1px solid var(--border)',
        borderRadius: 8,
        background: 'var(--surface)',
        cursor: 'pointer',
        maxWidth: 320,
        fontFamily: 'inherit',
      }}
    >
      <FileIcon style={{ width: 16, height: 16, color: 'var(--ink-3)', flexShrink: 0 }} />
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', minWidth: 0 }}>
        <span
          style={{
            fontSize: 13,
            fontWeight: 600,
            color: 'var(--ink)',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
            maxWidth: 280,
          }}
        >
          {a.filename}
        </span>
        <span style={{ fontSize: 11, color: 'var(--ink-3)' }}>{formatSize(a.sizeBytes, t)}</span>
      </div>
    </button>
  );
}
