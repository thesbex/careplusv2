/**
 * SupportTab — admin contact panel for reaching the careplus publisher.
 *
 * User ask 2026-05-28 : « l'administrateur a un écran pour communiquer avec
 * l'éditeur du logiciel pour remonter un bug ou dysfonctionnement : envoyer
 * un mail, le contacter par téléphone… ».
 *
 * Pas de backend dédié en v1 : on compose un mailto: avec contexte préfilé
 * (cabinet, version, navigateur) + on expose un tel: cliquable. Le serveur
 * de support de l'éditeur gère le reste.
 *
 * Constantes hardcodées pour l'instant — à déplacer dans une config
 * éditeur quand on aura un backend `support_contact` table ou env var.
 */
import { useState } from 'react';
import { Panel, PanelHeader } from '@/components/ui/Panel';
import { Button } from '@/components/ui/Button';
import { Textarea } from '@/components/ui/Input';
import { Phone, Mail, Doc } from '@/components/icons';
import { useClinicSettings } from '../hooks/useSettings';

const SUPPORT_EMAIL = 'support@careplus.ma';
const SUPPORT_PHONE = '+212 5 22 00 00 00';
const SUPPORT_PHONE_DISPLAY = '+212 5 22 00 00 00';
const APP_VERSION = '1.0.0';

export function SupportTab() {
  const { settings } = useClinicSettings();
  const [bugMessage, setBugMessage] = useState('');

  const cabinetName = settings?.name ?? 'Cabinet non identifié';
  const cabinetCity = settings?.city ?? '';
  const userAgent = typeof navigator !== 'undefined' ? navigator.userAgent : 'n/a';

  function buildMailto(subject: string, body: string): string {
    const params = new URLSearchParams({ subject, body });
    return `mailto:${SUPPORT_EMAIL}?${params.toString()}`;
  }

  function buildBugContext(): string {
    return [
      `Cabinet : ${cabinetName}${cabinetCity ? ` · ${cabinetCity}` : ''}`,
      `Version careplus : ${APP_VERSION}`,
      `Navigateur : ${userAgent}`,
      `URL : ${typeof window !== 'undefined' ? window.location.href : 'n/a'}`,
      '',
      '— Description du problème —',
      bugMessage || '(décrivez ce qui ne fonctionne pas, étapes pour reproduire, capture d\'écran si possible)',
    ].join('\n');
  }

  function handleSendBug() {
    const href = buildMailto(
      `[careplus][bug] ${cabinetName} — ${new Date().toLocaleDateString('fr-FR')}`,
      buildBugContext(),
    );
    window.location.href = href;
  }

  function handleSendGeneric() {
    const href = buildMailto(
      `[careplus] Contact — ${cabinetName}`,
      buildBugContext(),
    );
    window.location.href = href;
  }

  return (
    <div style={{ maxWidth: 720 }}>
      <Panel style={{ marginBottom: 16 }}>
        <PanelHeader>Coordonnées de l'éditeur</PanelHeader>
        <div style={{ padding: 16, display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div style={{ fontSize: 13, color: 'var(--ds2-ink-2, var(--ink-2))', lineHeight: 1.5 }}>
            En cas de bug, dysfonctionnement ou question, contactez l'équipe support
            careplus par e-mail ou téléphone. Pour un bug, le bouton « Envoyer un rapport »
            ci-dessous pré-remplit un mail avec le contexte technique (cabinet, version,
            navigateur) — il ne reste qu'à décrire le problème.
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <a
              href={`mailto:${SUPPORT_EMAIL}`}
              className="btn"
              style={{ justifyContent: 'flex-start', textDecoration: 'none' }}
            >
              <Mail />
              <span style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', lineHeight: 1.2 }}>
                <span style={{ fontSize: 11, color: 'var(--ds2-ink-3, var(--ink-3))', fontWeight: 500 }}>E-mail</span>
                <span style={{ fontWeight: 600 }}>{SUPPORT_EMAIL}</span>
              </span>
            </a>
            <a
              href={`tel:${SUPPORT_PHONE.replace(/\s+/g, '')}`}
              className="btn"
              style={{ justifyContent: 'flex-start', textDecoration: 'none' }}
            >
              <Phone />
              <span style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', lineHeight: 1.2 }}>
                <span style={{ fontSize: 11, color: 'var(--ds2-ink-3, var(--ink-3))', fontWeight: 500 }}>Téléphone</span>
                <span style={{ fontWeight: 600 }}>{SUPPORT_PHONE_DISPLAY}</span>
              </span>
            </a>
          </div>
        </div>
      </Panel>

      <Panel style={{ marginBottom: 16 }}>
        <PanelHeader>Signaler un bug</PanelHeader>
        <div style={{ padding: 16, display: 'flex', flexDirection: 'column', gap: 12 }}>
          <label style={{ fontSize: 12, fontWeight: 550, color: 'var(--ds2-ink-2, var(--ink-2))' }}>
            Décrivez le problème
            <Textarea
              value={bugMessage}
              onChange={(e) => setBugMessage(e.target.value)}
              placeholder="Ex. La photo de profil disparaît au bout d'une heure. Reproductible sur Chrome 140 / Cabinet El Amrani."
              style={{ marginTop: 6, minHeight: 120 }}
            />
          </label>
          <div style={{
            padding: '10px 12px',
            background: 'var(--ds2-surface-2, var(--bg))',
            borderRadius: 8,
            fontSize: 11.5,
            color: 'var(--ds2-ink-3, var(--ink-3))',
            lineHeight: 1.55,
          }}>
            <strong style={{ color: 'var(--ds2-ink-2)' }}>Contexte joint automatiquement :</strong> nom du cabinet, ville, version careplus,
            navigateur, URL courante. Vous pouvez supprimer ces lignes avant d'envoyer.
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <Button type="button" className="cp-ds2-primary" onClick={handleSendBug}>
              <Mail /> Envoyer un rapport de bug
            </Button>
            <Button type="button" onClick={handleSendGeneric}>
              <Doc /> Contact général
            </Button>
          </div>
        </div>
      </Panel>

      <div style={{
        fontSize: 11.5,
        color: 'var(--ds2-ink-3, var(--ink-3))',
        textAlign: 'center',
        marginTop: 12,
      }}>
        careplus {APP_VERSION} — © {new Date().getFullYear()}
      </div>
    </div>
  );
}
