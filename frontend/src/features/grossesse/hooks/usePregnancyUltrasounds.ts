import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api/client';
import type { Biometry, PregnancyUltrasound } from '../types';

/** Backend returns biometryJson as a String — parse to typed Biometry on read. */
interface UltrasoundWire extends Omit<PregnancyUltrasound, 'biometry'> {
  biometryJson?: string | null;
}

function parseUltrasound(wire: UltrasoundWire): PregnancyUltrasound {
  let biometry: Biometry | null = null;
  if (wire.biometryJson) {
    try {
      biometry = JSON.parse(wire.biometryJson) as Biometry;
    } catch {
      biometry = null;
    }
  }
  const { biometryJson: _drop, ...rest } = wire;
  return { ...rest, biometry };
}

/**
 * GET /api/pregnancies/:pregnancyId/ultrasounds — list of obstetrical ultrasounds.
 */
export function usePregnancyUltrasounds(pregnancyId?: string) {
  const { data, isLoading, error } = useQuery({
    queryKey: ['pregnancies', 'ultrasounds', pregnancyId],
    queryFn: () =>
      api
        .get<UltrasoundWire[]>(`/pregnancies/${pregnancyId}/ultrasounds`)
        .then((r) => r.data),
    enabled: !!pregnancyId,
    staleTime: 30_000,
  });

  return {
    ultrasounds: (data ?? []).map(parseUltrasound),
    isLoading,
    error: error ? 'Impossible de charger les échographies.' : null,
  };
}

/**
 * Télécharge le compte-rendu PDF d'une échographie obstétricale.
 *
 * GET /api/pregnancies/:pregnancyId/ultrasounds/:ultrasoundId/cr-pdf →
 * application/pdf. Le JWT vit en mémoire (ADR-019), donc on récupère le
 * binaire en blob via axios.
 *
 * Livraison via un `<a download>` cliqué par programme (ADR-038) plutôt que
 * `window.open` : appelé après l'`await`, window.open sort du geste
 * utilisateur et se fait bloquer par le bloqueur de pop-ups (« rien ne se
 * passe »).
 */
export async function downloadUltrasoundCrPdf(
  pregnancyId: string,
  ultrasoundId: string,
): Promise<void> {
  const res = await api.get<Blob>(
    `/pregnancies/${pregnancyId}/ultrasounds/${ultrasoundId}/cr-pdf`,
    { responseType: 'blob' },
  );
  const url = URL.createObjectURL(res.data as Blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `compte-rendu-echographie-${ultrasoundId.slice(0, 8)}.pdf`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  // Defer revoke: Safari a besoin que l'URL reste vivante le temps du clic.
  setTimeout(() => URL.revokeObjectURL(url), 1_000);
}
