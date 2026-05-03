/**
 * Screen 12 — Login (mobile).
 * Mirrors design/prototype/mobile/screens.jsx:MLogin: brand hero band on top,
 * form below. Wires to the same useLogin mutation as the desktop variant.
 */
import { useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { toast } from 'sonner';
import { Lock } from '@/components/icons';
import { useLogin } from '@/lib/auth/useAuth';
import { toProblemDetail } from '@/lib/api/problemJson';
import { loginSchema, type LoginValues } from './schema';

export default function LoginMobilePage() {
  const navigate = useNavigate();
  const location = useLocation();
  const loginMutation = useLogin();
  const [showPassword, setShowPassword] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
    setError,
  } = useForm<LoginValues>({
    resolver: zodResolver(loginSchema),
    defaultValues: { email: '', password: '' },
  });

  const redirectTo = (location.state as { from?: string } | null)?.from ?? '/agenda';

  const onSubmit = handleSubmit(async (values) => {
    try {
      await loginMutation.mutateAsync(values);
      navigate(redirectTo, { replace: true });
    } catch (err) {
      const problem = toProblemDetail(err);
      if (problem.status === 401) {
        setError('password', { type: 'server', message: 'Identifiants incorrects' });
      } else if (problem.status === 429) {
        toast.error('Trop de tentatives. Réessayez dans 15 minutes.', { duration: 6000 });
      } else if (problem.violations?.length) {
        problem.violations.forEach((v) =>
          setError(v.field as keyof LoginValues, { type: 'server', message: v.message }),
        );
      } else {
        toast.error(problem.title, { description: problem.detail });
      }
    }
  });

  return (
    <div
      className="cp-mobile cp-app"
      style={{
        minHeight: '100vh',
        background: 'var(--surface)',
        display: 'flex',
        flexDirection: 'column',
      }}
    >
      {/* Hero */}
      <div
        style={{
          background: 'linear-gradient(155deg, #1E5AA8 0%, #174585 55%, #112F5C 100%)',
          padding: '48px 26px 40px',
          color: 'white',
          borderRadius: '0 0 22px 22px',
        }}
      >
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 10,
            marginBottom: 36,
          }}
        >
          <div
            style={{
              width: 32,
              height: 32,
              background: 'white',
              color: 'var(--primary)',
              borderRadius: 8,
              display: 'grid',
              placeItems: 'center',
              fontSize: 17,
              fontWeight: 700,
              letterSpacing: '-0.03em',
            }}
            aria-hidden="true"
          >
            c
          </div>
          <span style={{ fontSize: 17, fontWeight: 600, letterSpacing: '-0.01em' }}>
            careplus
          </span>
        </div>
        <div
          style={{
            fontSize: 30,
            fontWeight: 600,
            lineHeight: 1.15,
            letterSpacing: '-0.025em',
          }}
        >
          Bon retour,
          <br />
          <span style={{ color: '#A8C5E8', fontWeight: 500 }}>docteur.</span>
        </div>
        <div
          style={{
            fontSize: 13,
            color: 'rgba(255,255,255,0.75)',
            marginTop: 10,
            lineHeight: 1.5,
          }}
        >
          Connectez-vous à votre cabinet
        </div>
      </div>

      <form
        onSubmit={onSubmit}
        noValidate
        style={{ padding: '28px 22px', flex: 1, overflowY: 'auto' }}
      >
        <div className="m-field">
          <label htmlFor="m-login-email">Adresse e-mail</label>
          <input
            id="m-login-email"
            className="m-input"
            type="email"
            autoComplete="email"
            placeholder="vous@cabinet.ma"
            aria-invalid={!!errors.email}
            {...register('email')}
          />
          {errors.email && (
            <div style={{ color: 'var(--danger)', fontSize: 12, marginTop: 4 }}>
              {errors.email.message}
            </div>
          )}
        </div>

        <div className="m-field">
          <label htmlFor="m-login-password">Mot de passe</label>
          <div style={{ position: 'relative' }}>
            <input
              id="m-login-password"
              className="m-input"
              type={showPassword ? 'text' : 'password'}
              autoComplete="current-password"
              aria-invalid={!!errors.password}
              style={{ paddingRight: 70 }}
              {...register('password')}
            />
            <button
              type="button"
              onClick={() => setShowPassword((v) => !v)}
              style={{
                position: 'absolute',
                right: 6,
                top: '50%',
                transform: 'translateY(-50%)',
                background: 'transparent',
                border: 0,
                fontFamily: 'inherit',
                color: 'var(--primary)',
                fontSize: 12,
                fontWeight: 600,
                cursor: 'pointer',
                padding: '4px 8px',
              }}
              aria-label={showPassword ? 'Masquer le mot de passe' : 'Afficher le mot de passe'}
            >
              {showPassword ? 'Masquer' : 'Afficher'}
            </button>
          </div>
          {errors.password && (
            <div style={{ color: 'var(--danger)', fontSize: 12, marginTop: 4 }}>
              {errors.password.message}
            </div>
          )}
        </div>

        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginBottom: 20,
            fontSize: 12,
          }}
        >
          <label
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              color: 'var(--ink-2)',
            }}
          >
            <input type="checkbox" defaultChecked /> Garder ma session
          </label>
          <a href="#forgot" style={{ color: 'var(--primary)', fontWeight: 600 }}>
            Mot de passe oublié ?
          </a>
        </div>

        <button
          type="submit"
          className="m-btn primary"
          style={{ height: 52, fontSize: 15, width: '100%' }}
          disabled={isSubmitting || loginMutation.isPending}
        >
          <Lock aria-hidden="true" />{' '}
          {isSubmitting || loginMutation.isPending ? 'Connexion…' : 'Se connecter'}
        </button>

        <div
          style={{
            marginTop: 22,
            padding: 12,
            border: '1px solid var(--border)',
            borderRadius: 10,
            background: 'var(--surface-2)',
            fontSize: 12,
            display: 'flex',
            gap: 10,
            alignItems: 'flex-start',
          }}
        >
          <span style={{ color: 'var(--primary)', flexShrink: 0, paddingTop: 1 }}>
            <Lock aria-hidden="true" />
          </span>
          <div>
            <div style={{ fontWeight: 600, marginBottom: 2 }}>Connexion sécurisée</div>
            <div style={{ color: 'var(--ink-3)', fontSize: 11.5, lineHeight: 1.4 }}>
              Chiffrement TLS · données hébergées au Maroc · conforme loi 09-08
            </div>
          </div>
        </div>
      </form>
    </div>
  );
}
