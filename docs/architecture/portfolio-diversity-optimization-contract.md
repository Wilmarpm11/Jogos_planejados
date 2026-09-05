# Contrato de otimização determinística de diversidade da carteira

**Status:** aprovado — `PASS` arquitetural e PO `GO` (9/10, confiança alta)

**Data:** 2026-09-04

**Contrato:** `1.0`

**Política:** `DETERMINISTIC_GREEDY_MIN_OVERLAP`

## Decisão

Criar um contrato público, estrito e versionado em
`@boloes/lottery-contracts` e implementá-lo no package previsto
`@boloes/portfolio-engine`. A versão inicial seleciona deterministicamente um
subconjunto de um pool pronto, sem gerar ou modificar apostas e sem alegar
ótimo global, probabilidade ou cobertura.

O contrato reutiliza a validação e a ordenação canônica dos candidatos, extrai
uma única primitiva pública de cardinalidade de interseção para
`@boloes/combinatorics` e faz a auditoria 4.4 consumir a mesma primitiva. Não é
permitida uma segunda implementação do cálculo de interseção.

Quando houver alocação estrutural explícita, a adaptação Lotofácil reutiliza a
classificação da Story 4.5, a validação da alocação e a regra de maiores restos
já usada pelo gerador. No modo neutro, nenhuma cota estrutural é inferida.

Não criar uma skill AIOX específica: o contrato, a primitiva compartilhada, os
adaptadores por modalidade e seus testes serão as fontes de verdade. A primeira
adaptação fica restrita a `lotofacil@1.0.0`, universo 25/15 e apostas simples
canônicas de 15 dezenas.

## Fronteiras

- `@boloes/lottery-contracts`: request, result, progresso, erros e versões.
- `@boloes/combinatorics`: única primitiva compartilhada de cardinalidade de
  interseção entre duas sequências canônicas.
- `@boloes/audit-engine`: preserva o contrato público `1.0` da Story 4.4 e passa
  a reutilizar a primitiva compartilhada sem alterar seus resultados.
- `@boloes/portfolio-engine`: matriz de sobreposição e seleção gulosa pura.
- `@boloes/lottery-lotofacil`: adaptador com comparação canônica,
  validação/classificação estrutural e conversão da alocação percentual em
  quantidades finais. A regra privada de maiores restos existente deve ser
  promovida ou encapsulada nesse adaptador e não reimplementada no motor.
- `apps/cli`: comando local `portfolio optimize-diversity --input PATH`, JSONL
  de progresso em `stderr`, resultado final único em `stdout` e `SIGINT` como
  cancelamento com exit code `130`.

O motor não consulta histórico, coorte, frequência observada, cobertura,
probabilidade, catálogo, preço, cotas financeiras, banco, rede, relógio ou
entropia. Ele não persiste, aprova, congela ou altera estado de carteira.

### Decisão de execução da versão 1.0

A versão `1.0` é executada localmente em TypeScript dentro de
`@boloes/portfolio-engine`. Essa restrição reutiliza diretamente os contratos,
adaptadores e auditorias TypeScript existentes e é compatível com o teto fechado
de 1.000 candidatos. Ela não cria IPC nem processo Python.

A reserva fundacional de Python para cálculo pesado em `docs/architecture.md`
continua válida como direção futura, mas não obriga esta fatia limitada a criar
prematuramente o contrato geral Tauri/TypeScript/Python. Esse contrato geral
permanece um gate pendente do projeto. Migrar a política para Python, adicionar
IPC ou remover o limite exige decisão arquitetural e versão próprias, com testes
de compatibilidade que preservem o resultado semântico da política `1.0`.

## Versões e constantes normativas

- `contractVersion`: `1.0`.
- `algorithm`: `DETERMINISTIC_GREEDY_MIN_OVERLAP`.
- `algorithmVersion`: `deterministic-greedy-min-overlap/1.0.0`.
- `intersectionAlgorithmVersion`: `intersection-cardinality/1.0.0`.
- `minimumPoolSize`: `1`.
- `maximumPoolSize`: `1_000`.
- `1 <= targetCandidateCount <= poolSize <= 1_000`.
- `globallyOptimal`: sempre `false`.
- `probabilityClaimed`: sempre `false`.
- `timeoutApplied`: sempre `false` na versão `1.0`.
- fases, nesta ordem: `BUILD_OVERLAP_MATRIX` e `SELECT_CANDIDATES`.

Qualquer mudança da função objetivo, desempate, ordem das fases ou teto exige
nova versão da política. Aumento do teto também exige benchmark prévio de tempo
e memória, registrado antes da decisão.

