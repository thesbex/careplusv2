/**
 * /register — Demande d'accès praticien (desktop).
 *
 * Faithful port of design-handoff-v2/_bundle-register/careplus/project/screens/register.jsx
 * (cream variant). Wires the form to POST /api/admin/bootstrap which is
 * one-shot per install — succeeds the first time the database is empty,
 * 409s afterwards. On success auto-logs in and lands the new admin on
 * /onboarding so they can configure the cabinet.
 */
import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { toast } from 'sonner';
import { BrandMark } from '@/components/ui/BrandMark';
import { useT } from '@/lib/i18n/I18nProvider';
import { useRegister } from './hooks/useRegister';
import { registerSchema, type RegisterValues } from './schema';
import { toProblemDetail } from '@/lib/api/problemJson';
import './register.css';

const ROLES: Array<{ key: 'MEDECIN' | 'SECRETAIRE' | 'GESTIONNAIRE'; labelKey: string }> = [
  { key: 'MEDECIN', labelKey: 'register.role.medecin' },
  { key: 'SECRETAIRE', labelKey: 'register.role.secretaire' },
  { key: 'GESTIONNAIRE', labelKey: 'register.role.gestionnaire' },
];

const BULLETS: Array<{ icon: 'check' | 'clock' | 'lock'; textKey: string }> = [
  { icon: 'check', textKey: 'register.bullet.compliance' },
  { icon: 'clock', textKey: 'register.bullet.setup' },
  { icon: 'lock', textKey: 'register.bullet.privacy' },
];

