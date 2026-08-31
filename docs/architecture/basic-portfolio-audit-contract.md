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

## Consequências

- Reuso: outras modalidades podem usar o mesmo motor com sua definição.
- Isolamento: regras estruturais e métricas específicas continuam nos módulos
  de modalidade.
- Testabilidade: o motor funciona sem rede, banco ou relógio e pode ter testes
  determinísticos de contrato.
- Sequência do produto: esta capacidade não altera a ordem obrigatória
  geração → diversidade → auditoria de cobertura; ela é apenas o componente
  descritivo que poderá integrar a auditoria formal posterior.
