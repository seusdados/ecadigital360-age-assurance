import { z } from 'zod';
import {
  WebhookEndpointWriteRequestSchema as SharedWebhookEndpointWriteRequestSchema,
  WEBHOOK_EVENT_TYPES,
  type WebhookEndpointWriteRequest,
  type WebhookEventType,
} from '@agekey/shared';

export type { WebhookEndpointWriteRequest, WebhookEventType };
export { SharedWebhookEndpointWriteRequestSchema, WEBHOOK_EVENT_TYPES };

// Client-side schema mirrors the shared contract but tolerates the empty
// strings React Hook Form likes to send for optional fields.
export const WebhookEndpointWriteRequestSchema = z
  .object({
    id: z
      .string()
      .uuid()
      .optional()
      .or(z.literal('').transform(() => undefined)),
    application_id: z.string().uuid({ message: 'Selecione uma aplicação.' }),
    name: z.string().min(1, { message: 'Informe um nome.' }).max(120),
    url: z
      .string()
      .min(1, { message: 'Informe a URL.' })
      .max(2048)
      .url({ message: 'URL inválida.' }),
    event_types: z
      .array(z.enum(WEBHOOK_EVENT_TYPES as readonly [WebhookEventType, ...WebhookEventType[]]))
      .min(1, { message: 'Selecione ao menos um tipo de evento.' })
      .max(32),
    active: z.boolean().default(true),
  });

export type WebhookFormValues = z.infer<typeof WebhookEndpointWriteRequestSchema>;
