/**
 * DossierTabs — tab bar for Chronologie | Consultations | Constantes |
 * Prescriptions | Vaccination | (Grossesse) | Analyses | Imagerie |
 * Documents | Facturation.
 *
 * Les compteurs (« badges ») viennent désormais de
 * GET /api/patients/{id}/tab-counts (B6) via la prop `counts`. Avant ce
 * fix, ils étaient hard-codés (14 / 22 / 9 / 3 / 7 / 14) → trompeur.
 * Pendant le chargement initial (counts = undefined), on n'affiche aucun
 * badge — afficher 0 serait pire qu'absent.
 *
 * Onglets sans badge : Chronologie, Constantes, Vaccination, Grossesse —
 * ce sont des panneaux/timelines, pas des listes décomptables.
 *
 * Ported from design/prototype/screens/dossier-patient.jsx lines 63–81.
 * Uses Radix Tabs (already in package.json) for keyboard navigation.
 */
import * as RadixTabs from '@radix-ui/react-tabs';
import type { DossierTab } from '../types';
import type { PatientTabCounts } from '../hooks/useTabCounts';

interface Tab {
  id: DossierTab;
  label: string;
  count?: number;
}

interface DossierTabsProps {
  value: DossierTab;
  onValueChange: (v: DossierTab) => void;
  children: React.ReactNode;
  /** When true, inserts the "Grossesse" tab right after Vaccination. */
  showGrossesse?: boolean;
  /** When true, inserts the "Séjours" tab (établissement avec hospitalisation). */
  showSejours?: boolean;
  /** Real counts from the backend. `undefined` = still loading; render labels without badges. */
  counts?: PatientTabCounts | null;
}

export function DossierTabs({
  value,
  onValueChange,
  children,
  showGrossesse,
  showSejours,
  counts,
}: DossierTabsProps) {
  // Build the tab list dynamically — `count` only set when counts are loaded.
  const TABS: Tab[] = [
    { id: 'timeline', label: 'Chronologie' },
    {
      id: 'consults',
      label: 'Consultations',
      ...(counts ? { count: counts.consultations } : {}),
    },
    { id: 'vitals', label: 'Constantes' },
    {
      id: 'prescr',
      label: 'Prescriptions',
      ...(counts ? { count: counts.prescriptions } : {}),
    },
    { id: 'vaccination', label: 'Vaccination' },
  ];

  if (showGrossesse) {
    TABS.push({ id: 'grossesse', label: 'Grossesse' });
  }
  if (showSejours) {
    TABS.push({ id: 'sejours', label: 'Séjours' });
  }

  TABS.push(
    {
      id: 'analyses',
      label: 'Analyses',
      ...(counts ? { count: counts.analyses } : {}),
    },
    {
      id: 'imagerie',
      label: 'Imagerie',
      ...(counts ? { count: counts.imagerie } : {}),
    },
    {
      id: 'docs',
      label: 'Documents',
      ...(counts ? { count: counts.documents } : {}),
    },
    {
      id: 'factu',
      label: 'Facturation',
      ...(counts ? { count: counts.facturation } : {}),
    },
  );

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
