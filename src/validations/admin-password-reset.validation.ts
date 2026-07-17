import { z } from 'zod';

const normalizeEmail = (value: string) => value.trim().toLowerCase();

export const forgotAdminPasswordSchema = z.object({
  email: z
    .string()
    .transform(normalizeEmail)
    .pipe(z.string().email("L'adresse email est invalide")),
});

export type ForgotAdminPasswordInput = z.infer<typeof forgotAdminPasswordSchema>;
