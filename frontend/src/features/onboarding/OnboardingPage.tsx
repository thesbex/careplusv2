/**
 * Screen 13 — Onboarding wizard (first launch, step 3/7: working hours).
 * Ported from design/prototype/screens/onboarding.jsx.
 *
 * Backend dependency: none in MVP. Submitting the wizard will write to the
 * `config_working_hours` + `cabinet` tables via settings APIs once they ship
 * (post-MVP — see BACKLOG.md). Until then, the form is static.
 */
import { Fragment } from 'react';
import { BrandMark } from '@/components/ui/BrandMark';
import { Button } from '@/components/ui/Button';
import { Panel } from '@/components/ui/Panel';
import { Pill } from '@/components/ui/Pill';
import { Input } from '@/components/ui/Input';
import { Check, ChevronLeft, ChevronRight, Edit } from '@/components/icons';
import './onboarding.css';

interface Step {
  n: number;
  label: string;
  done?: boolean;
  active?: boolean;
}

interface Hours {
  d: string;
  morningStart: string;
  morningEnd: string;
  afternoonStart: string;
  afternoonEnd: string;
  on: boolean;
  half?: boolean;
}

const STEPS: Step[] = [
  { n: 1, label: 'Cabinet', done: true },
  { n: 2, label: 'Médecin', done: true },
  { n: 3, label: 'Horaires', active: true },
  { n: 4, label: 'Équipe' },
  { n: 5, label: 'Tarifs' },
  { n: 6, label: 'Documents' },
  { n: 7, label: 'Prêt' },
];

const WEEK: Hours[] = [
  { d: 'Lundi', morningStart: '08:30', morningEnd: '12:30', afternoonStart: '14:30', afternoonEnd: '19:00', on: true },
  { d: 'Mardi', morningStart: '08:30', morningEnd: '12:30', afternoonStart: '14:30', afternoonEnd: '19:00', on: true },
  { d: 'Mercredi', morningStart: '08:30', morningEnd: '12:30', afternoonStart: '14:30', afternoonEnd: '19:00', on: true },
  { d: 'Jeudi', morningStart: '08:30', morningEnd: '12:30', afternoonStart: '14:30', afternoonEnd: '19:00', on: true },
  { d: 'Vendredi', morningStart: '08:30', morningEnd: '12:30', afternoonStart: '15:30', afternoonEnd: '19:00', on: true },
  { d: 'Samedi', morningStart: '09:00', morningEnd: '13:00', afternoonStart: '', afternoonEnd: '', on: true, half: true },
  { d: 'Dimanche', morningStart: '', morningEnd: '', afternoonStart: '', afternoonEnd: '', on: false },
];

const TEMPLATES = [
  { t: 'Cabinet classique', sub: 'Lun–Sam, 8:30–19:00', selected: true },
  { t: 'Journée continue', sub: 'Lun–Ven, 9:00–17:00' },
  { t: 'Demi-journées', sub: 'Matins seulement' },
];