## Request

O request público contém somente:

1. `contractVersion` e `algorithm` nos valores normativos;
2. `lotteryDefinition` versionada;
3. `candidates`, um pool pronto com 1 a 1.000 apostas;
4. `targetCandidateCount` inteiro entre 1 e o tamanho do pool;
5. `structuralConstraint`, discriminada como:
   - `NEUTRAL`, sem alocação; ou
   - `PRESERVE_EXPLICIT_ALLOCATION`, com a alocação percentual explícita e já
     aprovada para a estratégia.

O request não recebe seed, multiplicador de pool, quantidade a gerar,
histórico, frequências, cobertura, probabilidade ou parâmetros financeiros. O
motor nunca chama o gerador implicitamente.

## Preflight

Antes do primeiro evento de progresso, a operação:

1. valida contrato, definição, limites e `targetCandidateCount`;
2. valida cada aposta como candidato simples canônico da definição;
3. ordena o pool pelo comparador canônico versionado da modalidade; na primeira
   adaptação, ele reutiliza
   `LOCALE_COMPARE_OF_COMMA_JOINED_CANONICAL_GAMES`, já declarado no manifesto
   Lotofácil, sem criar uma segunda semântica de ordenação;
4. rejeita duplicatas detectadas após a canonização do pool;
5. preserva a relação entre cada candidato, sua posição de entrada e sua
   posição no pool canônico para proveniência;
6. no modo estrutural explícito, valida a alocação e classifica todo o pool;
7. recalcula as quantidades das faixas para `targetCandidateCount` pela regra de
   maiores restos existente: piso de cada quantidade exata, distribuição das
   vagas restantes pelos maiores restos e desempate pela ordem canônica
   `STRUCTURAL_BAND_ORDER`;
8. rejeita a solicitação se alguma faixa do pool tiver menos candidatos que a
   quantidade final exigida.

Falha de preflight não emite progresso nem resultado parcial. No modo
`NEUTRAL`, o motor não consulta estratégia, não calcula percentuais e não
infere cotas estruturais.

## Algoritmo normativo

### Canonização

Cada candidato mantém suas dezenas em ordem canônica. O pool é ordenado pelo
comparador canônico versionado da modalidade antes de qualquer seleção. Na
Lotofácil `1.0`, “menor sequência lexicográfica” significa exatamente a ordem
`LOCALE_COMPARE_OF_COMMA_JOINED_CANONICAL_GAMES` já usada pela geração e pela
identidade canônica. Todos os desempates reutilizam esse comparador; índices da
entrada original servem apenas à proveniência e nunca influenciam o resultado.

### Construção da matriz

Para cada par não ordenado do pool canônico, a fase
`BUILD_OVERLAP_MATRIX` calcula exatamente uma cardinalidade de interseção pela
primitiva compartilhada `intersectionCardinality`, versionada como
`intersection-cardinality/1.0.0`, de `@boloes/combinatorics`. A primitiva recebe
duas sequências já validadas e canônicas; a validação ocorre uma única vez no
preflight. A matriz não usa o array de objetos da auditoria como segunda fonte
de verdade; a auditoria 4.4 e o otimizador compartilham o mesmo cálculo
elementar.

### Seleção gulosa

1. O primeiro selecionado é o menor candidato lexicográfico elegível. Com
   restrição estrutural, somente faixas com quantidade final positiva são
   elegíveis.
2. Visitar cada candidato ainda não selecionado. A visita verifica primeiro sua
   elegibilidade estrutural e, somente quando elegível, calcula o histograma
   incremental das interseções dele com os candidatos já selecionados.
3. Na Lotofácil simples, comparar o vetor de contagens
   `[interseção 14, interseção 13, ..., interseção 0]` em ordem lexicográfica
   crescente. A primeira diferença decide; menor contagem é melhor. Interseção
   15 não ocorre porque duplicatas foram rejeitadas.
4. Selecionar o candidato de menor vetor. Em empate completo, selecionar a
   menor sequência lexicográfica.
5. No modo estrutural explícito, somente candidatos de faixas com saldo
   restante são elegíveis; cada escolha reduz em uma unidade o saldo da faixa.
6. Repetir até selecionar exatamente `targetCandidateCount` candidatos.

A política é gulosa: cada passo minimiza apenas o histograma incremental daquele
passo. O resultado não afirma nem tenta provar ótimo global. Cobertura,
histórico, frequências individuais/de pares e probabilidades não participam da
função objetivo.

### Caso identidade

