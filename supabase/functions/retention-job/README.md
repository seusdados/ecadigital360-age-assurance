# retention-job

Cron diário (`POST /functions/v1/retention-job`).

Auth: `Authorization: Bearer $CRON_SECRET`.

Estratégia conservadora em Fase 2:
- Calcula `cutoff = now() - min(retention_days)` entre tenants ativos.
- Lista partições de `audit_events_*` e `billing_events_*` cujo
  `range_end <= cutoff` via RPC `list_old_partitions`.
- Cada uma é dropada via RPC `drop_partition` (transação atômica).
- `proof_artifacts` mais antigos que cutoff são deletados em massa.

RPCs `list_old_partitions` e `drop_partition` são definidas na
migration 010 (anexa a este PR).

Schedule: `0 4 * * *` (todo dia às 04:00 UTC).
