# MetricEngine Lotofácil

**Versão:** 1.0.0  
**Story de origem:** 2.2  
**Escopo:** métricas estruturais puras, sem histórico, estratégia ou geração.

## Contrato

O módulo expõe `calculateLotofacilMetricProfile(numbers)` e o contrato
reutilizável `LotteryMetricEngine<Profile>`. O
`lotofacilStructuralClassifier` aplica regras válidas ao perfil já calculado.
A entrada aceita exclusivamente
15 a 20 dezenas únicas entre 01 e 25. A saída ordena as dezenas
canonicamente e inclui a definição versionada da modalidade, as métricas
Lotofácil, a ocupação da Story 2.1 e flags de regra.

## Semântica

- Moldura: 01–06, 10–11, 15–16, 20–25 (16 dezenas).
- Centro: 07–09, 12–14 e 17–19 (nove dezenas).
- Par consecutivo: uma relação marcada `n, n+1`; uma corrida de tamanho
  `k` contém `k - 1` pares.
- Sequência: corrida máxima de duas ou mais dezenas consecutivas. Isoladas não
  são sequências.
- Amplitude: maior dezena menos menor dezena.

## Classificação estrutural

Os limiares E1–E10 são aplicados somente a cartelas simples de 15 dezenas. E9
e E10 usam, respectivamente, `row_deviation >= 8` e
`column_deviation >= 8`. Em apostas de 16 a 20, as métricas continuam
disponíveis, mas cada flag declara `applicable: false` e `isExtreme: null`.
Isso evita reutilizar um limite de 15 dezenas como se fosse uma distribuição
teórica de outro tamanho.

O classificador também expõe sinais auxiliares de ocupação para 15 dezenas:
duas posições unitárias = `ATTENTION`, uma vazia = `RARE` e duas vazias =
`VERY_RARE`. Eles são independentes por eixo, não entram em E1–E10 ou
`extreme_count`, e não autorizam rejeição pelo gerador. Para 16–20, esses
sinais são não aplicáveis até haver política derivada do universo próprio.

`extreme_count`, E9/E10 consolidados e faixa estrutural não fazem parte deste
contrato; serão calculados somente depois de todas as regras possuírem
semântica e aplicabilidade congeladas.
