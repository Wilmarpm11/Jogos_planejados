# Contrato de políticas e massas estruturais Lotofácil 16–20

**Versão do contrato:** 1.0
**Versão do artefato:** 1.0.0
**Story:** 4.11
**Status:** Aprovado para implementação
**Parecer arquitetural:** PASS — 2026-09-05

## 1. Objetivo e autoridade

Este contrato define como derivar, calcular, versionar e verificar políticas
estruturais próprias para apostas Lotofácil de 16, 17, 18, 19 e 20 dezenas. As
decisões funcionais são as sete decisões de Produto aprovadas em 2026-09-05; a
formalização abaixo apenas elimina ambiguidades matemáticas, contratuais e
operacionais antes da implementação.

O contrato não altera a definição, os limites, a massa ou os resultados
canônicos de 15 dezenas. Ele generaliza a aplicação da classificação para
16–20 sem modificar as fórmulas das métricas.

## 2. Reuso obrigatório e fronteiras

| Capacidade | Decisão |
| --- | --- |
| Ocupação e distribuições por eixo | Reutilizar integralmente a Story 2.1, inclusive desvios normalizados e distribuições exatas para 15–20. |
| Métricas E1–E8 | Reutilizar as fórmulas do `MetricEngine` da Story 2.2, sem versões paralelas. |
| `extreme_count`, faixas e núcleo | Reutilizar o classificador e o resumo da Story 2.3, generalizando somente políticas/limites por `betSize`. |
| Enumeração e massa | Reutilizar `@boloes/combinatorics`, `ExactFraction` e o padrão exato da Story 2.4. |
| Manifesto | Estender aditivamente o manifesto da Story 2.5, com nova versão e preservação integral do registro de 15. |
| Novos artefatos | Criar somente políticas e massas Lotofácil versionadas por `betSize`. |
| Skill AIOX | Não criar; contrato, fixtures e testes são a fonte de verdade. |

Não pertencem a esta capacidade: geração, diversidade, cobertura, custo/cotas,
histórico, persistência, IPC, UI, impressão, aprovação ou congelamento.

## 3. Universos e invariantes

Seja `U_k = {S ⊆ {1,...,25} : |S| = k}`. A enumeração percorre integralmente
cada `U_k`, em ordem combinatória canônica, sem amostragem e sem repetição.

| `betSize` | `|U_k| = C(25,k)` | média descritiva da soma |
| ---: | ---: | ---: |
| 15 | 3.268.760 | 195 |
| 16 | 2.042.975 | 208 |
| 17 | 1.081.575 | 221 |
| 18 | 480.700 | 234 |
| 19 | 177.100 | 247 |
| 20 | 53.130 | 260 |

A média da soma é `13 × k` e é apenas metadado descritivo. Ela nunca seleciona
limites nem substitui a distribuição exata.

## 4. Distribuições exatas e comparação de caudas

Para uma métrica discreta `M`, tamanho `k` e valor `v` no suporte observado:

```text
N(k,M,v) = quantidade de S em U_k com M(S) = v
L(k,M,v) = soma de N(k,M,x) para x <= v
R(k,M,v) = soma de N(k,M,x) para x >= v
```

Todas as quantidades são inteiros. Frequências são razões exatas sobre `|U_k|`.
Nenhum limite é escolhido com `number` em ponto flutuante: distâncias entre
frações são comparadas por multiplicação cruzada inteira/`BigInt`.

Para uma cauda de referência com contagem `c15` e uma cauda candidata com
contagem `ck`, a distância usada na seleção é:

```text
distanceNumerator = abs(ck * |U_15| - c15 * |U_k|)
```

O denominador comum `|U_k| × |U_15|` não precisa ser materializado. Vence o
limite com menor `distanceNumerator`.

### 4.1 Desempate de limite extremo

Se dois limites extremos tiverem a mesma distância:

1. vence a cauda com menor contagem, classificando menos apostas como extremas;
2. persistindo igualdade, para cauda inferior vence o menor limite e, para
   cauda superior, o maior limite;
3. candidatos são somente valores do suporte exato, nunca valores interpolados.

As caudas inferior e superior são selecionadas separadamente. Se os limites
selecionados se sobrepuserem ou invalidarem a regra, a derivação falha; não há
ajuste heurístico.

## 5. Política E1–E8

As fórmulas permanecem exatamente as da Story 2.2:

| Regra | Métrica | Caudas |
| --- | --- | --- |
| E1 | pares | inferior e superior |
| E2 | soma | inferior e superior |
| E3 | moldura | inferior e superior |
| E4 | dezenas 01–13 | inferior e superior |
| E5 | pares consecutivos | inferior e superior |
| E6 | maior sequência | inferior e superior |
| E7 | quantidade de sequências | inferior e superior |
| E8 | amplitude | somente inferior |

Para E1–E7, a raridade-alvo inferior é a frequência exata de `M <= lower15`
em `U_15`; a superior é a frequência exata de `M >= upper15`. Para E8, a
raridade-alvo é a frequência exata de `amplitude <= 18`. Cada limite de 16–20
é escolhido pela regra da seção 4 e registra:

- operador e valor do limite;
- contagem da cauda no universo correspondente;
- frequência exata e distância exata da raridade de referência;
- limite e contagem de referência de 15;
- versões do `MetricEngine`, da política e do algoritmo de derivação.

Os limites de 15 permanecem byte a byte e semanticamente inalterados.

## 6. Política E9 e E10

E9 e E10 são aplicáveis a 16–20 e permanecem regras separadas:

- E9 usa `row_deviation_normalized`;
- E10 usa `column_deviation_normalized`.

As distribuições e valores racionais vêm do contrato da Story 2.1. A raridade
de referência é a cauda de 15 equivalente a desvio absoluto `>= 8`, isto é,
desvio normalizado `>= 8/15`. Para cada `betSize`, o limite é um valor racional
do suporte exato que minimiza a distância da cauda superior. Em empate vence o
maior limite normalizado e, portanto, a menor cauda.

O limite absoluto `8` não é copiado. A eventual igualdade matemática entre os
limites de linhas e colunas deve ser demonstrada por teste de simetria, sem
fundir E9 e E10 em uma única regra.

As distribuições `AXES_WITH_0`, `AXES_WITH_1` e `DEVIATION_NORMALIZED`
continuam disponíveis e auditáveis por tamanho. `AXES_WITH_0` e `AXES_WITH_1`
permanecem sinais auxiliares e não entram em E1–E10, `extreme_count`, faixas,
núcleo ou geração P0. `DEVIATION_NORMALIZED` é reutilizada exclusivamente por
E9 e E10, conforme definido acima. A política operacional auxiliar da Story
2.1 para 15 não é transferida para 16–20.

## 7. `extreme_count` e faixas

Para todo `betSize` de 15 a 20:

```text
extreme_count = soma de 1 para cada Ei com isExtreme = true, i em 1..10
```

Cada regra contribui uma vez, sem peso ou duplicidade. Sinais auxiliares não
participam. O resultado inteiro fica entre 0 e 10 e é acompanhado pelas dez
classificações individuais e pela versão da política.

| `extreme_count` | faixa canônica |
| ---: | --- |
| 0 | `ZERO_EXTREMES` |
| 1 | `ONE_EXTREME` |
| 2 | `TWO_EXTREMES` |
| 3 | `THREE_EXTREMES` |
| 4–10 | `FOUR_PLUS_EXTREMES` |

As faixas são mutuamente exclusivas e exaustivas. Nenhuma faixa rejeita uma
aposta no modo neutro e nenhuma contagem expressa probabilidade de prêmio.

## 8. Núcleo central

O núcleo conserva as cinco métricas da Story 2.3: pares, soma, moldura, dezenas
01–13 e pares consecutivos.

Para cada critério, a raridade inferior de referência é `P_15(M < min15)` e a
superior é `P_15(M > max15)`. Os limites inclusivos de 16–20 são escolhidos
separadamente pelas distribuições exatas. Em empate de distância:

- o limite inferior maior vence;
- o limite superior menor vence.

Isso produz a faixa mais estreita entre alternativas igualmente próximas. Os
limites devem satisfazer `min <= max`; caso contrário a derivação falha sem
fallback. O artefato registra os cinco resultados individuais e define:

```text
isCentralCore = even && sum && border && low01To13 && consecutivePairs
```

A massa conjunta do núcleo é própria de cada tamanho. Núcleo e seus critérios
são informativos, não preditivos e não constituem filtro de geração P0.

## 9. Massas e reconciliação

Cada combinação participa exatamente uma vez de cada agregação final de seu
`betSize`. O artefato de massa contém, nesta ordem canônica:

1. massa individual de E1–E10;
2. massas de `extreme_count` 0, 1, ..., 10;
3. massas das faixas `ZERO`, `ONE`, `TWO`, `THREE`, `FOUR_PLUS`;
4. massa individual dos cinco critérios do núcleo;
5. massa conjunta `isCentralCore`;
6. cruzamento das cinco faixas por `isCentralCore: false/true`;
7. universo total e provas de reconciliação.

