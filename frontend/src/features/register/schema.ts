import { z } from 'zod';

/**
 * Register form schema. The bootstrap endpoint (POST /api/admin/bootstrap)
 * accepts firstName, lastName, email, password (12-128 chars). The role
 * chip and phone field are surfaced for design parity but only `email`,
 * `firstName`, `lastName`, `password` are sent to the backend.
 */
// i18n (#122) : les `message` portent des CLÉS de traduction (register.err.*),
// résolues au rendu par le composant via `t(errors.<field>.message)`.
export const registerSchema = z
  .object({
    firstName: z
      .string()
      .min(1, 'register.err.firstNameRequired')
      .max(64, 'register.err.firstNameTooLong'),
    lastName: z
      .string()
      .min(1, 'register.err.lastNameRequired')
      .max(64, 'register.err.lastNameTooLong'),
    role: z.enum(['MEDECIN', 'SECRETAIRE', 'GESTIONNAIRE']).default('MEDECIN'),
    email: z
      .string()
      .min(1, 'register.err.emailRequired')
      .email('register.err.emailInvalid')
      .max(255),
    phone: z.string().max(32).optional().or(z.literal('')),
    password: z
      .string()
      .min(12, 'register.err.passwordMin')
      .max(128, 'register.err.passwordMax')
      .regex(/[A-Z]/, 'register.err.passwordUpper')
      .regex(/[0-9]/, 'register.err.passwordDigit'),
    acceptTerms: z.literal(true, {
      errorMap: () => ({ message: 'register.err.terms' }),
    }),
  });

export type RegisterValues = z.infer<typeof registerSchema>;
