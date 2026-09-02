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
