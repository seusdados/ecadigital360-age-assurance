// Edge-side OTP module.
//
// Re-exporta os helpers puros de packages/shared (`generateOtp`,
// `hashOtp`, `hmacContact`, `maskContact`, `normalizeContact`,
// `constantTimeEqual`) e adiciona o stub de delivery (Deno-specific).

export {
  generateOtp,
  hashOtp,
  constantTimeEqual,
  maskContact,
  normalizeContact,
  hmacContact,
} from '../../../../packages/shared/src/parental-consent/otp-utils.ts';

export interface OtpDeliveryRequest {
  channel: 'email' | 'phone';
  contactCleartext: string;
  otp: string;
  locale: string;
}

export interface OtpDeliveryResult {
  delivered: boolean;
  /** Provider noop em dev: 'noop'. Provider real: 'smtp' / 'sms'. */
  provider: string;
  /** Devolve o OTP cleartext apenas em dev mode. */
  devOtp: string | null;
}

/**
 * Envia o OTP. Stub.
 *
 * Em dev (`AGEKEY_PARENTAL_CONSENT_DEV_RETURN_OTP=true`), retorna o OTP
 * cleartext na resposta. Em prod, exige provider real configurado e
 * falha explicitamente caso não exista — nunca aprova um fluxo que
 * pretendia entregar OTP sem ter entregue de fato.
 */
export async function deliverOtp(
  req: OtpDeliveryRequest,
  env: {
    devReturnOtp: boolean;
    parentalConsentEnabled: boolean;
    deliveryProvider: string;
  },
): Promise<OtpDeliveryResult> {
  if (!env.parentalConsentEnabled) {
    throw new Error(
      'AGEKEY_PARENTAL_CONSENT_ENABLED is off — refusing to deliver OTP.',
    );
  }

  if (env.deliveryProvider === 'noop') {
    if (!env.devReturnOtp) {
      throw new Error(
        'OTP delivery provider is "noop" but AGEKEY_PARENTAL_CONSENT_DEV_RETURN_OTP is off — would silently drop. Configure a real provider before going to production.',
      );
    }
    return {
      delivered: true,
      provider: 'noop',
      devOtp: req.otp,
    };
  }

  // Outros providers ainda não implementados — falha explícita para
  // evitar simulação de envio.
  throw new Error(
    `OTP delivery provider "${env.deliveryProvider}" is not implemented in this build. Use "noop" with AGEKEY_PARENTAL_CONSENT_DEV_RETURN_OTP=true for development.`,
  );
}