Quando `targetCandidateCount == poolSize`, após o preflight a operação retorna
o mesmo conjunto canônico, com `changed: false`. Nesse caso, “sem mudança” diz
respeito à composição da carteira; a serialização da saída continua em ordem
lexicográfica. Uma restrição estrutural explícita ainda deve ser satisfeita pela
carteira completa, ou o preflight rejeita a entrada. Quando
`targetCandidateCount == 1`, o resultado contém somente o primeiro candidato
canônico elegível. Nenhum desses dois caminhos constrói a matriz.

## Resultado e rastreabilidade

O resultado registra, no mínimo:

- versões do contrato, algoritmo, definição, primitiva de interseção,
  classificação estrutural e regra de maiores restos que tenham sido usadas;
- `poolSize`, `targetCandidateCount`, `changed`, `selectionMode`,
  `globallyOptimal: false`, `probabilityClaimed: false` e
  `timeoutApplied: false`;
- carteira final em ordem lexicográfica;
- `selectionOrder` discriminada por modo:
  - `GREEDY_SUBSET`, quando `1 < targetCandidateCount < poolSize`: o primeiro
    item usa `winningIncrementalHistogram: null` e razão `FIRST_CANONICAL`; cada
    passo posterior exige o histograma incremental vencedor, com exatamente os
    buckets `betSize - 1` até `0`, contagem total igual ao número de candidatos
    previamente selecionados e soma ponderada igual à soma das interseções
    usadas naquele passo;
  - `IDENTITY`, quando `targetCandidateCount == poolSize`: lista a ordem
    canônica completa, usa `winningIncrementalHistogram: null` em todos os
    itens e razão `IDENTITY_SHORTCUT`;
  - `LEXICOGRAPHIC_SINGLETON`, quando `targetCandidateCount == 1 < poolSize`:
    contém somente o escolhido, com `winningIncrementalHistogram: null` e razão
    `SINGLE_TARGET`;
- proveniência de cada selecionado, com posição da entrada original e posição
  no pool canônico;
- política estrutural aplicada e, quando explícita, percentuais solicitados,
  quantidades recalculadas e quantidades realizadas por faixa;
- totais de trabalho das duas fases e unidades processadas;
- marcadores `transient: true`, `persisted: false`, `frozen: false`,
  `coverageCalculated: false` e `portfolioStateChanged: false`.

## Progresso, cancelamento e limites

- Quando `1 < targetCandidateCount < poolSize`, `BUILD_OVERLAP_MATRIX` usa
  pares processados como unidade e total `C(poolSize, 2)`.
- `SELECT_CANDIDATES` usa inspeções dos candidatos remanescentes como unidade.
  Seu total determinístico é
  `(targetCandidateCount - 1) × (2 × poolSize - targetCandidateCount) / 2`;
  cada unidade é uma visita a um candidato não selecionado, incluindo a visita
  que o declara estruturalmente inelegível. Somente visitas elegíveis comparam
  o histograma.
- Fases com `totalWork > 0` emitem início, avanços monotônicos e conclusão. Nos
  atalhos `targetCandidateCount == 1` e
  `targetCandidateCount == poolSize`, não há matriz nem inspeções: cada fase
  emite exatamente um evento terminal com `processedWork = totalWork = 0`; o
  percentual da fase é `100`, enquanto o percentual geral fica `0` no evento
  de `BUILD_OVERLAP_MATRIX` e chega a `100` somente no evento terminal de
  `SELECT_CANDIDATES`.
- Os eventos registram `processedWork`, `totalWork`, `overallProcessedWork`,
  `overallTotalWork` e percentual. O total geral é a soma dos dois totais
  homogêneos de avaliações discretas; no caminho de trabalho zero, o percentual
  terminal é `100`.
- A execução é assíncrona em lotes limitados, cede o event loop e consulta o
  `AbortSignal` antes do trabalho e entre lotes.
- Cancelamento lança erro tipado, não publica resultado parcial e é convertido
  pela CLI em exit code `130`.
- Não existe timeout na versão `1.0`; o limite rígido de 1.000 candidatos é a
  contenção operacional aprovada.

`changed` é `false` exclusivamente em `selectionMode: IDENTITY`. Nos modos
`GREEDY_SUBSET` e `LEXICOGRAPHIC_SINGLETON`, o alvo é menor que o pool e
`changed` é `true`.

## Erros públicos e mapeamento CLI

A versão `1.0` congela o enum público
`PortfolioDiversityOptimizationErrorCode` com exatamente estes valores:

- `INVALID_PORTFOLIO_DIVERSITY_REQUEST`: falha de schema ou preflight que não
  pertença às categorias específicas abaixo;
- `DUPLICATE_PORTFOLIO_DIVERSITY_CANDIDATE`: duas posições da entrada resultam
  no mesmo candidato canônico;
- `INFEASIBLE_PORTFOLIO_DIVERSITY_ALLOCATION`: o pool não consegue cumprir as
  contagens finais de uma alocação estrutural explícita;
- `PORTFOLIO_DIVERSITY_OPTIMIZATION_CANCELLED`: cancelamento cooperativo por
  `AbortSignal`, incluindo `SIGINT` encaminhado pela CLI.

Os nomes públicos dos erros tipados são, respectivamente,
`InvalidPortfolioDiversityRequestError`,
`DuplicatePortfolioDiversityCandidateError`,
`InfeasiblePortfolioDiversityAllocationError` e
`PortfolioDiversityOptimizationCancelledError`. Cada classe expõe seu `code`
literal. Mensagens são diagnósticas e não podem ser usadas por consumidores para
controle de fluxo.

A CLI serializa uma única linha JSONL em `stderr` no formato estrito
`{ type: "error", code, message }`, mantém `stdout` vazio e não emite resultado
parcial. Os três erros de entrada/preflight usam exit code `1`; cancelamento usa
exit code `130`. Como a versão `1.0` não possui timeout, ela não publica código
de timeout nem usa exit code `124`.

## Complexidade e memória

Para pool `n`, alvo `t` e tamanho de aposta `k`, a matriz exige
`C(n,2)` interseções e a seleção gulosa registra
`(t - 1) × (2n - t) / 2` visitas a candidatos remanescentes. Como `t <= n` e `k` é limitado pela
definição, o tempo permanece quadrático no teto aprovado. A matriz triangular
deve usar representação numérica compacta e não duplicar a lista materializada
de pares da auditoria 4.4.

O teto de 1.000 é fechado para `1.0`. O benchmark de pior caminho deve usar
`poolSize = 1.000` e `targetCandidateCount = 999`, porque `target == pool` é um
atalho sem trabalho. Qualquer aumento exige benchmark local de tempo e pico de
memória, regressão integral e nova decisão versionada antes da alteração.

## Compatibilidade e testes obrigatórios

- Preservar integralmente os contratos públicos e resultados das Stories
  4.2–4.8.
- Reexecutar toda a suíte da auditoria 4.4 após a extração da primitiva de
  interseção.
- Usar oráculo independente em pools pequenos para histograma incremental,
  ordem lexicográfica, primeiro candidato e desempates.
- Cobrir `target` 1, `target == pool`, pool 1, pool 1.000, entradas inválidas,
  duplicatas, alocação factível, alocação inviável e empate de maiores restos.
- Validar os quatro códigos e nomes públicos de erro, seus mapeamentos para exit
  `1`/`130`, `stdout` vazio e ausência de progresso ou resultado parcial nas
  falhas de preflight.
- Provar que permutações da ordem de entrada produzem a mesma carteira final e
  a mesma ordem de seleção, variando somente a proveniência da posição original.
- Provar ausência de acesso a cobertura, histórico, frequências e probabilidade.
- Validar os histogramas associados à ordem de seleção: buckets completos,
  contagem total e soma ponderada coerentes com a matriz compartilhada.
- Validar os três valores de `selectionMode`, suas razões e a ausência de
  histogramas fabricados nos atalhos, além da equivalência
  `changed == (targetCandidateCount < poolSize)`.
- Cobrir as duas fases, cancelamento antes/durante cada fase, `SIGINT`/130,
  separação `stderr`/`stdout`, ausência de timeout e ausência de resultado
  parcial.
- Rodar lint, typecheck, testes completos, CodeRabbit local e revisão
  independente antes de concluir a story.

## Gate arquitetural

**Parecer:** `PASS` em 2026-09-04.

O draft da Story 4.9 reproduz as regras aprovadas sem ampliar a função objetivo,
antecipa os casos de borda e preserva contratos existentes. Não há bloqueio
arquitetural para promoção a `Ready`.

## Gate PO

**Parecer:** `GO` — 9/10, confiança alta e zero bloqueios, em 2026-09-04.

O contrato e a story possuem requisitos rastreáveis, critérios testáveis,
dependências e File List suficientes para implementação. O cuidado não
bloqueante apontado pelo PO foi resolvido antes da implementação: os quatro
nomes e códigos públicos de erro, bem como os exits da CLI, estão congelados
neste contrato e devem ser materializados literalmente nos schemas e testes.
