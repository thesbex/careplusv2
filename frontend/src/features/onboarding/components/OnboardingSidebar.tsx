/**
 * Right-column sidebar (360 px) rendered next to each onboarding step.
 *
 * The prototype `design/prototype/screens/onboarding.jsx` ships a step-specific
 * aside per step (aperçu agenda for Horaires, aperçu facture for Tarifs, etc.).
 * The production wizard previously omitted it entirely — `.ob-body` was a
 * grid with two columns defined in CSS but only the left child rendered.
 * This component restores the right child so each step gets its contextual
 * panel.
 */
import type { WorkingHoursView } from '../hooks/useOnboardingApi';
import type { ReactNode } from 'react';

type StepKey = 'cabinet' | 'medecin' | 'horaires' | 'equipe' | 'tarifs' | 'documents' | 'recap';

interface Props {
  step: StepKey;
  hours: WorkingHoursView;
  premiumDiscount: number;
  invitedCount: number;
  hasSignature: boolean;
}

export function OnboardingSidebar({
  step,
  hours,
  premiumDiscount,
  invitedCount,
  hasSignature,
}: Props) {
  return (
    <aside className="ob-preview scroll">
      {step === 'cabinet' && <CabinetSidebar />}
      {step === 'medecin' && <MedecinSidebar hasSignature={hasSignature} />}
      {step === 'horaires' && <HorairesSidebar hours={hours} />}
      {step === 'equipe' && <EquipeSidebar invitedCount={invitedCount} />}
      {step === 'tarifs' && <TarifsSidebar premiumDiscount={premiumDiscount} />}
      {step === 'documents' && <DocumentsSidebar />}
      {step === 'recap' && <RecapSidebar />}
    </aside>
  );
}

// ── Cabinet ─────────────────────────────────────────────────────────────────

function CabinetSidebar() {
  const points = [
    {
      title: 'En-tête des documents',
      body: "La raison sociale, l'ICE et l'adresse apparaîtront automatiquement sur ordonnances, factures et certificats.",
    },
    {
      title: 'Conformité fiscale',
      body: "L'ICE et l'IF sont obligatoires sur toute facture émise au Maroc.",
    },
    {
      title: 'Référencement local',
      body: 'Les patients vous trouveront via la recherche par ville et par quartier.',
    },
    {
      title: 'Données protégées',
      body: 'Hébergement souverain au Maroc, chiffrement bout-en-bout, conforme CNDP.',
    },
  ];
  return (
    <SidebarFrame label="Pourquoi ces informations ?">
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        {points.map((p) => (
          <SidebarCard key={p.title} title={p.title} body={p.body} />
        ))}
      </div>
    </SidebarFrame>
  );
}

// ── Médecin ─────────────────────────────────────────────────────────────────

function MedecinSidebar({ hasSignature }: { hasSignature: boolean }) {
  return (
    <SidebarFrame label="Comment ça marche">
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        <SidebarCard
          title="Chaque médecin = un compte"
          body="Les médecins associés ont leur propre identifiant, agenda, et signature numérique. Les ordonnances et certificats sont automatiquement signés au nom du médecin connecté."
        />
        <SidebarCard
          title="Dossiers patients partagés"
          body="Tous les médecins du cabinet voient les mêmes dossiers, mais l'historique trace qui a fait quoi."
        />
        <SidebarTip>
          {hasSignature
            ? '✓ Votre signature est enregistrée. Elle apparaîtra sur chaque PDF signé.'
            : 'Astuce : téléversez une signature scannée pour que vos ordonnances soient signées automatiquement.'}
        </SidebarTip>
      </div>
    </SidebarFrame>
  );
}

// ── Horaires ────────────────────────────────────────────────────────────────

