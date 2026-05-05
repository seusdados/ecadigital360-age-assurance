// Edge-side OTP module.
//
// Re-exporta os helpers puros de packages/shared (`generateOtp`,
// `hashOtp`, `hmacContact`, `maskContact`, `normalizeContact`,
// `constantTimeEqual`) e adiciona delivery via provider registry (R5).

export {
  generateOtp,
  hashOtp,
  constantTimeEqual,
  maskContact,
  normalizeContact,
  hmacContact,
} from '../../../../packages/shared/src/parental-consent/otp-utils.ts';

import {
  selectProvider,
  NOOP_PROVIDER_ID,
  type OtpProvider,
} from './otp-providers/index.ts';

export interface OtpDeliveryRequest {
  channel: 'email' | 'phone';
  contactCleartext: string;
  otp: string;
  locale: string;
}

export interface OtpDeliveryResult {
  delivered: boolean;
  provider: string;
  devOtp: string | null;
  providerMessageId?: string;
  errorReason?: string;
}

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

  let provider: OtpProvider;
  provider = selectProvider({
    read: (name: string) => {
      if (name === 'AGEKEY_PARENTAL_CONSENT_OTP_PROVIDER') {
        return env.deliveryProvider;
      }
      return Deno.env.get(name);
    },
  });

  if (provider.id === NOOP_PROVIDER_ID && !env.devReturnOtp) {
    throw new Error(
      'OTP delivery provider is "noop" but AGEKEY_PARENTAL_CONSENT_DEV_RETURN_OTP is off — would silently drop. Configure a real provider before going to production.',
    );
  }

  const result = await provider.send({
    channel: req.channel,
    contact: req.contactCleartext,
    otp: req.otp,
    locale: req.locale,
  });

  return {
    delivered: result.delivered,
    provider: result.providerId,
    devOtp:
      provider.id === NOOP_PROVIDER_ID && env.devReturnOtp ? req.otp : null,
    ...(result.providerMessageId
      ? { providerMessageId: result.providerMessageId }
      : {}),
    ...(result.errorReason ? { errorReason: result.errorReason } : {}),
  };
}
