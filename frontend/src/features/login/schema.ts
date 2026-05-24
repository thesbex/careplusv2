import { z } from 'zod';

export const loginSchema = z.object({
  // `.trim()` so a pasted/autofilled email with surrounding whitespace passes
  // validation instead of failing `.email()` — the onSubmit trim then can't fire
  // because handleSubmit gates on zod first.
  email: z.string().trim().email({ message: "Adresse email invalide" }),
  password: z
    .string()
    .min(8, { message: 'Au moins 8 caractères' })
    .max(128, { message: 'Mot de passe trop long' }),
});

export type LoginValues = z.infer<typeof loginSchema>;
