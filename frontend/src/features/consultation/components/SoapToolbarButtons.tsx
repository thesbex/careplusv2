/**
 * Boutons « Modèles » (insère un modèle SOAP) + « CIM-10 » (insère un code dans
 * l'Analyse) de la barre d'outils de consultation. Avant : boutons désactivés.
 */
import { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/Button';
import { Doc, Clipboard } from '@/components/icons';
import { useSoapTemplates, type SoapTemplate } from '../hooks/useSoapTemplates';
import { CIM10_CODES } from '../cim10';

const POP: React.CSSProperties = {
  position: 'fixed',
  zIndex: 1000,
  background: 'var(--surface)',
  border: '1px solid var(--border)',
  borderRadius: 8,
  boxShadow: '0 6px 20px rgba(0,0,0,0.12)',
  padding: 4,
  maxHeight: 320,
  overflow: 'auto',
};

function usePopover() {
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState<{ top: number; left: number; width: number } | null>(null);
  const btnRef = useRef<HTMLButtonElement | null>(null);
  const popRef = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    if (!open) return;
    const measure = () => {
      const r = btnRef.current?.getBoundingClientRect();
      if (r) setPos({ top: r.bottom + 4, left: r.left, width: r.width });
    };
    measure();
    const onDoc = (e: MouseEvent) => {
      const t = e.target as Node;
      if (btnRef.current?.contains(t) || popRef.current?.contains(t)) return;
      setOpen(false);
    };
    window.addEventListener('scroll', measure, true);
    window.addEventListener('resize', measure);
    document.addEventListener('mousedown', onDoc);
    return () => {
      window.removeEventListener('scroll', measure, true);
      window.removeEventListener('resize', measure);
      document.removeEventListener('mousedown', onDoc);
    };
  }, [open]);
  return { open, setOpen, pos, btnRef, popRef };
}

const optStyle: React.CSSProperties = {
  display: 'block',
  width: '100%',
  textAlign: 'left',
  padding: '7px 9px',
  border: 'none',
  borderRadius: 5,
  background: 'transparent',
  color: 'var(--ink)',
  fontSize: 12.5,
  fontFamily: 'inherit',
  cursor: 'pointer',
};

export function SoapToolbarButtons({
  disabled,
  onApplyTemplate,
  onInsertCim,
}: {
  disabled: boolean;
  onApplyTemplate: (t: SoapTemplate) => void;
  onInsertCim: (text: string) => void;
}) {
  const navigate = useNavigate();
  const { templates, isLoading } = useSoapTemplates();
  const tpl = usePopover();
  const cim = usePopover();
  const [q, setQ] = useState('');

  const filtered = useMemo(() => {
    const n = q.trim().toLowerCase();
    if (!n) return CIM10_CODES.slice(0, 50);
    return CIM10_CODES.filter(
      (c) => c.code.toLowerCase().includes(n) || c.label.toLowerCase().includes(n),
    ).slice(0, 50);
  }, [q]);

  return (
    <>
      <Button ref={tpl.btnRef} size="sm" type="button" disabled={disabled} onClick={() => tpl.setOpen((o) => !o)}>
        <Doc /> Modèles
      </Button>
      {tpl.open && tpl.pos
        ? createPortal(
            <div ref={tpl.popRef} role="listbox" style={{ ...POP, top: tpl.pos.top, left: tpl.pos.left, minWidth: 240 }}>
              {isLoading && <div style={{ padding: 8, fontSize: 12, color: 'var(--ink-3)' }}>Chargement…</div>}
              {!isLoading && templates.length === 0 && (
                <div style={{ padding: 10, fontSize: 12, color: 'var(--ink-3)', lineHeight: 1.5 }}>
                  Aucun modèle de consultation.
                  <button
                    type="button"
                    onClick={() => { tpl.setOpen(false); navigate('/profil'); }}
                    style={{ display: 'block', marginTop: 6, background: 'none', border: 'none', padding: 0,
                      color: 'var(--primary)', cursor: 'pointer', fontFamily: 'inherit', fontSize: 12 }}
                  >
                    Créer un modèle dans Mon profil →
                  </button>
                </div>
              )}
              {templates.map((t) => (
                <button key={t.id} type="button" style={optStyle}
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => { onApplyTemplate(t); tpl.setOpen(false); }}>
                  <span style={{ fontWeight: 600 }}>{t.name}</span>
                </button>
              ))}
            </div>,
            document.body,
          )
        : null}

      <Button ref={cim.btnRef} size="sm" type="button" disabled={disabled} onClick={() => { setQ(''); cim.setOpen((o) => !o); }}>
        <Clipboard /> CIM-10
      </Button>
      {cim.open && cim.pos
        ? createPortal(
            <div ref={cim.popRef} role="listbox" style={{ ...POP, top: cim.pos.top, left: cim.pos.left, minWidth: 320 }}>
              <input
                autoFocus
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="Rechercher un code ou un libellé…"
                style={{ width: '100%', height: 30, padding: '0 8px', marginBottom: 4,
                  border: '1px solid var(--border)', borderRadius: 5, fontFamily: 'inherit', fontSize: 12.5,
                  background: 'var(--surface)' }}
              />
              {filtered.length === 0 && (
                <div style={{ padding: 8, fontSize: 12, color: 'var(--ink-3)' }}>Aucun code correspondant.</div>
              )}
              {filtered.map((c) => (
                <button key={c.code} type="button" style={optStyle}
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => { onInsertCim(`${c.code} — ${c.label}`); cim.setOpen(false); }}>
                  <span className="mono" style={{ fontWeight: 600, color: 'var(--primary)' }}>{c.code}</span>
                  <span style={{ color: 'var(--ink-2)' }}> — {c.label}</span>
                </button>
              ))}
            </div>,
            document.body,
          )
        : null}
    </>
  );
}
