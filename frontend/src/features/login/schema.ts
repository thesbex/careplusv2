import { z } from 'zod';

// i18n (#122) : zod tourne au chargement du module, avant tout contexte React.
// On y stocke des CLÉS de traduction (login.err.*) que le composant résout au
// rendu via `t(errors.<field>.message)`.
export const loginSchema = z.object({
  // `.trim()` so a pasted/autofilled email with surrounding whitespace passes
  // validation instead of failing `.email()` — the onSubmit trim then can't fire
  // because handleSubmit gates on zod first.
  email: z.string().trim().email({ message: 'login.err.email' }),
  password: z
    .string()
    .min(8, { message: 'login.err.password.min' })
    .max(128, { message: 'login.err.password.max' }),
});

export type LoginValues = z.infer<typeof loginSchema>;
