# Contrato reutilizável — Ocupação por eixo

**Versão do contrato:** 1.0  
**Story de origem:** 2.1  
**Escopo:** métrica estrutural sem estratégia, histórico ou geração.

## Decisão de reuso

Esta capacidade é um **contrato reutilizável**, e não uma skill de Codex. Uma
modalidade que possua grade pode reutilizar os conceitos de eixo, ocupação,
desvio, distribuição teórica e raridade; ela continua responsável por sua
própria grade e universo combinatório.

## Semântica

Cada eixo tem cinco posições no módulo Lotofácil. A saída guarda:

- contagens por posição, mínimo, máximo e quantidade de posições com 0 a 5;
- valor esperado `bet_size / axis_size`;
- desvio absoluto e desvio normalizado, ambos como frações inteiras;
- distribuições teóricas versionadas por modalidade, tamanho, eixo e métrica.

Os valores não dependem de ponto flutuante. Uma fração é sempre
`numerator / denominator`.

## Raridade

As métricas auxiliares `AXES_WITH_0`, `AXES_WITH_1` e
`DEVIATION_NORMALIZED` usam a cauda `GREATER_THAN_OR_EQUAL`. Logo, a
frequência de um valor observado é a quantidade exata de resultados teóricos
com valor maior ou igual ao observado, dividida por `C(n, bet_size)`.

Classes padrão:

| Classe | Frequência teórica |
| --- | --- |
| NORMAL | >= 10% |
| ATTENTION | >= 2% e < 10% |
| RARE | >= 0,5% e < 2% |
| VERY_RARE | < 0,5% |

A classe é informativa. O contrato não contém rejeição de cartela e não
autoriza o gerador a rejeitar uma linha ou coluna apenas por ter uma dezena.

## Lotofácil

O módulo Lotofácil enumera exatamente `C(25, bet_size)` para cada tamanho de
15 a 20 dezenas e gera seis distribuições independentes: três para linhas e
três para colunas. O resultado é uma estrutura serializável, com versão do
algoritmo, pronta para ser persistida posteriormente pelo módulo de dados.
