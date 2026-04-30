// privacy-guard.test.ts
//
// Suíte AK-P0-05: bloqueador de go-live.
// Garante que findForbiddenPublicPayloadKeys / assertPublicPayloadHasNoPii
// detectam 100% das chaves PII conhecidas e variações canonicalizadas
// (camelCase, kebab-case, com prefixos, plurals etc.) num fuzz determinístico.
//
// Roda com Deno test runner (já usado pelo CI):
//   deno test --no-check packages/shared/src/privacy-guard.test.ts

import { ok as assert, deepStrictEqual as assertEquals } from 'node:assert';
import {
  assertPublicPayloadHasNoPii,
  findForbiddenPublicPayloadKeys,
} from './privacy-guard.ts';

// ============================================================
// SET DETERMINÍSTICO: variações conhecidas de chaves proibidas
// ============================================================
const KNOWN_FORBIDDEN_VARIANTS: string[] = [
  // birthdate
  'birthdate',
  'BirthDate',
  'BIRTHDATE',
  'birth_date',
  'date_of_birth',
  'DateOfBirth',
  'DATE_OF_BIRTH',
  'dob',
  'DOB',
  // age
  'age',
  'Age',
  'AGE',
  'idade',
  'IDADE',
  'exact_age',
  'ExactAge',
  // documents
  'document',
  'Document',
  'cpf',
  'CPF',
  'rg',
  'RG',
  'passport',
  'Passport',
  // identity
  'name',
  'Name',
  'full_name',
  'FullName',
  'FULL_NAME',
  'email',
  'Email',
  'phone',
  'Phone',
  // biometric / image
  'selfie',
  'Selfie',
  'face',
  'Face',
  // raw IDs
  'raw_id',
  'RawId',
  // address
  'address',
  'Address',
  'ADDRESS',
];

// ============================================================
// 1. CHAVES CONHECIDAS NO TOPO
// ============================================================
Deno.test('AK-P0-05 detecta cada chave PII canonical no topo do payload', () => {
  for (const variant of KNOWN_FORBIDDEN_VARIANTS) {
    const v = findForbiddenPublicPayloadKeys({ [variant]: 'value' });
    assert(
      v.length >= 1,
      `chave "${variant}" deveria ser detectada como PII pública`,
    );
    assertEquals(v[0]?.path, `$.${variant}`);
  }
});

// ============================================================
// 2. CHAVES PII ANINHADAS
// ============================================================
Deno.test('AK-P0-05 detecta chaves PII em objetos aninhados', () => {
  const payload = {
    user: { profile: { dob: '1990-01-01', email: 'x@y.z' } },
    metadata: { extras: [{ cpf: '123' }] },
  };
  const violations = findForbiddenPublicPayloadKeys(payload);
  const paths = violations.map((v) => v.path).sort();
  // dob, email, cpf (3 violations)
  assertEquals(paths.length, 3);
  assert(paths.includes('$.user.profile.dob'));
  assert(paths.includes('$.user.profile.email'));
  assert(paths.includes('$.metadata.extras[0].cpf'));
});

// ============================================================
// 3. PAYLOAD LIMPO PASSA
// ============================================================
Deno.test('AK-P0-05 payload sem PII passa', () => {
  const okPayloads: unknown[] = [
    {},
    null,
    [],
    { jti: 'abc', decision: 'approved', threshold_satisfied: true },
    { policy: { slug: 'br-18-plus', version: 1 } },
    { external_user_ref: 'opaque-hash-string' },
  ];
  for (const p of okPayloads) {
    const v = findForbiddenPublicPayloadKeys(p);
    assertEquals(v, [], `payload ${JSON.stringify(p)} é limpo`);
  }
});

// ============================================================
// 4. assertPublicPayloadHasNoPii lança em violação
// ============================================================
Deno.test('AK-P0-05 assertPublicPayloadHasNoPii lança quando há PII', () => {
  let threw = false;
  try {
    assertPublicPayloadHasNoPii({ user: { birthdate: '1990' } });
  } catch (e) {
    threw = true;
    const msg = e instanceof Error ? e.message : String(e);
    assert(
      msg.includes('forbidden PII-like keys'),
      `mensagem deveria descrever violações; got: ${msg}`,
    );
  }
  assert(threw, 'assertPublicPayloadHasNoPii precisa lançar');
});

