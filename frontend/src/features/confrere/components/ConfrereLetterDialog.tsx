/**
 * QA9-10 — Modale "Courrier au confrère".
 *
 * Le médecin choisit un confrère dans son carnet (préremplit nom / spécialité /
 * ville, éditables) ou saisit librement le destinataire, rédige le corps du
 * courrier, puis "Générer & imprimer" → POST /consultations/{id}/confrere-letter
 * → documentId → téléchargement immédiat du PDF (blob via JWT en mémoire, même
 * mécanisme que ConsentDialog / CertificatDialog) + refresh de la liste des
 * documents (type LETTRE_CONFRERE).
 */
import { useEffect, useState } from 'react';
import * as Dialog from '@radix-ui/react-dialog';
import { toast } from 'sonner';
import { Button } from '@/components/ui/Button';
import { Select } from '@/components/ui/Input';
import { Close } from '@/components/icons';
import { api } from '@/lib/api/client';
import { useT } from '@/lib/i18n/I18nProvider';
import { useReferralContacts } from '@/features/profil/hooks/useReferralContacts';
import { useGenerateConfrereLetter } from '../hooks/useConfrereLetters';
import { useLetterTemplates } from '../hooks/useLetterTemplates';
import type { ConfrereLetterRequest } from '../types';

interface ConfrereLetterDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  consultationId: string;
}

const inputStyle: React.CSSProperties = {
  height: 34,
  padding: '0 10px',
  border: '1px solid var(--border)',
  borderRadius: 6,
  fontFamily: 'inherit',
  fontSize: 13,
  background: 'var(--surface)',
};

const labelStyle: React.CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: 4,
  fontSize: 12,
  marginBottom: 12,
};

const labelTitleStyle: React.CSSProperties = { color: 'var(--ink-3)', fontWeight: 600 };

