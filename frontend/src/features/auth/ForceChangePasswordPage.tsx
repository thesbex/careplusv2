/**
 * V044 — Force-change-password screen.
 *
 * Reached whenever the authenticated user has {@code passwordChangeRequired}
 * set on their session (after an admin reset). The route guards in
 * {@link ../../lib/auth/RequireAuth.tsx} push every other URL here until the
 * user picks a new password. The backend filter enforces the same rule
 * server-side (defence in depth).
 *
 * On success we clear the flag locally, refresh the session user, and bounce
 * to /agenda — the user is fully usable again.
 */
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { Button } from '@/components/ui/Button';
import { Field, FieldLabel } from '@/components/ui/Field';
import { Input } from '@/components/ui/Input';
import { BrandMark } from '@/components/ui/BrandMark';
import { Lock } from '@/components/icons';
import { useAuthStore } from '@/lib/auth/authStore';
import { performLogout } from '@/lib/auth/useAuth';
import { useChangeOwnPassword } from '@/features/parametres/hooks/useUsers';
import { toProblemDetail } from '@/lib/api/problemJson';
import { useT } from '@/lib/i18n/I18nProvider';

export default function ForceChangePasswordPage() {
  const { t } = useT();
  const navigate = useNavigate();
  const user = useAuthStore((s) => s.user);
  const setUser = useAuthStore((s) => s.setUser);
  const { changePassword, isPending } = useChangeOwnPassword();

  const [currentPwd, setCurrentPwd] = useState('');
  const [newPwd, setNewPwd] = useState('');
  const [confirmPwd, setConfirmPwd] = useState('');
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (newPwd.length < 12) {
      setError(t('login.fcp.err.tooShort'));
      return;
    }
    if (newPwd !== confirmPwd) {
      setError(t('login.fcp.err.mismatch'));
      return;
    }
    if (newPwd === currentPwd) {
      setError(t('login.fcp.err.sameAsCurrent'));
      return;
    }
    try {
      await changePassword({ currentPassword: currentPwd, newPassword: newPwd });
      if (user) {
        setUser({ ...user, passwordChangeRequired: false });
      }
      toast.success(t('login.fcp.success'));
      navigate('/agenda', { replace: true });
    } catch (err) {
      const problem = toProblemDetail(err);
      if (problem.code === 'INVALID_CURRENT_PASSWORD') {
        setError(t('login.fcp.err.invalidCurrent'));
      } else if (problem.code === 'PASSWORD_REUSED') {
        setError(t('login.fcp.err.sameAsCurrent'));
      } else {
        setError(problem.detail ?? problem.title);
      }
    }
  }

  return (
    <div
      style={{
        minHeight: '100vh',
        display: 'grid',
        placeItems: 'center',
        background: 'var(--bg-alt)',
        padding: 20,
      }}
    >
      <form
        onSubmit={handleSubmit}
        data-testid="force-change-password-form"
        style={{
          width: 'min(440px, 100%)',
          background: 'var(--surface)',
          border: '1px solid var(--border)',
          borderRadius: 12,
          padding: 28,
          display: 'flex',
          flexDirection: 'column',
          gap: 14,
          boxShadow: '0 8px 32px rgba(15,23,42,0.08)',
        }}
      >
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 10,
            marginBottom: 4,
          }}
        >
          <BrandMark size="sm" />
          <span style={{ fontSize: 14, fontWeight: 600, color: 'var(--ink-1)' }}>
            careplus
          </span>
        </div>

        <h1 style={{ fontSize: 20, fontWeight: 600, margin: 0 }}>
          {t('login.fcp.title')}
        </h1>
        <p style={{ fontSize: 13, color: 'var(--ink-3)', lineHeight: 1.55, margin: 0 }}>
          {t('login.fcp.sub')}
        </p>

        <Field>
          <FieldLabel htmlFor="fcp-current">{t('login.fcp.current')}</FieldLabel>
          <Input
            id="fcp-current"
            type="password"
            autoComplete="current-password"
            value={currentPwd}
            onChange={(e) => setCurrentPwd(e.target.value)}
            required
          />
          <div style={{ fontSize: 11, color: 'var(--ink-3)', marginTop: 4 }}>
            {t('login.fcp.currentHint')}
          </div>
        </Field>

        <Field>
          <FieldLabel htmlFor="fcp-new">{t('login.fcp.new')}</FieldLabel>
          <Input
            id="fcp-new"
            type="password"
            autoComplete="new-password"
            value={newPwd}
            onChange={(e) => setNewPwd(e.target.value)}
            required
          />
          <div style={{ fontSize: 11, color: 'var(--ink-3)', marginTop: 4 }}>
            {t('login.fcp.newHint')}
          </div>
        </Field>

        <Field>
          <FieldLabel htmlFor="fcp-confirm">{t('login.fcp.confirm')}</FieldLabel>
          <Input
            id="fcp-confirm"
            type="password"
            autoComplete="new-password"
            value={confirmPwd}
            onChange={(e) => setConfirmPwd(e.target.value)}
            required
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

        <Button
          type="submit"
          variant="primary"
          size="lg"
          disabled={isPending}
          style={{ width: '100%', justifyContent: 'center', height: 44 }}
        >
          <Lock /> {isPending ? t('login.fcp.submitting') : t('login.fcp.submit')}
        </Button>

        <button
          type="button"
          onClick={performLogout}
          style={{
            background: 'transparent',
            border: 0,
            color: 'var(--ink-3)',
            fontSize: 12,
            cursor: 'pointer',
            marginTop: 4,
          }}
        >
          {t('login.fcp.logout')}
        </button>
      </form>
    </div>
  );
}
