// rls-cross-tenant.test.ts
//
// Suíte AK-P0-04: bloqueador de go-live.
// Garante que RLS isola completamente dois tenants A e B em todas as
// tabelas sensíveis. Qualquer leitura/escrita cross-tenant deve retornar
// 0 rows ou falhar com erro de permissão (42501) — nunca retornar dado.
//
// Pré-requisitos:
//   - Postgres com migrations 000..016 aplicadas (via supabase db reset).
//   - Seed _rls_seed.sql aplicado ao mesmo DB.
//   - Variável de ambiente TEST_DATABASE_URL apontando para o DB de teste.
//     (Em CI, usar postgres://postgres:postgres@127.0.0.1:54322/postgres
//     do supabase start.)
//
// Run:
//   deno test --allow-net --allow-env --no-check \
//     supabase/functions/_tests/rls-cross-tenant.test.ts
//
// IMPORTANTE: nenhum SUPABASE_SERVICE_ROLE_KEY é commitado. A conexão
// usa o superuser local do Supabase (postgres/postgres) — credencial
// pública conhecida do stack local, jamais usada em produção.

import { ok as assert, deepStrictEqual as assertEquals } from 'node:assert';
import { Client } from 'https://deno.land/x/postgres@v0.19.3/mod.ts';

const DATABASE_URL = Deno.env.get('TEST_DATABASE_URL');
if (!DATABASE_URL) {
  throw new Error(
    'TEST_DATABASE_URL not set — required for cross-tenant RLS suite. ' +
      'Local: postgres://postgres:postgres@127.0.0.1:54322/postgres',
  );
}

// IDs sincronizados com _rls_seed.sql
const TENANT_A = 'aaaaaaaa-0000-7000-8000-000000000001';
const TENANT_B = 'bbbbbbbb-0000-7000-8000-000000000002';
const USER_A = '11111111-1111-7111-8111-111111111111';
const USER_B = '22222222-2222-7222-8222-222222222222';

const APP_A = 'aaaaaaaa-1000-7000-8000-000000000001';
const APP_B = 'bbbbbbbb-1000-7000-8000-000000000002';
const POLICY_A = 'aaaaaaaa-2000-7000-8000-000000000001';
const POLICY_B = 'bbbbbbbb-2000-7000-8000-000000000002';
const SESSION_A = 'aaaaaaaa-3000-7000-8000-000000000001';
const SESSION_B = 'bbbbbbbb-3000-7000-8000-000000000002';

interface AuthCtx {
  tenantId: string;
  userId: string;
}

