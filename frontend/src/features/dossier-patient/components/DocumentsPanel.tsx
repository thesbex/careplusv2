/**
 * DocumentsPanel — affiche / téléverse / télécharge les documents
 * historiques d'un patient (QA2-2 : prescriptions anciennes, comptes
 * rendus, résultats d'analyses, imagerie).
 *
 * Deux modes via la prop `filter` :
 *   - undefined → tous les documents avec chips de filtre par type
 *     (utilisé dans l'onglet "Documents" du dossier)
 *   - <DocumentType> → liste pré-filtrée + drop-zone fixée sur ce type
 *     (utilisé dans les onglets Analyses / Imagerie / Prescriptions)
 *
 * La prop `compact` rend une variante allégée (pour l'EditPatientPanel
 * sous l'onglet "Informations médicales") : pas d'en-tête, pas de chips.
 */
import { useRef, useState } from 'react';
import { Button } from '@/components/ui/Button';
import { File, Trash, Plus } from '@/components/icons';
import {
  usePatientDocuments,
  downloadDocument,
  DOCUMENT_TYPE_LABEL,
  type DocumentType,
  type PatientDocument,
} from '../hooks/usePatientDocuments';
import { useAuthStore } from '@/lib/auth/authStore';
import { DocumentPreviewDialog } from './DocumentPreviewDialog';

const ACCEPT = 'application/pdf,image/jpeg,image/png,image/webp,image/heic,image/heif';
const MAX_BYTES = 10 * 1024 * 1024; // 10 Mo — aligné avec spring.servlet.multipart.

const ALL_TYPES: DocumentType[] = [
  'PRESCRIPTION_HISTORIQUE',
  'ANALYSE',
  'IMAGERIE',
  'COMPTE_RENDU',
  'AUTRE',
];