function HorairesSidebar({ hours }: { hours: WorkingHoursView }) {
  // Mini week preview — first 6 columns, hours 8h-19h. Each cell shaded as
  // "closed" when no slot of that day covers that hour (lunch breaks + closed
  // days are striped). Updates live as the user edits the form.
  const visibleDays = hours.days.slice(0, 6); // exclude Sunday in the preview
  const hourRange = [8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19];

  function isOpen(d: WorkingHoursView['days'][number], hr: number): boolean {
    if (!d.active) return false;
    return d.slots.some((s) => {
      const start = parseInt(s.startTime.slice(0, 2), 10);
      const end = parseInt(s.endTime.slice(0, 2), 10);
      return hr >= start && hr < end;
    });
  }

  return (
    <SidebarFrame label="Aperçu agenda">
      <div
        className="panel"
        style={{ padding: 0, overflow: 'hidden', border: '1px solid var(--border)', borderRadius: 6, background: '#fff' }}
      >
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: '28px repeat(6, 1fr)',
            fontSize: 9,
            background: 'var(--surface-2)',
            borderBottom: '1px solid var(--border)',
            padding: '5px 0',
          }}
        >
          <span />
          {['L', 'M', 'M', 'J', 'V', 'S'].map((d, i) => (
            <span key={i} style={{ textAlign: 'center', color: 'var(--ink-3)', fontWeight: 600 }}>
              {d}
            </span>
          ))}
        </div>
        {hourRange.map((hr) => (
          <div
            key={hr}
            style={{
              display: 'grid',
              gridTemplateColumns: '28px repeat(6, 1fr)',
              borderBottom: '1px solid var(--border-soft)',
              height: 18,
            }}
          >
            <span
              className="tnum"
              style={{ fontSize: 9, color: 'var(--ink-4)', textAlign: 'right', paddingRight: 4, paddingTop: 2 }}
            >
              {hr}h
            </span>
            {visibleDays.map((d) => {
              const open = isOpen(d, hr);
              return (
                <div
                  key={d.dayOfWeek}
                  style={{
                    borderLeft: '1px solid var(--border-soft)',
                    background: open
                      ? '#fff'
                      : 'repeating-linear-gradient(-45deg, transparent, transparent 4px, var(--border-soft) 4px, var(--border-soft) 5px)',
                  }}
                />
              );
            })}
          </div>
        ))}
      </div>
      <div className="ob-preview-legend" style={{ marginTop: 10 }}>
        <div>
          <span className="ob-preview-legend-open" /> Disponible
        </div>
        <div>
          <span className="ob-preview-legend-closed" /> Fermé / pause
        </div>
      </div>
      <SidebarTip>
        Des créneaux courts (15 min) conviennent aux suivis. Les premières consultations gagnent à être réservées sur 30 min.
      </SidebarTip>
    </SidebarFrame>
  );
}

// ── Équipe ──────────────────────────────────────────────────────────────────

function EquipeSidebar({ invitedCount }: { invitedCount: number }) {
  // Cap soft à 5 utilisateurs comme dans le prototype "careplus Cabinet — 5 utilisateurs inclus".
  // L'admin courant + les invités composent l'effectif. On approxime "2 utilisés" en local.
  const used = 1 + invitedCount;
  const cap = 5;
  const pct = Math.min(100, (used / cap) * 100);
  return (
    <SidebarFrame label="Votre forfait">
      <div className="panel" style={{ padding: 16, background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 6 }}>
        <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 4 }}>careplus Cabinet</div>
        <div style={{ fontSize: 11, color: 'var(--ink-3)', marginBottom: 14 }}>
          {cap} utilisateurs inclus · {used} utilisé{used > 1 ? 's' : ''}
        </div>
        <div style={{ height: 6, background: 'var(--bg)', borderRadius: 3, overflow: 'hidden' }}>
          <div style={{ width: `${pct}%`, height: '100%', background: 'var(--primary)' }} />
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 6, fontSize: 11, color: 'var(--ink-3)' }}>
          <span>{used} / {cap}</span>
          <span>{cap - used} places restantes</span>
        </div>
      </div>
      <div style={{ marginTop: 18, display: 'flex', flexDirection: 'column', gap: 0 }}>
        <SidebarLabel>Bonnes pratiques</SidebarLabel>
        <div style={{ fontSize: 12, color: 'var(--ink-2)', lineHeight: 1.55 }}>
          <div style={{ padding: '10px 0', borderBottom: '1px dashed var(--border)' }}>
            <strong style={{ color: 'var(--ink)' }}>Au moins 2 admins.</strong> Désignez un second médecin titulaire pour conserver l’accès en cas d’absence.
          </div>
          <div style={{ padding: '10px 0', borderBottom: '1px dashed var(--border)' }}>
            <strong style={{ color: 'var(--ink)' }}>Le strict nécessaire.</strong> Une infirmière n’a pas besoin d’accéder à la facturation.
          </div>
          <div style={{ padding: '10px 0' }}>
            <strong style={{ color: 'var(--ink)' }}>Conformité 09-08.</strong> Chaque accès est journalisé.
          </div>
        </div>
      </div>
    </SidebarFrame>
  );
}

// ── Tarifs ──────────────────────────────────────────────────────────────────

