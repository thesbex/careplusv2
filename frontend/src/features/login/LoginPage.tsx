/**
 * Screen 12 — Login (desktop).
 * Ported from design/prototype/screens/login.jsx and wired to the real
 * backend (J2): POST /api/auth/login returns accessToken + sets the HttpOnly
 * `careplus_refresh` cookie.
 */
import { useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { toast } from 'sonner';
import { Button } from '@/components/ui/Button';
import { Field } from '@/components/ui/Field';
import { Input } from '@/components/ui/Input';
import { BrandMark } from '@/components/ui/BrandMark';
import { Eye, Lock } from '@/components/icons';
import { useLogin } from '@/lib/auth/useAuth';
import { toProblemDetail } from '@/lib/api/problemJson';
import { loginSchema, type LoginValues } from './schema';
import './login.css';

export default function LoginPage() {
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
      email: 'f.benjelloun@cab-elamrani.ma',
      password: '',
    },
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
            La gestion de votre cabinet,
            <br />
            <span className="login-hero-title-accent">simplement.</span>
          </h1>
          <p className="login-hero-tagline">
            careplus accompagne les médecins généralistes marocains, de la prise de rendez-vous
            à l'édition des ordonnances et des factures conformes.
          </p>

          <div className="login-hero-stats">
            <div>
              <div className="login-hero-stat-v tnum">184</div>
              <div className="login-hero-stat-k">Cabinets au Maroc</div>
            </div>
            <div>
              <div className="login-hero-stat-v tnum">62k</div>
              <div className="login-hero-stat-k">Consultations / mois</div>
            </div>
            <div>
              <div className="login-hero-stat-v tnum">99,98%</div>
              <div className="login-hero-stat-k">Disponibilité</div>
            </div>
          </div>

          <div className="login-hero-footer">
            <span>© 2026 careplus SARL</span>
            <span>·</span>
            <span>Hébergement HDS — Casablanca</span>
            <span>·</span>
            <span>Conforme loi 09-08</span>
          </div>
        </div>
      </div>

      {/* Right: form */}
      <div className="login-form-wrap">
        <form className="login-form" onSubmit={onSubmit} noValidate>
          <div className="login-form-eyebrow">Connexion professionnelle</div>
          <h2 className="login-form-title">Bon retour, docteur.</h2>
          <p className="login-form-sub">
            Accédez à votre cabinet. Vos identifiants sont strictement personnels.
          </p>

          <Field className="login-form-field">
            <label htmlFor="login-email">Adresse email</label>
            <Input
              id="login-email"
              type="email"
              autoComplete="email"
              aria-invalid={!!errors.email}
              aria-describedby={errors.email ? 'login-email-err' : undefined}
              style={{ height: 40 }}
              {...register('email')}
            />
            {errors.email && (
              <div id="login-email-err" className="help" style={{ color: 'var(--danger)' }}>
                {errors.email.message}
              </div>
            )}
          </Field>

          <Field className="login-form-field-tight">
            <label htmlFor="login-password">Mot de passe</label>
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
                aria-label={showPassword ? 'Masquer le mot de passe' : 'Afficher le mot de passe'}
              >
                <Eye />
              </Button>
            </div>
            {errors.password && (
              <div id="login-password-err" className="help" style={{ color: 'var(--danger)' }}>
                {errors.password.message}
              </div>
            )}
          </Field>

          <div className="login-form-row">
            <label className="login-form-remember">
              <input type="checkbox" defaultChecked /> Garder ma session
            </label>
            <a href="#forgot" className="login-form-forgot">
              Mot de passe oublié ?
            </a>
          </div>

          <Button
            type="submit"
            variant="primary"
            size="lg"
            disabled={isSubmitting || loginMutation.isPending}
            style={{ width: '100%', justifyContent: 'center', height: 44, fontSize: 14 }}
          >
            <Lock /> {isSubmitting || loginMutation.isPending ? 'Connexion…' : 'Se connecter'}
          </Button>

          <div className="login-form-separator">
            <div />
            <span>OU</span>
            <div />
          </div>

          <Button style={{ width: '100%', justifyContent: 'center', height: 40 }}>
            Connexion par code SMS envoyé au cabinet
          </Button>

          <div className="login-form-security">
            <span className="login-form-security-ico">
              <Lock />
            </span>
            <div>
              <div className="login-form-security-title">Connexion sécurisée</div>
              <div className="login-form-security-body">
                Vos données patient sont chiffrées et hébergées au Maroc, conformément à la loi
                09-08 sur la protection des données personnelles.
              </div>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}
