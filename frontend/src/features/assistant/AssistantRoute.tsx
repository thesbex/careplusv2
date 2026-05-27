/**
 * Point d'entrée responsive pour /assistant.
 * Desktop → AssistantPage ; Mobile → AssistantPage.mobile.
 */
import { useIsMobile } from '@/lib/responsive/useMediaQuery';
import AssistantPageDesktop from './AssistantPage';
import AssistantPageMobile from './AssistantPage.mobile';

export default function AssistantRoute() {
  const isMobile = useIsMobile();
  if (isMobile) return <AssistantPageMobile />;
  return <AssistantPageDesktop />;
}
