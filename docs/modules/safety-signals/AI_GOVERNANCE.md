# Governança de IA / modelos — AgeKey Safety Signals

## Posição do MVP

**O MVP NÃO usa LLM nem modelos ML.** A decisão é 100% por **regras
declarativas** avaliadas por um motor puro (`safety-rules.ts`).

A tabela `safety_model_runs` foi criada como **placeholder reservado**.
Ela só recebe linhas quando `AGEKEY_SAFETY_MODEL_GOVERNANCE_ENABLED=true`,
que continua **OFF** em todos os ambientes.

## Princípios para uma futura camada de modelos

Quando uma rodada futura ligar a flag, ela precisará respeitar:

1. **Sem LLM externa para conteúdo de menores.** Qualquer análise de
   texto sobre interações envolvendo menores roda em modelo controlado,
   on-prem ou em provider com DPA assinada.
2. **Inputs e outputs hashed** em `safety_model_runs` — nunca o texto
   bruto, nunca a saída bruta.
3. **Modelo versionado** (`model_name`, `model_version`).
4. **Recall path**: cada decisão automatizada que afete o usuário tem
   um `safety_alerts.assigned_to` para revisão humana.
5. **Drift detection**: rodada de governança aprova métricas de drift
   antes de cada release de modelo.
6. **Reversibilidade**: nenhuma decisão de modelo bloqueia conta
   de menor sem revisão humana — apenas sinaliza.
7. **Direito à explicação**: tenant pode pedir o `rule_eval` /
   `model_run` que produziu uma decisão.

## Sem reconhecimento facial

Em **nenhuma rodada** o módulo Safety vai aplicar reconhecimento
facial, biometria comportamental ou emotion recognition em interações
de menores. O AgeKey Core, sim, pode usar age estimation provider via
gateway adapter — mas isso é decisão **etária**, não decisão de
**risco**, e roda fora deste módulo.
