/**
 * TimelinePanel — medical chronology left column.
 * Ported from design/prototype/screens/dossier-patient.jsx lines 85–129.
 */
import { Pill } from '@/components/ui/Pill';
import type { TimelineEvent } from '../types';

interface TimelinePanelProps {
  events: TimelineEvent[];
}

export function TimelinePanel({ events }: TimelinePanelProps) {
  return (
    <div className="scroll" style={{ padding: '20px 24px' }}>
      <div
        style={{
          fontSize: 11,
          fontWeight: 600,
          textTransform: 'uppercase',
          letterSpacing: '0.08em',
          color: 'var(--ink-3)',
          marginBottom: 12,
        }}
      >
        Chronologie médicale
      </div>

      {events.map((e, i) => (
        <div
          key={i}
          style={{
            display: 'grid',
            gridTemplateColumns: '88px 16px 1fr',
            gap: 14,
            paddingBottom: 16,
          }}
        >
          {/* Date + time column */}
          <div className="tnum" style={{ textAlign: 'right', paddingTop: 2 }}>
            <div style={{ fontSize: 12, fontWeight: 600 }}>{e.date}</div>
            <div style={{ fontSize: 11, color: 'var(--ink-3)' }}>{e.time}</div>
          </div>

          {/* Connector dot + line */}
          <div style={{ position: 'relative', display: 'flex', justifyContent: 'center' }}>
            <div
              aria-hidden="true"
              style={{
                position: 'absolute',
                top: 0,
                bottom: -16,
                width: 1,
                background: 'var(--border)',
              }}
            />
            <div
              aria-hidden="true"
              style={{
                width: 11,
                height: 11,
                borderRadius: '50%',
                background: e.live ? 'var(--primary)' : 'var(--surface)',
                border: `2px solid ${e.live ? 'var(--primary)' : 'var(--border-strong)'}`,
                marginTop: 4,
                zIndex: 1,
              }}
            />
          </div>

          {/* Event card */}
          <div
            style={{
              background: e.live ? 'var(--primary-soft)' : 'var(--surface)',
              border: '1px solid var(--border)',
              borderRadius: 6,
              padding: '10px 14px',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ fontWeight: 600, fontSize: 13 }}>{e.title}</span>
              {e.live && (
                <Pill status="consult" dot>
                  En cours
                </Pill>
              )}
              <span style={{ marginLeft: 'auto', display: 'flex', gap: 4 }}>
                {e.tags.map((t) => (
                  <Pill key={t}>{t}</Pill>
                ))}
              </span>
            </div>
            {e.who && (
              <div style={{ fontSize: 11.5, color: 'var(--ink-3)', marginTop: 2 }}>
                {e.who}
              </div>
            )}
            {e.summary && (
              <div style={{ fontSize: 12.5, marginTop: 6, color: 'var(--ink-2)' }}>
                {e.summary}
              </div>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}
