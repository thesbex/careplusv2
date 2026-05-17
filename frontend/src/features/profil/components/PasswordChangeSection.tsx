/**
 * "Changer mon mot de passe" — section libre-service sur /profil.
 *
 * Réutilise le hook V044 {@link useChangeOwnPassword} et le même endpoint
 * (`POST /api/users/me/change-password`) que ForceChangePasswordPage. La
 * différence est purement IHM : ici l'utilisateur n'est pas en mode forcé,
 * donc on garde la page sous-jacente intacte (pas de redirect agenda) et
 * on ne touche pas au flag passwordChangeRequired (déjà à false par
 * définition pour cette surface).
 */
import { useState } from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/Button';
import { Field, FieldLabel } from '@/components/ui/Field';
import { Input } from '@/components/ui/Input';
import { Lock } from '@/components/icons';
import { useChangeOwnPassword } from '@/features/parametres/hooks/useUsers';
import { toProblemDetail } from '@/lib/api/problemJson';

export function PasswordChangeSection() {
  const { changePassword, isPending } = useChangeOwnPassword();
  const [current, setCurrent] = useState('');
  const [next, setNext] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState<string | null>(null);

  function reset() {
    setCurrent('');
    setNext('');
    setConfirm('');
    setError(null);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!current) {
      setError('Le mot de passe actuel est requis.');
      return;
    }
    if (next.length < 12) {
      setError('Le nouveau mot de passe doit faire au moins 12 caractères.');
      return;
    }
    if (next !== confirm) {
      setError('Les deux mots de passe ne correspondent pas.');
      return;
    }
    if (next === current) {
      setError("Le nouveau mot de passe doit être différent de l'actuel.");
      return;
    }
    try {
      await changePassword({ currentPassword: current, newPassword: next });
      toast.success('Mot de passe mis à jour.');
      reset();
    } catch (err) {
      const problem = toProblemDetail(err);
      if (problem.code === 'INVALID_CURRENT_PASSWORD') {
        setError('Le mot de passe actuel est incorrect.');
      } else if (problem.code === 'PASSWORD_REUSED') {
        setError("Le nouveau mot de passe doit être différent de l'actuel.");
      } else {
        setError(problem.detail ?? problem.title);
      }
    }
  }

  return (
    <form
      onSubmit={handleSubmit}
      data-testid="password-change-section"
      style={{
        marginTop: 16,
        background: 'var(--surface)',
        border: '1px solid var(--border)',
        borderRadius: 'var(--r-md)',
        padding: 18,
        display: 'flex',
        flexDirection: 'column',
        gap: 12,
      }}
    >
      <div style={{ fontWeight: 600, fontSize: 14 }}>Mot de passe</div>
      <div style={{ fontSize: 12.5, color: 'var(--ink-3)' }}>
        Modifiez votre mot de passe à tout moment. Vous resterez connecté à
        cette session.
      </div>

      <Field>
        <FieldLabel htmlFor="pwd-current">Mot de passe actuel</FieldLabel>
        <Input
          id="pwd-current"
          type="password"
          autoComplete="current-password"
          value={current}
          onChange={(e) => setCurrent(e.target.value)}
        />
      </Field>

      <Field>
        <FieldLabel htmlFor="pwd-new">Nouveau mot de passe</FieldLabel>
        <Input
          id="pwd-new"
          type="password"
          autoComplete="new-password"
          value={next}
          onChange={(e) => setNext(e.target.value)}
        />
        <div style={{ fontSize: 11, color: 'var(--ink-3)', marginTop: 4 }}>
          12 caractères minimum.
        </div>
      </Field>

      <Field>
        <FieldLabel htmlFor="pwd-confirm">Confirmer</FieldLabel>
        <Input
          id="pwd-confirm"
          type="password"
          autoComplete="new-password"
          value={confirm}
          onChange={(e) => setConfirm(e.target.value)}
        />
      </Field>

      {error && (
        <div
          role="alert"
          style={{
            fontSize: 12.5,
            color: 'var(--danger)',
            background: 'var(--danger-soft)',
            padding: '8px 10px',
            borderRadius: 6,
          }}
        >
          {error}
        </div>
      )}

      <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
        <Button type="submit" variant="primary" disabled={isPending}>
          <Lock /> {isPending ? 'Enregistrement…' : 'Mettre à jour'}
        </Button>
      </div>
    </form>
  );
}
