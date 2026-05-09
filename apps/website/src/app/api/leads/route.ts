import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { leadSchema } from '@/lib/leadSchema';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
  let json: unknown;
  try {
    json = await req.json();
  } catch {
    return NextResponse.json({ error: 'JSON inválido.' }, { status: 400 });
  }

  const parsed = leadSchema.safeParse(json);
  if (!parsed.success) {
    const first = parsed.error.issues[0];
    return NextResponse.json(
      { error: first?.message ?? 'Dados inválidos.' },
      { status: 400 },
    );
  }

  const lead = parsed.data;
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

  // If Supabase is not configured, accept the lead and rely on logging.
  // The frontend keeps the same UX in either mode; production should
  // wire SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY (server-only).
  if (!url || !key) {
    console.info('[website.lead] received (no persistence configured)', {
      source: lead.source,
      segment: lead.segment,
      channel: lead.channel,
      policies: lead.policies,
    });
    return NextResponse.json({ ok: true }, { status: 202 });
  }

  try {
    const supabase = createClient(url, key, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const { error } = await supabase.from('website_leads').insert({
      name: lead.name,
      email: lead.email,
      company: lead.company,
      role: lead.role,
      website: lead.website || null,
      segment: lead.segment,
      monthly_volume: lead.monthlyVolume,
      policies: lead.policies,
      channel: lead.channel,
      message: lead.message || null,
      source: lead.source,
    });
    if (error) {
      console.error('[website.lead] supabase insert failed', error);
      // Still don't leak details to the client.
      return NextResponse.json({ ok: true }, { status: 202 });
    }
    return NextResponse.json({ ok: true }, { status: 201 });
  } catch (err) {
    console.error('[website.lead] unexpected error', err);
    return NextResponse.json({ ok: true }, { status: 202 });
  }
}