export function ConfrereLetterDialog({
  open,
  onOpenChange,
  consultationId,
}: ConfrereLetterDialogProps) {
  const { t } = useT();
  const { contacts } = useReferralContacts();
  const { templates } = useLetterTemplates();
  const { generate, isPending } = useGenerateConfrereLetter(consultationId);

  const [contactId, setContactId] = useState('');
  const [templateId, setTemplateId] = useState('');
  const [recipientName, setRecipientName] = useState('');
  const [recipientSpecialty, setRecipientSpecialty] = useState('');
  const [recipientCity, setRecipientCity] = useState('');
  const [body, setBody] = useState('');
  const [downloading, setDownloading] = useState(false);

  useEffect(() => {
    if (open) {
      setContactId('');
      setTemplateId('');
      setRecipientName('');
      setRecipientSpecialty('');
      setRecipientCity('');
      setBody('');
    }
  }, [open]);

  function pickContact(id: string) {
    setContactId(id);
    const c = contacts.find((x) => x.id === id);
    if (c) {
      setRecipientName(c.fullName);
      setRecipientSpecialty(c.specialty ?? '');
      setRecipientCity(c.city ?? '');
    }
  }

  // Charger un modèle pré-remplit le corps de la lettre (le destinataire reste
  // celui choisi dans le carnet ou saisi à la main).
  function pickTemplate(id: string) {
    setTemplateId(id);
    const t = templates.find((x) => x.id === id);
    if (t) setBody(t.body);
  }

  async function submit() {
    if (!recipientName.trim()) {
      toast.error(t('confrere.err.recipientRequired'));
      return;
    }
    if (body.trim().length < 10) {
      toast.error(t('confrere.err.bodyMin'));
      return;
    }
    const specialty = recipientSpecialty.trim();
    const city = recipientCity.trim();
    const payload: ConfrereLetterRequest = {
      recipientName: recipientName.trim(),
      body: body.trim(),
      ...(specialty ? { recipientSpecialty: specialty } : {}),
      ...(city ? { recipientCity: city } : {}),
    };
    setDownloading(true);
    try {
      const { documentId } = await generate(payload);
      toast.success(t('confrere.toast.generated'));
      // Téléchargement immédiat du PDF. On évite `window.open` : appelé après
      // un `await`, il sort du geste utilisateur et se fait bloquer par le
      // bloqueur de pop-ups (« rien ne se passe »). Un <a download> cliqué
      // par programme n'est PAS soumis au blocage de pop-up — même mécanisme
      // que downloadDocument() du dossier patient.
      try {
        const res = await api.get<Blob>(`/documents/${documentId}/content`, {
          responseType: 'blob',
        });
        const url = URL.createObjectURL(res.data as Blob);
        const a = document.createElement('a');
        a.href = url;
        const slug = recipientName.trim().replace(/[^\p{L}\p{N}]+/gu, '-').replace(/^-+|-+$/g, '');
        a.download = `courrier-confrere-${slug || t('confrere.download.fallbackName')}.pdf`;
        document.body.appendChild(a);
        a.click();
        a.remove();
        // Defer revoke: Safari a besoin que l'URL reste vivante le temps du clic.
        setTimeout(() => URL.revokeObjectURL(url), 1_000);
      } catch {
        toast.error(t('confrere.err.pdfDownload'));
      }
      onOpenChange(false);
    } catch (e: unknown) {
      const msg =
        (e as { response?: { data?: { detail?: string } } })?.response?.data?.detail ??
        t('confrere.err.generateRefused');
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
              {t('confrere.dialog.title')}
            </Dialog.Title>
            <Dialog.Close asChild>
              <Button variant="ghost" size="sm" iconOnly aria-label={t('confrere.dialog.close')}>
                <Close />
              </Button>
            </Dialog.Close>
          </div>
          <Dialog.Description style={{ fontSize: 12, color: 'var(--ink-3)', marginBottom: 14 }}>
            {t('confrere.dialog.description')}
          </Dialog.Description>

          <label style={labelStyle}>
            <span style={labelTitleStyle}>{t('confrere.dialog.contactLabel')}</span>
            <Select
              value={contactId}
              onChange={(e) => pickContact(e.target.value)}
              aria-label={t('confrere.dialog.contactAria')}
              style={inputStyle}
            >
              <option value="">{t('confrere.dialog.contactFree')}</option>
              {contacts.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.fullName}
                  {c.specialty ? ` — ${c.specialty}` : ''}
                  {c.city ? ` (${c.city})` : ''}
                </option>
              ))}
            </Select>
          </label>

          {templates.length > 0 && (
            <label style={labelStyle}>
              <span style={labelTitleStyle}>{t('confrere.dialog.templateLabel')}</span>
              <Select
                value={templateId}
                onChange={(e) => pickTemplate(e.target.value)}
                aria-label={t('confrere.dialog.templateAria')}
                style={inputStyle}
              >
                <option value="">{t('confrere.dialog.templateFree')}</option>
                {templates.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.title}
                  </option>
                ))}
              </Select>
            </label>
          )}

          <label style={labelStyle}>
            <span style={labelTitleStyle}>{t('confrere.dialog.recipient')}</span>
            <input
              type="text"
              value={recipientName}
              onChange={(e) => setRecipientName(e.target.value)}
              placeholder={t('confrere.dialog.recipientPlaceholder')}
              aria-label={t('confrere.dialog.recipientAria')}
              style={inputStyle}
            />
          </label>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
            <label style={labelStyle}>
              <span style={labelTitleStyle}>{t('confrere.dialog.specialty')}</span>
              <input
                type="text"
                value={recipientSpecialty}
                onChange={(e) => setRecipientSpecialty(e.target.value)}
                placeholder={t('confrere.dialog.specialtyPlaceholder')}
                aria-label={t('confrere.dialog.specialtyAria')}
                style={inputStyle}
              />
            </label>
            <label style={labelStyle}>
              <span style={labelTitleStyle}>{t('confrere.dialog.city')}</span>
              <input
                type="text"
                value={recipientCity}
                onChange={(e) => setRecipientCity(e.target.value)}
                placeholder={t('confrere.dialog.cityPlaceholder')}
                aria-label={t('confrere.dialog.cityAria')}
                style={inputStyle}
              />
            </label>
          </div>

          <textarea
            value={body}
            onChange={(e) => setBody(e.target.value)}
            placeholder={t('confrere.dialog.bodyPlaceholder')}
            rows={10}
            aria-label={t('confrere.dialog.bodyAria')}
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

          <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 16 }}>
            <Dialog.Close asChild>
              <Button>{t('common.cancel')}</Button>
            </Dialog.Close>
            <Button variant="primary" onClick={() => { void submit(); }} disabled={busy}>
              {busy ? t('confrere.dialog.generating') : t('confrere.dialog.generate')}
            </Button>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
