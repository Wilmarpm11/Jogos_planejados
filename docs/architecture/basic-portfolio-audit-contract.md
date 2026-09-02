# Contrato de auditoria básica de carteira

## Decisão

Criar um contrato público e versionado em `@boloes/lottery-contracts` e uma
implementação pura em `@boloes/audit-engine`. A capacidade é reutilizável por
modalidade; não será criada uma skill específica.

O contrato recebe `LotteryDefinition` e candidatos canônicos já gerados. O
motor não conhece histórico, estratégia, coorte, persistência, cobertura ou
estado de carteira. A Lotofácil apenas fornece a definição 25/15; a enumeração
de dezenas e pares usa os limites declarados pela modalidade.

## Fronteiras

- `lottery-contracts`: schemas e tipos versionados de request/result.
- `audit-engine`: validação dependente da definição, identidade canônica,
  duplicidades e contadores completos de dezenas e pares.
- `apps/cli`: leitura do JSON, validação do contrato e serialização do resultado.
- O resultado é transitório e descritivo. Não promove uma carteira para
  `AUDITADA`, não otimiza, não calcula cobertura e não persiste dados.

## Compatibilidade e determinismo

A versão inicial do contrato é `1.0`. Dezenas são emitidas em ordem crescente;
pares são emitidos lexicograficamente, inclusive com contagem zero; duplicatas
são agrupadas pela representação canônica do jogo. Mudanças incompatíveis na
forma de entrada ou saída exigem nova versão do contrato.

## Complexidade e limites

Para `n` candidatos, tamanho de aposta `k` e universo `u`, o custo é
`O(n × k² + u²)` e a memória é `O(n + u²)`. Na Lotofácil simples, cada jogo
incrementa 15 dezenas e 105 pares, e a saída contém sempre 25 dezenas e 300
pares. Interseções entre jogos ficam fora deste contrato por terem custo
quadrático em `n`.

O PRD não define um máximo operacional de candidatos. Portanto, esta decisão
não cria um limite numérico; progresso, cancelamento e política de recursos
permanecem como decisão própria antes de classificar a operação como pesada.

## Extensão quadrática aprovada para a Story 4.4

A política de produto do PRD v0.4.5 fecha o gate do NFR-04. A auditoria de
interseções reutiliza `@boloes/audit-engine` e o contrato público versionado em
`@boloes/lottery-contracts`; não cria package, skill ou regra por modalidade.
A auditoria básica `1.0` permanece compatível e sem o teto da operação
quadrática.

O novo contrato `1.0` recebe de 2 a 1.000 candidatos canônicos e rejeita o
excesso no schema, antes de iniciar o cálculo. O resultado contém, em ordem
lexicográfica de índices `i < j`, o tamanho da interseção de cada par, além de
um histograma completo de `0` a `betSize`, inclusive buckets com zero. Também
declara `algorithmVersion`, `candidateCount`, total esperado/processado de
pares e os mesmos marcadores transitórios da auditoria básica. Não calcula
cobertura, eficiência, probabilidade, otimização ou estado de carteira.

Para que o cancelamento seja observável no CLI, a implementação é assíncrona e
cede o event loop entre lotes limitados. Um `AbortSignal` é consultado antes do
primeiro lote e entre lotes; cancelamento lança erro tipado e não devolve
resultado parcial. O callback de progresso emite estado inicial, avanços
monotônicos e conclusão com `processedPairs`, `totalPairs` e percentual inteiro.
O CLI escreve esses eventos como JSON Lines em `stderr`, reserva `stdout` para o
resultado final e converte `SIGINT` em cancelamento cooperativo.

Para `n` candidatos de tamanho `k`, o custo é `O(n² × k)` e a memória de saída
é `O(n² + k)`. O motor usa interseção de duas sequências canônicas por dois
ponteiros, sem criar conjuntos por par. O teto de 1.000 limita uma execução a
`C(1000,2) = 499.500` pares. A versão do algoritmo e o limite máximo são
constantes públicas; qualquer aumento do teto exige nova decisão de produto e
evidência de tempo e memória, sem alterar silenciosamente o contrato `1.0`.

**Gate de arquitetura:** aprovado. A extensão preserva as fronteiras do Core,
o determinismo, a compatibilidade da auditoria básica e a hierarquia CLI First.

## Consequências

- Reuso: outras modalidades podem usar o mesmo motor com sua definição.
- Isolamento: regras estruturais e métricas específicas continuam nos módulos
  de modalidade.
- Testabilidade: o motor funciona sem rede, banco ou relógio e pode ter testes
  determinísticos de contrato.
- Sequência do produto: esta capacidade não altera a ordem obrigatória
  geração → diversidade → auditoria de cobertura; ela é apenas o componente
  descritivo que poderá integrar a auditoria formal posterior.

## Extensão estrutural planejada para a Story 4.5

### Decisão de reutilização e restrição

Reutilizar o contrato compartilhado de `StructuralSummary`, `StructuralBand` e
`ExactFraction` em `@boloes/lottery-contracts`, a validação canônica de
candidatos e o motor de agregação em `@boloes/audit-engine`. Não criar nova
skill nem novo package. A agregação é reutilizável, mas a Story 4.5 conecta
somente o adaptador da Lotofácil, composto pelo MetricEngine,
StructuralClassifier e resumo estrutural já versionados em
`@boloes/lottery-lotofacil`.

O Core não importa o módulo Lotofácil. O motor recebe um adaptador explícito que
transforma um candidato canônico em `StructuralSummary`; a camada CLI seleciona
o adaptador pela modalidade. Outras modalidades só podem ser conectadas quando
fornecerem suas próprias regras e versões, sem herdar limites E1–E10.

### Contrato e comportamento

O request público versionado preserva o envelope com `LotteryDefinition` e
candidatos canônicos. Na primeira integração, `lotteryId` deve ser `lotofacil` e
`betSize` deve ser 15; apostas de 16–20 e modalidades sem adaptador são
rejeitadas explicitamente antes da agregação.

O resultado contém versões do contrato, algoritmo, MetricEngine e classifier,
`candidateCount` e os cinco buckets de `StructuralBand` em ordem canônica. Cada
bucket informa contagem inteira e frequência exata com denominador derivado do
total de candidatos, inclusive quando a contagem é zero. As contagens somam
exatamente `candidateCount`. Não são materializados perfis individuais nem
comparações com massa teórica, estratégia ou alocação solicitada.

O processamento é assíncrono em lotes limitados. O progresso informa fase,
`processedCandidates`, `totalCandidates` e percentual inteiro; o cancelamento
cooperativo usa `AbortSignal`, lança erro tipado e não retorna resultado parcial.
No CLI, progresso permanece em JSON Lines no `stderr` e o JSON final permanece
sozinho no `stdout`.

### Complexidade e fronteiras

Para `n` candidatos e custo fixo do adaptador Lotofácil simples, o custo cresce
linearmente em `n`; a saída ocupa `O(1)` para as cinco faixas, além da entrada já
materializada. Essa operação não herda o teto de 1.000 da auditoria quadrática.

O resultado é transitório, não persistido, não congelado, não calcula cobertura,
não otimiza diversidade, não filtra ou reordena candidatos e não altera o estado
da carteira. Núcleo central, sinais auxiliares, comparação com massa teórica e
aderência à estratégia ficam fora desta primeira distribuição.

**Gate de arquitetura:** aprovado para redação da Story 4.5, preservando CLI
First, isolamento por modalidade e compatibilidade dos contratos das Stories
4.3 e 4.4.
