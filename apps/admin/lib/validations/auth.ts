import { z } from 'zod';

// Shared between client (RHF resolver) and server (Server Action validation).
export const LoginSchema = z.object({
  email: z
    .string()
    .min(1, { message: 'Informe seu e-mail.' })
    .email({ message: 'E-mail inválido.' }),
  password: z
    .string()
    .min(8, { message: 'A senha precisa ter ao menos 8 caracteres.' }),
  next: z.string().optional(),
});

export type LoginInput = z.infer<typeof LoginSchema>;
