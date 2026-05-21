/**
 * DocumentPdfViewer — visualiseur de PDF unifié pour TOUS les types de
 * prescription (DRUG / LAB / IMAGING / CERT / SICK_LEAVE).
 *
 * Pourquoi un composant dédié :
 * Le backend stocke différents types dans `clinical_prescription.type`. Le
 * frontend en revanche n'avait qu'une seule page hardcodée "Aperçu —
 * Ordonnance" qui ignorait le type — ce qui faisait apparaître un certificat
 * comme "ORD-..." en titre. Ce composant lit le type via `usePrescription`
 * et adapte titre, préfixe, libellé d'archive, et nom du fichier téléchargé.
 *
 * Pourquoi un blob :
 * L'endpoint `/api/prescriptions/{id}/pdf` est protégé par `Authorization:
 * Bearer …` (ADR-019 — token in-memory, pas de cookie). Une `<iframe src=…>`
 * directe ne peut pas attacher l'header bearer → 401 silencieux et
 * "Impossible de charger le PDF". On télécharge donc en arraybuffer via axios
 * (intercepteur attache le bearer), on enveloppe en Blob, on génère un
 * `URL.createObjectURL`, et on injecte cette URL dans l'iframe — qui se
 * contente d'afficher le contenu local sans appel HTTP.
 *
 * Boutons Télécharger / Imprimer travaillent sur la même blob URL :
 *   - Télécharger : <a href={blobUrl} download="…"> programmatique
 *   - Imprimer : iframe.contentWindow.print()
 *
 * Mémoire : `URL.revokeObjectURL` au unmount (ou si la prescription change).
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import { isAxiosError } from 'axios';
import { api } from '@/lib/api/client';
import type { PrescriptionApi } from '../types';

export interface DocumentTypeMeta {
  /** Préfixe court affiché en sous-titre (ex. ORD-XXXX, CERT-XXXX). */
  prefix: string;
  /** Libellé long pour le titre Aperçu (ex. "Ordonnance", "Certificat"). */
  label: string;
  /** Variante téléchargée (ex. "ordonnance", "certificat"). Sert de slug fichier. */
  fileSlug: string;
}

/**
 * Mapping type prescription → libellés UI. Étend ce switch quand un nouveau
 * type est ajouté côté backend (`PrescriptionType` enum).
 */
export function metaForPrescription(p: PrescriptionApi | null | undefined): DocumentTypeMeta {
  switch (p?.type) {
    case 'DRUG':
      return { prefix: 'ORD', label: 'Ordonnance', fileSlug: 'ordonnance' };
    case 'LAB':
      return { prefix: 'BON', label: "Bon d'analyses", fileSlug: 'bon-analyses' };
    case 'IMAGING':
      return { prefix: 'BON', label: "Bon d'imagerie", fileSlug: 'bon-imagerie' };
    case 'CERT':
      return { prefix: 'CERT', label: 'Certificat', fileSlug: 'certificat' };
    case 'SICK_LEAVE':
      return { prefix: 'AT', label: 'Arrêt de travail', fileSlug: 'arret-travail' };
    default:
      // Fallback : on n'invente pas un label, on reste neutre.
      return { prefix: 'DOC', label: 'Document', fileSlug: 'document' };
  }
}

interface UsePrescriptionPdfBlobResult {
  url: string | null;
  isLoading: boolean;
  error: string | null;
  /** Re-fire the GET. Useful for the "Réessayer" button on a transient failure. */
  retry: () => void;
}

/**
 * Hook bas-niveau : télécharge le PDF en arraybuffer via axios, retourne une
 * `blob:` URL stable jusqu'à unmount.
 *
 * Note Strict Mode : en dev, React invoque le useEffect deux fois ; chaque
 * passe a son propre `objectUrl` local — le cleanup de la première passe
 * révoque uniquement la première URL, la seconde URL reste vivante dans le
 * state. Pas de fuite, pas de "PDF blanc" en dev.
 *
 * Timeout & error messaging (2026-05-17) : the global axios timeout is 20 s
 * (good default for typical API calls), but PDF generation on a cold Render
 * free-tier dyno can easily take 30-40 s the first time after sleep — the
 * old version then surfaced a generic "Impossible de charger le PDF" with
 * no clue why. We now bump the timeout to 60 s for this single endpoint,
 * log the actual error to the console, and turn the most common failures
 * into actionable messages.
 */
