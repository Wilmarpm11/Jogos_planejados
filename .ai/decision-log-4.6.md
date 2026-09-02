# Decision Log: Story 4.6

**Generated:** 2026-09-02T20:13:56Z
**Agent:** dev
**Mode:** Yolo (Autonomous Development)
**Story:** docs/stories/4.6.lotofacil-exact-coverage-audit.story.md
**Rollback reference:** `31243c7`

## Context

Implementação da primeira auditoria de cobertura exata da carteira, restrita à
Lotofácil 25/15 e a apostas simples. O resultado mede cobertura bruta, única,
repetida e eficiência exata nas faixas cumulativas 15, 14+, 13+ e 12+.

## Decisions Made

### 1. Separar união genérica da enumeração Lotofácil

- **Tipo:** arquitetura
- **Prioridade:** alta
- **Decisão:** criar `@boloes/coverage-engine` para mapa, progresso e agregação,
  recebendo um `ExactCoverageAdapter` implementado em
  `@boloes/lottery-lotofacil`.
- **Razão:** mantém limiares e universo da modalidade fora do Core e permite
  versionar futuras modalidades sem transferência silenciosa de regras.
- **Alternativas:** incorporar a cobertura em `audit-engine`; importar
  Lotofácil no motor genérico; criar uma skill operacional.

### 2. Usar ranking colexicográfico denso com tabela de Pascal

- **Tipo:** algoritmo
- **Prioridade:** alta
- **Decisão:** adicionar `createCombinationRanker` reutilizável em
  `@boloes/combinatorics`, mapeando cada combinação em `[0, C(n,k))`.
- **Razão:** elimina hashing/colisões, permite `Uint8Array` de um byte por
  resultado e mantém contagens inteiras determinísticas.
- **Alternativas:** `Set<string>`; mapa de bitmasks; ranking específico dentro
  do adaptador.

### 3. Processar o trabalho em lotes cooperativos limitados

- **Tipo:** confiabilidade
- **Prioridade:** alta
- **Decisão:** ceder o event loop após cada massa de 59.476 visitas por
  candidato e a cada 65.536 posições da varredura final, verificando
  `AbortSignal` e relógio monotônico.
- **Razão:** satisfaz o limite operacional, torna SIGINT observável e garante
  timeout tipado de 30 s sem publicar parcial.
- **Alternativas:** loop integralmente síncrono; worker thread; lotes menores
  sem evidência de necessidade.

### 4. Tornar invariantes de cobertura parte do schema público

- **Tipo:** contrato
- **Prioridade:** alta
- **Decisão:** o schema valida ordem das faixas, bruto canônico, conservação,
  eficiência reduzida, erro 0/1 e trabalho concluído.
- **Razão:** impede que qualquer consumidor aceite uma saída internamente
  inconsistente, mesmo fora do caminho principal do motor.
- **Alternativas:** confiar somente nos testes do algoritmo; validar apenas a
  forma dos campos.

### 5. Serializar progresso e erros operacionais como JSON Lines

- **Tipo:** CLI/observabilidade
- **Prioridade:** alta
- **Decisão:** manter resultado final isolado em stdout e emitir em stderr
  registros JSON estáveis para progresso e erros, com exit 130/124.
- **Razão:** preserva composição por CLI e permite automação sem parsing de
  texto humano.
- **Alternativas:** mensagens de erro livres em stderr; resultado e progresso
  no mesmo stream.

## Verification

- `npm run lint` — PASS
- `npm run typecheck` — PASS
- `npm test` — 21 arquivos, 144 testes PASS
- teste direcionado — 14 testes PASS em cerca de 7 s
- cenário de teto — 1.000 candidatos PASS dentro de 30 s
- `git diff --check` — PASS
- `npm install --ignore-scripts` — 0 vulnerabilidades reportadas
- CodeRabbit local — primeira rodada: 4 achados (3 aplicados, 1 rejeitado por
  contrariar o AC de desempenho); segunda rodada: 0 achados

## Consequences

A cobertura exata passa a existir como cálculo transitório, sem persistência,
aproximação ou mudança de estado. A expansão 16–20 e outras modalidades seguem
bloqueadas até contrato, adaptador e benchmark próprios.
