import { z } from 'zod';
import {
  ApplicationWriteRequestSchema as SharedApplicationWriteRequestSchema,
  type ApplicationWriteRequest,
} from '@agekey/shared';

// Re-export the canonical request type from @agekey/shared so callers can
// type-check the action payload against the same source of truth.
export type { ApplicationWriteRequest };

export { SharedApplicationWriteRequestSchema };

// Preprocess empty strings to undefined so optional URL/text fields don't
// fail `.url()` / `.min(1)` validation when the user leaves them blank.
// The browser surfaces an empty input as `""`. The Server Action still
// re-validates against the canonical shared schema after stripping blanks.
const emptyToUndefined = (schema: z.ZodTypeAny): z.ZodTypeAny =>
  z.preprocess(
    (val) => (typeof val === 'string' && val.length === 0 ? undefined : val),
    schema,
  );

// Client-side schema mirroring the shared contract but tolerating empty
// strings on optional fields. Slug regex / length constraints are kept
// in sync with the shared definition.
export const ApplicationWriteRequestSchema = z
  .object({
    id: z
      .string()
      .uuid()
      .optional()
      .or(z.literal('').transform(() => undefined)),
    name: z.string().min(1, { message: 'Informe o nome.' }).max(255),
    slug: z
      .string()
      .min(1, { message: 'Informe o slug.' })
      .max(64)
      .regex(/^[a-z0-9][a-z0-9-]{0,62}[a-z0-9]$/, {
        message:
          'Slug deve ser kebab-case (a-z, 0-9, -), iniciar/terminar com alfanumérico.',
      }),
    description: emptyToUndefined(z.string().max(2000).optional()),
    callback_url: emptyToUndefined(
      z.string().url({ message: 'URL inválida.' }).optional(),
    ),
    webhook_url: emptyToUndefined(
      z.string().url({ message: 'URL inválida.' }).optional(),
    ),
    allowed_origins: z
      .array(z.string().url({ message: 'Cada origem precisa ser uma URL.' }))
      .max(50)
      .default([]),
  });
