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
import { useRegister } from './hooks/useRegister';
import { registerSchema, type RegisterValues } from './schema';
import { toProblemDetail } from '@/lib/api/problemJson';
import './register.css';

const ROLES: Array<{ key: 'MEDECIN' | 'SECRETAIRE' | 'GESTIONNAIRE'; label: string }> = [
  { key: 'MEDECIN', label: 'Médecin' },
  { key: 'SECRETAIRE', label: 'Secrétaire' },
  { key: 'GESTIONNAIRE', label: 'Gestionnaire' },
];

const BULLETS: Array<{ icon: 'check' | 'clock' | 'lock'; text: string }> = [
  { icon: 'check', text: 'Conforme à la loi 09-08 / CNDP. Hébergement au Maroc.' },
  { icon: 'clock', text: 'Mise en route guidée en 7 étapes — moins de 15 minutes.' },
  { icon: 'lock', text: 'Vos données patient sont chiffrées et strictement privées.' },
];

export default function RegisterPage() {
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
      toast.success('Compte créé. Bienvenue !', {
        description: 'Configurons votre cabinet.',
      });
      navigate('/onboarding', { replace: true });
    } catch (err) {
      const problem = toProblemDetail(err);
      // BOOTSTRAP_LOCKED — DB already has a user, so this install is claimed.
      if (problem.status === 409) {
        toast.error('Cet espace careplus a déjà un administrateur.', {
          description: "Connectez-vous, ou contactez l'administrateur du cabinet pour être invité.",
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
          <div className="register-hero-pill">Demande d&apos;accès praticien</div>
          <h1 className="register-hero-title">
            Votre cabinet, en <em>quelques minutes.</em>
          </h1>
          <p className="register-hero-tagline">
            Créez votre compte praticien. Vous configurerez ensuite votre cabinet, vos médecins,
            vos horaires et vos tarifs — étape par étape.
          </p>

          <div className="register-bullets">
            {BULLETS.map((b) => (
              <div key={b.icon} className="register-bullet">
                <span className="register-bullet-icon" aria-hidden="true">
                  <BulletIcon icon={b.icon} />
                </span>
                <span>{b.text}</span>
              </div>
            ))}
          </div>

          <div className="register-hero-stats">
            <div>
              <div className="register-hero-stat-v tnum">184</div>
              <div className="register-hero-stat-l">Cabinets au Maroc</div>
            </div>
            <div>
              <div className="register-hero-stat-v tnum">62k</div>
              <div className="register-hero-stat-l">Consultations / mois</div>
            </div>
            <div>
              <div className="register-hero-stat-v tnum">99,98%</div>
              <div className="register-hero-stat-l">Disponibilité</div>
            </div>
          </div>
        </div>
      </div>

      <div className="register-form-wrap">
        <div className="register-form-topnav">
          <span>Déjà inscrit&nbsp;?</span>
          <Link to="/login">Se connecter</Link>
          <span style={{ color: 'var(--ink-4)' }}>·</span>
          <span>FR · عر</span>
        </div>

        <form className="register-form" onSubmit={onSubmit} noValidate>
          <h2 className="register-form-title">Créer un compte</h2>
          <p className="register-form-sub">Quelques informations pour commencer.</p>

          <div className="register-form-grid-2">
            <div className="register-form-field" style={{ marginBottom: 0 }}>
              <label htmlFor="reg-firstName">Prénom</label>
              <input id="reg-firstName" type="text" autoComplete="given-name" {...rhfRegister('firstName')} />
              {errors.firstName && <div className="register-form-field-err">{errors.firstName.message}</div>}
            </div>
            <div className="register-form-field" style={{ marginBottom: 0 }}>
              <label htmlFor="reg-lastName">Nom</label>
              <input id="reg-lastName" type="text" autoComplete="family-name" {...rhfRegister('lastName')} />
              {errors.lastName && <div className="register-form-field-err">{errors.lastName.message}</div>}
            </div>
          </div>

          <div className="register-form-field">
            <label>Rôle</label>
            <Controller
              control={control}
              name="role"
              render={({ field }) => (
                <div className="register-form-roles" role="radiogroup" aria-label="Rôle">
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
                      {r.label}
                    </button>
                  ))}
                </div>
              )}
            />
          </div>

          <div className="register-form-field">
            <label htmlFor="reg-email">E-mail professionnel</label>
            <input
              id="reg-email"
              type="email"
              autoComplete="email"
              placeholder="vous@cabinet.ma"
              {...rhfRegister('email')}
            />
            {errors.email && <div className="register-form-field-err">{errors.email.message}</div>}
          </div>

          <div className="register-form-field">
            <label htmlFor="reg-phone">Téléphone</label>
            <div className="register-form-phone">
              <span className="register-form-phone-prefix" aria-hidden="true">+212</span>
              <input id="reg-phone" type="tel" autoComplete="tel" {...rhfRegister('phone')} placeholder="6 12 34 56 78" />
            </div>
            {errors.phone && <div className="register-form-field-err">{errors.phone.message}</div>}
          </div>

          <div className="register-form-field" style={{ marginBottom: 0 }}>
            <label htmlFor="reg-password">Mot de passe</label>
            <input
              id="reg-password"
              type={showPassword ? 'text' : 'password'}
              autoComplete="new-password"
              {...rhfRegister('password')}
            />
            {errors.password && <div className="register-form-field-err">{errors.password.message}</div>}
          </div>
          <div className="register-form-password-help">
            Minimum 12 caractères, dont une majuscule et un chiffre.
          </div>

          <label className="register-form-terms">
            <input type="checkbox" {...rhfRegister('acceptTerms')} />
            <span>
              J&apos;accepte les <a href="#cgu">conditions d&apos;utilisation</a> et la{' '}
              <a href="#privacy">politique de confidentialité</a>.
            </span>
          </label>
          {errors.acceptTerms && (
            <div className="register-form-field-err" style={{ marginTop: -16, marginBottom: 12 }}>
              {errors.acceptTerms.message}
            </div>
          )}

          <button
            type="submit"
            className="register-form-submit"
            disabled={isSubmitting || registerMutation.isPending}
          >
            {isSubmitting || registerMutation.isPending ? 'Création…' : 'Créer mon compte →'}
          </button>

          <div className="register-form-footer-note">
            Un conseiller pourra prendre contact avec vous sous 24 h pour finaliser votre accès.
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
