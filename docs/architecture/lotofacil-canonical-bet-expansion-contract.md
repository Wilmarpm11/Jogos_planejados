# Contrato de expansão canônica de aposta Lotofácil

## Decisão de capacidade reutilizável

Criar um contrato público e versionado em `@boloes/lottery-contracts` e
implementar o adaptador da primeira modalidade no módulo existente da
Lotofácil. Reutilizar `binomialCoefficient` e `forEachCombination` de
`@boloes/combinatorics`; não criar package ou skill. A estabilidade necessária
pertence ao contrato executável, à enumeração combinatória compartilhada e aos
testes.

O contrato do Core descreve a expansão sem embutir constantes de modalidade.
O adaptador Lotofácil restringe a primeira integração a `lotofacil`, definição
`1.0.0`, universo `01–25`, aposta-fonte de 15–20 dezenas e unidade simples de 15.
Nenhuma regra é propagada silenciosamente para outra modalidade.

## Semântica de produto

O contrato `1.0` recebe uma `LotteryDefinition` e exatamente uma aposta-fonte.
A aposta precisa estar em forma canônica: inteiros dentro do universo, únicos e
em ordem estritamente crescente. O tamanho é derivado da quantidade de dezenas
e deve estar entre 15 e 20 para o adaptador Lotofácil.

A expansão visita todas as escolhas de 15 índices da aposta-fonte e projeta cada
escolha para as dezenas correspondentes. A ordem é lexicográfica e estável; não
há aleatoriedade, seed, filtro, otimização ou reordenação posterior. A aposta de
15 dezenas produz uma única combinação idêntica. As contagens obrigatórias são:

Como `forEachCombination` reutiliza o mesmo buffer de índices entre visitas, o
adaptador projeta e copia cada candidato antes de armazená-lo. O request e a
aposta-fonte não são mutados.

| Tamanho da aposta-fonte | Combinações simples de 15 |
| ---: | ---: |
| 15 | 1 |
| 16 | 16 |
| 17 | 136 |
| 18 | 816 |
| 19 | 3.876 |
| 20 | 15.504 |

O resultado declara versões do contrato e do algoritmo, identidade/versão da
modalidade, tamanho e dezenas da aposta-fonte, tamanho simples, quantidade
esperada e candidatos materializados. Também declara explicitamente
`transient: true`, `persisted: false`, `frozen: false`,
`coverageCalculated: false` e `portfolioStateChanged: false`.

## Limites operacionais e observabilidade

A entrada unitária limita uma execução a `C(20,15) = 15.504` candidatos. Esse
teto deriva do maior tamanho de aposta autorizado pelo PRD, não de uma cota
operacional inventada. A enumeração é síncrona e finita; não introduz progresso,
timeout ou cancelamento na versão `1.0`.

O contrato `1.0` publica esse teto como limite absoluto de materialização,
deriva `C(sourceBetSize, drawSize)` antes de chamar o adaptador e valida em
conjunto request e resultado. Modalidade, versão, aposta-fonte e tamanho simples
do resultado precisam coincidir com o request que originou a execução.

A CLI expõe `lotofacil expand --numbers 01,02,...` e escreve somente o JSON final
em `stdout`. Entradas inválidas falham antes da enumeração e usam o canal de erro
existente da CLI. A ação não consulta rede, banco, relógio, histórico, estratégia,
catálogo, preços ou cotas.

## Compatibilidade e fronteiras

As auditorias das Stories 4.3–4.6 não mudam. Em especial, o contrato de cobertura
exata `1.0` continua aceitando somente carteiras de 1 a 1.000 candidatos simples
de 15 dezenas e não passa a expandir entradas automaticamente. A integração de
apostas expandidas com carteira e cobertura exige story, limites e evidência de
desempenho próprios.

O primeiro contrato não agrega várias apostas-fonte, elimina sobreposições entre
fontes, calcula custo/cotas, audita cobertura, persiste, congela ou imprime. Ele
somente estabelece a transformação canônica exigida por FR-01, FR-02, FR-05 e
pela seção 7.4 do PRD.

## Testes e gate

Os testes devem provar aceitação de 15–20, identidade para 15, contagens exatas
para todos os tamanhos, ordem lexicográfica, unicidade, preservação da entrada,
primeira/última combinação e rejeição em preflight de modalidade, versão,
intervalo, duplicidade, desordem e tamanho não aplicáveis. A CLI deve ser coberta
sem persistência e com separação correta entre `stdout` e `stderr`.

**Gate de arquitetura:** aprovado para redação da Story 4.7 e implementação
da primeira expansão canônica Lotofácil dentro das fronteiras acima.

**Revalidação pós-implementação (2026-09-02): PASS.** O contrato compartilhado
permanece neutro, `lottery-contracts -> combinatorics` é uma dependência interna
unidirecional, as regras 25/15 continuam isoladas no adaptador Lotofácil e a
cobertura 4.6 não recebeu expansão implícita. O cenário máximo materializou
15.504 candidatos em aproximadamente 0,26 s, com saída JSON de cerca de 810 KB;
lint, typecheck, 35 testes direcionados/regressivos e os 165 testes integrais
passaram.
