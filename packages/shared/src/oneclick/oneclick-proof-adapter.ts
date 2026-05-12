// OneClick Proof Adapter — Contract-Ready.
//
// **No fake crypto.** Adapter default nega (`feature_disabled`). Para
// curvas BBS+ reais, retorna `ZKP_CURVE_UNSUPPORTED` — comportamento
// idêntico ao `supabase/functions/_shared/adapters/zkp.ts`. Isso garante
// que código de teste ou integração jamais aprove silenciosamente um
// BBS+ que não foi verificado de verdade.
//
// Quando P4 chegar, este adapter delegará para o
// `selectProofVerifier` canônico — preservando interface.

import type { ProofPresentation } from '../proof/types.ts';

export type OneclickProofAdapterReason =
  | 'feature_disabled'
  | 'library_unavailable'
  | 'curve_unsupported'
  | 'scheme_unsupported'
  | 'fake_crypto_refused'
  | 'success';

/**
 * Formatos / curvas BBS+ que exigiriam um verificador BBS+ real. Listados
 * em paralelo com `BBS_FORMATS` em `supabase/functions/_shared/adapters/zkp.ts`.
 * Quando recebidos, o adapter contract-ready DEVE rejeitar com
 * `curve_unsupported`. Nunca tentar aprovar.
 */
export const ONECLICK_BBS_FORMATS: ReadonlyArray<string> = Object.freeze([
  'bls12381-bbs+',
  'bls12381-bbs+-2024',
  'bbs-2023',
  'bls12-381-g1',
]);

export interface OneclickProofProveRequest {
  /** Referência opaca da credential já emitida ao sujeito. */
  readonly credentialRef: string;
  /** Predicado a provar. */
  readonly predicate: string;
  /** Nonce contra replay. */
  readonly nonce: string;
  /** Curva/scheme requisitada pelo solicitante. */
  readonly scheme: string;
}

export interface OneclickProofProveResult {
  readonly produced: boolean;
  readonly reason: OneclickProofAdapterReason;
  /** Referência opaca da prova produzida quando `produced=true`. */
  readonly proofRef?: string;
}

export interface OneclickProofVerifyResult {
  readonly valid: boolean;
  readonly reason: OneclickProofAdapterReason;
}

export interface OneclickProofAdapter {
  prove(
    request: OneclickProofProveRequest,
  ): Promise<OneclickProofProveResult>;
  verify(
    presentation: ProofPresentation,
  ): Promise<OneclickProofVerifyResult>;
}

/**
 * Verifica se um scheme/curva pertence ao conjunto BBS+ que exigiria
 * crypto-core real. Reutilizado pelos testes para garantir que nenhum
 * código aprove BBS+ silenciosamente.
 */
export function isBbsLikeScheme(scheme: string): boolean {
  return ONECLICK_BBS_FORMATS.includes(scheme);
}

/**
 * Adapter padrão que NUNCA aprova prova real. Sempre que recebe um
 * scheme BBS+, devolve `curve_unsupported` — espelha
 * `supabase/functions/_shared/adapters/zkp.ts`. Para qualquer outro
 * scheme, devolve `feature_disabled`.
 */
export const disabledOneclickProofAdapter: OneclickProofAdapter = {
  async prove(
    request: OneclickProofProveRequest,
  ): Promise<OneclickProofProveResult> {
    if (isBbsLikeScheme(request.scheme)) {
      return { produced: false, reason: 'curve_unsupported' };
    }
    return { produced: false, reason: 'feature_disabled' };
  },
  async verify(
    presentation: ProofPresentation,
  ): Promise<OneclickProofVerifyResult> {
    if (isBbsLikeScheme(presentation.scheme)) {
      return { valid: false, reason: 'curve_unsupported' };
    }
    return { valid: false, reason: 'feature_disabled' };
  },
};