// Parse postgres://user:pass@host:port/db into deno-postgres ClientOptions
// para que possamos forçar `tls.enabled = false` (postgres vanilla local
// não tem cert; deno-postgres tenta TLS por padrão e v0.19.x trava em
// ambiente sem cert).
function parsePgUrl(url: string) {
  const u = new URL(url);
  return {
    hostname: u.hostname,
    port: u.port ? Number(u.port) : 5432,
    user: decodeURIComponent(u.username),
    password: decodeURIComponent(u.password),
    database: u.pathname.replace(/^\//, '') || 'postgres',
    tls: { enabled: false },
  };
}

const PG_OPTIONS = parsePgUrl(DATABASE_URL);

async function newClient(): Promise<Client> {
  const c = new Client(PG_OPTIONS);
  try {
    await c.connect();
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error(
      `[rls-test] failed to connect to ${PG_OPTIONS.hostname}:${PG_OPTIONS.port} as ${PG_OPTIONS.user}: ${msg}`,
    );
    throw e;
  }
  return c;
}

// Roda uma function dentro de uma transação simulando o ambiente
// Edge Function: role=authenticated, request.jwt.claims setado, e
// app.current_tenant_id apontando para o tenant do usuário.
//
// O SET LOCAL é descartado pelo ROLLBACK, garantindo isolamento entre testes.
async function withAuthContext<T>(
  ctx: AuthCtx,
  fn: (c: Client) => Promise<T>,
): Promise<T> {
  const c = await newClient();
  try {
    try {
      await c.queryArray('BEGIN');
      await c.queryArray('SET LOCAL ROLE authenticated');
      await c.queryArray(
        `SET LOCAL request.jwt.claims = '${JSON.stringify({
          sub: ctx.userId,
          role: 'authenticated',
        })}'`,
      );
      await c.queryArray(
        `SET LOCAL app.current_tenant_id = '${ctx.tenantId}'`,
      );
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      console.error(
        `[rls-test] withAuthContext setup failed (tenant=${ctx.tenantId}): ${msg}`,
      );
      throw e;
    }
    const result = await fn(c);
    await c.queryArray('ROLLBACK');
    return result;
  } finally {
    await c.end();
  }
}

// Helper: conta linhas de uma query escalar SELECT count(*)
async function countRows(
  c: Client,
  sql: string,
  args: unknown[] = [],
): Promise<number> {
  try {
    const r = await c.queryObject<{ count: bigint | string }>(sql, args);
    const v = r.rows[0]?.count;
    return typeof v === 'bigint' ? Number(v) : Number(v ?? 0);
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error(`[rls-test] countRows query failed: ${msg}\n  sql: ${sql}\n  args: ${JSON.stringify(args)}`);
    throw e;
  }
}

// Helper: tentar UPDATE/DELETE — retorna número de linhas afetadas. Captura
// erros de permissão (42501) como "0 linhas, bloqueado por RLS".
async function tryWrite(
  c: Client,
  sql: string,
  args: unknown[] = [],
): Promise<{ affected: number; error?: string }> {
  try {
    const r = await c.queryArray(sql, args);
    return { affected: r.rowCount ?? 0 };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return { affected: 0, error: msg };
  }
}

// ============================================================
// SUITE
// ============================================================

Deno.test('AK-P0-04 RLS cross-tenant — pré-condição: seed inserido para A e B', async () => {
  const c = await newClient();
  try {
    const a = await countRows(
      c,
      'SELECT count(*) FROM tenants WHERE id = $1',
      [TENANT_A],
    );
    const b = await countRows(
      c,
      'SELECT count(*) FROM tenants WHERE id = $1',
      [TENANT_B],
    );
    assertEquals(a, 1, 'tenant A presente no seed');
    assertEquals(b, 1, 'tenant B presente no seed');
  } finally {
    await c.end();
  }
});

Deno.test('AK-P0-04 SELECT cross-tenant em verification_sessions retorna 0 rows', async () => {
  await withAuthContext({ tenantId: TENANT_A, userId: USER_A }, async (c) => {
    const cnt = await countRows(
      c,
      'SELECT count(*) FROM verification_sessions WHERE tenant_id = $1',
      [TENANT_B],
    );
    assertEquals(cnt, 0, 'tenant A NÃO pode enxergar sessão de B');
    const cntById = await countRows(
      c,
      'SELECT count(*) FROM verification_sessions WHERE id = $1',
      [SESSION_B],
    );
    assertEquals(cntById, 0, 'lookup pelo PK também é bloqueado');
  });

  await withAuthContext({ tenantId: TENANT_B, userId: USER_B }, async (c) => {
    const cnt = await countRows(
      c,
      'SELECT count(*) FROM verification_sessions WHERE tenant_id = $1',
      [TENANT_A],
    );
    assertEquals(cnt, 0, 'tenant B NÃO pode enxergar sessão de A');
  });
});

Deno.test('AK-P0-04 SELECT cross-tenant em verification_results retorna 0 rows', async () => {
  await withAuthContext({ tenantId: TENANT_A, userId: USER_A }, async (c) => {
    const cnt = await countRows(
      c,
      'SELECT count(*) FROM verification_results WHERE tenant_id = $1',
      [TENANT_B],
    );
    assertEquals(cnt, 0);
  });
});

Deno.test('AK-P0-04 SELECT cross-tenant em result_tokens retorna 0 rows', async () => {
  await withAuthContext({ tenantId: TENANT_A, userId: USER_A }, async (c) => {
    const cnt = await countRows(
      c,
      'SELECT count(*) FROM result_tokens WHERE tenant_id = $1',
      [TENANT_B],
    );
    assertEquals(cnt, 0);
  });
});

Deno.test('AK-P0-04 SELECT cross-tenant em applications retorna 0 rows', async () => {
  await withAuthContext({ tenantId: TENANT_A, userId: USER_A }, async (c) => {
    const cnt = await countRows(
      c,
      'SELECT count(*) FROM applications WHERE tenant_id = $1',
      [TENANT_B],
    );
    assertEquals(cnt, 0);
  });
});

Deno.test('AK-P0-04 SELECT cross-tenant em policies retorna 0 rows', async () => {
  await withAuthContext({ tenantId: TENANT_A, userId: USER_A }, async (c) => {
    // Policies de B não-template. Como is_template = false, RLS bloqueia.
    const cnt = await countRows(
      c,
      'SELECT count(*) FROM policies WHERE tenant_id = $1 AND is_template = false',
      [TENANT_B],
    );
    assertEquals(cnt, 0);
  });
});

Deno.test('AK-P0-04 SELECT cross-tenant em issuers (escopo tenant) retorna 0 rows', async () => {
  await withAuthContext({ tenantId: TENANT_A, userId: USER_A }, async (c) => {
    // issuers com tenant_id IS NULL são globais (visíveis a todos);
    // issuers com tenant_id = B só devem aparecer para B.
    const cnt = await countRows(
      c,
      'SELECT count(*) FROM issuers WHERE tenant_id = $1',
      [TENANT_B],
    );
    assertEquals(cnt, 0);
  });
});

Deno.test('AK-P0-04 UPDATE cross-tenant em policies não afeta linhas de outro tenant', async () => {
  await withAuthContext({ tenantId: TENANT_A, userId: USER_A }, async (c) => {
    const r = await tryWrite(
      c,
      "UPDATE policies SET name = 'pwn' WHERE id = $1",
      [POLICY_B],
    );
    assertEquals(r.affected, 0, 'UPDATE em policy de B é bloqueado');
  });

  // Confirma fora da transação que o nome de B não mudou
  const c = await newClient();
  try {
    const r = await c.queryObject<{ name: string }>(
      'SELECT name FROM policies WHERE id = $1',
      [POLICY_B],
    );
    assertEquals(r.rows[0]?.name, 'B 18+');
  } finally {
    await c.end();
  }
});

Deno.test('AK-P0-04 UPDATE cross-tenant em applications não afeta linhas de outro tenant', async () => {
  await withAuthContext({ tenantId: TENANT_A, userId: USER_A }, async (c) => {
    const r = await tryWrite(
      c,
      "UPDATE applications SET name = 'pwn' WHERE id = $1",
      [APP_B],
    );
    assertEquals(r.affected, 0);
  });
});

Deno.test('AK-P0-04 DELETE cross-tenant em policies / applications é bloqueado', async () => {
  await withAuthContext({ tenantId: TENANT_A, userId: USER_A }, async (c) => {
    const r1 = await tryWrite(c, 'DELETE FROM policies WHERE id = $1', [
      POLICY_B,
    ]);
    assertEquals(r1.affected, 0);
    const r2 = await tryWrite(c, 'DELETE FROM applications WHERE id = $1', [
      APP_B,
    ]);
    assertEquals(r2.affected, 0);
  });
});

Deno.test('AK-P0-04 INSERT de nonce do tenant A em sessão do tenant B é bloqueado', async () => {
  // verification_challenges tem RLS WITH CHECK (false) para usuários comuns
  // (apenas service_role). O teste confirma que mesmo com app.current_tenant_id
  // do A, não conseguimos plantar nonce numa sessão de B.
  await withAuthContext({ tenantId: TENANT_A, userId: USER_A }, async (c) => {
    const r = await tryWrite(
      c,
      `INSERT INTO verification_challenges (session_id, nonce)
       VALUES ($1, $2)`,
      [SESSION_B, 'malicious-nonce-from-a'],
    );
    assertEquals(
      r.affected,
      0,
      'INSERT em verification_challenges deve ser bloqueado por RLS WITH CHECK (false)',
    );
    assert(
      r.error !== undefined ||
        (await countRows(
          c,
          'SELECT count(*) FROM verification_challenges WHERE nonce = $1',
          ['malicious-nonce-from-a'],
        )) === 0,
      'nonce malicioso não pode ter sido persistido',
    );
  });
});

Deno.test('AK-P0-04 listar audit_events cross-tenant retorna 0 rows', async () => {
  // audit_events_select exige has_role('auditor'). A nossa fixture não dá
  // 'auditor' a USER_A nem USER_B, então qualquer SELECT retorna 0 — em
  // qualquer hipótese cross-tenant também falha. Testamos os dois caminhos.
  await withAuthContext({ tenantId: TENANT_A, userId: USER_A }, async (c) => {
    const cnt = await countRows(
      c,
      'SELECT count(*) FROM audit_events WHERE tenant_id = $1',
      [TENANT_B],
    );
    assertEquals(cnt, 0);
  });

  // Promove A->auditor temporariamente para isolar a verificação ao papel
  // sem afetar o cross-tenant: mesmo como auditor de A, não enxerga B.
  const admin = await newClient();
  try {
    await admin.queryArray(
      `UPDATE tenant_users SET role = 'auditor'
       WHERE tenant_id = $1 AND user_id = $2`,
      [TENANT_A, USER_A],
    );
  } finally {
    await admin.end();
  }
  try {
    await withAuthContext(
      { tenantId: TENANT_A, userId: USER_A },
      async (c) => {
        const cnt = await countRows(
          c,
          'SELECT count(*) FROM audit_events WHERE tenant_id = $1',
          [TENANT_B],
        );
        assertEquals(
          cnt,
          0,
          'auditor de A NÃO pode enxergar audit_events de B',
        );
      },
    );
  } finally {
    const r = await newClient();
    try {
      await r.queryArray(
        `UPDATE tenant_users SET role = 'admin'
         WHERE tenant_id = $1 AND user_id = $2`,
        [TENANT_A, USER_A],
      );
    } finally {
      await r.end();
    }
  }
});

Deno.test('AK-P0-04 proof_artifacts (getArtifactUrl base) cross-tenant retorna 0 rows', async () => {
  // O teste de `getArtifactUrl` cross-tenant — Edge Function consulta
  // proof_artifacts ANTES de assinar URL do Storage. Se RLS já bloqueia
  // a leitura cross-tenant, o signer nunca recebe path para assinar.
  // Aqui validamos a base de dados; o teste end-to-end do edge fn fica
  // em supabase/functions/_tests/proof-artifact-url.test.ts (futuro).
  const seed = await newClient();
  try {
    await seed.queryArray(
      `INSERT INTO proof_artifacts (
         id, session_id, tenant_id, adapter_method, artifact_hash, storage_path
       ) VALUES
         ('aaaaaaaa-8000-7000-8000-000000000001',
          $1, $2, 'fallback', 'a-hash-1', $2 || '/' || $1 || '/a'),
         ('bbbbbbbb-8000-7000-8000-000000000002',
          $3, $4, 'fallback', 'b-hash-2', $4 || '/' || $3 || '/b')
       ON CONFLICT (id) DO NOTHING`,
      [SESSION_A, TENANT_A, SESSION_B, TENANT_B],
    );
  } finally {
    await seed.end();
  }

  // Promove A->auditor (RLS exige 'auditor' para SELECT em proof_artifacts)
  const admin = await newClient();
  try {
    await admin.queryArray(
      `UPDATE tenant_users SET role = 'auditor'
       WHERE tenant_id = $1 AND user_id = $2`,
      [TENANT_A, USER_A],
    );
  } finally {
    await admin.end();
  }

  try {
    await withAuthContext(
      { tenantId: TENANT_A, userId: USER_A },
      async (c) => {
        const cnt = await countRows(
          c,
          'SELECT count(*) FROM proof_artifacts WHERE tenant_id = $1',
          [TENANT_B],
        );
        assertEquals(
          cnt,
          0,
          'auditor de A NÃO pode listar artefatos de B (proteção upstream do getArtifactUrl)',
        );
      },
    );
  } finally {
    const r = await newClient();
    try {
      await r.queryArray(
        `UPDATE tenant_users SET role = 'admin'
         WHERE tenant_id = $1 AND user_id = $2`,
        [TENANT_A, USER_A],
      );
    } finally {
      await r.end();
    }
  }
});

Deno.test(
  'AK-P0-04 verify token: lookup cross-tenant via api_key_hash de outro tenant retorna 0',
  async () => {
    // O verify token (verifications-token-verify) autentica a aplicação
    // pelo header X-AgeKey-API-Key, computa sha256 e busca em applications.
    // Se a app pertence a outro tenant, a query bloqueia via RLS.
    // Aqui simulamos: A tenta resolver o api_key_hash de B (sabido).
    await withAuthContext(
      { tenantId: TENANT_A, userId: USER_A },
      async (c) => {
        const cnt = await countRows(
          c,
          `SELECT count(*) FROM applications
           WHERE api_key_hash = sha256_hex($1)`,
          ['rls_test_key_b_0000000000000000'],
        );
        assertEquals(
          cnt,
          0,
          'A não pode resolver application de B via api_key_hash',
        );
      },
    );
  },
);
