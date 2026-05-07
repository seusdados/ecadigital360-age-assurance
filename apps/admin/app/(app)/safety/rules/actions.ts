'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { agekeyEnv } from '@/lib/agekey/env';

interface CreateRuleInput {
  rule_code: string;
  enabled: boolean;
  severity: string;
  actions: string[];
  config_json: Record<string, unknown>;
}

interface PatchRuleInput {
  id: string;
  enabled?: boolean;
  severity?: string;
  actions?: string[];
  config_json?: Record<string, unknown>;
}

async function callEdge(path: string, method: 'POST' | 'PATCH' | 'DELETE', body?: unknown) {
  const base = agekeyEnv.apiBase();
  const resp = await fetch(`${base}${path}`, {
    method,
    headers: {
      'X-AgeKey-API-Key': agekeyEnv.adminApiKey(),
      'Content-Type': 'application/json',
    },
    cache: 'no-store',
    ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
  });
  if (!resp.ok) {
    const text = await resp.text().catch(() => '');
    throw new Error(`safety rules write failed: ${resp.status} ${text}`);
  }
  return resp.json() as Promise<{ id: string; status: string }>;
}

export async function createRuleOverride(input: CreateRuleInput): Promise<void> {
  const result = await callEdge('/safety-rules-write', 'POST', input);
  revalidatePath('/safety/rules');
  redirect(`/safety/rules/${result.id}`);
}

export async function patchRuleOverride(input: PatchRuleInput): Promise<void> {
  const { id, ...rest } = input;
  await callEdge(`/safety-rules-write/${encodeURIComponent(id)}`, 'PATCH', rest);
  revalidatePath('/safety/rules');
  revalidatePath(`/safety/rules/${id}`);
}

export async function deleteRuleOverride(id: string): Promise<void> {
  await callEdge(`/safety-rules-write/${encodeURIComponent(id)}`, 'DELETE');
  revalidatePath('/safety/rules');
  redirect('/safety/rules');
}

export async function toggleRuleOverride(id: string, enabled: boolean): Promise<void> {
  return patchRuleOverride({ id, enabled });
}
