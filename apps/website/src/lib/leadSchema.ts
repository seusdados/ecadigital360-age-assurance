import { z } from 'zod';

// Hard-rejects payload patterns that look like personal documents or
// sensitive identifiers. AgeKey is not a KYC service, so the public lead
// form must never become a channel for personal data.
const SENSITIVE_PATTERNS: Array<{ pattern: RegExp; label: string }> = [
  { pattern: /\b\d{3}[\s.-]?\d{3}[\s.-]?\d{3}[\s.-]?\d{2}\b/, label: 'CPF' },
  { pattern: /\b\d{2}[\s.-]?\d{3}[\s.-]?\d{3}[\s.-]?\d{4}[\s.-]?\d{2}\b/, label: 'CNPJ' },
  { pattern: /\b\d{1,2}\/\d{1,2}\/\d{2,4}\b/, label: 'data de nascimento' },
  { pattern: /\bpassaporte\b/i, label: 'passaporte' },
  { pattern: /\bselfie\b/i, label: 'selfie' },
  { pattern: /\bbiometria\b/i, label: 'biometria' },
];

export function findSensitive(input: string): string | null {
  for (const { pattern, label } of SENSITIVE_PATTERNS) {
    if (pattern.test(input)) return label;
  }
  return null;
}

export const POLICY_OPTIONS = [
  '13+',
  '16+',
  '18+',
  '21+',
  'faixa etária',
  'outra',
] as const;

export const CHANNEL_OPTIONS = [
  'API',
  'widget',
  'SDK',
  'white-label',
  'não sei ainda',
] as const;

export const SEGMENT_OPTIONS = [
  'plataforma digital',
  'edtech',
  'marketplace',
  'publisher / conteúdo',
  'jogos / comunidade',
  'app de saúde / serviços',
  'outro',
] as const;

export const leadSchema = z.object({
  name: z.string().trim().min(2, 'Informe seu nome.').max(120),
  email: z.string().trim().email('Email inválido.').max(180),
  company: z.string().trim().min(1, 'Informe a empresa.').max(160),
  role: z.string().trim().min(1, 'Informe o cargo.').max(120),
  website: z.string().trim().url('URL inválida.').max(240).optional().or(z.literal('')),
  segment: z.enum(SEGMENT_OPTIONS),
  monthlyVolume: z.string().trim().min(1, 'Informe o volume estimado.').max(60),
  policies: z
    .array(z.enum(POLICY_OPTIONS))
    .min(1, 'Selecione ao menos uma política.'),
  channel: z.enum(CHANNEL_OPTIONS),
  message: z
    .string()
    .trim()
    .max(2000)
    .optional()
    .or(z.literal(''))
    .superRefine((value, ctx) => {
      if (!value) return;
      const found = findSensitive(value);
      if (found) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: `Não envie ${found} ou outros dados pessoais neste formulário.`,
        });
      }
    }),
  source: z.enum(['contato', 'demo']),
});

export type LeadInput = z.infer<typeof leadSchema>;
