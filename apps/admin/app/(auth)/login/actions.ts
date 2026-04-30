'use server';

import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { LoginSchema } from '@/lib/validations/auth';

export type LoginActionState = {
  error?: string;
  fieldErrors?: Partial<Record<'email' | 'password', string[]>>;
};

export async function loginAction(
  _prev: LoginActionState,
  formData: FormData,
): Promise<LoginActionState> {
  const parsed = LoginSchema.safeParse({
    email: formData.get('email'),
    password: formData.get('password'),
    next: formData.get('next'),
  });

  if (!parsed.success) {
    return { fieldErrors: parsed.error.flatten().fieldErrors };
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword({
    email: parsed.data.email,
    password: parsed.data.password,
  });

  if (error) {
    // Generic message to avoid disclosing whether the email exists.
    return { error: 'Credenciais inválidas. Tente novamente.' };
  }

  // Don't redirect inside try/catch — Next.js uses a thrown signal.
  redirect(parsed.data.next || '/dashboard');
}
