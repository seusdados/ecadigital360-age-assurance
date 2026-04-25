import { z } from 'zod';

export const VerificationMethodSchema = z.enum([
  'zkp',
  'vc',
  'gateway',
  'fallback',
]);

export const AssuranceLevelSchema = z.enum(['low', 'substantial', 'high']);

export const VerificationDecisionSchema = z.enum([
  'approved',
  'denied',
  'needs_review',
]);

export const SessionStatusSchema = z.enum([
  'pending',
  'in_progress',
  'completed',
  'expired',
  'cancelled',
]);

export const UuidSchema = z.string().uuid();

export const LocaleSchema = z
  .string()
  .regex(/^[a-z]{2}(-[A-Z]{2})?$/)
  .default('pt-BR');

export const JurisdictionCodeSchema = z
  .string()
  .regex(/^[A-Z]{2}(-[A-Z0-9]{1,3})?$/);

export const ClientCapabilitiesSchema = z
  .object({
    digital_credentials_api: z.boolean().optional(),
    wallet_present: z.boolean().optional(),
    webauthn: z.boolean().optional(),
    user_agent: z.string().max(512).optional(),
    platform: z.enum(['web', 'ios', 'android']).optional(),
  })
  .strict()
  .default({});
