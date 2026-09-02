# Decision Log: Story 4.5

**Generated:** 2026-09-02T14:18:06Z
**Agent:** dev
**Mode:** Yolo (Autonomous Development)
**Story:** docs/stories/4.5.lotofacil-portfolio-structural-distribution.story.md
**Rollback reference:** `354188370ab5983e4c125408b8e216fc7b88e65d`

## Context

Implementação da distribuição estrutural transitória da carteira Lotofácil.
O Core agrega somente `StructuralSummary`; regras E1–E10 permanecem no módulo
da modalidade, sem histórico, estratégia, cobertura, persistência ou estado.

## Decisions Made

### 1. Reutilizar contratos estruturais e adicionar um adapter explícito

- **Tipo:** arquitetura
- **Prioridade:** alta
- **Decisão:** manter schemas/tipos em `lottery-contracts`, agregação linear em
  `audit-engine` e composição MetricEngine → classifier → summary no adapter
  Lotofácil.
- **Razão:** preserva a fronteira Core/modalidade aprovada e evita reimplementar
  E1–E10.
- **Alternativas:** importar Lotofácil no Core; duplicar regras no agregador;
  criar package ou skill novos.

### 2. Exigir compatibilidade integral da LotteryDefinition antes do progresso

- **Tipo:** contrato
- **Prioridade:** alta
- **Decisão:** o adapter declara `supportsDefinition`, e o Core valida id,
  versão, universo e limites antes de emitir o primeiro evento.
- **Razão:** impede que uma definição adulterada alcance o cálculo específico ou
  produza observabilidade parcial.
- **Alternativas:** validar somente `lotteryId`; deixar a rejeição ocorrer dentro
  do MetricEngine.

### 3. Agregar em cinco contadores fixos com frações exatas reduzidas

- **Tipo:** algoritmo
- **Prioridade:** alta
- **Decisão:** usar a ordem canônica compartilhada, memória `O(1)` e derivar
  cada frequência de `count/candidateCount` pelo MDC.
- **Razão:** garante buckets zero, conservação, determinismo e ausência de
  materialização dos resumos individuais.
- **Alternativas:** mapa esparso; percentuais em ponto flutuante; armazenar um
  resumo por candidato.

### 4. Ceder o event loop a cada 256 candidatos

- **Tipo:** confiabilidade
- **Prioridade:** alta
- **Decisão:** processamento assíncrono em lotes fixos, com `AbortSignal`, erro
  tipado e progresso JSONL separado do resultado.
- **Razão:** mantém custo linear sem herdar o teto quadrático e torna `SIGINT`
  observável sem publicar resultado parcial.
- **Alternativas:** loop totalmente síncrono; worker thread; teto artificial de
  1.000 candidatos.

## Verification

- `npm run lint` — PASS
- `npm run typecheck` — PASS
- `npm test` — 20 arquivos, 130 testes PASS
- teste direcionado — 13 testes PASS
- `git diff --check` — PASS
- CodeRabbit local — 2 achados corrigidos (1 major, 1 minor); verificação final
  com 0 achados

## Consequences

A auditoria cresce linearmente com a quantidade de candidatos, mantém saída
fixa de cinco buckets e não introduz dependência da Lotofácil no Core. Outras
modalidades continuam bloqueadas até fornecerem definição e regras versionadas
em adapter próprio.