export default function OnboardingPage() {
  return (
    <div className="ob-root">
      {/* Top bar */}
      <header className="ob-topbar">
        <BrandMark size="sm" />
        <span className="ob-topbar-name">careplus</span>
        <Pill style={{ marginLeft: 10 }}>Configuration initiale</Pill>
        <span className="ob-topbar-session">
          Session : Dr. Karim El Amrani ·{' '}
          <a href="#logout" className="ob-topbar-logout">
            Déconnexion
          </a>
        </span>
      </header>

      {/* Progress rail */}
      <nav className="ob-rail" aria-label="Étapes de configuration">
        <ol className="ob-steps">
          {STEPS.map((s, i) => (
            <Fragment key={s.n}>
              <li
                className={`ob-step ${s.done ? 'done' : ''} ${s.active ? 'active' : ''}`}
                aria-current={s.active ? 'step' : undefined}
              >
                <span className="ob-step-circle">{s.done ? <Check /> : s.n}</span>
                <span className="ob-step-label">{s.label}</span>
              </li>
              {i < STEPS.length - 1 && (
                <li className={`ob-step-connector ${s.done ? 'done' : ''}`} aria-hidden="true" />
              )}
            </Fragment>
          ))}
        </ol>
      </nav>

      {/* Body */}
      <div className="ob-body">
        <div className="ob-content scroll">
          <div className="ob-content-inner">
            <div className="ob-eyebrow">Étape 3 sur 7</div>
            <h1 className="ob-title">Quand recevez-vous vos patients ?</h1>
            <p className="ob-sub">
              Ces horaires déterminent les créneaux proposés par l'agenda et les messages
              envoyés aux patients. Vous pourrez les modifier à tout moment depuis les paramètres.
            </p>

            <div className="ob-section">
              <div className="ob-section-label">Démarrer depuis un modèle</div>
              <div className="ob-templates">
                {TEMPLATES.map((m) => (
                  <button
                    key={m.t}
                    className={`ob-template ${m.selected ? 'selected' : ''}`}
                    type="button"
                  >
                    <span className="ob-template-t">{m.t}</span>
                    <span className="ob-template-sub">{m.sub}</span>
                  </button>
                ))}
              </div>
            </div>

            <Panel className="ob-hours">
              {WEEK.map((h) => (
                <div key={h.d} className="ob-hours-row">
                  <span className="ob-hours-day">{h.d}</span>
                  <label className="ob-hours-toggle">
                    <input
                      type="checkbox"
                      defaultChecked={h.on}
                      aria-label={`${h.d} — ${h.on ? 'ouvert' : 'fermé'}`}
                    />
                    {h.on ? 'Ouvert' : 'Fermé'}
                  </label>
                  {h.on ? (
                    <div className="ob-hours-range">
                      <Input
                        defaultValue={h.morningStart}
                        className="tnum"
                        style={{ height: 32 }}
                        aria-label={`${h.d} — début matinée`}
                      />
                      <span>–</span>
                      <Input
                        defaultValue={h.morningEnd}
                        className="tnum"
                        style={{ height: 32 }}
                        aria-label={`${h.d} — fin matinée`}
                      />
                    </div>
                  ) : (
                    <div className="ob-hours-empty">—</div>
                  )}
                  {h.on && !h.half ? (
                    <div className="ob-hours-range">
                      <Input
                        defaultValue={h.afternoonStart}
                        className="tnum"
                        style={{ height: 32 }}
                        aria-label={`${h.d} — début après-midi`}
                      />
                      <span>–</span>
                      <Input
                        defaultValue={h.afternoonEnd}
                        className="tnum"
                        style={{ height: 32 }}
                        aria-label={`${h.d} — fin après-midi`}
                      />
                    </div>
                  ) : (
                    <div className="ob-hours-empty">{h.half ? 'Demi-journée' : '—'}</div>
                  )}
                  <Button variant="ghost" size="sm" iconOnly aria-label={`Modifier ${h.d}`}>
                    <Edit />
                  </Button>
                </div>
              ))}
            </Panel>

            <div className="ob-options">
              <label>
                <input type="checkbox" defaultChecked /> Pause déjeuner automatique
              </label>
              <label>
                <input type="checkbox" /> Créneau urgences réservé
              </label>
              <label>
                <input type="checkbox" defaultChecked /> Respecter les jours fériés marocains
              </label>
            </div>
          </div>
        </div>

        {/* Preview sidebar */}
        <aside className="ob-preview scroll">
          <div className="ob-preview-label">Aperçu agenda</div>
          <Panel className="ob-preview-grid">
            <div className="ob-preview-head">
              <span />
              {['L', 'M', 'M', 'J', 'V', 'S'].map((d, i) => (
                <span key={i}>{d}</span>
              ))}
            </div>
            {Array.from({ length: 12 }, (_, i) => 8 + i).map((h) => (
              <div key={h} className="ob-preview-row">
                <span className="tnum ob-preview-hour">{h}h</span>
                {[0, 1, 2, 3, 4, 5].map((d) => {
                  const isLunch = h === 12 || h === 13;
                  const isSatAfter = d === 5 && h >= 13;
                  const closed = isLunch || isSatAfter;
                  return <div key={d} className={`ob-preview-cell ${closed ? 'closed' : ''}`} />;
                })}
              </div>
            ))}
          </Panel>
          <div className="ob-preview-legend">
            <div>
              <span className="ob-preview-legend-open" /> Disponible
            </div>
            <div>
              <span className="ob-preview-legend-closed" /> Fermé
            </div>
          </div>

          <div className="ob-tip">
            <strong>💡 Conseil</strong>
            <br />
            Des créneaux plus courts (15 min) conviennent aux suivis. Les premières
            consultations gagnent à être réservées sur 30 min.
          </div>
        </aside>
      </div>

      {/* Footer */}
      <footer className="ob-footer">
        <Button>
          <ChevronLeft /> Précédent
        </Button>
        <div className="ob-footer-right">
          <Button variant="ghost">Passer cette étape</Button>
          <Button variant="primary" size="lg">
            Continuer — Équipe <ChevronRight />
          </Button>
        </div>
      </footer>
    </div>
  );
}
