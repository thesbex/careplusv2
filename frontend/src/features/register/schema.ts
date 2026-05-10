import { z } from 'zod';

/**
 * Register form schema. The bootstrap endpoint (POST /api/admin/bootstrap)
 * accepts firstName, lastName, email, password (12-128 chars). The role
 * chip and phone field are surfaced for design parity but only `email`,
 * `firstName`, `lastName`, `password` are sent to the backend.
 */
export const registerSchema = z
  .object({
    firstName: z
      .string()
      .min(1, 'Prénom requis.')
      .max(64, 'Prénom trop long.'),
    lastName: z
      .string()
      .min(1, 'Nom requis.')
      .max(64, 'Nom trop long.'),
    role: z.enum(['MEDECIN', 'SECRETAIRE', 'GESTIONNAIRE']).default('MEDECIN'),
    email: z
      .string()
      .min(1, 'Email requis.')
      .email('Adresse email invalide.')
      .max(255),
    phone: z.string().max(32).optional().or(z.literal('')),
    password: z
      .string()
      .min(12, 'Au moins 12 caractères.')
      .max(128, 'Mot de passe trop long.')
      .regex(/[A-Z]/, 'Au moins une majuscule.')
      .regex(/[0-9]/, 'Au moins un chiffre.'),
    acceptTerms: z.literal(true, {
      errorMap: () => ({ message: "Vous devez accepter les conditions d'utilisation." }),
    }),
  });

export type RegisterValues = z.infer<typeof registerSchema>;