Cada célula possui `count`, `universeSize` e `frequency: ExactFraction`, cuja
razão é exatamente `count / universeSize`. Percentuais arredondados são somente
apresentação e ficam fora do payload canônico.

São invariantes bloqueantes:

- soma de `extreme_count` 0–10 igual ao universo;
- soma das cinco faixas igual ao universo;
- `FOUR_PLUS_EXTREMES` igual à soma dos contadores 4–10;
- cada linha e cada coluna do cruzamento faixa × núcleo reconciliada;
- massa conjunta do núcleo igual à soma das células `isCentralCore: true`;
- massa individual de cada regra/critério igual à enumeração independente;
- massa de 15 nas cinco faixas igual ao snapshot canônico da Story 2.4.

Falha de qualquer invariante impede a publicação de todos os artefatos.

## 10. Schemas, identidades e versões

### 10.1 Identidades obrigatórias

```text
contractVersion          = "1.0"
artifactSchemaVersion    = "1.0.0"
canonicalSerializationVersion =
  "lotofacil-structural-canonical-json/1.0.0"
policySetId              = "lotofacil-structural-policy"
policySetVersion         = "1.0.0"
policyId                 = "lotofacil-structural-policy/{betSize}"
policyVersion            = "1.0.0"
derivationAlgorithm      = "EXACT_TAIL_RARITY_MATCH"
derivationAlgorithmVersion = "exact-tail-rarity-match/1.0.0"
classifierVersion        = "2.0.0"
massAlgorithmVersion     = "2.0.0"
```

`metricEngineVersion` e `axisOccupancyAlgorithmVersion` permanecem nas versões
canônicas existentes enquanto suas fórmulas não mudarem. A versão `2.0.0` do
classificador explicita a mudança de comportamento de 16–20 de não aplicável
para aplicável; ela não altera o resultado de 15.

### 10.2 Política por tamanho

O schema estrito de política contém:

- identidades/versões acima;
- `lotteryId`, `lotteryDefinitionVersion`, `betSize` e `universeSize`;
- média descritiva da soma;
- E1–E10 em ordem, com métrica, operador(es), limites e evidência de cauda;
- cinco critérios do núcleo, limites inclusivos e evidência das duas caudas;
- referência às distribuições auxiliares da Story 2.1;
- `historyUsed: false`, `samplingUsed: false` e `probabilityClaimed: false`;
- `artifactHash`.

### 10.3 Massa por tamanho

O schema estrito de massa contém as mesmas identidades de modalidade, tamanho,
política, classificador e algoritmos; todas as agregações da seção 9;
`enumeration: INTEGRAL`, `samplingUsed: false`, `historyUsed: false`,
`reconciled: true` e `artifactHash`.

Mistura de `betSize`, política, classificador, manifesto ou versão de algoritmo
é rejeitada antes de qualquer cálculo ou publicação.

### 10.4 Compatibilidade e atualização

- mudança de fórmula de métrica exige nova versão do `MetricEngine` e major da
  política consumidora;
- mudança de limite, operador, desempate, núcleo ou composição de
  `extreme_count` exige nova versão da política e do classificador;
- mudança de cálculo da massa exige nova versão do algoritmo ou schema;
- qualquer mudança que altere os bytes canônicos exige novas versões de
  `canonicalSerializationVersion` e `artifactSchemaVersion`, novas fixtures e
  novos hashes, sem reinterpretar ou recalcular silenciosamente artefatos
  antigos;
- mudança de `betSize` sempre possui `policyId` e massa distintos;
- artefatos antigos permanecem identificáveis e nunca são recalculados sob uma
  versão nova sem produzir uma nova identidade/hash.

## 11. Serialização e hash determinísticos

O perfil `lotofacil-structural-canonical-json/1.0.0` aceita somente `null`,
booleanos, strings Unicode válidas, inteiros permitidos pelo schema, arrays e
objetos estritos.

- chaves de todo objeto, inclusive objetos aninhados, são ordenadas pela
  sequência de bytes UTF-8 sem sinal da chave Unicode não escapada;
- arrays preservam a ordem definida pelo domínio e nunca são reordenados pelo
  serializador;
