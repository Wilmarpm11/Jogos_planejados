# Decision Log: Story 4.8

**Generated:** 2026-09-02T23:06:50Z
**Agent:** dev
**Mode:** Interactive Development
**Story:** docs/stories/4.8.lotofacil-expanded-coverage-composition.story.md
**Rollback reference:** `59cefa4`

## Context

Composição transitória de uma ou mais apostas-fonte Lotofácil pela expansão
canônica 1.0 e cobertura exata 1.0, preservando origem, ordem e ocorrências
duplicadas dentro do teto existente de 1.000 candidatos simples.

## Decisions Made

### 1. Separar fronteira neutra e contrato público Lotofácil

- **Tipo:** arquitetura
- **Prioridade:** alta
- **Decisão:** manter schemas base e envelope de execução neutros para o motor,
  com schemas públicos adicionais que fixam Lotofácil 25/15 v1.0.0.
- **Razão:** preserva reuso por injeção sem enfraquecer a primeira integração.
- **Alternativas:** acoplar o engine ao adaptador Lotofácil; expor apenas o base.

### 2. Executar o limite cumulativo no schema de request

- **Tipo:** confiabilidade
- **Prioridade:** alta
- **Decisão:** derivar e somar `C(k,15)` durante o preflight estrito, antes de
  qualquer adaptador, materialização ou progresso.
- **Razão:** torna o teto de 1.000 ocorrências impossível de contornar.
- **Alternativas:** validar após expansão; limitar somente candidatos distintos.

### 3. Preservar todas as ocorrências e usar identidade apenas para métricas

- **Tipo:** semântica
- **Prioridade:** alta
- **Decisão:** concatenar as expansões na ordem recebida e usar `Set` somente
  para calcular total distinto e ocorrências duplicadas.
- **Razão:** duplicatas compõem a massa bruta e a redundância da cobertura.
- **Alternativas:** deduplicar antes da auditoria; reordenar globalmente.

### 4. Versionar também os adaptadores componentes

- **Tipo:** rastreabilidade
- **Prioridade:** alta
- **Decisão:** adicionar metadado aditivo `adapterVersion` ao adaptador de
  expansão e publicar versões de composição, expansão e cobertura no resultado.
- **Razão:** permite reproduzir o caminho completo sem alterar contratos 1.0.
- **Alternativas:** registrar somente versões dos contratos e algoritmos.

### 5. Reutilizar limites operacionais da cobertura

- **Tipo:** operação
- **Prioridade:** alta
- **Decisão:** encaminhar o mesmo `AbortSignal`, callback de progresso e relógio
  ao motor exato, sem criar timeout ou unidade de trabalho paralela.
- **Razão:** mantém códigos 130/124 e comportamento comprovado pela Story 4.6.
- **Alternativas:** progresso próprio da expansão; segundo timeout.

### 6. Expor uma ação CLI local por arquivo

- **Tipo:** CLI
- **Prioridade:** média
- **Decisão:** adicionar `portfolio audit-expanded-coverage --input PATH`, com
  JSON Lines de progresso em `stderr` e resultado único em `stdout`.
- **Razão:** atende CLI First e suporta várias fontes sem argumentos ambíguos.
- **Alternativas:** lista de dezenas na linha de comando; persistência intermediária.

## Verification

- `npm run lint` — PASS
- `npm run typecheck` — PASS
- `npm test` — 23 arquivos, 173 testes PASS
- teste direcionado — 1 arquivo, 8 testes PASS
- `npm ls --all` — PASS; workspaces deduplicados, sem dependência nova
- `git diff --check` — PASS
- CodeRabbit local — 1 minor e 1 major corrigidos; rodada final com 0 achados

## Consequences

A CLI agora transforma fontes elegíveis de 15–18 dezenas em ocorrências simples
e entrega a lista integral à cobertura exata. Fontes 19–20 e somas acima de
1.000 continuam exigindo nova decisão de capacidade; custo, persistência,
congelamento, impressão e conferência permanecem fora do escopo.