function TarifsSidebar({ premiumDiscount }: { premiumDiscount: number }) {
  const cons = 200;
  const ecg = 180;
  const subtotal = cons + ecg;
  const discount = (subtotal * premiumDiscount) / 100;
  const total = subtotal - discount;
  return (
    <SidebarFrame label="Aperçu facture Premium">
      <div className="panel" style={{ padding: 16, fontSize: 12, color: 'var(--ink-2)', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 6 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid var(--border)', paddingBottom: 8, marginBottom: 8 }}>
          <span style={{ fontFamily: 'var(--font-mono)', fontSize: 10.5, color: 'var(--ink-3)' }}>FAC-2026-00482</span>
          <span style={{ fontSize: 10.5, color: 'var(--ink-3)' }}>14/05/2026</span>
        </div>
        <div style={{ fontSize: 11.5, marginBottom: 12, color: 'var(--ink-3)' }}>M. Mohamed Alami · Premium</div>
        <div style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', borderBottom: '1px dashed var(--border)' }}>
          <span>Consultation de suivi</span>
          <span className="tnum" style={{ fontWeight: 600 }}>200,00 DH</span>
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', borderBottom: '1px dashed var(--border)' }}>
          <span>ECG au cabinet</span>
          <span className="tnum" style={{ fontWeight: 600 }}>180,00 DH</span>
        </div>
        {premiumDiscount > 0 && (
          <div style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', borderBottom: '1px dashed var(--border)', color: 'var(--primary)' }}>
            <span>Remise Premium (−{premiumDiscount}%)</span>
            <span className="tnum" style={{ fontWeight: 600 }}>−{discount.toFixed(2)} DH</span>
          </div>
        )}
        <div style={{ display: 'flex', justifyContent: 'space-between', padding: '10px 0 4px', fontWeight: 600, fontSize: 13, color: 'var(--ink)' }}>
          <span>Total</span>
          <span className="tnum">{total.toFixed(2)} DH</span>
        </div>
        <div style={{ fontSize: 10, color: 'var(--ink-3)', marginTop: 6, fontStyle: 'italic' }}>
          TVA exonérée — art. 91 CGI
        </div>
      </div>
      <SidebarTip>
        <strong>Conformité loi 09-08</strong>
        <br />
        Les factures incluent automatiquement votre ICE, RC et IF.
      </SidebarTip>
    </SidebarFrame>
  );
}

// ── Documents ───────────────────────────────────────────────────────────────

function DocumentsSidebar() {
  return (
    <SidebarFrame label="Aperçu ordonnance">
      <div
        style={{
          background: '#fff',
          border: '1px solid var(--border)',
          borderRadius: 6,
          padding: 12,
          fontSize: 9,
          lineHeight: 1.4,
          color: 'var(--ink-2)',
          aspectRatio: '1 / 1.414',
          overflow: 'hidden',
        }}
      >
        <div style={{ borderBottom: '1px solid var(--border-soft)', paddingBottom: 6, marginBottom: 6 }}>
          <div style={{ fontWeight: 600, color: 'var(--ink)', fontSize: 10 }}>Cabinet Médical</div>
          <div style={{ color: 'var(--ink-3)', fontSize: 8 }}>Adresse · Téléphone · INPE</div>
        </div>
        <div style={{ fontWeight: 600, color: 'var(--ink)', fontSize: 11, marginBottom: 6 }}>ORDONNANCE</div>
        <div style={{ marginBottom: 6 }}>Date : 14/05/2026</div>
        <div style={{ marginBottom: 8 }}>Patient : M. ──────── · Âge : 42 ans</div>
        <div style={{ borderBottom: '1px dashed var(--border)', padding: '3px 0' }}>•&nbsp;&nbsp;Paracétamol 1g — 3×/jour, 5j</div>
        <div style={{ borderBottom: '1px dashed var(--border)', padding: '3px 0' }}>•&nbsp;&nbsp;Amoxicilline 500mg — 2×/jour, 7j</div>
        <div style={{ marginTop: 24, textAlign: 'right', fontSize: 8 }}>Dr. ──────── (signature)</div>
      </div>
      <SidebarTip>
        L’en-tête de cabinet (étape 1) et votre signature (étape 2) sont injectés automatiquement.
      </SidebarTip>
    </SidebarFrame>
  );
}

// ── Récap ───────────────────────────────────────────────────────────────────

function RecapSidebar() {
  return (
    <>
      <SidebarLabel>Votre abonnement</SidebarLabel>
      <div
        className="panel"
        style={{
          padding: 16,
          marginBottom: 18,
          background: 'linear-gradient(180deg, var(--primary-soft), transparent 80%)',
          border: '1px solid var(--border)',
          borderRadius: 6,
        }}
      >
        <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 4, color: 'var(--primary)' }}>
          careplus Cabinet
        </div>
        <div style={{ fontSize: 11.5, color: 'var(--ink-3)', marginBottom: 14, lineHeight: 1.5 }}>
          Essai gratuit — 14 jours restants. Aucune carte requise.
        </div>
        <div style={{ height: 4, background: 'var(--bg)', borderRadius: 2, overflow: 'hidden', marginBottom: 8 }}>
          <div style={{ width: '0%', height: '100%', background: 'var(--primary)' }} />
        </div>
        <div className="tnum" style={{ fontSize: 11, color: 'var(--ink-3)', textAlign: 'right' }}>
          Jour 0 sur 14
        </div>
      </div>

      <SidebarLabel>Besoin d’aide&nbsp;?</SidebarLabel>
      <div style={{ fontSize: 12.5, color: 'var(--ink-2)', lineHeight: 1.6 }}>
        <a
          style={{
            display: 'flex',
            gap: 10,
            padding: '10px 0',
            borderBottom: '1px dashed var(--border)',
            color: 'inherit',
            textDecoration: 'none',
          }}
        >
          <span style={{ color: 'var(--primary)' }}>📚</span>
          <div>
            <div style={{ fontWeight: 600 }}>Centre d’aide</div>
            <div style={{ fontSize: 11, color: 'var(--ink-3)' }}>Guides pas à pas en français et arabe</div>
          </div>
        </a>
        <a
          style={{
            display: 'flex',
            gap: 10,
            padding: '10px 0',
            borderBottom: '1px dashed var(--border)',
            color: 'inherit',
            textDecoration: 'none',
          }}
        >
          <span style={{ color: 'var(--primary)' }}>💬</span>
          <div>
            <div style={{ fontWeight: 600 }}>Chat avec un expert</div>
            <div style={{ fontSize: 11, color: 'var(--ink-3)' }}>Lun–Ven 9h–19h · réponse &lt; 5 min</div>
          </div>
        </a>
        <a style={{ display: 'flex', gap: 10, padding: '10px 0', color: 'inherit', textDecoration: 'none' }}>
          <span style={{ color: 'var(--primary)' }}>📞</span>
          <div>
            <div style={{ fontWeight: 600 }}>+212 522 00 11 22</div>
            <div style={{ fontSize: 11, color: 'var(--ink-3)' }}>Hotline dédiée aux nouveaux cabinets</div>
          </div>
        </a>
      </div>

      <div
        style={{
          marginTop: 24,
          padding: 14,
          background: 'var(--surface-2)',
          borderRadius: 6,
          fontSize: 11.5,
          color: 'var(--ink-3)',
          lineHeight: 1.55,
          textAlign: 'center',
        }}
      >
        🇲🇦 Hébergé au Maroc
        <br />
        Conforme loi 09-08 · CNDP
      </div>
    </>
  );
}

