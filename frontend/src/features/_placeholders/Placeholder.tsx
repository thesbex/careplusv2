/**
 * Generic "Coming in J_x" placeholder for routes whose real screen hasn't
 * been ported yet. Renders in the right shell (desktop or mobile) so the
 * navigation always lands somewhere that feels like the real app.
 */
import { Screen } from '@/components/shell/Screen';
import type { SidebarScreen } from '@/components/shell/Sidebar';
import { MScreen } from '@/components/shell/MScreen';
import { MTopbar, MIconBtn } from '@/components/shell/MTopbar';
import type { MobileTab } from '@/components/shell/MTabs';
import { useIsMobile } from '@/lib/responsive/useMediaQuery';
import { useNavigate } from 'react-router-dom';
import { Panel, PanelHeader } from '@/components/ui/Panel';

interface PlaceholderProps {
  active: SidebarScreen;
  mobileTab: MobileTab;
  title: string;
  sub?: string;
  sprintDay: string;
}

export function Placeholder({ active, mobileTab, title, sub, sprintDay }: PlaceholderProps) {
  const isMobile = useIsMobile();
  const navigate = useNavigate();

  const body = (
    <div style={{ padding: isMobile ? 16 : 20 }}>
      <Panel>
        <PanelHeader>{title}</PanelHeader>
        <div style={{ padding: 20, fontSize: 13, color: 'var(--ink-2)', lineHeight: 1.55 }}>
          <div style={{ fontWeight: 600, marginBottom: 6 }}>
            Écran prévu pour le jour {sprintDay}.
          </div>
          <p style={{ margin: 0, color: 'var(--ink-3)', maxWidth: 560 }}>
            La coque (barre latérale, topbar, navigation, tokens) est en place et l'URL est
            connectée. L'écran réel sera porté depuis{' '}
            <code>design/prototype/screens/</code> quand l'endpoint backend correspondant sera
            prêt, conformément à ADR-021 (livraison parallèle synchronisée).
          </p>
        </div>
      </Panel>
    </div>
  );

  if (isMobile) {
    return (
      <MScreen
        tab={mobileTab}
        topbar={
          <MTopbar title={title} {...(sub ? { sub } : {})} right={<MIconBtn icon="Bell" label="Notifications" />} />
        }
        onTabChange={(tab) => {
          const map: Record<MobileTab, string> = {
            agenda: '/agenda',
            salle: '/salle',
            patients: '/patients',
            factu: '/facturation',
            menu: '/parametres',
          };
          navigate(map[tab]);
        }}
      >
        {body}
      </MScreen>
    );
  }

  return (
    <Screen
      active={active}
      title={title}
      {...(sub ? { sub } : {})}
      onNavigate={(id) => {
        const map: Record<SidebarScreen, string> = {
          agenda: '/agenda',
          patients: '/patients',
          salle: '/salle',
          consult: '/consultations',
          factu: '/facturation',
          vaccinations: '/vaccinations',
  grossesses: '/grossesses',
          stock: '/stock',
          catalogue: '/catalogue',
          params: '/parametres',
        };
        navigate(map[id]);
      }}
    >
      {body}
    </Screen>
  );
}