export function useDocumentPdfBlob(id?: string): UsePrescriptionPdfBlobResult {
  const [url, setUrl] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  // Bump with the retry button to re-trigger the effect.
  const [attempt, setAttempt] = useState(0);

  const retry = useCallback(() => setAttempt((a) => a + 1), []);

  useEffect(() => {
    if (!id) {
      setUrl(null);
      return;
    }
    let cancelled = false;
    let objectUrl: string | null = null;

    setIsLoading(true);
    setError(null);

    api
      .get<ArrayBuffer>(`/prescriptions/${id}/pdf`, {
        responseType: 'arraybuffer',
        timeout: 60_000,
      })
      .then((r) => {
        if (cancelled) return;
        const blob = new Blob([r.data], { type: 'application/pdf' });
        objectUrl = URL.createObjectURL(blob);
        setUrl(objectUrl);
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        // eslint-disable-next-line no-console
        console.error('[useDocumentPdfBlob] PDF fetch failed', err);
        setError(messageForPdfError(err));
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false);
      });

    return () => {
      cancelled = true;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [id, attempt]);

  return { url, isLoading, error, retry };
}

/**
 * Map a fetch error to a French sentence the praticien can act on. We
 * intentionally keep the technical status visible at the end of the
 * message so support can correlate with backend logs.
 */
function messageForPdfError(err: unknown): string {
  if (isAxiosError(err)) {
    if (err.code === 'ECONNABORTED' || err.message.toLowerCase().includes('timeout')) {
      return "Le serveur met trop de temps à générer le PDF. Réessayez dans quelques secondes.";
    }
    const status = err.response?.status;
    if (status === 401) return 'Session expirée. Reconnectez-vous puis rouvrez le document.';
    if (status === 403) return "Vous n'avez pas les droits pour consulter ce document.";
    if (status === 404) return 'Document introuvable.';
    if (status && status >= 500) {
      return `Erreur serveur lors de la génération du PDF (HTTP ${status}). Réessayez.`;
    }
    if (status) return `Impossible de charger le PDF (HTTP ${status}).`;
    return 'Connexion interrompue. Vérifiez votre réseau puis réessayez.';
  }
  return 'Impossible de charger le PDF.';
}

interface DocumentPdfViewerProps {
  documentId: string | undefined;
  meta: DocumentTypeMeta;
  /** Optionnel : id court (8 premiers caractères de l'UUID) pour le filename. */
  shortId?: string;
  /** Hauteur CSS du viewer (par défaut 100%). */
  height?: string;
  /** Classe CSS supplémentaire pour l'iframe (par défaut "pr-pdf-viewer"). */
  iframeClassName?: string;
}

export interface DocumentPdfViewerHandle {
  download: () => void;
  print: () => void;
  blobUrl: string | null;
  isLoading: boolean;
  error: string | null;
}

/**
 * Composant viewer + actions (download / print). Utilisé par les pages
 * desktop et mobile via la fonction utilitaire `useDocumentPdfController`
 * ci-dessous (qui expose les actions sans imposer le rendu de l'iframe).
 */
export function DocumentPdfViewer({
  documentId,
  meta,
  shortId,
  height = '100%',
  iframeClassName = 'pr-pdf-viewer',
}: DocumentPdfViewerProps) {
  const { url, isLoading, error, retry } = useDocumentPdfBlob(documentId);
  const iframeId = `doc-pdf-frame-${documentId ?? 'pending'}`;
  const filename = `${meta.fileSlug}-${shortId ?? documentId ?? 'document'}.pdf`;

  return (
    <div style={{ height, background: 'var(--bg-alt)' }}>
      {isLoading && (
        <div style={{ padding: 24, color: 'var(--ink-3)', fontSize: 13 }}>
          Chargement du PDF…
        </div>
      )}
      {error && (
        <div
          style={{
            padding: 24,
            display: 'flex',
            flexDirection: 'column',
            gap: 10,
            alignItems: 'flex-start',
          }}
        >
          <div style={{ color: 'var(--danger)', fontSize: 13 }}>{error}</div>
          <button
            type="button"
            onClick={retry}
            style={{
              fontFamily: 'inherit',
              fontSize: 12.5,
              fontWeight: 600,
              padding: '6px 14px',
              border: '1px solid var(--border)',
              borderRadius: 6,
              background: 'var(--surface)',
              color: 'var(--ink)',
              cursor: 'pointer',
            }}
          >
            Réessayer
          </button>
        </div>
      )}
      {url && (
        <iframe
          id={iframeId}
          className={iframeClassName}
          title={`Aperçu ${meta.label}`}
          src={url}
          data-pdf-filename={filename}
        />
      )}
    </div>
  );
}

/**
 * Hook de contrôle : retourne {url, isLoading, error, download, print, iframeId}
 * pour que la page puisse câbler ses propres boutons "Télécharger" /
 * "Imprimer" tout en partageant la même blob URL et le même <iframe>.
 *
 * Le iframeId est exposé pour que la page rendre l'iframe avec ce même id ;
 * `print()` cherche `document.getElementById(iframeId)` pour appeler son
 * `contentWindow.print()`.
 */
export function useDocumentPdfController(documentId: string | undefined) {
  const blob = useDocumentPdfBlob(documentId);
  const iframeIdRef = useRef(`doc-pdf-frame-${documentId ?? 'pending'}`);
  // Garde l'iframeId stable même si documentId change (ex. drawer rouvert) :
  // on ne change l'id que si le documentId change, ce qui est cohérent avec
  // la durée de vie de l'iframe.
  iframeIdRef.current = `doc-pdf-frame-${documentId ?? 'pending'}`;

  function download(filename: string) {
    if (!blob.url) return;
    const a = document.createElement('a');
    a.href = blob.url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  }

  function print() {
    if (!blob.url) return;
    // L'ancienne approche (iframe[display:none].contentWindow.print()) ne
    // marche pas systématiquement sur Chrome récent — l'iframe caché charge
    // le PDF mais le print() est silencieusement bloqué quand le PDF viewer
    // embarqué Chromium s'attache à l'iframe. Retour terrain : "Impression
    // des documents générés ne marche pas".
    //
    // Fix robuste : on crée un NOUVEL iframe dynamique off-screen (pas
    // display:none mais position:fixed avec dimensions 0) — Chrome traite ça
    // comme un iframe visible donc le print() porte. Si onload ne se
    // déclenche pas en 3 s (PDF cassé ou ad-blocker bizarre), fallback vers
    // window.open(blob) où le user peut utiliser Ctrl+P.
    const iframe = document.createElement('iframe');
    iframe.style.position = 'fixed';
    iframe.style.right = '0';
    iframe.style.bottom = '0';
    iframe.style.width = '0';
    iframe.style.height = '0';
    iframe.style.border = '0';
    iframe.setAttribute('aria-hidden', 'true');
    let printed = false;
    iframe.onload = () => {
      setTimeout(() => {
        try {
          iframe.contentWindow?.focus();
          iframe.contentWindow?.print();
          printed = true;
        } catch {
          // contentWindow.print() peut throw si l'iframe est sandboxed —
          // on tombera sur le fallback ci-dessous.
        }
        // Nettoie l'iframe 60 s après le print dialog (laisse le temps au
        // browser de l'utiliser pendant que la dialog est ouverte).
        setTimeout(() => iframe.remove(), 60_000);
      }, 200);
    };
    iframe.src = blob.url;
    document.body.appendChild(iframe);
    // Fallback : si onload ne s'est pas déclenché en 3 s, ouvrir le PDF
    // dans un nouvel onglet (Ctrl+P pour imprimer).
    setTimeout(() => {
      if (!printed) {
        window.open(blob.url ?? '', '_blank', 'noopener,noreferrer');
      }
    }, 3000);
  }

  return {
    ...blob,
    iframeId: iframeIdRef.current,
    download,
    print,
  };
}
