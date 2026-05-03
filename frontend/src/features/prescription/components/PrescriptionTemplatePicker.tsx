/**
 * Picker pour charger un modèle de prescription pendant la consultation
 * (QA6-2 + QA6-3). Bouton trigger placé dans le header du PrescriptionDrawer.
 * Click → popover (desktop) ou Dialog plein écran (mobile <768px).
 */
import { useEffect, useMemo, useRef, useState } from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/Button';
import { Doc, Search } from '@/components/icons';
import {
  usePrescriptionTemplates,
  type PrescriptionTemplate,
  type TemplateType,
} from '@/features/parametres/hooks/usePrescriptionTemplates';

interface PrescriptionTemplatePickerProps {
  type: TemplateType;
  onLoad: (template: PrescriptionTemplate) => void;
  /** Disabled si la consultation est signée (drawer read-only). */
  disabled?: boolean;
}

const MOBILE_BREAKPOINT = 768;

export function PrescriptionTemplatePicker({ type, onLoad, disabled }: PrescriptionTemplatePickerProps) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [isMobile, setIsMobile] = useState(false);
  const popoverRef = useRef<HTMLDivElement | null>(null);
  const triggerRef = useRef<HTMLButtonElement | null>(null);

  const { templates, isLoading, error } = usePrescriptionTemplates(type);

  const filtered = useMemo(() => {
    if (!query.trim()) return templates;
    const q = query.toLowerCase();
    return templates.filter((t) => t.name.toLowerCase().includes(q));
  }, [templates, query]);

  // Detect mobile via window.innerWidth — pas de matchMedia hook ici, simple suffit.
  useEffect(() => {
    function check() {
      setIsMobile(window.innerWidth < MOBILE_BREAKPOINT);
    }
    check();
    window.addEventListener('resize', check);
    return () => window.removeEventListener('resize', check);
  }, []);

  // Fermeture au click outside (desktop popover seulement).
  useEffect(() => {
    if (!open || isMobile) return;
    function onMouseDown(e: MouseEvent) {
      if (popoverRef.current?.contains(e.target as Node)) return;
      if (triggerRef.current?.contains(e.target as Node)) return;
      setOpen(false);
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') setOpen(false);
    }
    document.addEventListener('mousedown', onMouseDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onMouseDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [open, isMobile]);

  // Reset query à l'ouverture.
  useEffect(() => {
    if (open) setQuery('');
  }, [open]);

  function handlePick(t: PrescriptionTemplate) {
    onLoad(t);
    setOpen(false);
    toast.success(
      `Modèle « ${t.name} » ajouté (${t.lineCount} ligne${t.lineCount > 1 ? 's' : ''}).`,
    );
  }

  if (error) {
    return null; // Erreur silencieuse — pas la peine de bloquer le drawer.
  }

  return (
    <>
      <Button
        ref={triggerRef}
        type="button"
        variant="ghost"
        size="sm"
        onClick={() => setOpen((v) => !v)}
        disabled={disabled === true || isLoading}
        aria-label="Charger un modèle"
      >
        <Doc /> Charger un modèle
      </Button>

      {open && !isMobile && (
        <div
          ref={popoverRef}
          role="dialog"
          aria-label="Choisir un modèle"
          style={{
            position: 'absolute',
            top: 64,
            right: 16,
            zIndex: 200,
            width: 360,
            maxHeight: 480,
            display: 'flex',
            flexDirection: 'column',
            background: 'var(--surface)',
            border: '1px solid var(--border)',
            borderRadius: 8,
            boxShadow: '0 12px 32px rgba(0,0,0,0.18)',
          }}
        >
          <PickerBody
            templates={filtered}
            isLoading={isLoading}
            query={query}
            setQuery={setQuery}
            onPick={handlePick}
            type={type}
          />
        </div>
      )}

      {open && isMobile && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Choisir un modèle"
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 200,
            background: 'rgba(20,18,12,0.5)',
            display: 'flex',
            alignItems: 'flex-end',
          }}
          onClick={(e) => {
            if (e.target === e.currentTarget) setOpen(false);
          }}
        >
          <div
            style={{
              width: '100%',
              maxHeight: '85vh',
              background: 'var(--surface)',
              borderTopLeftRadius: 12,
              borderTopRightRadius: 12,
              display: 'flex',
              flexDirection: 'column',
            }}
          >
            <div
              style={{
                padding: '12px 16px',
                borderBottom: '1px solid var(--border)',
                display: 'flex',
                alignItems: 'center',
              }}
            >
              <strong style={{ flex: 1, fontSize: 14 }}>Charger un modèle</strong>
              <button
                type="button"
                onClick={() => setOpen(false)}
                aria-label="Fermer"
                style={{
                  background: 'none',
                  border: 'none',
                  cursor: 'pointer',
                  fontSize: 22,
                  color: 'var(--ink-3)',
                }}
              >
                ×
              </button>
            </div>
            <PickerBody
              templates={filtered}
              isLoading={isLoading}
              query={query}
              setQuery={setQuery}
              onPick={handlePick}
              type={type}
            />
          </div>
        </div>
      )}
    </>
  );
}

function PickerBody({
  templates, isLoading, query, setQuery, onPick, type,
}: {
  templates: PrescriptionTemplate[];
  isLoading: boolean;
  query: string;
  setQuery: (v: string) => void;
  onPick: (t: PrescriptionTemplate) => void;
  type: TemplateType;
}) {
  return (
    <>
      <div style={{ position: 'relative', padding: 8, borderBottom: '1px solid var(--border)' }}>
        <span
          style={{
            position: 'absolute',
            left: 18,
            top: '50%',
            transform: 'translateY(-50%)',
            color: 'var(--ink-3)',
            display: 'flex',
          }}
          aria-hidden="true"
        >
          <Search />
        </span>
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Rechercher un modèle…"
          autoFocus
          style={{
            width: '100%',
            height: 34,
            padding: '0 10px 0 32px',
            border: '1px solid var(--border)',
            borderRadius: 6,
            fontSize: 13,
            fontFamily: 'inherit',
            background: 'var(--surface)',
          }}
          aria-label="Rechercher dans mes modèles"
        />
      </div>
      <div style={{ flex: 1, overflowY: 'auto', minHeight: 0 }}>
        {isLoading && (
          <div style={{ padding: 16, fontSize: 12, color: 'var(--ink-3)' }}>Chargement…</div>
        )}
        {!isLoading && templates.length === 0 && (
          <div style={{ padding: 16, fontSize: 12, color: 'var(--ink-3)' }}>
            {query
              ? 'Aucun modèle ne correspond.'
              : (
                <>
                  Aucun modèle {type === 'DRUG' ? 'médicament' : type === 'LAB' ? 'analyse' : "d'imagerie"} créé.
                  <br />
                  <a href="/parametres" style={{ color: 'var(--primary)' }}>
                    Créer depuis Paramétrage → Modèles d&apos;ordonnance
                  </a>
                </>
              )}
          </div>
        )}
        {templates.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => onPick(t)}
            style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'flex-start',
              width: '100%',
              padding: '10px 14px',
              border: 'none',
              borderBottom: '1px solid var(--border)',
              background: 'var(--surface)',
              cursor: 'pointer',
              fontFamily: 'inherit',
              textAlign: 'left',
            }}
          >
            <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--ink-1)' }}>{t.name}</span>
            <span style={{ fontSize: 11.5, color: 'var(--ink-3)' }}>
              {t.lineCount} ligne{t.lineCount > 1 ? 's' : ''}
            </span>
          </button>
        ))}
      </div>
    </>
  );
}