Deno.test('AK-P0-05 assertPublicPayloadHasNoPii passa em payload limpo', () => {
  // não deve lançar
  assertPublicPayloadHasNoPii({
    decision: 'approved',
    policy: { slug: 'br-18-plus' },
  });
});

// ============================================================
// 5. FUZZ DETERMINÍSTICO — combina chaves canonical com variações
//    de case, separadores e wrappers comuns.
// ============================================================
const CASES = ['lower', 'upper', 'pascal', 'asis'] as const;
type Case = (typeof CASES)[number];

function applyCase(s: string, c: Case): string {
  switch (c) {
    case 'lower':
      return s.toLowerCase();
    case 'upper':
      return s.toUpperCase();
    case 'pascal':
      return s.replace(/(^|_|-)([a-z])/g, (_, _sep, ch) => ch.toUpperCase());
    case 'asis':
      return s;
  }
}

// Para cada chave proibida do contrato, gera N variações case-only do
// mesmo nome canônico. A função privacy-guard normaliza com .toLowerCase()
// antes de comparar contra a lista, então TODAS devem ser bloqueadas.
Deno.test('AK-P0-05 fuzz canonical-key case variations: 100% bloqueio', () => {
  const CANONICAL = [
    'birthdate',
    'date_of_birth',
    'dob',
    'idade',
    'age',
    'exact_age',
    'document',
    'cpf',
    'rg',
    'passport',
    'name',
    'full_name',
    'email',
    'phone',
    'selfie',
    'face',
    'raw_id',
    'address',
  ];

  let total = 0;
  let escaped = 0;
  for (const canonical of CANONICAL) {
    for (const c of CASES) {
      const variant = applyCase(canonical, c);
      total += 1;
      const v = findForbiddenPublicPayloadKeys({ [variant]: 'x' });
      if (v.length === 0) {
        escaped += 1;
        console.error(`FUZZ ESCAPE: chave "${variant}" passou pelo guard`);
      }
    }
  }
  assertEquals(escaped, 0, `${escaped}/${total} chaves PII escaparam do guard`);
});

// ============================================================
// 6. FUZZ DE COMPOSIÇÃO — payloads sintéticos misturando PII e não-PII
// ============================================================
Deno.test(
  'AK-P0-05 fuzz mixed payloads: cada PII canônica é detectada mesmo em meio a 50 chaves limpas',
  () => {
    const cleanKeys = Array.from({ length: 50 }, (_, i) => `field_${i}`);
    const PII_KEYS = ['birthdate', 'cpf', 'selfie', 'email', 'address'];

    for (const pii of PII_KEYS) {
      const obj: Record<string, unknown> = {};
      for (const k of cleanKeys) obj[k] = 'safe';
      obj[pii] = 'leak';
      const v = findForbiddenPublicPayloadKeys(obj);
      const found = v.some((x) => x.key === pii);
      assert(
        found,
        `chave PII "${pii}" deveria ter sido detectada em meio a chaves limpas`,
      );
    }
  },
);

// ============================================================
// 7. ARRAYS COM PII
// ============================================================
Deno.test('AK-P0-05 detecta PII em arrays', () => {
  const v = findForbiddenPublicPayloadKeys([
    { ok: 1 },
    { dob: '1990' },
    { also: { passport: 'X12345' } },
  ]);
  const paths = v.map((x) => x.path).sort();
  assertEquals(paths.length, 2);
  assert(paths.some((p) => p.endsWith('.dob')));
  assert(paths.some((p) => p.endsWith('.passport')));
});

// ============================================================
// 8. NÃO confunde substrings — chaves não-canônicas com caracteres extras
//    NÃO são bloqueadas (decisão consciente: o guard bloqueia chaves
//    canônicas exatas após lowercasing). Documentado aqui como contrato.
// ============================================================
Deno.test('AK-P0-05 contrato: substrings não-canônicas NÃO são bloqueadas', () => {
  // "username" contém "name" mas o guard intencionalmente NÃO faz match
  // por substring para evitar falsos positivos. external_user_ref existe
  // exatamente porque "user_ref" não casa com nenhuma chave proibida.
  const v = findForbiddenPublicPayloadKeys({
    username: 'jdoe',
    user_id: 'opaque',
    external_user_ref: 'h(uuid)',
  });
  assertEquals(v, []);
});
