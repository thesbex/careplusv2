/**
 * QA9-13 — Modale "Consentement éclairé" : le médecin choisit un modèle
 * (préremplit titre + corps, éditables) ou rédige librement, puis
 * "Générer & imprimer" → POST /patients/{id}/consents → documentId →
 * téléchargement immédiat du PDF (blob via JWT en mémoire) + refresh de la
 * liste des documents du dossier (type CONSENTEMENT).
 */
import { useEffect, useState } from 'react';
import * as Dialog from '@radix-ui/react-dialog';
import { toast } from 'sonner';
import { Button } from '@/components/ui/Button';
import { Select } from '@/components/ui/Input';
import { Close } from '@/components/icons';
import { api } from '@/lib/api/client';
import { useT } from '@/lib/i18n/I18nProvider';
import { useConsentTemplates, useGenerateConsent } from '../hooks/useConsentTemplates';
import {
  CONSENT_PLACEHOLDERS,
  type ConsentGenerateRequest,
} from '../types';

interface ConsentDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  patientId: string;
}

export function ConsentDialog({ open, onOpenChange, patientId }: ConsentDialogProps) {
  const { t } = useT();
  const { templates } = useConsentTemplates();
  const { generate, isPending } = useGenerateConsent(patientId);

  const [templateId, setTemplateId] = useState<string>('');
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [downloading, setDownloading] = useState(false);

  useEffect(() => {
    if (open) {
      setTemplateId('');
      setTitle('');
      setBody('');
    }
  }, [open]);

  function pickTemplate(id: string) {
    setTemplateId(id);
    const tmpl = templates.find((t) => t.id === id);
    if (tmpl) {
      setTitle(tmpl.title);
      setBody(tmpl.body);
    }
  }

  async function submit() {
    if (!title.trim()) {
      toast.error(t('consent.err.titleRequired'));
      return;
    }
    if (body.trim().length < 10) {
      toast.error(t('consent.err.bodyMin'));
      return;
    }
    const payload: ConsentGenerateRequest = {
      title: title.trim(),
      body: body.trim(),
      ...(templateId ? { templateId } : {}),
    };
    setDownloading(true);
    try {
      const { documentId } = await generate(payload);
      toast.success(t('consent.toast.generated'));
      // Téléchargement immédiat du PDF — même mécanisme que DocumentsPanel
      // (blob via axios car le JWT est en mémoire, pas en cookie).
      try {
        const res = await api.get<Blob>(`/documents/${documentId}/content`, {
          responseType: 'blob',
        });
        const url = URL.createObjectURL(res.data as Blob);
        window.open(url, '_blank', 'noopener,noreferrer');
        setTimeout(() => URL.revokeObjectURL(url), 1_000);
      } catch {
        toast.error(t('consent.err.pdfPreview'));
      }
      onOpenChange(false);
    } catch (e: unknown) {
      const msg =
        (e as { response?: { data?: { detail?: string } } })?.response?.data?.detail ??
        t('consent.err.generateRefused');
      toast.error(msg);
    } finally {
      setDownloading(false);
    }
  }

  const busy = isPending || downloading;

  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay
          style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', zIndex: 100 }}
        />
        <Dialog.Content
          style={{
            position: 'fixed',
            top: '50%',
            left: '50%',
            transform: 'translate(-50%, -50%)',
            background: 'var(--surface)',
            border: '1px solid var(--border)',
            borderRadius: 'var(--r-md)',
            padding: 22,
            width: 'min(600px, 94vw)',
            maxHeight: '90vh',
            overflowY: 'auto',
            zIndex: 101,
            boxShadow: '0 8px 32px rgba(0,0,0,0.18)',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', marginBottom: 14 }}>
            <Dialog.Title style={{ fontSize: 15, fontWeight: 600, margin: 0, flex: 1 }}>
              {t('consent.dialog.title')}
            </Dialog.Title>
            <Dialog.Close asChild>
              <Button variant="ghost" size="sm" iconOnly aria-label={t('consent.dialog.close')}>
                <Close />
              </Button>
            </Dialog.Close>
          </div>
          <Dialog.Description style={{ fontSize: 12, color: 'var(--ink-3)', marginBottom: 14 }}>
            {t('consent.dialog.description')}
          </Dialog.Description>

          <label style={{ display: 'flex', flexDirection: 'column', gap: 4, fontSize: 12, marginBottom: 12 }}>
            <span style={{ color: 'var(--ink-3)', fontWeight: 600 }}>{t('consent.dialog.templateLabel')}</span>
            <Select
              value={templateId}
              onChange={(e) => pickTemplate(e.target.value)}
              aria-label={t('consent.dialog.templateAria')}
              style={{
                height: 34, padding: '0 10px',
                border: '1px solid var(--border)', borderRadius: 6,
                fontFamily: 'inherit', fontSize: 13, background: 'var(--surface)',
              }}
            >
              <option value="">{t('consent.dialog.templateFree')}</option>
              {templates.map((tmpl) => (
                <option key={tmpl.id} value={tmpl.id}>
                  {t('consent.dialog.templateOption', {
                    type: t(`consent.type.${tmpl.type}`),
                    title: tmpl.title,
                  })}
                </option>
              ))}
            </Select>
          </label>

          <label style={{ display: 'flex', flexDirection: 'column', gap: 4, fontSize: 12, marginBottom: 12 }}>
            <span style={{ color: 'var(--ink-3)', fontWeight: 600 }}>{t('consent.dialog.titleLabel')}</span>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder={t('consent.dialog.titlePlaceholder')}
              aria-label={t('consent.dialog.titleAria')}
              style={{
                height: 34, padding: '0 10px',
                border: '1px solid var(--border)', borderRadius: 6,
                fontFamily: 'inherit', fontSize: 13, background: 'var(--surface)',
              }}
            />
          </label>

          <textarea
            value={body}
            onChange={(e) => setBody(e.target.value)}
            placeholder={t('consent.dialog.bodyPlaceholder')}
            rows={10}
            aria-label={t('consent.dialog.bodyAria')}
            style={{
              width: '100%',
              border: '1px solid var(--border)',
              borderRadius: 6,
              padding: 10,
              fontSize: 13,
              fontFamily: 'inherit',
              resize: 'vertical',
              boxSizing: 'border-box',
            }}
          />
          <div style={{ fontSize: 11, color: 'var(--ink-3)', marginTop: 6, lineHeight: 1.6 }}>
            {t('consent.dialog.placeholdersHint')}{' '}
            {CONSENT_PLACEHOLDERS.map((p) => (
              <code
                key={p}
                style={{
                  background: 'var(--surface-2)', borderRadius: 4,
                  padding: '1px 5px', marginRight: 4, fontSize: 11,
                }}
              >
                {p}
              </code>
            ))}
          </div>

          <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 16 }}>
            <Dialog.Close asChild>
              <Button>{t('common.cancel')}</Button>
            </Dialog.Close>
            <Button variant="primary" onClick={() => { void submit(); }} disabled={busy}>
              {busy ? t('consent.dialog.generating') : t('consent.dialog.generate')}
            </Button>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
