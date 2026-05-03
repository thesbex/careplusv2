import { useIsMobile } from '@/lib/responsive/useMediaQuery';
import LoginPage from './LoginPage';
import LoginMobilePage from './LoginPage.mobile';

export default function LoginRoute() {
  const isMobile = useIsMobile();
  return isMobile ? <LoginMobilePage /> : <LoginPage />;
}
