/**
 * Demo-only preview of the shell primitives.
 * Not a real feature — used by App.tsx's dev screen picker so you can see
 * <Screen> and <MScreen> rendering before real feature screens arrive in J3+.
 * Delete this folder once Agenda / Salle / Patients are wired.
 */
import { useState } from 'react';
import { Screen } from '@/components/shell/Screen';
import type { SidebarScreen } from '@/components/shell/Sidebar';
import { MScreen } from '@/components/shell/MScreen';
import type { MobileTab } from '@/components/shell/MTabs';
import { MTopbar, MIconBtn } from '@/components/shell/MTopbar';
import { Panel, PanelHeader } from '@/components/ui/Panel';
import { Pill } from '@/components/ui/Pill';
import { Button } from '@/components/ui/Button';
import { Plus } from '@/components/icons';

export function DesktopShellPreview() {
  const [active, setActive] = useState<SidebarScreen>('agenda');
  return (
    <Screen
      active={active}
      title="Shell preview"
      sub="Composition: Sidebar · Topbar · Workspace · RightPanel"
      pageDate="Jeudi 24 avril 2026"
      topbarRight={
        <Button variant="primary">
          <Plus /> Nouveau RDV
        </Button>
      }
      onNavigate={setActive}
      counts={{ salle: 3 }}
      right={
        <div style={{ padding: 16 }}>
          <div
            style={{
              fontSize: 10,
              fontWeight: 600,
              letterSpacing: '0.08em',
              textTransform: 'uppercase',
              color: 'var(--ink-3)',
              marginBottom: 8,
            }}
          >
            Panneau droit
          </div>
          <Panel>
            <PanelHeader>En salle d'attente</PanelHeader>
            <div style={{ padding: 14, fontSize: 12, color: 'var(--ink-3)' }}>
              Le contenu réel arrive avec la Salle d'attente (J5). Ce panneau est
              optionnel — passe-le en prop <code>right</code>.
            </div>
          </Panel>
        </div>
      }
    >
      <div style={{ padding: 20 }}>
        <div style={{ display: 'flex', gap: 10, alignItems: 'center', marginBottom: 18 }}>
          <Pill status="arrived" dot>
            Arrivé
          </Pill>
          <Pill status="waiting" dot>
            En attente
          </Pill>
          <Pill status="consult" dot>
            En consultation
          </Pill>
          <Pill status="done" dot>
            Terminé
          </Pill>
          <Pill status="allergy">Pénicilline</Pill>
        </div>
        <Panel>
          <PanelHeader>Écran actif : {active}</PanelHeader>
          <div
            style={{
              padding: 20,
              fontSize: 13,
              color: 'var(--ink-2)',
              lineHeight: 1.55,
              maxWidth: 620,
            }}
          >
            Ce cadre <code>&lt;Screen&gt;</code> est la coque partagée par tous les écrans
            desktop. Navigue dans la barre latérale à gauche — chaque entrée peut déclencher
            une route réelle une fois React Router connecté en J2.
            <br />
            <br />
            Le badge (3) sur « Salle d'attente » vient de la prop <code>counts.salle</code>
            et sera relié au polling de <code>/api/queue</code> en J5.
          </div>
        </Panel>
      </div>
    </Screen>
  );
}

export function MobileShellPreview() {
  const [tab, setTab] = useState<MobileTab>('agenda');
  return (
    <div
      style={{
        minHeight: '100vh',
        background: 'var(--bg-alt)',
        display: 'grid',
        placeItems: 'center',
        padding: 24,
      }}
    >
      <MScreen
        tab={tab}
        onTabChange={setTab}
        badges={{ salle: 3 }}
        topbar={
          <MTopbar
            brand
            right={<MIconBtn icon="Bell" badge label="Notifications" />}
          />
        }
      >
        <div className="mb-pad">
          <div className="m-section-h">
            <h3>Aperçu shell mobile</h3>
          </div>
          <div className="m-card">
            <div className="m-row">
              <div className="m-row-pri">
                <div className="m-row-main">Onglet actif : {tab}</div>
                <div className="m-row-sub">
                  Les 5 onglets du bas sont les mêmes que dans le prototype.
                </div>
              </div>
            </div>
            <div className="m-row">
              <div className="m-row-pri">
                <div className="m-row-main">Statuts</div>
                <div
                  className="m-row-sub"
                  style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 6 }}
                >
                  <span className="m-pill arrived">Arrivé</span>
                  <span className="m-pill waiting">En attente</span>
                  <span className="m-pill consult">En consultation</span>
                  <span className="m-pill allergy">Pénicilline</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </MScreen>
    </div>
  );
}