// ── Building blocks ─────────────────────────────────────────────────────────

function SidebarFrame({ label, children }: { label: string; children: ReactNode }) {
  return (
    <>
      <SidebarLabel>{label}</SidebarLabel>
      {children}
    </>
  );
}

function SidebarLabel({ children }: { children: ReactNode }) {
  return (
    <div
      style={{
        fontSize: 11,
        color: 'var(--ink-3)',
        fontWeight: 600,
        textTransform: 'uppercase',
        letterSpacing: '0.08em',
        marginBottom: 10,
      }}
    >
      {children}
    </div>
  );
}

function SidebarCard({ title, body }: { title: string; body: string }) {
  return (
    <div
      style={{
        padding: 12,
        background: 'var(--surface)',
        border: '1px solid var(--border)',
        borderRadius: 6,
      }}
    >
      <div style={{ fontSize: 12.5, fontWeight: 600, color: 'var(--ink)', marginBottom: 4 }}>
        {title}
      </div>
      <div style={{ fontSize: 11.5, color: 'var(--ink-3)', lineHeight: 1.5 }}>{body}</div>
    </div>
  );
}

function SidebarTip({ children }: { children: ReactNode }) {
  return (
    <div className="ob-tip" style={{ marginTop: 16, fontSize: 12 }}>
      {children}
    </div>
  );
}
