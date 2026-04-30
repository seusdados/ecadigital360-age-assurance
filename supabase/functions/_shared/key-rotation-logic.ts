// Pure (DB-free) decision logic for the key-rotation Edge Function.
//
// Extracted from `key-rotation/index.ts` so it can be exercised by
// deterministic unit tests without spinning up Postgres. The IO layer
// (the real `serve` handler) consumes these helpers and only adds
// the SELECT/INSERT/UPDATE/DELETE plumbing on top.
//
// Naming guarantees (kept stable for tests):
//   shouldRotate(now, keys, opts)               — true if a fresh key is needed
//   classifyTransitions(now, keys, opts)        — pure plan of promotions/retirements/purges
//   ROTATING_TO_ACTIVE_MS, ACTIVE_TO_RETIRED_MS, RETIRED_PURGE_MS — exported

export const ROTATING_TO_ACTIVE_MS = 24 * 60 * 60 * 1000; // 24h
export const ACTIVE_TO_RETIRED_MS = 24 * 60 * 60 * 1000; // 24h overlap
export const RETIRED_PURGE_MS = 90 * 24 * 60 * 60 * 1000; // 90 days

// How old the most-recently-activated key may be before we *require* a
// new rotation. The cron runs daily, but the decision function lets us
// detect a regressed schedule (e.g. cron paused for several days).
export const ROTATION_INTERVAL_MS = 24 * 60 * 60 * 1000; // 24h

export type KeyStatus = 'active' | 'rotating' | 'retired';

export interface CryptoKeyRow {
  id: string;
  kid: string;
  status: KeyStatus;
  activated_at: string | null;
  retired_at: string | null;
  created_at: string;
}

export interface RotationPlan {
  /** kids of `rotating` keys that should become `active`. */
  promote: string[];
  /** kids of `active` keys that should become `retired`. */
  retire: string[];
  /** kids of `retired` keys that should be hard-deleted. */
  purge: string[];
  /** kids of `active` keys that are still current (kept). */
  keepActive: string[];
}

/**
 * True if the key-rotation cron must mint a new key on this run.
 *
 * Returns true when:
 *   - There are no keys at all (bootstrap), OR
 *   - There is no `active` key, OR
 *   - The most-recently-activated `active` key is older than
 *     `intervalMs` (default 24h).
 *
 * Returns false otherwise.
 *
 * Pure — does not touch the network or DB.
 */
export function shouldRotate(
  nowMs: number,
  keys: CryptoKeyRow[],
  opts: { intervalMs?: number } = {},
): boolean {
  if (keys.length === 0) return true;

  const intervalMs = opts.intervalMs ?? ROTATION_INTERVAL_MS;
  const actives = keys.filter((k) => k.status === 'active' && k.activated_at);
  if (actives.length === 0) return true;

  // Newest active wins.
  let newest = 0;
  for (const k of actives) {
    const t = new Date(k.activated_at!).getTime();
    if (t > newest) newest = t;
  }
  return nowMs - newest >= intervalMs;
}

/**
 * Detects the (illegal) regressed state where two distinct `active` keys
 * coexist and BOTH are within the active overlap window — meaning the
 * older one was never demoted to `retired`. Cron must converge to a
 * single `active` per cycle.
 */
export function hasMultipleFreshActives(
  nowMs: number,
  keys: CryptoKeyRow[],
  opts: { activeOverlapMs?: number } = {},
): boolean {
  const overlap = opts.activeOverlapMs ?? ACTIVE_TO_RETIRED_MS;
  let fresh = 0;
  for (const k of keys) {
    if (k.status !== 'active' || !k.activated_at) continue;
    const age = nowMs - new Date(k.activated_at).getTime();
    if (age < overlap) fresh++;
  }
  return fresh > 1;
}

/**
 * Plans the lifecycle transitions that the rotation handler should
 * apply. Pure: takes the current set of keys + a timestamp, returns
 * the kids to promote / retire / purge.
 *
 * The plan deliberately KEEPS the most-recently-activated `active` key
 * untouched; it is the current signing key.
 */
export function classifyTransitions(
  nowMs: number,
  keys: CryptoKeyRow[],
  opts: {
    rotatingToActiveMs?: number;
    activeToRetiredMs?: number;
    retiredPurgeMs?: number;
  } = {},
): RotationPlan {
  const rotMs = opts.rotatingToActiveMs ?? ROTATING_TO_ACTIVE_MS;
  const retMs = opts.activeToRetiredMs ?? ACTIVE_TO_RETIRED_MS;
  const purgeMs = opts.retiredPurgeMs ?? RETIRED_PURGE_MS;

  const promote: string[] = [];
  const retire: string[] = [];
  const purge: string[] = [];
  const keepActive: string[] = [];

  // Promote rotating → active when ≥ rotating-to-active threshold.
  for (const k of keys) {
    if (k.status !== 'rotating') continue;
    const age = nowMs - new Date(k.created_at).getTime();
    if (age >= rotMs) promote.push(k.kid);
  }

  // Find the most-recently-activated `active` key — it stays.
  let mostRecent: { id: string; activated_at: string } | null = null;
  for (const k of keys) {
    if (k.status !== 'active' || !k.activated_at) continue;
    if (
      !mostRecent ||
      new Date(k.activated_at).getTime() >
        new Date(mostRecent.activated_at).getTime()
    ) {
      mostRecent = { id: k.id, activated_at: k.activated_at };
    }
  }

  for (const k of keys) {
    if (k.status === 'active' && k.activated_at) {
      if (mostRecent && k.id === mostRecent.id) {
        keepActive.push(k.kid);
        continue;
      }
      const age = nowMs - new Date(k.activated_at).getTime();
      if (age >= retMs) retire.push(k.kid);
      else keepActive.push(k.kid);
    }
  }

  for (const k of keys) {
    if (k.status !== 'retired' || !k.retired_at) continue;
    const age = nowMs - new Date(k.retired_at).getTime();
    if (age >= purgeMs) purge.push(k.kid);
  }

  return { promote, retire, purge, keepActive };
}
