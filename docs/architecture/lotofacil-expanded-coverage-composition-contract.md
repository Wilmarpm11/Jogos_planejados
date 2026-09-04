# Contrato de composição entre expansão e cobertura exata Lotofácil

## Decisão de capacidade reutilizável

Criar um contrato público e versionado de composição em
`@boloes/lottery-contracts` e implementá-lo no package existente
`@boloes/coverage-engine`. Reutilizar, sem alterar, o
`CanonicalBetExpansionAdapter` e o `ExactCoverageAdapter`; a CLI seleciona os
adaptadores Lotofácil existentes. Não criar package, skill, algoritmo
combinatório ou motor de cobertura paralelo.

O contrato compartilhado permanece independente de modalidade. A primeira
integração fica restrita a `lotofacil`, definição 25/15 versão `1.0.0`, e aos
contratos `1.0` de expansão e cobertura. Constantes 01–25, tamanho simples 15 e
faixas 15/14+/13+/12+ continuam pertencendo ao adaptador Lotofácil.

## Semântica de produto

O contrato de composição `1.0` recebe uma `LotteryDefinition` e uma lista não
vazia de apostas-fonte canônicas. Cada fonte é validada pelo contrato de
expansão existente e pode declarar de 15 a 20 dezenas únicas, inteiras, dentro
de `01–25` e em ordem estritamente crescente.

A operação preserva duas ordens:

1. apostas-fonte na ordem recebida;
2. candidatos simples na ordem lexicográfica produzida pelo adaptador dentro
   de cada fonte.

O resultado registra as versões da composição, da expansão e da cobertura,
identidade/versão da modalidade, quantidade de fontes, resumo indexado de cada
fonte, quantidade total de ocorrências expandidas, quantidade de candidatos
distintos, quantidade de ocorrências duplicadas e o resultado exato da
cobertura. Cada resumo de fonte informa índice, dezenas, tamanho e
`C(sourceBetSize, 15)`.

Combinações simples iguais produzidas por fontes distintas não são removidas.
Cada uma permanece uma ocorrência independente na entrada da cobertura, conta
na massa bruta e pode aumentar repetição/redundância sem aumentar a cobertura
única. A composição apenas torna a duplicidade observável; não filtra, otimiza
ou reordena a carteira.

## Preflight e limites operacionais

Antes de chamar qualquer adaptador, materializar candidatos ou emitir
progresso, o preflight:

- valida de forma estrita a definição e todas as fontes;
- calcula cada contagem com `binomialCoefficient(sourceBetSize, drawSize)`;
- soma as ocorrências com aritmética de inteiro seguro;
- exige total entre 1 e `EXACT_COVERAGE_AUDIT_MAX_CANDIDATES = 1.000`.

Esse limite preserva integralmente o contrato de cobertura `1.0`. Uma fonte de
18 dezenas produz 816 ocorrências e é elegível isoladamente; fontes de 19 e 20
produzem 3.876 e 15.504 e, portanto, são rejeitadas no preflight da composição.
Qualquer conjunto de fontes 15–18 cuja soma exceda 1.000 também é rejeitado,
sem materialização, progresso ou resultado parcial.

O teto é aplicado às ocorrências, não aos candidatos distintos. Deduplicar
antes do gate permitiria ocultar trabalho e alterar a semântica de cobertura
bruta, portanto é proibido.

## Integração e fluxo de dependências

`@boloes/coverage-engine` recebe o request e dois adaptadores explícitos. Após o
preflight, chama a expansão uma vez por fonte, concatena as ocorrências na ordem
definida e encaminha a lista completa para `auditExactPortfolioCoverage`. O
fluxo de dependências permanece:

```text
CLI -> coverage-engine -> lottery-contracts / audit-engine
 |          |
 |          +-> adaptadores fornecidos por parâmetro
 +-> lottery-lotofacil
```

O `coverage-engine` não importa o módulo Lotofácil. Não há ciclo entre packages
e os contratos `CANONICAL_BET_EXPANSION_CONTRACT_VERSION = "1.0"` e
`EXACT_COVERAGE_AUDIT_CONTRACT_VERSION = "1.0"` permanecem compatíveis.

## Observabilidade, cancelamento e timeout

Entradas inválidas ou acima do teto falham antes do primeiro progresso. A
expansão limitada a 1.000 ocorrências é síncrona e finita; o sinal de
cancelamento é verificado antes de cada fonte e antes de iniciar a cobertura.
Depois disso, a composição encaminha sem alteração o progresso, cancelamento e
timeout da cobertura exata:

- progresso JSON Lines em `stderr`;
- `AbortSignal` com saída 130;
- timeout rígido de 30.000 ms na fase de cobertura, com saída 124;
- JSON final único em `stdout` somente após conclusão válida.

Cancelamento ou timeout não publica resultado parcial. A composição não cria
um segundo relógio ou protocolo de progresso e não redefine a unidade de
trabalho do motor de cobertura.

## Evidência de desempenho

Em Node.js v24.14.0, macOS arm64, a composição manual dos contratos existentes
para uma fonte canônica de 18 dezenas produziu 816 candidatos em 5,11 ms e
concluiu a cobertura em 3.120,86 ms, totalizando 3.125,97 ms e 51.801.176
unidades de trabalho. O cenário permanece dentro do timeout de 30 segundos e do
teto de 1.000 ocorrências.

Essa evidência autoriza somente a composição dentro do teto atual. Aumentar
1.000, aceitar uma fonte de 19–20, mudar timeout, aproximar cobertura ou executar
em outro processo exige nova decisão versionada e benchmark próprio.

## Compatibilidade e fronteiras

- A expansão unitária `1.0` continua aceitando 15–20 e materializando até
  15.504 candidatos quando usada isoladamente.
- A cobertura exata `1.0` continua recebendo somente 1–1.000 candidatos simples
  e não expande fontes implicitamente.
- As auditorias das Stories 4.3–4.5 não mudam e não são executadas pela
  composição.
- A operação é transitória: `persisted: false`, `frozen: false` e
  `portfolioStateChanged: false`; somente o resultado aninhado da cobertura
  declara `coverageCalculated: true`.
- Não há rede, banco, histórico, estratégia, geração, preço/cotas, concurso,
  aprovação, congelamento, impressão, conferência ou UI.

## Testes e gate

Os testes devem provar fontes unitárias e múltiplas; somas exatas para 15–18;
ordem de fontes e candidatos; sobreposição total e parcial entre fontes;
preservação de ocorrências duplicadas; coerência entre total, distintos e
duplicados; vínculo entre resumos, request e cobertura; preflight em 1.000 e
1.001; rejeição de 19–20; validação estrita; cancelamento, timeout, progresso e
streams da CLI. Devem existir regressões explícitas dos contratos e comandos das
Stories 4.6 e 4.7.

**Gate de arquitetura:** aprovado para redação da Story 4.8 e implementação da
primeira composição transitória entre expansão canônica e cobertura exata,
somente dentro das fronteiras acima.
