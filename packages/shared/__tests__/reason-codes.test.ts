import { describe, expect, it } from 'vitest';
import {
  CANONICAL_REASON_CODES,
  FORBIDDEN_REASON_CODE_TERMS,
  LEGACY_REASON_CODES,
} from '../src/taxonomy/index.ts';

describe('Reason Codes — vocabulário proibido', () => {
  it('nenhum reason code canônico contém termos proibidos', () => {
    const allCanonical = Object.values(CANONICAL_REASON_CODES).map((s) =>
      s.toLowerCase(),
    );
    for (const term of FORBIDDEN_REASON_CODE_TERMS) {
      const offending = allCanonical.filter((code) => code.includes(term));
      expect(offending, `term=${term}`).toEqual([]);
    }
  });

  it('nenhum reason code legado contém termos proibidos', () => {
    const allLegacy = Object.values(LEGACY_REASON_CODES).map((s) =>
      s.toLowerCase(),
    );
    for (const term of FORBIDDEN_REASON_CODE_TERMS) {
      const offending = allLegacy.filter((code) => code.includes(term));
      expect(offending, `term=${term}`).toEqual([]);
    }
  });

  it('todos os codes seguem UPPER_SNAKE_CASE com prefixo de grupo', () => {
    const allowedPrefixes = [
      'AGE_',
      'CONSENT_',
      'SAFETY_',
      'POLICY_',
      'GATEWAY_',
      'CREDENTIAL_',
      'ZKP_',
      'PRIVACY_',
      'TOKEN_',
      'WEBHOOK_',
      'RETENTION_',
      'SYSTEM_',
    ];
    for (const code of Object.values(CANONICAL_REASON_CODES)) {
      expect(/^[A-Z][A-Z0-9_]*$/.test(code), `code=${code}`).toBe(true);
      expect(
        allowedPrefixes.some((p) => code.startsWith(p)),
        `code=${code}`,
      ).toBe(true);
    }
  });
});
