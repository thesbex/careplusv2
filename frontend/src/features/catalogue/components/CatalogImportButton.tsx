/**
 * CatalogImportButton — bouton « Importer CSV » pour les pages catalogue
 * (médicaments / analyses / imagerie). V018 + rapport Y. Boutaleb 2026-05-01.
 *
 * Format attendu (rappelé dans la modale) :
 *   - UTF-8, séparateur virgule, en-tête sur la 1re ligne.
 *   - Colonnes obligatoires variables selon `kind` :
 *       drug    → commercial_name, dci, form, dosage   (atc_code, tags, active optionnels)
 *       lab     → code, name                            (category, active optionnels)
 *       imaging → code, name                            (modality, active optionnels)
 *   - Upsert : pour LAB/RADIO la clé est `code` ; pour DRUG c'est
 *     (commercial_name + dci + form + dosage).
 */
import { useRef, useState } from 'react';
import { toast } from 'sonner';
import { api } from '@/lib/api/client';
import { Button } from '@/components/ui/Button';
import { Upload } from '@/components/icons';

type ImportKind = 'drug' | 'lab' | 'imaging';

interface ImportResult {
  added: number;
  updated: number;
  skipped: number;
  errors: string[];
}

const ENDPOINT: Record<ImportKind, string> = {
  drug: '/catalog/medications/import',
  lab: '/catalog/lab-tests/import',
  imaging: '/catalog/imaging-exams/import',
};

const HEADERS_HINT: Record<ImportKind, string> = {
  drug: 'commercial_name, dci, form, dosage [, atc_code, tags, active]',
  lab: 'code, name [, category, active]',
  imaging: 'code, name [, modality, active]',
};

interface Props {
  kind: ImportKind;
  /** Called with the result so the parent can refresh its list. */
  onImported?: (r: ImportResult) => void;
}

export function CatalogImportButton({ kind, onImported }: Props) {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [busy, setBusy] = useState(false);

  async function handleFile(file: File) {
    setBusy(true);
    try {
      const fd = new FormData();
      fd.append('file', file);
      const res = await api.post<ImportResult>(ENDPOINT[kind], fd, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      const { added, updated, skipped, errors } = res.data;
      if (errors.length === 0 && skipped === 0) {
        toast.success(`Import OK — ${added} ajouté${added > 1 ? 's' : ''}, ${updated} mis à jour.`);
      } else {
        toast.warning(
          `Import partiel — ${added} ajouté(s), ${updated} mis à jour, ${skipped} ignoré(s).`,
          { description: errors.slice(0, 3).join(' · ') || undefined },
        );
      }
      onImported?.(res.data);
    } catch (err) {
      const status = err && typeof err === 'object' && 'response' in err
        ? (err as { response?: { status?: number; data?: { detail?: string } } }).response
        : undefined;
      if (status?.status === 403) {
        toast.error('Vous n\'avez pas le droit d\'importer le catalogue.');
      } else if (status?.status === 400) {
        toast.error('Fichier rejeté.', { description: status.data?.detail });
      } else {
        toast.error('Échec de l\'import.');
      }
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <input
        ref={inputRef}
        type="file"
        accept=".csv,text/csv"
        style={{ display: 'none' }}
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) void handleFile(f);
          // Reset so picking the same file twice still triggers onChange.
          e.target.value = '';
        }}
        aria-label={`Importer un fichier CSV (${kind})`}
      />
      <Button
        type="button"
        variant="ghost"
        disabled={busy}
        title={`CSV UTF-8 — colonnes : ${HEADERS_HINT[kind]}`}
        onClick={() => inputRef.current?.click()}
      >
        <Upload /> {busy ? 'Import…' : 'Importer CSV'}
      </Button>
    </>
  );
}
