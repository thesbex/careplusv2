/**
 * Mobile SOAP accordion — uses native <details>/<summary> elements.
 * @radix-ui/react-accordion is NOT in package.json, so we use the HTML-native
 * approach which is accessible (keyboard/screen reader) out of the box.
 * Ported verbatim from the SOAP accordion block in MConsultation
 * (design/prototype/mobile/screens.jsx).
 *
 * All four sections render as open by default (s.open === true in the prototype).
 */
import { useState } from 'react';
import { ChevronDown } from '@/components/icons';

interface SoapAccordionSection {
  l: string;
  t: string;
  v: string;
}

interface SoapAccordionProps {
  sections: readonly SoapAccordionSection[];
}

export function SoapAccordion({ sections }: SoapAccordionProps) {
  // All sections open by default per prototype
  const [openSections, setOpenSections] = useState<Set<string>>(
    () => new Set(sections.map((s) => s.l)),
  );

  function toggle(l: string) {
    setOpenSections((prev) => {
      const next = new Set(prev);
      if (next.has(l)) {
        next.delete(l);
      } else {
        next.add(l);
      }
      return next;
    });
  }

  return (
    <>
      {sections.map((s) => {
        const isOpen = openSections.has(s.l);
        return (
          <div className="m-card" key={s.l} style={{ marginBottom: 10 }}>
            <button
              type="button"
              aria-expanded={isOpen}
              aria-controls={`soap-panel-${s.l}`}
              id={`soap-header-${s.l}`}
              onClick={() => toggle(s.l)}
              style={{
                padding: '12px 14px',
                display: 'flex',
                alignItems: 'center',
                gap: 10,
                borderTop: 0,
                borderLeft: 0,
                borderRight: 0,
                borderBottom: isOpen ? '1px solid var(--border-soft)' : '0',
                width: '100%',
                background: 'transparent',
                cursor: 'pointer',
                fontFamily: 'inherit',
                textAlign: 'left',
              }}
            >
              <span
                style={{
                  width: 26,
                  height: 26,
                  background: 'var(--primary)',
                  color: 'white',
                  borderRadius: 5,
                  display: 'grid',
                  placeItems: 'center',
                  fontSize: 12,
                  fontWeight: 700,
                  flexShrink: 0,
                }}
                aria-hidden="true"
              >
                {s.l}
              </span>
              <span style={{ fontSize: 14, fontWeight: 600, flex: 1 }}>{s.t}</span>
              <span
                style={{
                  transform: isOpen ? 'rotate(180deg)' : undefined,
                  transition: 'transform 0.2s',
                  color: 'var(--ink-3)',
                }}
                aria-hidden="true"
              >
                <ChevronDown />
              </span>
            </button>
            <div
              id={`soap-panel-${s.l}`}
              role="region"
              aria-labelledby={`soap-header-${s.l}`}
              hidden={!isOpen}
              style={{
                padding: '12px 14px',
                fontSize: 13,
                lineHeight: 1.5,
                color: 'var(--ink-2)',
              }}
            >
              {s.v}
            </div>
          </div>
        );
      })}
    </>
  );
}
