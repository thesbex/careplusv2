/**
 * VitalIcon — petit pictogramme préfixant un libellé de constante (TA, FC,
 * T°, SpO₂, …). Le médecin pilote a demandé un repère visuel pour scanner
 * la liste des constantes plus vite (F3, 2026-05-06).
 *
 * Implémenté avec le set d'icônes maison (`src/components/icons`) et non
 * lucide-react : DESIGN_SYSTEM §8 interdit les sets externes pour garder
 * stroke 1.5 / 16×16 / currentColor cohérents.
 *
 * Mapping :
 *   ta       → Activity (pulse-line)
 *   fc       → Heart
 *   fr       → Wind
 *   temp     → Thermo (existant)
 *   spo2     → Droplet
 *   poids    → Scale
 *   taille   → Ruler
 *   imc      → Calculator
 *   glycemie → Droplet
 *   abdo     → Circle
 *   cranien  → Baby
 *
 * Usage :
 *   <VitalIcon vital="ta" />
 *   <VitalIcon vital="fc" className="vital-icon vital-icon--lg" />
 *
 * Pour une clé inconnue, retourne `null` (pas de fallback bruyant).
 */
import type { ComponentType, SVGProps } from 'react';
import {
  Activity,
  Heart,
  Wind,
  Thermo,
  Droplet,
  Scale,
  Ruler,
  Calculator,
  Circle,
  Baby,
} from '@/components/icons';

export type VitalKey =
  | 'ta'
  | 'fc'
  | 'fr'
  | 'temp'
  | 'spo2'
  | 'poids'
  | 'taille'
  | 'imc'
  | 'glycemie'
  | 'abdo'
  | 'cranien';

type SvgIcon = ComponentType<SVGProps<SVGSVGElement>>;

const ICON_MAP: Record<VitalKey, SvgIcon> = {
  ta: Activity,
  fc: Heart,
  fr: Wind,
  temp: Thermo,
  spo2: Droplet,
  poids: Scale,
  taille: Ruler,
  imc: Calculator,
  glycemie: Droplet,
  abdo: Circle,
  cranien: Baby,
};

interface VitalIconProps {
  vital: VitalKey;
  className?: string;
  /**
   * `aria-hidden` par défaut — le label texte (ex. "TA") porte déjà la
   * sémantique. Mettre `false` si l'icône est utilisée sans label.
   */
  decorative?: boolean;
}

export function VitalIcon({ vital, className, decorative = true }: VitalIconProps) {
  const Icon = ICON_MAP[vital as VitalKey] as SvgIcon | undefined;
  if (!Icon) return null;
  return (
    <Icon
      className={className ?? 'vital-icon'}
      aria-hidden={decorative ? true : undefined}
    />
  );
}
