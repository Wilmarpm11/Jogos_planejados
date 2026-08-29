# Resumo estrutural da Lotofácil

**Versão:** 1.0.0  
**Story de origem:** 2.3  
**Escopo:** consolidação pura de métricas e regras já calculadas.

O resumo recebe `LotofacilMetricProfile` e
`LotofacilStructuralClassification`; ele não recalcula E1–E10, não consulta
histórico e não possui acesso ao gerador.

Para cartelas simples de 15 dezenas:

- `extreme_count` soma os flags verdadeiros de E1–E10;
- a faixa é `ZERO_EXTREMES`, `ONE_EXTREME`, `TWO_EXTREMES`,
  `THREE_EXTREMES` ou `FOUR_PLUS_EXTREMES`;
- núcleo central exige, simultaneamente: pares 6–9, soma 176–214, moldura
  8–12, baixas 7–10 e pares consecutivos 7–10.

Os sinais auxiliares de ocupação não alteram contador, faixa ou núcleo. Em
apostas de 16–20 dezenas, todos esses campos são `not_applicable` até que a
modalidade possua estudo teórico e regras versionadas por tamanho.