interface DocumentsPanelProps {
  patientId: string;
  filter?: DocumentType;
  compact?: boolean;
}

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} o`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} Ko`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} Mo`;
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('fr-MA', {
    day: '2-digit', month: '2-digit', year: 'numeric',
  });
}

export function DocumentsPanel({ patientId, filter, compact = false }: DocumentsPanelProps) {
  const {
    documents, isLoading, error,
    upload, isUploading, uploadError,
    remove, isRemoving,
  } = usePatientDocuments(patientId);

  const userPerms = useAuthStore((s) => s.user?.permissions);
  // Aligné sur la matrice RBAC v1 — l'upload réutilise PATIENT_CREATE
  // (qui couvre déjà toute mutation sur le dossier patient).
  const canUpload = userPerms == null || userPerms.includes('PATIENT_CREATE');
  const canDelete = userPerms == null || userPerms.includes('PATIENT_CREATE');

  const fileRef = useRef<HTMLInputElement | null>(null);
  const [pendingType, setPendingType] = useState<DocumentType>(filter ?? 'AUTRE');
  const [pendingNotes, setPendingNotes] = useState('');
  const [activeFilter, setActiveFilter] = useState<DocumentType | 'ALL'>(filter ?? 'ALL');
  const [localError, setLocalError] = useState<string | null>(null);
  const [previewDoc, setPreviewDoc] = useState<PatientDocument | null>(null);

  const visible = documents.filter((d) =>
    filter ? d.type === filter : (activeFilter === 'ALL' ? true : d.type === activeFilter),
  );

  async function handlePick(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    e.target.value = ''; // permet de re-sélectionner le même fichier
    if (!f) return;
    if (f.size > MAX_BYTES) {
      setLocalError('Fichier trop volumineux (max 10 Mo).');
      return;
    }
    setLocalError(null);
    try {
      await upload({ file: f, type: pendingType, notes: pendingNotes });
      setPendingNotes('');
    } catch {
      // surfaced via uploadError
    }
  }

  async function handleDelete(d: PatientDocument) {
    if (!confirm(`Supprimer « ${d.originalFilename} » ?`)) return;
    try {
      await remove(d.id);
    } catch {
      // best-effort, no toast
    }
  }

  async function handleDownload(d: PatientDocument) {
    try {
      await downloadDocument(d);
    } catch {
      setLocalError('Téléchargement impossible.');
    }
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      {!compact && (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div>
            <div style={{ fontSize: 14, fontWeight: 650 }}>
              {filter ? DOCUMENT_TYPE_LABEL[filter] + 's' : 'Documents du dossier'}
            </div>
            <div style={{ fontSize: 12, color: 'var(--ink-3)', marginTop: 2 }}>
              {filter
                ? `Téléversez les ${DOCUMENT_TYPE_LABEL[filter].toLowerCase()}s antérieurs.`
                : "Anciennes prescriptions, comptes rendus, analyses, imagerie."}
            </div>
          </div>
        </div>
      )}

      {/* Upload zone */}
      {canUpload && (
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            gap: 8,
            padding: 12,
            border: '1px dashed var(--border)',
            borderRadius: 8,
            background: 'var(--bg-alt)',
          }}
        >
          <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
            {!filter && (
              <select
                value={pendingType}
                onChange={(e) => setPendingType(e.target.value as DocumentType)}
                aria-label="Type de document"
                style={{
                  height: 32, fontSize: 12.5, fontFamily: 'inherit',
                  border: '1px solid var(--border)', borderRadius: 6,
                  padding: '0 8px', background: 'var(--surface)',
                }}
              >
                {ALL_TYPES.map((t) => (
                  <option key={t} value={t}>{DOCUMENT_TYPE_LABEL[t]}</option>
                ))}
              </select>
            )}
            <input
              type="text"
              value={pendingNotes}
              onChange={(e) => setPendingNotes(e.target.value)}
              placeholder="Note (optionnelle) — ex. Reçu en consultation"
              style={{
                flex: 1, minWidth: 160, height: 32, fontSize: 12.5,
                border: '1px solid var(--border)', borderRadius: 6,
                padding: '0 8px', fontFamily: 'inherit', background: 'var(--surface)',
              }}
            />
            <input
              ref={fileRef}
              type="file"
              accept={ACCEPT}
              onChange={(e) => { void handlePick(e); }}
              hidden
            />
            <Button
              type="button"
              variant="primary"
              size="sm"
              disabled={isUploading}
              onClick={() => fileRef.current?.click()}
            >
              <Plus style={{ width: 12, height: 12 }} />
              {isUploading ? 'Envoi…' : 'Téléverser'}
            </Button>
          </div>
          <div style={{ fontSize: 11, color: 'var(--ink-3)' }}>
            PDF, JPEG, PNG, WebP, HEIC — max 10 Mo.
          </div>
          {(uploadError ?? localError) && (
            <div style={{ fontSize: 12, color: 'var(--danger)' }}>{uploadError ?? localError}</div>
          )}
        </div>
      )}

      {/* Filter chips (only when not pre-filtered) */}
      {!filter && !compact && documents.length > 0 && (
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          {(['ALL', ...ALL_TYPES] as const).map((k) => {
            const isActive = activeFilter === k;
            const count = k === 'ALL'
              ? documents.length
              : documents.filter((d) => d.type === k).length;
            const label = k === 'ALL' ? 'Tous' : DOCUMENT_TYPE_LABEL[k];
            return (
              <button
                key={k}
                type="button"
                onClick={() => setActiveFilter(k)}
                style={{
                  fontSize: 11.5, fontWeight: isActive ? 650 : 500,
                  padding: '4px 10px', borderRadius: 12, cursor: 'pointer',
                  fontFamily: 'inherit',
                  border: `1px solid ${isActive ? 'var(--primary)' : 'var(--border)'}`,
                  background: isActive ? 'var(--primary-soft)' : 'transparent',
                  color: isActive ? 'var(--primary)' : 'var(--ink-3)',
                }}
              >
                {label} <span style={{ opacity: 0.7 }}>· {count}</span>
              </button>
            );
          })}
        </div>
      )}

      {/* List */}
      {isLoading && (
        <div style={{ fontSize: 12, color: 'var(--ink-3)' }}>Chargement…</div>
      )}
      {!isLoading && error && (
        <div style={{ fontSize: 12, color: 'var(--danger)' }}>{error}</div>
      )}
      {!isLoading && !error && visible.length === 0 && (
        <div style={{ fontSize: 12, color: 'var(--ink-3)', fontStyle: 'italic' }}>
          {filter
            ? `Aucun document de type « ${DOCUMENT_TYPE_LABEL[filter]} ».`
            : 'Aucun document pour ce patient.'}
        </div>
      )}
      {!isLoading && !error && visible.length > 0 && (
        <ul style={{ display: 'flex', flexDirection: 'column', gap: 6, padding: 0, margin: 0, listStyle: 'none' }}>
          {visible.map((d) => (
            <li
              key={d.id}
              style={{
                display: 'flex', alignItems: 'center', gap: 10,
                padding: '8px 10px',
                border: '1px solid var(--border)', borderRadius: 8,
                background: 'var(--surface)',
              }}
            >
              <File style={{ width: 16, height: 16, color: 'var(--ink-3)', flexShrink: 0 }} />
              <button
                type="button"
                onClick={() => setPreviewDoc(d)}
                title="Visualiser"
                style={{
                  flex: 1, textAlign: 'left', background: 'none', border: 'none',
                  cursor: 'pointer', fontFamily: 'inherit', padding: 0,
                  display: 'flex', flexDirection: 'column', gap: 2,
                  color: 'var(--ink)',
                }}
              >
                <span style={{ fontSize: 12.5, fontWeight: 600 }}>{d.originalFilename}</span>
                <span style={{ fontSize: 11, color: 'var(--ink-3)' }}>
                  {DOCUMENT_TYPE_LABEL[d.type]} · {formatDate(d.uploadedAt)} · {formatSize(d.sizeBytes)}
                  {d.notes ? ` · ${d.notes}` : ''}
                </span>
              </button>
              <button
                type="button"
                onClick={() => { void handleDownload(d); }}
                title="Télécharger"
                aria-label={`Télécharger ${d.originalFilename}`}
                style={{
                  background: 'none', border: 'none', cursor: 'pointer',
                  color: 'var(--ink-3)', fontSize: 11, padding: '4px 8px',
                  borderRadius: 4, fontFamily: 'inherit',
                }}
              >
                Télécharger
              </button>
              {canDelete && (
                <button
                  type="button"
                  onClick={() => { void handleDelete(d); }}
                  disabled={isRemoving}
                  aria-label={`Supprimer ${d.originalFilename}`}
                  style={{
                    background: 'none', border: 'none', cursor: 'pointer',
                    color: 'var(--ink-3)', padding: 4, borderRadius: 4, lineHeight: 0,
                  }}
                >
                  <Trash style={{ width: 14, height: 14 }} />
                </button>
              )}
            </li>
          ))}
        </ul>
      )}

      <DocumentPreviewDialog
        doc={previewDoc}
        onOpenChange={(open) => { if (!open) setPreviewDoc(null); }}
      />
    </div>
  );
}
