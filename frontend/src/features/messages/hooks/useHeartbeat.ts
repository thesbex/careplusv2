import { useEffect } from 'react';
import { api } from '@/lib/api/client';
import { useAuthStore } from '@/lib/auth/authStore';

/**
 * Ping POST /api/chat/heartbeat toutes les 30 s tant qu'une session est active.
 * Met à jour `identity_user.last_seen_at` côté serveur, drive la présence (on/away/off).
 *
 * Idle quand l'onglet est masqué (document.hidden) pour éviter les calls inutiles.
 */
export function useHeartbeat() {
  const accessToken = useAuthStore((s) => s.accessToken);

  useEffect(() => {
    if (!accessToken) return;

    let cancelled = false;

    function ping() {
      if (cancelled || document.hidden) return;
      api.post('/chat/heartbeat').catch(() => {
        // dégrader silencieusement — la présence n'est pas critique
      });
    }

    ping(); // ping immédiat à la connexion
    const id = window.setInterval(ping, 30_000);

    function onVisibilityChange() {
      if (!document.hidden) ping(); // ping dès qu'on revient sur l'onglet
    }
    document.addEventListener('visibilitychange', onVisibilityChange);

    return () => {
      cancelled = true;
      window.clearInterval(id);
      document.removeEventListener('visibilitychange', onVisibilityChange);
    };
  }, [accessToken]);
}
