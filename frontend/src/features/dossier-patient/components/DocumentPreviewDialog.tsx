/**
 * DocumentPreviewDialog — visualisation in-app d'un document patient.
 * - PDF → <iframe> sur un blob:// (le JWT est en mémoire, pas en cookie,
 *   donc on récupère le binaire via axios et on en fabrique l'URL côté client).
 * - Image → <img>.
 * - Autre → fallback texte + bouton télécharger.
 *
 * Le blob est révoqué à la fermeture / changement de doc.
 */
import { useEffect, useState } from 'react';
import * as Dialog from '@radix-ui/react-dialog';
import { Button } from '@/components/ui/Button';
import { Close, File as FileIcon, Print } from '@/components/icons';
import { api } from '@/lib/api/client';
import {
  DOCUMENT_TYPE_LABEL,
  type PatientDocument,
} from '../hooks/usePatientDocuments';

interface DocumentPreviewDialogProps {
  doc: PatientDocument | null;
  onOpenChange: (open: boolean) => void;
}

function isPdf(mime: string): boolean {
  return mime === 'application/pdf';
}

function isImage(mime: string): boolean {
  return mime.startsWith('image/');
}

export function DocumentPreviewDialog({ doc, onOpenChange }: DocumentPreviewDialogProps) {
  const [url, setUrl] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!doc) {
      setUrl(null);
      setError(null);
      return;
    }
    let cancelled = false;
    let createdUrl: string | null = null;
    setIsLoading(true);
    setError(null);
    // /preview returns a JSON envelope { mimeType, base64, ... } — chosen on
    // purpose so browser download-manager extensions (FDM/IDM) don't grab
    // the binary body before our XHR can read it.
    api
      .get<{ mimeType: string; base64: string; sizeBytes: number; filename: string }>(
        `/documents/${doc.id}/preview`,
      )
      .then((res) => {
        if (cancelled) return;
        const bin = atob(res.data.base64);
        const bytes = new Uint8Array(bin.length);
        for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
        if (doc.mimeType === 'application/pdf') {
          const head = String.fromCharCode(...bytes.slice(0, 5));
          if (head !== '%PDF-') {
            setError(
              `Le serveur n'a pas renvoyé un PDF (${bytes.byteLength} octets, en-tête « ${head} »).`,
            );
            return;
          }
        }
        const blob = new Blob([bytes], { type: res.data.mimeType });
        createdUrl = URL.createObjectURL(blob);
        setUrl(createdUrl);
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        const e = err as { response?: { status?: number } };
        const status = e?.response?.status;
        if (status === 410) {
          setError(
            "Fichier physique introuvable. Cette pièce a probablement été uploadée avant un redémarrage qui a vidé le répertoire de stockage. " +
              'Supprimez la ligne puis réimportez le document.',
          );
        } else {
          setError(
            status
              ? `Impossible de charger le document (HTTP ${status}).`
              : 'Impossible de charger le document.',
          );
        }
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false);
      });
    return () => {
      cancelled = true;
      // Defer revoke: Chrome's embedded PDF viewer fetches the blob URL
      // asynchronously *after* the iframe is wired. Revoking synchronously
      // on cleanup races that fetch and yields "Failed to load PDF document".
      if (createdUrl) {
        const toRevoke = createdUrl;
        setTimeout(() => URL.revokeObjectURL(toRevoke), 60_000);
      }
    };
  }, [doc]);

  function handleDownload() {
    if (!url || !doc) return;
    const a = document.createElement('a');
    a.href = url;
    a.download = doc.originalFilename;
    document.body.appendChild(a);
    a.click();
    a.remove();
  }

  function handlePrint() {
    const frame = document.getElementById('doc-preview-frame') as HTMLIFrameElement | null;
    frame?.contentWindow?.print();
  }

  const open = !!doc;

  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay
          style={{
            position: 'fixed', inset: 0,
            background: 'rgba(20, 18, 12, 0.45)',
            zIndex: 100,
          }}
        />
        <Dialog.Content
          aria-describedby={undefined}
          style={{
            position: 'fixed',
            top: '4vh', left: '50%', transform: 'translateX(-50%)',
            width: 'min(960px, 94vw)', height: '92vh',
            background: 'var(--surface)',
            border: '1px solid var(--border)', borderRadius: 10,
            boxShadow: '0 20px 60px rgba(0,0,0,0.18)',
            display: 'flex', flexDirection: 'column',
            zIndex: 101,
          }}
        >
          <div
            style={{
              padding: '12px 18px',
              borderBottom: '1px solid var(--border)',
              display: 'flex', alignItems: 'center', gap: 10,
            }}
          >
            <div style={{ flex: 1, minWidth: 0 }}>
              <Dialog.Title
                style={{
                  fontSize: 14, fontWeight: 650, margin: 0,
                  whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
                }}
              >
                {doc?.originalFilename ?? 'Document'}
              </Dialog.Title>
              {doc && (
                <div style={{ fontSize: 11.5, color: 'var(--ink-3)', marginTop: 2 }}>
                  {DOCUMENT_TYPE_LABEL[doc.type]}
                  {doc.notes ? ` · ${doc.notes}` : ''}
                </div>
              )}
            </div>
            {doc && isPdf(doc.mimeType) && (
              <Button size="sm" type="button" onClick={handlePrint} disabled={!url}>
                <Print /> Imprimer
              </Button>
            )}
            <Button size="sm" type="button" onClick={handleDownload} disabled={!url}>
              <FileIcon /> Télécharger
            </Button>
            <Dialog.Close asChild>
              <button
                type="button"
                aria-label="Fermer"
                style={{
                  background: 'none', border: 'none', cursor: 'pointer',
                  color: 'var(--ink-3)', padding: 6, borderRadius: 6, lineHeight: 0,
                }}
              >
                <Close />
              </button>
            </Dialog.Close>
          </div>

          <div
            style={{
              flex: 1, minHeight: 0,
              background: 'var(--bg-alt)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              overflow: 'auto',
            }}
          >
            {isLoading && (
              <div style={{ color: 'var(--ink-3)', fontSize: 13 }}>Chargement…</div>
            )}
            {error && !isLoading && (
              <div style={{ color: 'var(--danger)', fontSize: 13, padding: 24 }}>
                {error}
              </div>
            )}
            {!isLoading && !error && url && doc && isPdf(doc.mimeType) && (
              <object
                data={url}
                type="application/pdf"
                style={{ width: '100%', height: '100%', background: '#fff' }}
              >
                <iframe
                  id="doc-preview-frame"
                  title={doc.originalFilename}
                  src={url}
                  style={{ width: '100%', height: '100%', border: 'none', background: '#fff' }}
                />
              </object>
            )}
            {!isLoading && !error && url && doc && isImage(doc.mimeType) && (
              <img
                src={url}
                alt={doc.originalFilename}
                style={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain' }}
              />
            )}
            {!isLoading && !error && url && doc && !isPdf(doc.mimeType) && !isImage(doc.mimeType) && (
              <div style={{ padding: 24, color: 'var(--ink-3)', fontSize: 13, textAlign: 'center' }}>
                Aperçu indisponible pour ce format.
                <br />
                Utilisez « Télécharger » pour ouvrir le fichier.
              </div>
            )}
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
