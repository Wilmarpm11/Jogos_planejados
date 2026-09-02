# Contrato de cobertura exata da carteira Lotofácil

## Decisão de capacidade reutilizável

Criar um contrato público e versionado em `@boloes/lottery-contracts` e o novo
package `@boloes/coverage-engine`, já reservado pela arquitetura do monólito
modular. Reutilizar `@boloes/combinatorics` para enumeração e ranking de
combinações. Não criar uma skill: a estabilidade necessária pertence ao
contrato executável e aos testes.

O motor permanece independente de modalidade e recebe um adaptador explícito
com os limiares de cobertura e a validação da definição. A primeira integração
fica restrita a `lotofacil`, definição 25/15 versão 1.0.0 e apostas simples de 15
dezenas. Nenhuma regra, teto ou constante Lotofácil entra silenciosamente em
outra modalidade. Apostas de 16–20 exigem decisão e contrato próprios de
expansão antes de serem aceitas.

## Semântica de produto

O contrato `1.0` recebe `LotteryDefinition` e de 1 a 1.000 candidatos canônicos.
O adaptador Lotofácil expõe quatro faixas cumulativas, nesta ordem: 15, 14+, 13+
e 12+. Uma aposta simples cobre respectivamente 1, 151, 4.876 e 59.476
resultados brutos, valores derivados por:

`sum(C(15,h) × C(10,15-h)), para h do limiar até 15`.

Para cada faixa, o resultado informa:

- `minimumHits`;
- `grossCoveredOutcomes`, contando cada ocorrência de candidato;
- `uniqueCoveredOutcomes`, contando cada resultado possível uma única vez;
- `repeatedCoveredOutcomes = grossCoveredOutcomes - uniqueCoveredOutcomes`;
- `efficiency = uniqueCoveredOutcomes / grossCoveredOutcomes`, como
  `ExactFraction` reduzida.

Duplicatas permanecem ocorrências independentes na cobertura bruta. Elas não
aumentam a cobertura única e, portanto, aparecem como repetição/redundância. O
motor não remove, reordena ou altera os candidatos.

## Algoritmo exato

O universo da Lotofácil contém `C(25,15) = 3.268.760` resultados. Cada resultado
canônico recebe ranking combinatório determinístico. O motor aloca um mapa denso
de um byte por resultado e, para cada candidato, enumera exatamente as
combinações com interseção de 12, 13, 14 e 15 dezenas. Em cada índice, conserva
o maior número de acertos observado.

Após processar os candidatos, uma única varredura do mapa conta, para cada
limiar, os índices cujo maior acerto é igual ou superior. Não há amostragem,
estimador, semente, ponto flutuante ou dependência de histórico. Uma execução
concluída declara `method: EXACT_ENUMERATION`, `exact: true`, erro absoluto zero
e erro relativo `0/1`.

O custo é `O(n × 59.476 × 15 + C(25,15))` para `n` apostas simples; o mapa ocupa
3.268.760 bytes, além da entrada e de buffers combinatórios limitados. No teto
de 1.000 candidatos, são 59.476.000 visitas de resultados cobertos antes da
varredura final.

## Limites operacionais e observabilidade

- O request rejeita modalidade, definição, tamanho de aposta ou quantidade não
  aplicável antes do primeiro evento de progresso.
- A execução possui timeout rígido de 30.000 ms medido por relógio monotônico.
- No máximo 65.536 visitas podem ocorrer entre yields, verificações de timeout,
  verificações de `AbortSignal` e emissões de progresso.
- O total de trabalho observável é
  `candidateCount × 59.476 + 3.268.760`; progresso é inicial, monotônico e
  termina em 100% somente antes de um resultado válido.
- Cancelamento lança erro tipado e a CLI encerra com código 130. Timeout lança
  erro tipado `COVERAGE_TIMEOUT`, usa código 124 e não devolve resultado parcial.
- `stdout` contém somente o JSON final; progresso e erros operacionais usam
  JSON Lines em `stderr`.

O resultado também declara versões de contrato, algoritmo e adaptador,
identidade/versão da modalidade, `candidateCount`, tamanho de aposta, universo,
timeout e trabalho processado. Ele é transitório, não persistido, não congelado
e não altera o estado da carteira.

## Evidência de desempenho

Um protótipo local em Node.js v24.14.0, macOS arm64, aplicou o algoritmo de mapa
denso às primeiras combinações lexicográficas canônicas:

| Candidatos | Visitas | Tempo observado | Mapa denso |
| ---: | ---: | ---: | ---: |
| 286 | 17.010.136 | 1.026 ms | 3.268.760 bytes |
| 500 | 29.738.000 | 1.753 ms | 3.268.760 bytes |
| 1.000 | 59.476.000 | 3.900 ms | 3.268.760 bytes |

O timeout de 30 segundos preserva margem superior a sete vezes o maior tempo
observado. Essa evidência autoriza o teto inicial, mas não autoriza aumentá-lo,
aceitar outras modalidades ou adicionar expansão 16–20 sem nova decisão
versionada e novo benchmark.

## Testes e compatibilidade

Os testes devem provar as quatro contagens brutas canônicas, união exata em
carteiras sobrepostas, duplicatas, frações reduzidas, conservação
`unique + repeated = gross`, progresso, cancelamento, timeout e rejeição em
preflight. Um cenário de 1.000 candidatos deve concluir dentro do limite e 1.001
deve ser rejeitado sem progresso.

As auditorias das Stories 4.3–4.5 permanecem compatíveis e não passam a calcular
cobertura. O motor não consulta rede, banco, relógio civil, estratégia, coorte,
resultados históricos, preço ou estado persistido.

**Gate de arquitetura:** aprovado para redação da Story 4.6 e para implementação
da primeira cobertura exata Lotofácil, dentro dos limites acima.
