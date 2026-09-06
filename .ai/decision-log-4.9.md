# Decision Log: Story 4.9

**Generated:** 2026-09-05T12:36:00Z
**Agent:** dev
**Mode:** Autonomous Development
**Story:** docs/stories/4.9.lotofacil-deterministic-diversity-optimization.story.md
**Rollback reference:** `d9fbf06`

## Context

Implementação da etapa P0 entre geração e cobertura: seleção determinística de
um subconjunto de candidatos simples Lotofácil, sem geração implícita,
histórico, probabilidade, custo, persistência, UI ou Python.

## Decisions Made

### 1. Manter motor neutro e injetar a modalidade

- **Tipo:** arquitetura
- **Prioridade:** alta
- **Decisão:** criar `@boloes/portfolio-engine` dependente somente de contratos
  e combinatória; a CLI injeta o adaptador Lotofácil 25/15.
- **Razão:** cumpre o gate criar/reutilizar/restringir sem ciclo de dependências
  ou constantes Lotofácil no Core.
- **Alternativas:** importar Lotofácil no motor; implementar diretamente na CLI.

### 2. Compartilhar uma única cardinalidade de interseção

- **Tipo:** compatibilidade
- **Prioridade:** alta
- **Decisão:** publicar `intersectionCardinality` em
  `@boloes/combinatorics` e migrar apenas o cálculo interno da auditoria 4.4.
- **Razão:** impede divergência matemática e preserva ordem, API e resultados
  da auditoria existente.
- **Alternativas:** copiar o cálculo; consumir a lista materializada da 4.4.

### 3. Usar matriz triangular compacta e histogramas incrementais

- **Tipo:** algoritmo/desempenho
- **Prioridade:** alta
- **Decisão:** armazenar `C(n,2)` interseções em `Uint8Array` e atualizar um
  `Uint16Array` por candidato a cada nova seleção.
- **Razão:** executa a política aprovada 14→0 em tempo quadrático no teto, sem
  recomputar interseções nem materializar objetos por par.
- **Alternativas:** matriz quadrada; recalcular cada histograma desde zero.

### 4. Reutilizar classificação e maiores restos da Lotofácil

- **Tipo:** regra de domínio
- **Prioridade:** alta
- **Decisão:** exportar e reutilizar o comparador canônico e o helper de maiores
  restos já usado pelo gerador; o adaptador classifica as faixas existentes.
- **Razão:** mantém uma fonte de verdade e tolerância zero na alocação explícita.
- **Alternativas:** duplicar a regra no motor; inferir cotas no modo neutro.

### 5. Congelar erros e observabilidade da CLI

- **Tipo:** operação
- **Prioridade:** alta
- **Decisão:** mapear os quatro códigos/classes públicos para JSONL em `stderr`,
  exit `1` ou `130`, sem timeout/124 nem resultado parcial.
- **Razão:** torna falhas e cancelamento auditáveis sem misturar diagnóstico ao
  resultado final em `stdout`.
- **Alternativas:** mensagens livres; reutilizar os códigos de cobertura.

### 6. Fazer o schema do resultado provar invariantes cruzadas

- **Tipo:** confiabilidade
- **Prioridade:** alta
- **Decisão:** validar universo, ordem por proveniência canônica, índices,
  conjunto final, modos/atalhos, trabalho e recomputar cada histograma vencedor
  pela primitiva compartilhada.
- **Razão:** impede que um artefato adulterado passe apenas por ter o formato
  correto.
- **Alternativas:** confiar exclusivamente no motor; validar apenas tipos.

### 7. Tratar o benchmark como evidência, não SLA

- **Tipo:** operação
- **Prioridade:** média
- **Decisão:** medir o pior caminho aprovado 1.000/999 e registrar ambiente e
  consumo, sem criar timeout ou meta de tempo.
- **Razão:** o teto é a contenção normativa; tempo de uma máquina não deve virar
  requisito de produto implícito.
- **Alternativas:** timeout arbitrário; elevar o teto com base em uma execução.

## Verification

- `npm run lint` — PASS
- `npm run typecheck` — PASS
- `npm test` — 24 arquivos, 193 testes PASS
- testes direcionados 4.9 + regressão 4.4 — 2 arquivos, 28 testes PASS
- `npm ls @boloes/portfolio-engine @boloes/combinatorics --all` — PASS
- `npm install`/audit — 0 vulnerabilidades
- `git diff --check` — PASS
- CodeRabbit local — 2 achados `major` válidos corrigidos; rodada final com 0
  achados
- revisão arquitetural independente — PASS técnico, zero bloqueios
- `npm run validate:structure` e `npm run validate:agents` — N/A: scripts não
  existem no `package.json` deste checkout

## Benchmark final

- ambiente: Node.js 24.14.0, macOS arm64, execução local em 2026-09-05
- entrada: `poolSize = 1.000`, `targetCandidateCount = 999`, modo neutro
- trabalho: 499.500 interseções + 499.499 visitas = 998.999 unidades
- duração observada do motor: 149,88 ms
- RSS: 102.072.320 → 123.846.656 bytes; delta 21.774.336 bytes
- RSS máximo do processo (`/usr/bin/time -lp`): 124.157.952 bytes
- peak memory footprint reportado: 50.387.904 bytes

Esses valores são evidência ambiental e não SLA. O teto permanece 1.000 e não
há timeout na política `1.0`.

## Consequences

O fluxo local passa a poder executar `geração → otimização de diversidade →
auditoria de cobertura` com rastreabilidade e cancelamento. FR-06, geração
16–20, persistência, impressão, UI e contrato Tauri/Python continuam fora da
Story 4.9 e não foram desbloqueados.
