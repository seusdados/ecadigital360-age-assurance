/**
 * i18n strings for the AgeKey widget host page.
 *
 * pt-BR is the canonical locale (full strings). en-US and es-ES carry the
 * same keys but may contain TODO placeholders where translation is pending.
 */

export type StageMessages = {
  /** Welcome / introduction screen. */
  intro: {
    title: string;
    body: string;
    start: string;
  };
  /** Consent screen with checkbox. */
  consent: {
    title: string;
    body: string;
    checkboxLabel: string;
    continue: string;
    cancel: string;
  };
  /** Auto-detection of best verification method. */
  method: {
    title: string;
    detecting: string;
  };
  /** Loading / verifying screen. */
  loading: {
    title: string;
    body: string;
  };
  /** Success screen. */
  success: {
    title: string;
    body: string;
    return: string;
  };
  /** Error screen. */
  error: {
    title: string;
    body: string;
    retry: string;
    cancel: string;
  };
  /** Fallback declaration form. */
  fallback: {
    title: string;
    body: string;
    ageCheckLabel: string;
    consentLabel: string;
    submit: string;
  };
};

export type SupportedLocale = 'pt-BR' | 'en-US' | 'es-ES';

export const messages: Record<SupportedLocale, StageMessages> = {
  'pt-BR': {
    intro: {
      title: 'Verificação de idade',
      body: 'Vamos confirmar que você atende ao requisito de idade. Seus dados pessoais não serão armazenados — apenas o resultado da verificação.',
      start: 'Iniciar verificação',
    },
    consent: {
      title: 'Consentimento',
      body: 'Para prosseguir, precisamos do seu consentimento para realizar uma verificação de idade. Nenhum dado pessoal (nome, CPF, data de nascimento) é coletado ou armazenado pela AgeKey — apenas a confirmação de que você atende ao critério.',
      checkboxLabel:
        'Estou ciente e concordo com a verificação de idade conforme descrito.',
      continue: 'Continuar',
      cancel: 'Cancelar',
    },
    method: {
      title: 'Detectando método',
      detecting: 'Procurando o melhor método de verificação para o seu dispositivo...',
    },
    loading: {
      title: 'Verificando',
      body: 'Aguarde enquanto processamos sua verificação...',
    },
    success: {
      title: 'Verificação concluída',
      body: 'A verificação foi realizada com sucesso. Você pode retornar ao site.',
      return: 'Retornar',
    },
    error: {
      title: 'Não foi possível concluir',
      body: 'Ocorreu um erro durante a verificação. Tente novamente ou cancele.',
      retry: 'Tentar novamente',
      cancel: 'Cancelar',
    },
    fallback: {
      title: 'Declaração de idade',
      body: 'Não foi possível encontrar uma carteira digital ou método automático. Para prosseguir, declare e confirme seu consentimento abaixo.',
      ageCheckLabel: 'Declaro que tenho a idade mínima exigida.',
      consentLabel:
        'Concordo com o processamento desta declaração para fins de verificação.',
      submit: 'Enviar declaração',
    },
  },
  'en-US': {
    intro: {
      title: 'Age verification',
      body: "We'll confirm that you meet the age requirement. Your personal data is not stored — only the verification result.",
      start: 'Start verification',
    },
    consent: {
      title: 'Consent',
      body: 'To proceed, we need your consent to perform an age verification. No personal data (name, ID, date of birth) is collected or stored by AgeKey — only the confirmation that you meet the criterion.',
      checkboxLabel:
        'I understand and agree to the age verification as described.',
      continue: 'Continue',
      cancel: 'Cancel',
    },
    method: {
      title: 'Detecting method',
      detecting: 'Looking for the best verification method for your device...',
    },
    loading: {
      title: 'Verifying',
      body: 'Please wait while we process your verification...',
    },
    success: {
      title: 'Verification complete',
      body: 'The verification was successful. You can return to the site.',
      return: 'Return',
    },
    error: {
      title: 'Unable to complete',
      body: 'An error occurred during verification. Please try again or cancel.',
      retry: 'Try again',
      cancel: 'Cancel',
    },
    fallback: {
      title: 'Age declaration',
      body: 'No digital wallet or automatic method was found. To proceed, declare and confirm your consent below.',
      ageCheckLabel: 'I declare that I meet the required minimum age.',
      consentLabel:
        'I agree to the processing of this declaration for verification purposes.',
      submit: 'Submit declaration',
    },
  },
  'es-ES': {
    intro: {
      title: 'Verificación de edad',
      body: 'Confirmaremos que cumples el requisito de edad. Tus datos personales no se almacenan — solo el resultado de la verificación.',
      start: 'Iniciar verificación',
    },
    consent: {
      title: 'Consentimiento',
      body: 'Para continuar, necesitamos tu consentimiento para realizar una verificación de edad. AgeKey no recopila ni almacena datos personales (nombre, documento, fecha de nacimiento) — solo la confirmación de que cumples el criterio.',
      checkboxLabel:
        'Entiendo y acepto la verificación de edad tal como se describe.',
      continue: 'Continuar',
      cancel: 'Cancelar',
    },
    method: {
      title: 'Detectando método',
      detecting:
        'Buscando el mejor método de verificación para tu dispositivo...',
    },
    loading: {
      title: 'Verificando',
      body: 'Espera mientras procesamos tu verificación...',
    },
    success: {
      title: 'Verificación completada',
      body: 'La verificación se realizó correctamente. Puedes volver al sitio.',
      return: 'Volver',
    },
    error: {
      title: 'No se pudo completar',
      body: 'Ocurrió un error durante la verificación. Inténtalo de nuevo o cancela.',
      retry: 'Reintentar',
      cancel: 'Cancelar',
    },
    fallback: {
      title: 'Declaración de edad',
      body: 'No se encontró una cartera digital ni un método automático. Para continuar, declara y confirma tu consentimiento abajo.',
      ageCheckLabel: 'Declaro que tengo la edad mínima requerida.',
      consentLabel:
        'Acepto el procesamiento de esta declaración para fines de verificación.',
      submit: 'Enviar declaración',
    },
  },
};

/**
 * Resolve a {@link StageMessages} bundle from a BCP-47 tag, falling back to
 * pt-BR when the requested locale is not supported.
 */
export function resolveMessages(locale: string | undefined): StageMessages {
  if (!locale) return messages['pt-BR'];
  if (locale in messages) {
    return messages[locale as SupportedLocale];
  }
  // Try a primary-language match (e.g. `en` → `en-US`).
  const primary = locale.split('-')[0];
  if (primary === 'en') return messages['en-US'];
  if (primary === 'es') return messages['es-ES'];
  if (primary === 'pt') return messages['pt-BR'];
  return messages['pt-BR'];
}
