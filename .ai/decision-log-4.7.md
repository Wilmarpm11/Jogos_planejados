# Decision Log: Story 4.7

**Generated:** 2026-09-02T21:20:48Z
**Agent:** dev
**Mode:** Interactive Development
**Story:** docs/stories/4.7.lotofacil-canonical-bet-expansion.story.md
**Rollback reference:** `affa226`

## Context

Implementação da primeira expansão canônica unitária, restrita à Lotofácil
25/15 e a apostas-fonte de 15–20 dezenas. A saída transitória materializa todas
as combinações simples de 15 sem integrar cobertura ou persistência.

## Decisions Made

### 1. Manter contrato neutro e adaptador por modalidade

- **Tipo:** arquitetura
- **Prioridade:** alta
- **Decisão:** schemas e interface vivem em `@boloes/lottery-contracts`; as
  constantes 01–25, 15–20 e a validação da definição ficam no adaptador
  `@boloes/lottery-lotofacil`.
- **Razão:** preserva a fronteira multi-loteria definida pela story.
- **Alternativas:** contrato específico no Core; novo package; skill dedicada.

### 2. Reutilizar a fonte combinatória existente

- **Tipo:** algoritmo
- **Prioridade:** alta
- **Decisão:** usar `forEachCombination` para enumeração lexicográfica e
  `binomialCoefficient` para a quantidade esperada, copiando cada projeção.
- **Razão:** evita uma segunda implementação matemática e o vazamento do buffer
  reutilizado pelo visitor.
- **Alternativas:** loops específicos Lotofácil; recursão local; combinações por
  strings.

### 3. Validar resultado no contexto do request

- **Tipo:** contrato
- **Prioridade:** alta
- **Decisão:** criar `canonicalBetExpansionExecutionSchema` para vincular
  modalidade, versão, aposta-fonte e `simpleBetSize` ao request originador.
- **Razão:** impede anexar um resultado internamente válido a outra execução.
- **Alternativas:** validar apenas o result isolado; confiar no adaptador.

### 4. Bloquear materialização acima do teto aprovado

- **Tipo:** confiabilidade
- **Prioridade:** alta
- **Decisão:** derivar `C(sourceBetSize, drawSize)` no preflight e rejeitar mais
  de 15.504 candidatos na versão `1.0`.
- **Razão:** torna o limite de memória/trabalho parte do contrato antes do loop.
- **Alternativas:** limitar somente no adaptador; materializar sem teto; exigir
  progresso/cancelamento fora do escopo.

### 5. Expor uma ação CLI sem estado

- **Tipo:** CLI
- **Prioridade:** média
- **Decisão:** adicionar `lotofacil expand --numbers`, com JSON final em
  `stdout` e erros em `stderr`.
- **Razão:** atende CLI First sem introduzir arquivo, banco ou UI.
- **Alternativas:** request por arquivo; comando dentro de `portfolio`.

### 6. Aplicar o teto também no schema de resultado isolado

- **Tipo:** confiabilidade
- **Prioridade:** média
- **Decisão:** limitar `candidates` a 15.504 no próprio
  `canonicalBetExpansionResultSchema`, além do preflight e do envelope de
  execução.
- **Razão:** garante que consumidores que validem diretamente um resultado não
  aceitem uma materialização acima do limite público do contrato.
- **Alternativas:** depender exclusivamente do request ou do execution schema.

## Verification

- `npm run lint` — PASS
- `npm run typecheck` — PASS
- `npm test` — 22 arquivos, 165 testes PASS
- teste direcionado — 21 testes PASS
- `npm ls @boloes/combinatorics --all` — dependência workspace deduplicada
- `git diff --check` — PASS
- CodeRabbit local — primeira rodada: 1 major corrigido e 1 minor de cache
  descartado; segunda rodada: 2 majors corrigidos; re-review DEV/QA: 0 achados;
  Pre-PR: limite direto do result schema corrigido

## Consequences

A Lotofácil passa a ter expansão canônica unitária, determinística e limitada.
A cobertura 4.6 permanece inalterada; agregação de várias apostas-fonte e
cobertura expandida continuam exigindo story própria.
