# Decision Log: Story 4.3

**Generated:** 2026-08-31T00:14:57Z
**Agent:** dev
**Mode:** Yolo (Autonomous Development)
**Story:** docs/stories/4.3.basic-portfolio-frequency-audit.story.md
**Rollback reference:** `b4ccb7de306f77dd11f84b15e7eec994123cd6c1`

## Context

Implementação do diagnóstico transitório de validade, duplicidade e frequências
da Story 4.3. O trabalho não altera estado de carteira, não persiste e não
calcula otimização ou cobertura.

## Decisions Made

### 1. Contrato genérico e motor puro

- **Tipo:** arquitetura
- **Prioridade:** alta
- **Decisão:** tipos/schemas em `lottery-contracts` e algoritmo em
  `audit-engine`, parametrizado por `LotteryDefinition`.
- **Razão:** segue o mapa arquitetural e permite reuso sem transportar regras
  específicas de modalidade para o Core.
- **Alternativas:** implementação exclusiva da Lotofácil; lógica dentro da CLI.

### 2. Inferir o tamanho de aposta dos candidatos

- **Tipo:** contrato
- **Prioridade:** média
- **Decisão:** inferir `betSize` do primeiro candidato, exigir conjunto não
  vazio, tamanho uniforme e limite declarado pela modalidade.
- **Razão:** mantém a entrada restrita à definição e candidatos, conforme AC1.
- **Alternativas:** adicionar parâmetro redundante `betSize`; aceitar mistura de
  tamanhos, o que quebraria as identidades combinatórias do AC5.

### 3. Emitir o universo completo de pares

- **Tipo:** algoritmo
- **Prioridade:** alta
- **Decisão:** pré-enumerar pares canônicos e incrementar contadores durante uma
  única passagem pelos candidatos.
- **Razão:** garante ordem estável e inclui frequências zero por construção.
- **Alternativas:** emitir somente pares observados; ordenar um mapa esparso ao
  final.

## Verification

- `npm run typecheck` — PASS
- `npm run lint` — PASS
- `npx vitest run tests/audit-engine/basic-portfolio-frequency-audit.test.ts`
  — 8 testes PASS
- `npm test` — 18 arquivos, 103 testes PASS
- `git diff --check` — PASS
- CodeRabbit local — 0 achados no escopo da Story 4.3

## Consequences

O custo é `O(n × k² + u²)` e a saída Lotofácil contém sempre 25 frequências
individuais e 300 frequências de pares. Interseções, política de volume,
progresso e cancelamento permanecem fora do escopo documentado.