- strings escapam `"` como `\"`, `\` como `\\`, e os controles
  `U+0008`, `U+000C`, `U+000A`, `U+000D` e `U+0009` como
  `\b`, `\f`, `\n`, `\r` e `\t`; os demais caracteres `U+0000..U+001F`
  usam `\u00xx` hexadecimal minúsculo;
- os demais valores escalares Unicode são emitidos diretamente em UTF-8;
  surrogate isolado é inválido;
- A serialização não normaliza Unicode; preserva exatamente a sequência de
  valores escalares validada pelo schema. Identificadores normativos são
  restringidos pelo respectivo schema, preferencialmente a ASCII;
- inteiros usam base decimal ASCII, sem `+`, zeros à esquerda ou notação
  exponencial; `0` é a única representação de zero;
- `NaN`, `Infinity`, `-Infinity`, `-0`, números fracionários e `undefined`
  são proibidos;
- `ExactFraction` usa `{ denominator, numerator }`, ambos inteiros,
  `denominator > 0`, `numerator >= 0`, razão reduzida por MDC e zero somente
  como `0/1`; representação não canônica é rejeitada;
- `null` é emitido como `null` somente quando o schema o permite;
- campo opcional ausente é omitido; presença com `undefined` é inválida;
- não há BOM, whitespace, indentação ou quebra de linha fora de strings.

Antes da serialização genérica, as coleções de domínio usam:

- `betSize` em ordem crescente;
- regras `E1` a `E10`;
- contadores `0` a `10`;
- faixas na ordem canônica da seção 7;
- critérios do núcleo na ordem da seção 8;
- cruzamento por faixa e depois `false`, `true`.

O perfil acima, e não `JSON.stringify` isoladamente, é a definição normativa.
Os bytes são UTF-8 do JSON canônico, sem `artifactHash`. Não há
timestamp, duração, percentual de apresentação ou dado de ambiente no payload.
O hash é SHA-256 em hexadecimal minúsculo, representado como `sha256:<hex>`.
Política, massa e índice do conjunto possuem hashes próprios.

Fixtures normativas mínimas:

1. `{"fraction":{"denominator":2,"numerator":1}}`
   possui 44 bytes UTF-8 e SHA-256
   `sha256:7569c6b59b86ed222bbe8829d54ac1db9f9d3c684f92c422169c34c60525e262`.
2. `{"a":[null,"linha\n\"\\",{"frequency":{"denominator":2,"numerator":1}}],"label":"Lotofácil","z":0}`
   possui 99 bytes UTF-8 e SHA-256
   `sha256:dab0cbac6cb7e2ae4f7ac477976fb942626cbcf2b523f2ecb1de4739f064e012`.

A implementação também congela ao menos uma política, uma massa e um índice
completos por versão, preservando seus bytes UTF-8 e SHA-256 esperados. Duas
execuções com as mesmas versões devem produzir bytes idênticos.

## 12. Manifesto canônico

A implementação deve publicar uma extensão aditiva do manifesto:

- incrementar `formulaVersion` de `1.0.0` para `1.1.0`;
- preservar os campos e valores existentes de 15;
- adicionar referências ordenadas às políticas e massas de 16–20 e às suas
  versões/hashes;
- conservar a massa de cinco faixas de 15 idêntica à Story 2.4;
- não remover nem reinterpretar snapshots antigos.

O documento vigente da Story 2.5 continua descrevendo `1.0.0` até que a
implementação e as fixtures `1.1.0` existam. Planejamento não antecipa estado
executável no manifesto.

## 13. Contrato de consumo futuro pela Story 4.12

Esta story não implementa geração. Ela apenas estabiliza a referência que uma
estratégia futura poderá declarar:

```text
lotteryId + betSize + policyId + policyVersion + classifierVersion
```

Regras P0 para o consumidor futuro:

- `NEUTRAL` não aplica filtro, percentuais ou cotas estruturais;
- alocação só existe quando uma estratégia a fornece explicitamente;
- alocação aceita apenas as cinco faixas e soma 100%;
- percentuais viram quantidades pela regra existente de maiores restos;
- E1–E10 e `extreme_count` servem somente para determinar a faixa;
- núcleo e sinais auxiliares são informativos/auditáveis;
- não há filtro direto por E individual, histórico bruto, resultados recentes
  ou estratégia experimental específica de 16–20;
- alocação inviável falha sem resultado parcial;
- a estratégia declara `betSize` e a versão exata da política.

A compatibilidade desse contrato não torna a Story 4.12 pronta nem autoriza sua
implementação.

## 14. História e isolamento

Resultados oficiais têm sempre 15 dezenas. Podem auditar a política original de
15 ou alimentar pesquisa futura, mas não são distribuição de cartelas 16–20.
Eles não são expandidos artificialmente e não entram em limite, massa,
classificador, fixture ou gerador. A operação é local, sem rede, download,
banco ou relógio.

## 15. Operação, progresso e cancelamento

A superfície CLI planejada é:

```text
npm run cli -- lotofacil structural-policy build
npm run cli -- lotofacil structural-policy verify --input PATH
```

`build` produz o conjunto completo de 15–20 para impedir publicação parcial ou
mistura de versões. O preflight valida definição, versões e disponibilidade das
capacidades 2.1–2.5 antes do primeiro evento.

O cálculo usa duas passagens integrais e ordenadas sobre os seis universos:

1. `BUILD_EXACT_DISTRIBUTIONS`: 7.104.240 combinações, para distribuições de
   E1–E8 e métricas do núcleo; E9/E10 consomem as distribuições exatas da 2.1;
2. `BUILD_CLASSIFIED_MASSES`: 7.104.240 combinações, já com políticas
   derivadas, para as massas e reconciliações finais;
3. `FINALIZE_ARTIFACTS`: seis políticas, seis massas e um índice de conjunto.

O teto normativo é 14.208.480 visitas combinatórias por build, além da leitura
das distribuições 2.1. Ele só pode aumentar com benchmark e nova decisão
arquitetural. A memória deve ser proporcional aos suportes/agregadores, nunca
ao armazenamento das combinações do universo.

Progresso é JSONL em `stderr`, com fase, `betSize`, trabalho processado/total e
totais gerais. Há evento inicial, avanços monotônicos no máximo a cada 10.000
combinações e evento terminal por fase. A saída final única usa `stdout`.

Cancelamento usa `AbortSignal`, é verificado antes do trabalho e pelo menos a
cada 4.096 combinações, não publica resultado parcial e a CLI usa exit `130`.
Não existe timeout em `1.0`; a contenção é o conjunto fechado de universos e o
teto de visitas. Duração, pico de RSS, visitas e hashes são registrados como
evidência de benchmark, nunca como SLA nem dentro do payload canônico.

## 16. Erros públicos

| Código | Condição | Exit |
| --- | --- | ---: |
| `INVALID_STRUCTURAL_POLICY_REQUEST` | schema, definição ou versão inválida | 1 |
| `STRUCTURAL_POLICY_DEPENDENCY_MISMATCH` | dependência 2.1–2.5 incompatível | 1 |
| `STRUCTURAL_POLICY_LIMIT_DERIVATION_FAILED` | limites sobrepostos ou sem candidato válido | 1 |
| `STRUCTURAL_MASS_RECONCILIATION_FAILED` | qualquer invariante da seção 9 falha | 1 |
| `STRUCTURAL_ARTIFACT_HASH_MISMATCH` | bytes e hash não reconciliam | 1 |
| `STRUCTURAL_POLICY_BUILD_CANCELLED` | cancelamento cooperativo | 130 |

Falhas emitem uma única linha estrita `{ type: "error", code, message }` em
`stderr`, deixam `stdout` vazio e não publicam artefato parcial.

## 17. Testes e fixtures normativas

O gate de implementação exige:

- fixtures congeladas de política e massa para 15–20;
- vetores no limite e nos valores adjacentes do suporte para cada cauda;
- oráculo independente da comparação racional e dos desempates;
- todas as reconciliações da seção 9;
- simetria teórica entre linhas e colunas quando aplicável, mantendo E9/E10
  separados;
- determinismo de serialização e SHA-256;
- prova de uma única contribuição de cada combinação em cada agregação final;
- regressão bloqueante de 15: limites, dez flags, núcleo, faixas, massa de cinco
  faixas, manifesto `1.0.0` e suítes 2.1–2.5 sem alteração de resultado;
- ausência de rede, histórico, amostragem e alegação probabilística;
- progresso, cancelamento antes/durante cada fase, erro/exit e ausência de
  resultado parcial;
- lint, typecheck, suíte integral, benchmark, CodeRabbit e revisão matemática
  independente.

## 18. Parecer de Arquitetura

**PASS.** O contrato cobre integralmente as sete decisões de Produto, preserva
as fórmulas e resultados de 15, reutiliza as capacidades 2.1–2.5, torna a
enumeração e a reconciliação exatas, fecha desempates, schemas, versões,
proveniência, hash, progresso, cancelamento e limites. Não há decisão material
de negócio adicionada pela formalização e não há autorização para código da
Story 4.12.
