/**
 * DossierTabs — tab bar for Chronologie | Consultations | Prescriptions |
 * Analyses | Imagerie | Documents | Facturation.
 * Ported from design/prototype/screens/dossier-patient.jsx lines 63–81.
 * Uses Radix Tabs (already in package.json) for keyboard navigation.
 */
import * as RadixTabs from '@radix-ui/react-tabs';
import type { DossierTab } from '../types';

interface Tab {
  id: DossierTab;
  label: string;
  count?: number;
}

const TABS: Tab[] = [
  { id: 'timeline', label: 'Chronologie' },
  { id: 'consults', label: 'Consultations', count: 14 },
  { id: 'vitals', label: 'Constantes' },
  { id: 'prescr', label: 'Prescriptions', count: 22 },
  { id: 'vaccination', label: 'Vaccination' },
  { id: 'analyses', label: 'Analyses', count: 9 },
  { id: 'imagerie', label: 'Imagerie', count: 3 },
  { id: 'docs', label: 'Documents', count: 7 },
  { id: 'factu', label: 'Facturation', count: 14 },
];

interface DossierTabsProps {
  value: DossierTab;
  onValueChange: (v: DossierTab) => void;
  children: React.ReactNode;
}

export function DossierTabs({ value, onValueChange, children }: DossierTabsProps) {
  return (
    <RadixTabs.Root
      value={value}
      onValueChange={(v) => onValueChange(v as DossierTab)}
      style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', minHeight: 0 }}
    >
      <RadixTabs.List
        aria-label="Sections du dossier patient"
        style={{
          display: 'flex',
          gap: 2,
          padding: '0 20px',
          borderBottom: '1px solid var(--border)',
          background: 'var(--surface)',
        }}
      >
        {TABS.map((t) => {
          const isActive = value === t.id;
          return (
            <RadixTabs.Trigger
              key={t.id}
              value={t.id}
              style={{
                padding: '11px 14px',
                border: 'none',
                background: 'transparent',
                borderBottom: `2px solid ${isActive ? 'var(--primary)' : 'transparent'}`,
                color: isActive ? 'var(--ink)' : 'var(--ink-3)',
                fontWeight: isActive ? 600 : 500,
                fontSize: 12.5,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: 6,
                fontFamily: 'inherit',
                outline: 'none',
              }}
            >
              {t.label}
              {t.count !== undefined && (
                <span
                  style={{
                    fontSize: 10.5,
                    background: isActive ? 'var(--primary-soft)' : 'var(--bg-alt)',
                    color: isActive ? 'var(--primary)' : 'var(--ink-3)',
                    padding: '1px 6px',
                    borderRadius: 8,
                    fontWeight: 600,
                  }}
                >
                  {t.count}
                </span>
              )}
            </RadixTabs.Trigger>
          );
        })}
      </RadixTabs.List>

      {children}
    </RadixTabs.Root>
  );
}

/** Wrapper for a single tab panel — passes through to Radix. */
export function DossierTabPanel({
  value,
  children,
}: {
  value: DossierTab;
  children: React.ReactNode;
}) {
  return (
    <RadixTabs.Content value={value} className="dp-tab-panel">
      {children}
    </RadixTabs.Content>
  );
}
