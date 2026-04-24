import { z } from 'zod';

export const loginSchema = z.object({
  email: z.string().email({ message: "Adresse email invalide" }),
  password: z
    .string()
    .min(8, { message: 'Au moins 8 caractères' })
    .max(128, { message: 'Mot de passe trop long' }),
});

export type LoginValues = z.infer<typeof loginSchema>;
