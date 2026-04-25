// Auto-generated Supabase types placeholder.
// To regenerate from the live schema:
//   supabase gen types typescript --project-id tpdiccnmsnjtjwhardij \
//     > apps/admin/types/database.ts
//
// Until then, this is a permissive shape that satisfies the
// `createServerClient<Database>()` generic constraint without forcing
// hand-maintained row types. Domain code casts the responses to specific
// types via `lib/agekey/*` and `lib/validations/*`.

export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export interface Database {
  public: {
    Tables: Record<
      string,
      {
        Row: Record<string, unknown>;
        Insert: Record<string, unknown>;
        Update: Record<string, unknown>;
      }
    >;
    Views: Record<string, { Row: Record<string, unknown> }>;
    Functions: Record<
      string,
      { Args: Record<string, unknown>; Returns: unknown }
    >;
    Enums: Record<string, string>;
  };
}

// Domain-specific row shapes used by the panel. Cast results to these
// at the query site; once `supabase gen types` runs, replace this with
// the generated file and drop the manual interfaces.
export interface TenantRow {
  id: string;
  slug: string;
  name: string;
  status: 'active' | 'suspended' | 'pending_setup' | 'closed';
  deleted_at: string | null;
}

export interface TenantUserRow {
  id: string;
  tenant_id: string;
  user_id: string;
  role: 'owner' | 'admin' | 'operator' | 'auditor' | 'billing';
  created_at: string;
}

export interface UsageCounterRow {
  tenant_id: string;
  application_id: string;
  day: string;
  verifications_created: number;
  verifications_approved: number;
  verifications_denied: number;
  tokens_issued: number;
  webhooks_delivered: number;
}
