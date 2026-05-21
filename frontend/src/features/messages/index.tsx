import { useParams } from 'react-router-dom';
import { useIsMobile } from '@/lib/responsive/useMediaQuery';
import MessagesPage from './MessagesPage';
import MessagesMobilePage from './MessagesPage.mobile';
import MConversationMobilePage from './MConversationPage.mobile';

/**
 * Point d'entrée routeur pour la messagerie d'équipe.
 * - Desktop : `MessagesPage` (3 colonnes — fil sélectionné via état local),
 *   peu importe que l'URL soit `/messages` ou `/messages/:id`.
 * - Mobile  : `/messages` = liste, `/messages/:id` = conversation
 *   (deep-linkable, parité avec les autres modules type dossier).
 */
export default function MessagesRoute() {
  const isMobile = useIsMobile();
  const { conversationId } = useParams();

  if (isMobile) {
    return conversationId ? <MConversationMobilePage /> : <MessagesMobilePage />;
  }
  return <MessagesPage />;
}
