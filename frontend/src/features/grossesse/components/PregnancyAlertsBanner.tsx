/**
 * PregnancyAlertsBanner — top-of-tab warning bandeau listing the active
 * obstetric alerts (HTA gravidique, BU+, terme dépassé, etc.).
 * Severity → CSS class (severity-CRITICAL / WARNING / INFO).
 */
import { Warn } from '@/components/icons';
import type { PregnancyAlert } from '../types';

interface PregnancyAlertsBannerProps {
  alerts: PregnancyAlert[];
}

function formatSince(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleDateString('fr-MA', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });
}

export function PregnancyAlertsBanner({ alerts }: PregnancyAlertsBannerProps) {
  if (alerts.length === 0) return null;

  return (
    <div className="gr-alerts" role="alert" aria-label="Alertes obstétricales actives">
      {alerts.map((a) => (
        <div
          key={a.code}
          className={`gr-alert severity-${a.severity}`}
          data-testid={`gr-alert-${a.code}`}
        >
          <Warn aria-hidden="true" />
          <span style={{ fontWeight: 600 }}>{a.label}</span>
          <span className="gr-alert-since">depuis {formatSince(a.since)}</span>
        </div>
      ))}
    </div>
  );
}