export default function RegisterPage() {
  const { t } = useT();
  const navigate = useNavigate();
  const registerMutation = useRegister();
  const [showPassword] = useState(false);

  const {
    register: rhfRegister,
    handleSubmit,
    control,
    formState: { errors, isSubmitting },
    setError,
  } = useForm<RegisterValues>({
    resolver: zodResolver(registerSchema),
    defaultValues: {
      firstName: '',
      lastName: '',
      role: 'MEDECIN',
      email: '',
      phone: '',
      password: '',
      acceptTerms: true,
    },
  });

  const onSubmit = handleSubmit(async (values) => {
    try {
      await registerMutation.mutateAsync({
        email: values.email,
        password: values.password,
        firstName: values.firstName,
        lastName: values.lastName,
      });
      toast.success(t('register.toast.success.title'), {
        description: t('register.toast.success.desc'),
      });
      navigate('/onboarding', { replace: true });
    } catch (err) {
      const problem = toProblemDetail(err);
      // BOOTSTRAP_LOCKED — DB already has a user, so this install is claimed.
      if (problem.status === 409) {
        toast.error(t('register.toast.claimed.title'), {
          description: t('register.toast.claimed.desc'),
          duration: 8000,
        });
        navigate('/login', { replace: true });
        return;
      }
      if (problem.violations?.length) {
        problem.violations.forEach((v) => {
          if (v.field in values) {
            setError(v.field as keyof RegisterValues, { type: 'server', message: v.message });
          }
        });
        return;
      }
      toast.error(problem.title, problem.detail ? { description: problem.detail } : undefined);
    }
  });

  return (
    <div className="register-root">
      <div className="register-hero">
        <div className="register-hero-brand">
          <BrandMark size="md" />
          <span className="register-hero-name">
            care<span className="plus">plus</span>
          </span>
        </div>

        <div className="register-hero-bottom">
          <div className="register-hero-pill">{t('register.hero.pill')}</div>
          <h1 className="register-hero-title">
            {t('register.hero.title1')} <em>{t('register.hero.title2')}</em>
          </h1>
          <p className="register-hero-tagline">{t('register.hero.tagline')}</p>

          <div className="register-bullets">
            {BULLETS.map((b) => (
              <div key={b.icon} className="register-bullet">
                <span className="register-bullet-icon" aria-hidden="true">
                  <BulletIcon icon={b.icon} />
                </span>
                <span>{t(b.textKey)}</span>
              </div>
            ))}
          </div>

          <div className="register-hero-stats">
            <div>
              <div className="register-hero-stat-v tnum">184</div>
              <div className="register-hero-stat-l">{t('register.hero.stat.cabinets')}</div>
            </div>
            <div>
              <div className="register-hero-stat-v tnum">62k</div>
              <div className="register-hero-stat-l">{t('register.hero.stat.consults')}</div>
            </div>
            <div>
              <div className="register-hero-stat-v tnum">99,98%</div>
              <div className="register-hero-stat-l">{t('register.hero.stat.uptime')}</div>
            </div>
          </div>
        </div>
      </div>

      <div className="register-form-wrap">
        <div className="register-form-topnav">
          <span>{t('register.topnav.already')}</span>
          <Link to="/login">{t('register.topnav.login')}</Link>
          <span style={{ color: 'var(--ink-4)' }}>·</span>
          <span>FR · عر</span>
        </div>

        <form className="register-form" onSubmit={onSubmit} noValidate>
          <h2 className="register-form-title">{t('register.title')}</h2>
          <p className="register-form-sub">{t('register.sub')}</p>

          <div className="register-form-grid-2">
            <div className="register-form-field" style={{ marginBottom: 0 }}>
              <label htmlFor="reg-firstName">{t('register.field.firstName')}</label>
              <input id="reg-firstName" type="text" autoComplete="given-name" {...rhfRegister('firstName')} />
              {errors.firstName && <div className="register-form-field-err">{t(errors.firstName.message ?? '')}</div>}
            </div>
            <div className="register-form-field" style={{ marginBottom: 0 }}>
              <label htmlFor="reg-lastName">{t('register.field.lastName')}</label>
              <input id="reg-lastName" type="text" autoComplete="family-name" {...rhfRegister('lastName')} />
              {errors.lastName && <div className="register-form-field-err">{t(errors.lastName.message ?? '')}</div>}
            </div>
          </div>

          <div className="register-form-field">
            <label>{t('register.field.role')}</label>
            <Controller
              control={control}
              name="role"
              render={({ field }) => (
                <div className="register-form-roles" role="radiogroup" aria-label={t('register.field.role')}>
                  {ROLES.map((r) => (
                    <button
                      key={r.key}
                      type="button"
                      role="radio"
                      aria-checked={field.value === r.key}
                      aria-pressed={field.value === r.key}
                      className="register-form-role-chip"
                      onClick={() => field.onChange(r.key)}
                    >
                      {t(r.labelKey)}
                    </button>
                  ))}
                </div>
              )}
            />
          </div>

          <div className="register-form-field">
            <label htmlFor="reg-email">{t('register.field.email')}</label>
            <input
              id="reg-email"
              type="email"
              autoComplete="email"
              placeholder="vous@cabinet.ma"
              {...rhfRegister('email')}
            />
            {errors.email && <div className="register-form-field-err">{t(errors.email.message ?? '')}</div>}
          </div>

          <div className="register-form-field">
            <label htmlFor="reg-phone">{t('register.field.phone')}</label>
            <div className="register-form-phone">
              <span className="register-form-phone-prefix" aria-hidden="true">+212</span>
              <input id="reg-phone" type="tel" autoComplete="tel" {...rhfRegister('phone')} placeholder="6 12 34 56 78" />
            </div>
            {errors.phone && <div className="register-form-field-err">{t(errors.phone.message ?? '')}</div>}
          </div>

          <div className="register-form-field" style={{ marginBottom: 0 }}>
            <label htmlFor="reg-password">{t('register.field.password')}</label>
            <input
              id="reg-password"
              type={showPassword ? 'text' : 'password'}
              autoComplete="new-password"
              {...rhfRegister('password')}
            />
            {errors.password && <div className="register-form-field-err">{t(errors.password.message ?? '')}</div>}
          </div>
          <div className="register-form-password-help">
            {t('register.password.help')}
          </div>

          <label className="register-form-terms">
            <input type="checkbox" {...rhfRegister('acceptTerms')} />
            <span>
              {t('register.terms.pre')} <a href="#cgu">{t('register.terms.cgu')}</a> {t('register.terms.and')}{' '}
              <a href="#privacy">{t('register.terms.privacy')}</a>.
            </span>
          </label>
          {errors.acceptTerms && (
            <div className="register-form-field-err" style={{ marginTop: -16, marginBottom: 12 }}>
              {t(errors.acceptTerms.message ?? '')}
            </div>
          )}

          <button
            type="submit"
            className="register-form-submit"
            disabled={isSubmitting || registerMutation.isPending}
          >
            {isSubmitting || registerMutation.isPending ? t('register.submitting') : t('register.submit')}
          </button>

          <div className="register-form-footer-note">
            {t('register.footerNote')}
          </div>
        </form>
      </div>
    </div>
  );
}

function BulletIcon({ icon }: { icon: 'check' | 'clock' | 'lock' }) {
  if (icon === 'check') {
    return (
      <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
        <path d="M4 8.5 L7 11.5 L12 5.5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    );
  }
  if (icon === 'clock') {
    return (
      <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
        <circle cx="8" cy="8" r="5.5" stroke="currentColor" strokeWidth="1.4" />
        <path d="M8 5 V8 L10 9.5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
      </svg>
    );
  }
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
      <rect x="4" y="7" width="8" height="6" rx="1.2" stroke="currentColor" strokeWidth="1.4" />
      <path d="M5.8 7 V5.5 a2.2 2.2 0 0 1 4.4 0 V7" stroke="currentColor" strokeWidth="1.4" />
    </svg>
  );
}
