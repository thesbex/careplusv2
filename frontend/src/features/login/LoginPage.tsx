/**
 * Screen 12 — Login (desktop).
 * Ported from design/prototype/screens/login.jsx and wired to the real
 * backend (J2): POST /api/auth/login returns accessToken + sets the HttpOnly
 * `careplus_refresh` cookie.
 */
import { useState } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { toast } from 'sonner';
import { Button } from '@/components/ui/Button';
import { Field } from '@/components/ui/Field';
import { Input } from '@/components/ui/Input';
import { BrandMark } from '@/components/ui/BrandMark';
import { Eye, Lock } from '@/components/icons';
import { useLogin } from '@/lib/auth/useAuth';
import { useAuthStore } from '@/lib/auth/authStore';
import { isPureTech, defaultLandingForTech } from '@/lib/auth/roleHelpers';
import { api } from '@/lib/api/client';
import { toProblemDetail } from '@/lib/api/problemJson';
import { useT } from '@/lib/i18n/I18nProvider';
import { loginSchema, type LoginValues } from './schema';
import './login.css';

export default function LoginPage() {
  const { t } = useT();
  const [showPassword, setShowPassword] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();
  const loginMutation = useLogin();

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
    setError,
  } = useForm<LoginValues>({
    resolver: zodResolver(loginSchema),
    defaultValues: {
      email: '',
      password: '',
    },
  });

  const redirectTo = (location.state as { from?: string } | null)?.from ?? '/agenda';

  const onSubmit = handleSubmit(async (values) => {
    // Guard against stray whitespace from autofill / copy-paste: an email never
    // contains spaces, and no careplus password intentionally has leading or
    // trailing whitespace. A single trailing space here otherwise 401s as
    // "Identifiants incorrects" against credentials that are actually correct.
    const credentials = {
      email: values.email.trim(),
      password: values.password.trim(),
    };
    try {
      const result = await loginMutation.mutateAsync(credentials);
      // V044 — admin reset this account, the user must pick a new password
      // before doing anything else. Skip the regular post-login routing.
      if (result.user?.passwordChangeRequired) {
        navigate('/force-change-password', { replace: true });
        return;
      }
      // First-login redirect : if the new admin hasn't run the cabinet setup
      // wizard yet (clinic_settings.name is empty), send them straight there
      // instead of /agenda. Idempotent — the wizard re-loads existing values
      // so it's safe to land on it again later.
      const target = await pickPostLoginPath(redirectTo);
      navigate(target, { replace: true });
    } catch (err) {
      const problem = toProblemDetail(err);
      if (problem.status === 401) {
        setError('password', { type: 'server', message: 'login.err.invalidCredentials' });
      } else if (problem.status === 429) {
        toast.error(t('login.err.tooManyAttempts'), { duration: 6000 });
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
    <div className="login-root">
      {/* Left: brand panel */}
      <div className="login-hero">
        <div className="login-hero-grid" aria-hidden="true" />
        <div className="login-hero-brand">
          <BrandMark size="lg" tone="inverted" />
          <span className="login-hero-name">careplus</span>
        </div>

        <div className="login-hero-bottom">
          <h1 className="login-hero-title">
            {t('login.hero.title1')}
            <br />
            <span className="login-hero-title-accent">{t('login.hero.title2')}</span>
          </h1>
          <p className="login-hero-tagline">{t('login.hero.tagline')}</p>

          <div className="login-hero-stats">
            <div>
              <div className="login-hero-stat-v tnum">184</div>
              <div className="login-hero-stat-k">{t('login.hero.stat.cabinets')}</div>
            </div>
            <div>
              <div className="login-hero-stat-v tnum">62k</div>
              <div className="login-hero-stat-k">{t('login.hero.stat.consults')}</div>
            </div>
            <div>
              <div className="login-hero-stat-v tnum">99,98%</div>
              <div className="login-hero-stat-k">{t('login.hero.stat.uptime')}</div>
            </div>
          </div>

          <div className="login-hero-footer">
            <span>© 2026 careplus SARL</span>
            <span>·</span>
            <span>{t('login.hero.footer.hosting')}</span>
            <span>·</span>
            <span>{t('login.hero.footer.law')}</span>
          </div>
        </div>
      </div>

      {/* Right: form */}
      <div className="login-form-wrap">
        <form className="login-form" onSubmit={onSubmit} noValidate>
          <div className="login-form-eyebrow">{t('login.eyebrow')}</div>
          <h2 className="login-form-title">{t('login.title')}</h2>
          <p className="login-form-sub">{t('login.sub')}</p>

          <Field className="login-form-field">
            <label htmlFor="login-email">{t('login.field.email')}</label>
            <Input
              id="login-email"
              type="email"
              autoComplete="email"
              placeholder="vous@cabinet.ma"
              aria-invalid={!!errors.email}
              aria-describedby={errors.email ? 'login-email-err' : undefined}
              style={{ height: 40 }}
              {...register('email')}
            />
            {errors.email && (
              <div id="login-email-err" className="help" style={{ color: 'var(--danger)' }}>
                {t(errors.email.message ?? '')}
              </div>
            )}
          </Field>

          <Field className="login-form-field-tight">
            <label htmlFor="login-password">{t('login.field.password')}</label>
            <div style={{ position: 'relative' }}>
              <Input
                id="login-password"
                type={showPassword ? 'text' : 'password'}
                autoComplete="current-password"
                aria-invalid={!!errors.password}
                aria-describedby={errors.password ? 'login-password-err' : undefined}
                style={{ height: 40, paddingRight: 38 }}
                {...register('password')}
              />
              <Button
                variant="ghost"
                size="sm"
                iconOnly
                style={{ position: 'absolute', right: 4, top: 4 }}
                onClick={() => setShowPassword((v) => !v)}
                aria-label={showPassword ? t('login.password.hide') : t('login.password.show')}
              >
                <Eye />
              </Button>
            </div>
            {errors.password && (
              <div id="login-password-err" className="help" style={{ color: 'var(--danger)' }}>
                {t(errors.password.message ?? '')}
              </div>
            )}
          </Field>

          <div className="login-form-row">
            <label className="login-form-remember">
              <input type="checkbox" defaultChecked /> {t('login.remember')}
            </label>
            <a href="#forgot" className="login-form-forgot">
              {t('login.forgot')}
            </a>
          </div>

          <Button
            type="submit"
            variant="primary"
            size="lg"
            disabled={isSubmitting || loginMutation.isPending}
            style={{ width: '100%', justifyContent: 'center', height: 44, fontSize: 14 }}
          >
            <Lock /> {isSubmitting || loginMutation.isPending ? t('login.submitting') : t('login.submit')}
          </Button>

          <div className="login-form-separator">
            <div />
            <span>{t('login.or')}</span>
            <div />
          </div>

          <Button style={{ width: '100%', justifyContent: 'center', height: 40 }}>
            {t('login.smsCode')}
          </Button>

          <div className="login-form-security">
            <span className="login-form-security-ico">
              <Lock />
            </span>
            <div>
              <div className="login-form-security-title">{t('login.security.title')}</div>
              <div className="login-form-security-body">{t('login.security.body')}</div>
            </div>
          </div>

          <div
            style={{
              marginTop: 18,
              textAlign: 'center',
              fontSize: 12.5,
              color: 'var(--ink-3)',
            }}
          >
            {t('login.noAccount')}{' '}
            <Link
              to="/register"
              style={{ color: 'var(--primary)', textDecoration: 'none', fontWeight: 600 }}
            >
              {t('login.createCabinet')}
            </Link>
          </div>
        </form>
      </div>
    </div>
  );
}

/**
 * Resolve where to land after a successful login. Default is the route the
 * user was originally trying to reach (`from` state) or `/agenda`. The
 * exception: a brand-new ADMIN whose cabinet has never been configured
 * (`clinic_settings.name` is empty) is sent to the onboarding wizard.
 */
async function pickPostLoginPath(redirectTo: string): Promise<string> {
  const user = useAuthStore.getState().user;
  // Pure-tech (LAB/RADIO seul) : redirect direct vers la queue. Évite
  // qu'un technicien atterrisse sur /agenda et soit bouncé par le guard.
  if (isPureTech(user?.roles)) return defaultLandingForTech(user?.roles);
  const isAdmin = !!user?.roles?.includes('ADMIN');
  if (!isAdmin) return redirectTo;
  // 404 is fine here — old installs may not have the row yet, treated as empty.
  try {
    const r = await api.get<{ name?: string | null }>('/settings/clinic');
    if (!r.data?.name) return '/onboarding';
  } catch {
    return '/onboarding';
  }
  return redirectTo;
}
