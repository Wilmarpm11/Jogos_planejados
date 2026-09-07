# Decision Log: Story 4.10

**Generated:** 2026-09-06T22:52:17Z
**Agent:** dev
**Mode:** Autonomous Development
**Story:** docs/stories/4.10.lotofacil-operational-cost-and-quotas.story.md
**Rollback reference:** `134d0ae`

## Context

Implementação do cálculo transitório de custo oficial, taxa opcional e rateio
por cotas para a carteira Lotofácil efetivamente comprada, sem pagamento,
participantes, persistência, UI ou IPC.

## Decisions Made

### 1. Isolar a primitiva inteira da modalidade

- **Tipo:** arquitetura
- **Prioridade:** alta
- **Decisão:** manter no `portfolio-engine` somente o cálculo normalizado e uma
  orquestração genérica; o adaptador Lotofácil prepara o request e monta/valida
  o resultado público.
- **Razão:** o Core não conhece catálogo, definição ou constantes Lotofácil e
  outra modalidade pode fornecer seu próprio adapter.
- **Alternativas:** importar schemas Lotofácil no motor; calcular na CLI.

### 2. Executar toda aritmética sensível em `bigint`

- **Tipo:** confiabilidade
- **Prioridade:** alta
- **Decisão:** converter contagem, preço e taxa antes dos produtos, calcular
  HALF_UP e rateio exatamente e converter somente valores públicos já validados
  contra a fronteira de inteiro seguro.
- **Razão:** impede perda silenciosa de centavos e vazamento de `bigint` no JSON.
- **Alternativas:** ponto flutuante; converter para `bigint` depois do produto.

### 3. Preservar ocorrências da única base comprada

- **Tipo:** regra de domínio
- **Prioridade:** alta
- **Decisão:** a união estrita aceita apenas `SOURCE_BETS` ou
  `EXPANDED_SIMPLE_BETS`; cada ocorrência é cobrada uma vez e duplicatas não são
  deduplicadas.
- **Razão:** evita dupla contagem e mantém a multiplicidade auditável.
- **Alternativas:** aceitar listas paralelas; cobrar fontes e expansões.

### 4. Restringir a nova ordenação à Story 4.10

- **Tipo:** compatibilidade
- **Prioridade:** alta
- **Decisão:** comparar `numbers.join(",")` com operadores ordinais sobre o
  domínio ASCII aprovado, sem `localeCompare` ou `Intl.Collator`.
- **Razão:** garante resultado independente de locale sem alterar constante,
  comparador, fixtures ou resultados da Story 4.9.
- **Alternativas:** reutilizar o comparador locale-dependent da 4.9.

### 5. Fixar preflight e erros públicos

- **Tipo:** contrato
- **Prioridade:** alta
- **Decisão:** publicar onze classes com `code` literal e aplicar a precedência
  schema/definição/concurso → taxa → catálogo → base/apostas/homogeneidade/preço
  → IDs/limites → aritmética/resultado.
- **Razão:** requests com múltiplas falhas produzem um erro estável e auditável.
- **Alternativas:** depender da ordem incidental de issues do schema.

### 6. Reutilizar catálogo e separar streams da CLI

- **Tipo:** integração
- **Prioridade:** alta
- **Decisão:** consumir o `LotofacilCatalogRecord` validado da Story 3.5 e
  publicar um JSON em `stdout` no sucesso ou um envelope JSONL em `stderr` no
  erro, sempre sem persistência.
- **Razão:** preserva proveniência e o princípio CLI-first.
- **Alternativas:** preço manual; consulta ao banco dentro do motor.

## Verification

- `npm run lint` — PASS
- `npm run typecheck` — PASS
- `npm test` — 26 arquivos, 224 testes PASS
- testes focados 4.10 + contrato/catálogo 3.5 — 4 arquivos, 39 testes PASS
- `git diff --check` — PASS
- CodeRabbit Pre-Commit — rodada final com 15 arquivos revisados, 0 achados
- revisão arquitetural independente — PASS; dois Majors corrigidos e encerrados
- gate QA independente — PASS, quality score 100/100 e ACs 1–14 cobertos
- nenhum manifest ou `package-lock.json` alterado

## Consequences

O Épico 5 poderá consumir um resultado auditável de custo e cotas sem
recalcular regras monetárias. O contrato não compra, cobra, persiste, aprova ou
congela carteira. Stories 4.11/4.12, UI, impressão e IPC continuam fora do
escopo.
