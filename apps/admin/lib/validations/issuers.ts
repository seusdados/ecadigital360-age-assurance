import { z } from 'zod';

/**
 * Mirrors IssuerRegisterInput in lib/agekey/client.ts. Shared between
 * client (RHF resolver) and server (Server Action validation).
 */

export const ISSUER_FORMATS = [
  'w3c_vc',
  'sd_jwt_vc',
  'attestation',
  'predicate-attestation-v1',
] as const;
export type IssuerFormat = (typeof ISSUER_FORMATS)[number];

// did:web, did:key, did:jwk are the realistic shapes for now.
const DID_REGEX = /^did:[a-z0-9]+:[A-Za-z0-9._%:-]+$/;

function parseOptionalJsonObject(
  raw: string | undefined,
  ctx: z.RefinementCtx,
): Record<string, unknown> | undefined {
  if (!raw || raw.trim() === '') return undefined;
  try {
    const parsed: unknown = JSON.parse(raw);
    if (
      parsed === null ||
      typeof parsed !== 'object' ||
      Array.isArray(parsed)
    ) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Informe um objeto JSON válido.',
      });
      return z.NEVER;
    }
    return parsed as Record<string, unknown>;
  } catch {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'JSON inválido.',
    });
    return z.NEVER;
  }
}

export const IssuerFormSchema = z
  .object({
    issuer_did: z
      .string()
      .min(1, { message: 'Informe o DID do emissor.' })
      .max(512, { message: 'DID muito longo.' })
      .regex(DID_REGEX, {
        message: 'Formato inválido. Ex.: did:web:exemplo.com',
      }),
    name: z
      .string()
      .min(1, { message: 'Informe um nome.' })
      .max(200, { message: 'Nome muito longo.' }),
    supports_formats: z
      .array(z.enum(ISSUER_FORMATS))
      .min(1, { message: 'Selecione ao menos um formato.' }),
    jwks_uri: z
      .string()
      .url({ message: 'Informe uma URL válida.' })
      .optional()
      .or(z.literal('').transform(() => undefined)),
    public_keys_json_raw: z.string().optional(),
    metadata_json_raw: z.string().optional(),
  })
  .transform((data, ctx) => {
    const public_keys_json = parseOptionalJsonObject(
      data.public_keys_json_raw,
      ctx,
    );
    const metadata_json = parseOptionalJsonObject(data.metadata_json_raw, ctx);
    return {
      issuer_did: data.issuer_did,
      name: data.name,
      supports_formats: data.supports_formats,
      jwks_uri: data.jwks_uri,
      public_keys_json,
      metadata_json,
    };
  });

export type IssuerFormInput = z.input<typeof IssuerFormSchema>;
export type IssuerFormOutput = z.output<typeof IssuerFormSchema>;
