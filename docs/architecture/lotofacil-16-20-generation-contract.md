# Contrato de geração Lotofácil 16–20

**Status:** especificação aprovada para readiness; não autoriza implementação

**Data:** 2026-09-07

**Revalidação documental:** `4.12-readiness/2026-09-09-r2`, com cardinalidade,
seeds e API/callback aprovados por Produto em 09/09; pareceres e revisão
examinada registrados na Story 4.12, seção “Revalidação r2 — 2026-09-09”.
Consolida a especificação inicial pré-implementação; não altera runtime v1.

**Decisão F5-IPC-SPEC/4.12:** `IN_PROCESS_TYPESCRIPT_LIMITED`

**Versão inicial do contrato:** `lotofacil-16-20-generation/1.0.0`

**Versões iniciais dos componentes v2:**
`lotofacil-seeded-rank-permutation/1.0.0` e
`lotofacil-numeric-lexicographic-canonical-games/1.0.0`

**Fontes:** PRD — FR-02, FR-04.1, FR-05, NFR-01, NFR-04 e NFR-07;
Stories 4.2, 4.7, 4.9 e 4.11; contratos
`lotofacil-16-20-structural-policies-and-masses/1.0` e
`lotofacil-structural-canonical-json/1.0.0`.

## 1. Objetivo e fronteira

A Story 4.12 cria uma API pública v2, assíncrona e aditiva para gerar apostas-
fonte Lotofácil de 16 a 20 dezenas dentro do processo TypeScript. O P0 não
implementa Python, IPC, Tauri, persistência ou UI. A fundação técnica do Épico
5 preserva Python/IPC como capacidade futura independente e continua sujeita a
`F5-IPC-DONE` antes de qualquer uso.

A operação recebe somente a definição Lotofácil, uma estratégia resolvida,
parâmetros de execução e a referência verificável à política estrutural da
Story 4.11. Não recebe histórico bruto, resultados, coortes brutas, cobertura,
custo/cotas, banco, caminhos ou credenciais. O resultado é transitório e
atômico na produção do resultado: falha ou cancelamento anterior à publicação
deixa stdout vazio. A entrega por stdout não é atômica: falha de escrita após
a fronteira da seção 6.1 pode truncar bytes, sem rollback e sem sucesso.

## 2. Decisão de criar, reutilizar e restringir

| Capacidade | Decisão | Restrição |
| --- | --- | --- |
| Contrato de geração | **Criar** API v2 assíncrona e aditiva | Não alterar a API v1 nem seus tipos/resultados de 15. |
| Semântica do `PortfolioGenerator` | **Reutilizar** entrada mínima, resultado transitório e unicidade | A v2 pode ampliar tipos somente por novos exports discriminados. |
| PRNG, seed e permutação | **Reutilizar** as primitivas da Story 4.2 | Mesma versão e entrada completa devem reproduzir os mesmos ranks. |
| Entrada e opções v2 | **Restringir** seeds a 1..1024 unidades UTF-16 e callback a retorno síncrono `undefined` | Decisão de Produto de 09/09; preservar schemas e API v1, PRNG e códigos públicos existentes. |
| Combinatória | **Reutilizar** `C(25,k)` e unranking existentes/generalizados | Não materializar o universo nem armazenar array proporcional a ele. |
| Classificação estrutural | **Reutilizar** o mecanismo único orientado por política da Story 4.11 | Consumir a política exata do `betSize`; não copiar limites de 15. |
| Alocação | **Reutilizar** `lotofacil-largest-remainder/1.0.0` | Somente as cinco faixas 0/1/2/3/4+, em `ADVANCED`. |
| Ordenação v2 | **Criar** comparador próprio, ordinal e independente de locale | Comparar sequências numéricas canônicas elemento a elemento; não usar `localeCompare`/`Intl.Collator` e não alterar o comparador v1. |
| Integração | **Restringir** ao adaptador Lotofácil | Nenhuma constante 16–20 entra no Core genérico. |
| Skill AIOX | **Não criar** | Contrato, schemas e testes são a fonte de verdade reutilizável. |

## 3. Contrato público v2

### 3.1 Identificadores normativos

```text
contractVersion = "lotofacil-16-20-generation/1.0.0"
generationAlgorithmVersion = "lotofacil-seeded-rank-permutation/1.0.0"
prngVersion = "utf16-code-unit-fnv1a32-mulberry32/1.0.0"
unrankingVersion = "lexicographic-combination-unrank/1.0.0"
candidateOrderingVersion = "lotofacil-numeric-lexicographic-canonical-games/1.0.0"
structuralAllocationAlgorithmVersion = "lotofacil-largest-remainder/1.0.0"
```

Os nomes identificam a semântica já existente que será reutilizada e sua
adaptação v2; não autorizam mudança na implementação ou nos resultados v1.

### 3.2 Request estrito

O request possui exatamente cinco campos de topo:
`contractVersion`, `lotteryDefinition`, `strategy`, `parameters` e
`policySetReference`. `strategy.mode` é o discriminante da união. Todos os
objetos rejeitam campos desconhecidos.

```text
lotteryDefinition = {
  id: "lotofacil",
  version: "1.0.0",
  totalNumbers: 25,
  drawSize: 15,
  minBetSize: 15,
  maxBetSize: 20
}

parameters = {
  seed: string with 1..1024 UTF-16 code units,
  candidateCount: safe integer 1..min(10000, C(25, betSize))
}

policySetReference = {
  policySetId: exact Story 4.11 index value,
  policySetVersion: exact Story 4.11 index value,
  classifierVersion: exact Story 4.11 index value,
  massAlgorithmVersion: exact Story 4.11 index value,
  indexHash: "sha256:" + 64 lowercase hex,
  policy: {
    betSize: same 16..20 value as strategy.betSize,
    policyId: exact indexed value,
    policyVersion: exact indexed value,
    policyHash: "sha256:" + 64 lowercase hex,
    massHash: "sha256:" + 64 lowercase hex
  }
}
```

Os campos comuns de `strategy` são exatamente `id`, `version`, `lotteryId`,
`betSize`, `mode`, `statisticalLabel`, `seed` e
`requiresManualAcknowledgement`. `id`, `version` e `seed` são strings não
vazias; `lotteryId = "lotofacil"`; `betSize` é inteiro 16–20; e
`requiresManualAcknowledgement = false`.

Esses são os domínios do request aceito; a validação em etapas da seção 7.1
preserva os códigos específicos. `strategy.betSize` numérico não inteiro,
incluindo 15.5 e 16.5, é erro de request; inteiro fora de 16..20 é erro de
tamanho. Ambos falham antes de executar combinatória ou emitir progresso.

`parameters.seed` é a seed efetivamente consumida pelo PRNG, preservando a
semântica v1. `strategy.seed` permanece como proveniência da configuração
resolvida; os dois campos integram a identidade completa da entrada e não são
silenciosamente substituídos ou igualados.

Somente na v2 da Story 4.12, cada um dos campos `parameters.seed` e
`strategy.seed` deve satisfazer `1 <= seed.length <= 1024`, medido em
unidades de código UTF-16 da string JavaScript já decodificada. Não medir
bytes UTF-8, pontos de código, grafemas ou o tamanho textual dos escapes JSON.
Não truncar, normalizar, recodificar nem substituir seeds; preservar os
papéis distintos dos dois campos e a mistura `charCodeAt` do PRNG existente.
O teto limita o trabalho síncrono de mistura da seed efetiva a 1.024 unidades
e a proveniência textual a outras 1.024; é uma escolha operacional do P0,
não um SLA nem um limite total de arquivo/JSON ou proteção da leitura/parse.
Os schemas e o comportamento v1 permanecem inalterados.

Excesso em qualquer seed usa `INVALID_PORTFOLIO_GENERATION_V2_REQUEST`
na etapa 1 da seção 7.1, antes de PRNG, progresso ou resultado; não reutiliza
o erro específico de contagem. A mesma regra vale na API e no despacho CLI v2.
Para cada campo, isoladamente e em conjunto, planejar os seguintes vetores
com o restante do request válido:

| Seed após decodificação | Unidades UTF-16 | Resultado v2 esperado |
| --- | --- | --- |
| `""` | 0 | erro de request |
| `"a"` | 1 | aceita |
| `"a".repeat(1023)` | 1023 | aceita |
| `"a".repeat(1024)` | 1024 | aceita |
| `"a".repeat(1025)` | 1025 | erro de request |
| `"😀".repeat(511) + "a"` | 1023 | aceita |
| `"😀".repeat(512)` | 1024 | aceita |
| `"😀".repeat(512) + "a"` | 1025 | erro de request |

Aceitação significa aprovação desta regra, não dispensa as demais validações.
A forma JSON literal de 😀 e o escape `\uD83D\uDE00` produzem a mesma string
e contam duas unidades cada; devem preservar a mesma sequência do PRNG.
Comparar seeds aceitas com o PRNG reutilizado, sem reimplementá-lo; cobrir
`"é"` versus `"e\u0301"` como strings distintas, sem exigir ausência de colisões
do PRNG. Não introduzir rejeição adicional de surrogates isolados.
Combinar seed excedida com tamanho/modo/contagem inválidos e sinal abortado:
prevalece o erro de request, independentemente da ordem das propriedades JSON.
Os mesmos vetores de 1.025 unidades continuam aceitos pelos schemas v1.

- ramo `NEUTRAL`: `mode = "NEUTRAL"`, `statisticalLabel = "NEUTRAL"` e não
  existe `structuralAllocation`;
- ramo `ADVANCED`: `mode = "ADVANCED"`, `statisticalLabel = "PRODUCTION"` e
  existe `structuralAllocation` com exatamente `zeroExtremes`, `oneExtreme`,
  `twoExtremes`, `threeExtremes` e `fourPlusExtremes`. Cada valor é finito,
  entre 0 e 100. Para a soma calculada `S`, aceitar exatamente
  `Math.abs(S - 100) <= 1e-9`: tolerância absoluta, não relativa, em pontos
  percentuais, com comparação inclusiva em aritmética JavaScript `Number`.

As chaves de alocação mapeiam, na mesma ordem, para `ZERO_EXTREMES`,
`ONE_EXTREME`, `TWO_EXTREMES`, `THREE_EXTREMES` e
`FOUR_PLUS_EXTREMES`. As quantidades inteiras usam
`lotofacil-largest-remainder/1.0.0`, inclusive seu desempate estável.
`calculateLotofacilStructuralAllocationCounts` usa os percentuais recebidos
sem normalização: `q_i = (p_i * candidateCount) / 100`, piso e distribuição
dos restos por ordem decrescente, com desempate pela ordem das cinco chaves.
Não substituir `p_i` por `100 * p_i / S`. A “tolerância zero” da Story 4.9
refere-se à reconciliação das contagens inteiras solicitadas/realizadas, não
à soma dos percentuais; o algoritmo reutilizado e seus resultados não mudam.

`cohortId`, `auxiliaryConstraints`, `hypothesisRefs`,
`MANUAL_EXPERIMENTAL`, estratégias experimentais específicas de 16–20, núcleo
central e filtros diretos por E1–E10 são rejeitados no P0. E1–E10 são usados
somente pelo classificador 4.11 para produzir `extreme_count` e a faixa.

### 3.3 Fonte runtime da política

A implementação deve empacotar uma única fonte runtime em
`packages/lotteries/lotofacil/src/artifacts/structural-policy-set-1.0.0.json`,
com os mesmos bytes e hashes do conjunto normativo entregue pela Story 4.11.
Ela é carregada e validada uma vez, então injetada no adaptador. A geração não
pode reconstruir políticas/massas, executar as duas enumerações da 4.11 nem
depender de caminho sob `tests/`.

A comparação de bytes e hashes entre o artefato runtime e a fixture normativa
4.11 prova integridade da cópia empacotada; divergência bloqueia a suíte. Ela
não constitui validação matemática independente. Esta provém do oráculo DFS
da Story 4.11, que deriva limites e massas sem importar módulos produtivos,
e de sua comparação com os artefatos normativos. A 4.12 preserva essa evidência
e suas regressões; não repete a enumeração na geração. Nenhum comando atualiza
qualquer uma das cópias automaticamente.

### 3.4 Resultado estrito

O resultado possui exatamente os campos abaixo; o campo `mode` discrimina os
dois shapes de `structuralAllocation` e `structuralCounts`:

```text
{
  contractVersion,
  generationAlgorithmVersion,
  lottery: { id: "lotofacil", definitionVersion: "1.0.0" },
  betSize: integer 16..20,
  mode: "NEUTRAL" | "ADVANCED",
  strategy: { id, version, seed },
  parameters: { seed, candidateCount },
  policySetReference,
  componentVersions: {
    prngVersion,
    unrankingVersion,
    classifierVersion,
    structuralAllocationAlgorithmVersion: null | literal,
    candidateOrderingVersion
  },
  candidates: [exactly candidateCount unique candidates {
    numbers: [exactly betSize unique, strictly increasing integers in 1..25]
  }],
  execution: {
    visitedRanks: safe integer 0..universeSize,
    universeSize: safe integer exactly C(25, betSize),
    selectedCount: safe integer 0..min(candidateCount, visitedRanks),
    structuralAllocation: null | exact five-key percentage object,
    structuralCounts: null | exact five-band non-negative safe-integer object,
    timeoutApplied: false
  },
  transient: true,
  persisted: false,
  frozen: false,
  coverageCalculated: false,
  probabilityClaimed: false,
  partial: false
}
```

Em `NEUTRAL`, `structuralAllocation` e `structuralCounts` são `null` e
`structuralAllocationAlgorithmVersion` é `null`. Em `ADVANCED`, os três campos
contêm, respectivamente, o objeto de percentuais, as quantidades produzidas por
faixa e o literal da seção 3.1. O array possui exatamente `candidateCount`
candidatos únicos, `selectedCount = candidateCount` e
`visitedRanks <= universeSize = C(25, betSize)`.
Para cada candidato, `numbers.length === betSize`; o resultado satisfaz
`candidates.length === candidateCount`, sem candidatos duplicados. Esses
invariantes são verificados conjuntamente com o request antes da publicação.
Os limites completos dos contadores e sua reconciliação seguem 3.5;
no sucesso, `selectedCount = candidateCount = candidates.length`.

A ordem v2 é a comparação lexicográfica numérica das dezenas canônicas,
elemento a elemento. Ela não reutiliza nem modifica
`locale-compare-of-comma-joined-canonical-games/1.0.0`, preservado apenas no
caminho v1 de 15. Request e resultado são validados conjuntamente; divergência
de quantidade, tamanho, versões, política, faixas, ordenação ou flags invalida
o resultado antes da publicação.

**Aprovação de Produto — 2026-09-09:** na Story 4.12, a comparação numérica
posição por posição, decidida pela primeira dezena diferente, substitui
explicitamente a proposta anterior de ASCII bytewise. Ordenar somente após
concluir a seleção, preservando o conjunto, as quantidades e as alocações;
não usar `localeCompare` ou `Intl.Collator`. Mantém-se
`candidateOrderingVersion = "lotofacil-numeric-lexicographic-canonical-games/1.0.0"`.
As ordenações e os resultados das Stories 4.9 e 4.10 permanecem preservados.

### 3.5 Contadores: schema isolado, sequência e request

As mesmas regras aplicam-se ao request aceito, aos eventos de progresso e
ao resultado. Todos os campos de contagem são inteiros seguros JavaScript
(`Number.isSafeInteger`), com estes limites:

| Campo | Limite ou relação |
| --- | --- |
| `candidateCount` | `1 <= candidateCount <= min(10000, C(25, betSize))` |
| `universeSize` | `universeSize = C(25, betSize)` |
| `visitedRanks` | `0 <= visitedRanks <= universeSize` |
| `selectedCount` | `0 <= selectedCount <= min(candidateCount, visitedRanks)` |
| Cada valor de `structuralCounts` em `ADVANCED` | Inteiro seguro não negativo, no máximo sua quantidade-alvo |

Em `ADVANCED`, `structuralCounts` tem exatamente as cinco faixas da seção 3.2,
sem chaves extras ou ausentes; a soma de seus valores é `selectedCount`.
As quantidades-alvo são as calculadas por `lotofacil-largest-remainder/1.0.0`
para o request validado, sem alterar o algoritmo. Em `NEUTRAL`, o campo é
sempre `null`.

Separar três níveis de validação, sem tratar um evento isolado como prova de
uma execução válida:

1. **Objeto isolado:** schemas estritos conferem tipos, campos, limites e
   relações entre campos disponíveis no próprio objeto. Progresso contém
   `betSize`/`candidateCount`; no resultado, a contagem está em
   `parameters.candidateCount`. Conferir universo exato, limites dos contadores,
   shape por modo e soma das faixas. Um evento `FINALIZE_RESULT` exige
   `selectedCount = candidateCount`; um resultado de sucesso exige também
   `selectedCount = candidateCount = candidates.length`.
2. **Entre eventos da mesma execução:** o primeiro evento é
   `SELECT_CANDIDATES` com `visitedRanks = selectedCount = 0`. `visitedRanks`,
   `selectedCount` e cada contagem de faixa são monotônicos não decrescentes;
   `candidateCount` e `universeSize` permanecem constantes. `FINALIZE_RESULT`
   só ocorre com seleção completa, no máximo uma vez, sem se tornar terminal
   ou confirmar publicação. Valores individualmente válidos não autorizam
   regressão de contador nem troca de identidade entre eventos.
3. **Conjunto com o request:** conferir identidade, modo, tamanho, contagem,
   política e alocação contra o request validado. Em `ADVANCED`, nenhuma faixa
   supera sua quantidade-alvo em qualquer evento/resultado; no resultado final,
   cada faixa é exatamente igual ao alvo. Conferir também que as contagens
   finais correspondem à classificação dos candidatos efetivamente retornados.
   O progresso isolado não contém a alocação do request e não pode, sozinho,
   comprovar esses alvos. `NEUTRAL` preserva `structuralCounts: null`.

A ordem do preflight continua sendo 7.1: estes limites não antecipam
`C(25, betSize)` à rejeição de tamanho inválido nem convertem excesso de
`candidateCount` em erro genérico de schema.

## 4. Algoritmo determinístico

1. Fazer preflight completo do schema, definição, modo, contagem, universo e
   referência da política, sem emitir progresso. Em `ADVANCED`, converter a
   alocação em quantidades e compará-las às contagens exatas das faixas da massa
   referenciada; inviabilidade conhecida falha ainda no preflight. Depois,
   validar opções e verificar o sinal conforme 6.2, ainda sem progresso ou PRNG.
2. Derivar, com `createDeterministicRandom(parameters.seed)`, `offset` e passo
   coprimo para uma permutação completa dos ranks `0..C(25,k)-1`, conforme a
   fórmula normativa abaixo.
3. Percorrer cada rank no máximo uma vez. `NEUTRAL` aceita diretamente;
   `ADVANCED` classifica pela política 4.11 e aceita enquanto a cota da faixa
   não estiver completa.
4. Verificar cancelamento ao menos uma vez a cada 1.024 ranks e ceder o event
   loop no mesmo limite máximo de lote.
5. Encerrar quando todas as quantidades forem atendidas ou quando o universo
   se esgotar. Esgotamento inesperado sem atendimento integral é falha
   determinística de alocação e nunca publica o acumulado.
6. Depois do evento `FINALIZE_RESULT`, verificar `AbortSignal`, ordenar os
   candidatos, construir e validar conjuntamente o resultado. Antes de
   disponibilizá-lo, executar a barreira de event loop e a nova verificação
   descritas na seção 6; a CLI repete essa proteção após serializar o JSON.

Para uma seed JavaScript, a versão `prngVersion` percorre exatamente seus code
units UTF-16, sem normalização Unicode e sem recodificação UTF-8:

```text
state = 2166136261
for i = 0 .. seed.length-1:
  state = Math.imul(state XOR seed.charCodeAt(i), 16777619)

nextUint32():
  state = (state + 0x6d2b79f5) >>> 0
  value = Math.imul(state XOR (state >>> 15), state OR 1)
  value = value XOR (value + Math.imul(value XOR (value >>> 7), value OR 61))
  return (value XOR (value >>> 14)) >>> 0

nextInt(upperExclusive):
  return floor((nextUint32() / 4294967296) * upperExclusive)
```

Para `U = C(25, betSize)`, as duas primeiras e únicas chamadas anteriores ao
percurso são, nesta ordem:

```text
offset = nextInt(U)
step = nextInt(U - 1) + 1
while gcd(step, U) != 1: step = step + 1
if step == U: step = 1
rank_i = (offset + step * i) mod U, para i = 0 .. U-1
```

Não é permitido consumir valor aleatório adicional, trocar a ordem das
chamadas ou interpretar a seed como bytes. Vetores normativos para
`U = C(25,16) = 2.042.975`:

| seed | `offset` | `step` | primeiros cinco ranks |
| --- | ---: | ---: | --- |
| `seed-v2` | 307.185 | 753.956 | 307.185, 1.061.141, 1.815.097, 526.078, 1.280.034 |
| `ação-β` | 298.270 | 354.031 | 298.270, 652.301, 1.006.332, 1.360.363, 1.714.394 |

Não há segunda enumeração de pré-cálculo, tentativa com seeds adicionais nem
varredura oculta. A implementação mantém apenas candidatos aceitos, contadores
por faixa e estado constante da permutação; memória é `O(candidateCount)`, não
`O(C(25,k))`.

## 5. Limites operacionais

Para todo `betSize` 16–20:

```text
1 <= candidateCount <= min(10_000, C(25, betSize))
```

| `betSize` | `C(25,k)` | máximo P0 por execução |
| ---: | ---: | ---: |
| 16 | 2.042.975 | 10000 |
| 17 | 1.081.575 | 10000 |
| 18 | 480.700 | 10000 |
| 19 | 177.100 | 10000 |
| 20 | 53.130 | 10000 |

`10000` é somente teto técnico por execução. Não é padrão, recomendação de
compra, limite comercial ou limite definitivo. `10001` e qualquer contagem
acima do universo são rejeitadas no preflight, antes do primeiro progresso.
Elevar o teto exige benchmark atualizado, revisão arquitetural e nova versão do
contrato/algoritmo afetado.

O orçamento máximo de inspeção é um percurso do universo do tamanho solicitado.
Não há timeout normativo no contrato `1.0.0`; todo resultado registra
`timeoutApplied: false`.

## 6. Progresso, cancelamento e CLI

A API v2 é assíncrona e aceita `AbortSignal` e callback de progresso. Após o
preflight, a validação das opções e a verificação inicial do sinal (6.2),
emite um evento inicial, eventos após cada lote de no
máximo 1.024 ranks e um evento `FINALIZE_RESULT` não terminal depois de
completar a seleção. Não existe evento de sucesso antes da validação conjunta;
na CLI, sucesso exige concluir a escrita do JSON final validado, conforme 6.1.

O schema estrito de progresso possui exatamente:

```text
{
  type: "progress",
  contractVersion: "lotofacil-16-20-generation/1.0.0",
  phase: "SELECT_CANDIDATES" | "FINALIZE_RESULT",
  betSize: integer 16..20,
  mode: "NEUTRAL" | "ADVANCED",
  visitedRanks: safe integer 0..universeSize,
  universeSize: safe integer exactly C(25, betSize),
  selectedCount: safe integer 0..min(candidateCount, visitedRanks),
  candidateCount: safe integer 1..min(10000, C(25, betSize)),
  structuralCounts: null | exact five-band non-negative safe-integer object
}
```

O evento inicial usa `SELECT_CANDIDATES`, `visitedRanks = 0` e
`selectedCount = 0`. Os campos são monotônicos, derivados de contadores e nunca
do relógio. `FINALIZE_RESULT` ocorre no máximo uma vez por execução, somente
após concluir a seleção e ao entrar na finalização. Erro ou cancelamento antes
dessa etapa permite zero emissões. O evento não é terminal e não confirma
validação, publicação ou sucesso; em `NEUTRAL`,
`structuralCounts` é sempre `null`; em `ADVANCED`, contém as cinco faixas.
Aplicar os três níveis de validação e os limites de 3.5: um schema de evento
isolado não substitui a verificação da sequência nem a comparação com o request.

`SELECT_CANDIDATES` e `FINALIZE_RESULT` são fases anteriores à publicação;
nenhuma delas muda sua fronteira. A seção 6.1 é a única definição normativa
do início da publicação, da barreira final, do SIGINT tardio e da falha de escrita.

Na CLI-first, a ação existente `portfolio generate --input PATH` despacha o
request discriminado para v1 ou v2 sem reinterpretá-lo. Para v2:

- `stdout` fica reservado ao único JSON final validado;
- progresso e diagnóstico estruturados usam somente JSONL em `stderr`;
- cancelamento por `SIGINT` observado antes da fronteira da seção 6.1 produz
  exit `130`, sem stdout e sem resultado parcial; após essa fronteira,
  aplicam-se o tratamento de SIGINT tardio e de falha de escrita da mesma seção;
- request inválido, limite, incompatibilidade de política e alocação inviável
  falham antes de resultado, com erro público estruturado e exit não zero;
- nenhum timeout é iniciado ou reportado como aplicado no contrato `1.0.0`.

### 6.1 Barreira final e início da publicação

Depois do trabalho síncrono de finalização, a API deve ceder realmente ao
event loop, permitindo um novo ciclo de processamento de I/O/sinais, e só
então verificar novamente `AbortSignal` antes de resolver com o resultado.
Na CLI, preparar todo o JSON em memória, repetir a barreira e a verificação,
e somente então iniciar a escrita. Em Node.js, usar duas passagens sucessivas
por `setImmediate` (a segunda agendada na continuação da primeira), ou
equivalente comprovado por teste de subprocesso; uma Promise já resolvida,
`queueMicrotask` ou `process.nextTick` não substitui essa barreira.

Na API, resolver a Promise disponibiliza um resultado integralmente validado;
isso não garante sua entrega pelo transporte. Na CLI,
a publicação se inicia no ato de invocar a primeira e única escrita do JSON
final em stdout. Entre a última verificação e esse ato não há `await`,
callback de usuário ou trabalho de serialização/validação. Até esse ponto,
cancelamento observado na CLI resulta no erro estruturado existente, exit
`130` e stdout vazio. Depois dele, SIGINT tardio não cancela essa operação nem a
reclassifica como `130`; o handler permanece ativo enquanto a escrita conclui,
e o sucesso exige a conclusão da escrita, sem forçar saída antes do flush.
Falha de escrita continua sendo falha da CLI, com exit `1` se o processo
puder tratá-la, e nunca pode ser reportada como sucesso ou cancelamento.

Essa é a fronteira de atomicidade da operação, não uma garantia de escrita
atômica do sistema operacional: falha do destino stdout ou término forçado
do processo após o início pode truncar bytes, sem rollback. Não converter
essa falha em cancelamento nem tratá-la como resultado válido. Não criar
protocolo, retry ou erro de IPC para esse caso.

### 6.2 Superfície TypeScript v2 e falhas de callback

Exportar os tipos de request, resultado e progresso em
`@boloes/lottery-contracts`, correspondendo integralmente às seções 3.2,
3.4 e 6, e a função aditiva em `@boloes/lottery-lotofacil`.
No trecho normativo abaixo, `portfolioGenerationV2CanonicalMessages` designa
o mapa literal planejado dos oito pares da tabela da seção 7: exatamente
essas chaves e valores, preservados como literais readonly (`as const`),
nunca ampliados para `Record<string, string>`. Sua materialização pertence
à implementação futura; a tabela permanece a referência documental única.

```typescript
type PortfolioGenerationV2CanonicalMessages =
  typeof portfolioGenerationV2CanonicalMessages;

export type PortfolioGenerationV2ErrorCode =
  keyof PortfolioGenerationV2CanonicalMessages;

export type PortfolioGenerationV2Failure = {
  [Code in PortfolioGenerationV2ErrorCode]: {
    readonly type: "error";
    readonly contractVersion: "lotofacil-16-20-generation/1.0.0";
    readonly code: Code;
    readonly message: PortfolioGenerationV2CanonicalMessages[Code];
  };
}[PortfolioGenerationV2ErrorCode];

export interface PortfolioGenerationV2Options {
  readonly signal?: AbortSignal;
  readonly onProgress?: (
    progress: Readonly<PortfolioGenerationV2Progress>,
  ) => undefined;
}

export declare function generateLotofacilPortfolioV2(
  request: PortfolioGenerationV2Request,
  options?: PortfolioGenerationV2Options,
): Promise<PortfolioGenerationV2Result>;
```

Os tipos de request/resultado/progresso são os shapes normativos referidos
acima, não objetos abertos nem substitutos da validação runtime. Opções
omitidas equivalem a `{}`; ausência de sinal significa ausência de
cancelamento externo, e ausência de callback não altera seleção ou resultado.
Todas as falhas da operação rejeitam a Promise com o envelope estrito
`PortfolioGenerationV2Failure` da seção 7, sem exceção bruta ou resultado
parcial; TypeScript não codifica o tipo de rejeição no parâmetro de `Promise`.
A CLI apenas serializa esse envelope em stderr e aplica os exits existentes.
A união discriminada por `code` vincula cada ramo à sua mensagem literal;
não aceita o produto cartesiano entre os oito códigos e as oito mensagens.
O schema runtime planejado deve ser uma união estrita dos mesmos oito ramos,
derivada do mesmo mapa, com `type` e `contractVersion` literais como acima.
Ambos rejeitam pares trocados e mensagens arbitrárias. Tipagem não substitui
validação runtime, inclusive para valores construídos ou recebidos via `any`.
Planejar construção centralizada a partir de `code` e do mapa canônico e
validar o envelope antes da rejeição pública da API e da serialização CLI;
não aceitar nem repassar `Error.message` arbitrário. Falha interna nessa
construção/validação mantém o par genérico de resultado previsto em 7.1,
sem novo código, publicação de resultado ou mudança de precedência/exits.

Ordem: executar o preflight completo do request na ordem da seção 7.1;
validar as opções; verificar o sinal; somente depois inicializar PRNG e
emitir o primeiro progresso. Request inválido prevalece sobre sinal
previamente abortado, inclusive nos erros específicos de domínio. Opções
fora do contrato (objeto inválido, sinal incompatível ou callback não função)
usam `INVALID_PORTFOLIO_GENERATION_V2_REQUEST`, após as validações do request.
Request/opções válidos com sinal já abortado rejeitam com
`LOTOFACIL_PORTFOLIO_GENERATION_CANCELLED`, sem PRNG, progresso ou resultado.

O callback é exclusivamente síncrono no P0: deve retornar `undefined`;
o retorno normal não transmite dados nem comandos ao gerador. Usar
`() => undefined`, não `() => void`, para não aceitar estaticamente funções
`async`. Um callback de coleta deve usar bloco sem valor de retorno,
por exemplo `event => { events.push(event); }`.
Verificar cancelamento antes de cada emissão e depois de cada callback.
Não invocar callback depois da última verificação anterior à disponibilização
do resultado/publicação da seção 6.1.

Exceção lançada pelo callback, em qualquer fase, ou retorno diferente de
`undefined` rejeita com `INVALID_PORTFOLIO_GENERATION_V2_RESULT`: falha de
execução que impede disponibilizar resultado válido, sem novo código.
Parar emissões e trabalho; não expor o valor lançado. Se o callback abortar
e também lançar/retornar valor inválido na mesma chamada, prevalece essa
falha de callback; se retornar normalmente, a verificação subsequente
observa o cancelamento. Eventos já emitidos não são desfeitos.

Callbacks assíncronos não são admitidos. Se JavaScript/`any` contornar o tipo
e devolver Promise/thenable, tratar como retorno inválido sem aguardar sua
conclusão; anexar observador que absorva eventual rejeição, evitando rejeição
não observada. Isso não habilita callbacks assíncronos, não aguarda promessas
pendentes e não altera a falha pública já escolhida. A inspeção do retorno,
inclusive acesso a `then` por getter/proxy, sua assimilação e a instalação do
observador permanecem dentro do tratamento controlado: `then` não chamável
ou que lança, getter/proxy que lança e falhas ao observar a rejeição mantêm
`INVALID_PORTFOLIO_GENERATION_V2_RESULT`, sem exceção bruta nem rejeição não
observada. Não usar diretamente `.then`/`.catch` do valor sem essa proteção.
O callback deve ser curto: não existe preempção ou timeout para código síncrono
do chamador. A API/CLI
não publica em falha de callback; o chamador não deve escrever em stdout por
conta própria. A fronteira e as limitações de transporte da seção 6.1 não mudam.

Vetores planejados, usando sincronização/contadores, sem sleeps:

- request inválido + sinal abortado: erro correspondente à primeira etapa
  inválida de 7.1; opções inválidas não substituem erro do request;
- request válido + opções inválidas (`null`, array, callback não função ou
  sinal incompatível), inclusive com sinal abortado quando presente:
  `INVALID_PORTFOLIO_GENERATION_V2_REQUEST`, zero progresso/PRNG/resultado;
- request/opções válidos + sinal abortado: cancelamento, zero chamadas ao
  PRNG/callback, nenhuma resolução com resultado; CLI exit 130 e stdout vazio;
- opções omitidas, somente sinal, somente callback e ambos: resultado válido
  idêntico para a mesma entrada quando não houver cancelamento/falha;
- callback síncrono com retorno `undefined`: eventos na ordem da seção 6;
  callback aborta e retorna normalmente: cancelamento, sem evento posterior;
- callback lança no evento inicial, em lote ou em `FINALIZE_RESULT`:
  erro de resultado, sem evento posterior nem publicação; mesmo código se
  abortar e lançar na mesma chamada;
- retorno numérico, Promise resolvida, rejeitada, pendente e thenable:
  erro de resultado, sem espera pela conclusão, sem rejeição não observada;
  teste de tipos rejeita callback `async`;
- thenables malformados: getter/proxy de `then` que lança, `then` não função,
  `then` que lança antes/depois de resolver ou rejeitar, e observação que falha:
  erro de resultado controlado, sem exceção bruta, publicação ou
  `unhandledRejection`; sincronizar a verificação de rejeições sem sleeps;
- falhas anteriores à publicação: API rejeitada, CLI exit 1 e stdout vazio;
  preservar separadamente os testes de falha de escrita posterior da seção 6.1.

## 7. Erros públicos

A representação pública de erro v2 é o objeto estrito abaixo: a API rejeita
com esse objeto; somente a CLI o serializa como uma linha JSONL em stderr.
A API não escreve em stdout/stderr.

```text
{
  type: "error",
  contractVersion: "lotofacil-16-20-generation/1.0.0",
  code: one of the literals below,
  message: exact canonical literal paired with code in the table below
}
```

Não há `stack`, path local ou campo adicional no envelope público. A tabela
normativa abaixo, aprovada por Produto em 2026-09-09 no adendo da revisão r2,
é a única fonte dos oito pares `code`/`message`; preservar exatamente
maiúsculas, espaços e pontuação, sem tradução, interpolação ou sufixos.

| `code` | `message` canônica |
| --- | --- |
| `INVALID_PORTFOLIO_GENERATION_V2_REQUEST` | `Invalid portfolio generation v2 request.` |
| `UNSUPPORTED_LOTOFACIL_BET_SIZE` | `Unsupported Lotofacil bet size.` |
| `UNSUPPORTED_LOTOFACIL_GENERATION_MODE` | `Unsupported Lotofacil generation mode.` |
| `LOTOFACIL_STRUCTURAL_POLICY_MISMATCH` | `Lotofacil structural policy mismatch.` |
| `LOTOFACIL_CANDIDATE_COUNT_LIMIT_EXCEEDED` | `Lotofacil candidate count limit exceeded.` |
| `LOTOFACIL_STRUCTURAL_ALLOCATION_INFEASIBLE` | `Lotofacil structural allocation infeasible.` |
| `LOTOFACIL_PORTFOLIO_GENERATION_CANCELLED` | `Lotofacil portfolio generation cancelled.` |
| `INVALID_PORTFOLIO_GENERATION_V2_RESULT` | `Invalid portfolio generation v2 result.` |

Todo controle de fluxo depende exclusivamente de `code`, nunca de `message`.
Mensagens não incorporam seed, input, stack, caminhos ou a exceção original.
Falhas internas, de callback e de tratamento de thenables mantêm o par genérico
de `INVALID_PORTFOLIO_GENERATION_V2_RESULT`, conforme 6.2 e 7.1. A tabela não
altera envelope, precedência, exits ou o tratamento separado das falhas da CLI.

### 7.1 Precedência do preflight v2

Retornar somente o erro da primeira etapa inválida, nesta ordem fixa:

A validação estrutural verifica campos ausentes/desconhecidos, tipos e shapes.
Também pertencem ao erro de request suas regras de boa formação: literais
fixos do envelope/definição, seeds com 1..1024 unidades UTF-16, formato de
hashes, percentuais válidos, `strategy.betSize` inteiro e contagem inteira
segura positiva. A validação semântica subsequente
verifica os domínios de tamanho/modo, o teto, a referência da política e a
viabilidade da alocação, cada qual com seu código específico.

| Ordem | Validação | Código público |
| --- | --- | --- |
| 1 | Estrutura/schema: campos ausentes/desconhecidos, tipos, `strategy.betSize` numérico não inteiro, literais fixos, seeds vazias ou acima de 1024 unidades UTF-16, formato dos hashes e shape do ramo reconhecido; contagem não inteira segura positiva; alocação com chaves/percentuais/soma inválidos | `INVALID_PORTFOLIO_GENERATION_V2_REQUEST` |
| 2 | `strategy.betSize` inteiro fora de 16–20 | `UNSUPPORTED_LOTOFACIL_BET_SIZE` |
| 3 | `strategy.mode` string fora de `NEUTRAL`/`ADVANCED` | `UNSUPPORTED_LOTOFACIL_GENERATION_MODE` |
| 4 | Contagem positiva acima de `min(10000, C(25, betSize))` | `LOTOFACIL_CANDIDATE_COUNT_LIMIT_EXCEEDED` |
| 5 | Identidade/versões/hashes de política divergentes do artefato ou `policy.betSize` diferente de `strategy.betSize` | `LOTOFACIL_STRUCTURAL_POLICY_MISMATCH` |
| 6 | Quantidades por maiores restos excedem as massas disponíveis | `LOTOFACIL_STRUCTURAL_ALLOCATION_INFEASIBLE` |

Na etapa 1, os valores de tamanho e modo são verificados quanto ao tipo, e
`strategy.betSize` também deve ser inteiro: 15.5 e 16.5 usam erro de request.
Inteiros fora de 16..20 usam o erro específico de tamanho na etapa 2; não
executar combinatória nem emitir progresso antes dessas rejeições.
Os domínios de tamanho/modo são reservados às etapas 2–3. Não aplicar antes delas um enum de modo
ou refinamento 16–20 que converta todo valor não suportado em erro genérico.
Assim, inteiro `15` em v2 chega ao erro de tamanho e string `"UNSUPPORTED"`
chega ao erro de modo quando não existir violação anterior. Para modo
desconhecido, verificar a estrutura comum e os campos de alocação presentes,
sem presumir um ramo.
Formato de referência inválido pertence à etapa 1; divergência contra a
política validada pertence à etapa 5. Uma alocação malformada pertence à etapa
1; alocação válida, mas matematicamente inviável, pertence à etapa 6.
Essa separação não relaxa o schema público: o request só é aceito após todas
as etapas. Não depender da ordem de propriedades do JSON nem da ordem de
issues produzidas pelo validador. Na API, esses erros rejeitam a Promise sem
progresso; na CLI, têm exit `1` e stdout vazio. Falhas da CLI anteriores ao
despacho mantêm a fronteira já descrita. Opções e sinal são avaliados somente
após esse preflight completo, conforme 6.2.

O mapeamento distingue a origem da falha:

- domínio/validação: request inválido usa
  `INVALID_PORTFOLIO_GENERATION_V2_REQUEST`; tamanho ou modo não suportado,
  política incompatível, contagem acima do limite e alocação inviável usam os
  respectivos códigos específicos acima. Esgotamento sem completar a alocação
  usa `LOTOFACIL_STRUCTURAL_ALLOCATION_INFEASIBLE`; resultado que viola a
  validação conjunta usa `INVALID_PORTFOLIO_GENERATION_V2_RESULT`;
- falha interna de execução: exceção de cálculo no gerador v2 que impede obter
  resultado válido, sem corresponder a erro de domínio/validação ou
  cancelamento, usa `INVALID_PORTFOLIO_GENERATION_V2_RESULT`; o código expressa
  a impossibilidade de publicar resultado válido, sem expor a exceção interna;
  inclui falha de callback/retorno e de tratamento de thenables conforme 6.2;
- cancelamento cooperativo por `AbortSignal`, inclusive acionado por `SIGINT`,
  observado antes da fronteira da seção 6.1 usa
  `LOTOFACIL_PORTFOLIO_GENERATION_CANCELLED`.

Esses casos usam somente a representação aprovada; os exits e a serialização
pertencem exclusivamente à CLI. Falhas e
cancelamentos anteriores à fronteira de publicação da seção 6.1 deixam stdout
vazio, sem resultado parcial. Falha de escrita posterior pode deixar bytes
truncados, sem rollback: deve ser reportada como falha, nunca como sucesso
ou cancelamento, conforme 6.1.

Entrada inválida nunca provoca progresso. Falha de execução ou validação e
cancelamento nunca publicam candidato parcial. Na CLI, sucesso usa exit `0`; qualquer
erro não relacionado a cancelamento usa exit `1`; cancelamento observado antes
da fronteira da seção 6.1, inclusive por SIGINT, usa exit `130`. As mensagens são determinísticas por código e nunca
controlam fluxo.

Falhas da CLI antes do despacho v1/v2 — ausência de `--input`, falha de
leitura do arquivo ou JSON malformado — preservam o comportamento existente:
diagnóstico textual em stderr, stdout vazio e exit `1`. Elas não são falhas
de cálculo v2. Falha de protocolo, crash de worker e timeout de IPC pertencem
à fundação futura do Épico 5 e não integram `IN_PROCESS_TYPESCRIPT_LIMITED`.

## 8. Compatibilidade e isolamento downstream

- API, tipos, comparator, versões, fixtures e resultados v1 de 15 permanecem
  bit a bit reproduzíveis; a API v1 continua wrapper do caminho imutável de 15.
- A v2 não altera a Story 4.9. A otimização de diversidade continua aceitando
  somente apostas simples de 15 até story própria.
- Distribuição estrutural de carteira, cobertura, expansão, custo/cotas e
  auditorias mantêm os limites de seus contratos. A geração não os chama nem
  amplia implicitamente sua elegibilidade.
- A expansão 4.7 pode ser invocada depois, explicitamente, para uma aposta-
  fonte 16–20. Ela não faz parte desta operação.
- Persistência, aprovação, congelamento, relatório, impressão, UI e IPC não são
  consequências da geração v2.

### 8.1 Versionamento

- Mudança incompatível no request, resultado, eventos ou erros exige nova
  versão do contrato e mantém o parser anterior disponível enquanto suportado.
- Mudança na permutação, unranking, classificação aplicada, maiores restos ou
  ordenação exige nova versão do componente/algoritmo correspondente e novos
  vetores de regressão.
- Nova política ou massa é consumida somente sob nova identidade/versão/hash da
  Story 4.11; um artefato antigo nunca é reinterpretado silenciosamente.
- Alterar o teto de candidatos exige benchmark e revisão arquitetural; se mudar o conjunto de
  requests válidos, avança a versão do contrato.
- Nenhuma versão v2 pode alterar os bytes/resultados cobertos pelos vetores v1
  de 15.

A aprovação de Produto de 09/09 incorpora o teto de seeds e a superfície
API/callback à especificação inicial v2 ainda não implementada/liberada.
Não reinterpreta um runtime v2 já publicado. Após sua liberação, mudar o
conjunto de seeds aceitas ou a semântica pública de opções/rejeições exige
versionamento compatível com as regras acima, nunca mudança silenciosa.

## 9. Evolução futura de escala — fora da Story 4.12

Uma evolução posterior pode contratar geração particionada em lotes com:
partição determinística do universo, ausência de duplicatas entre lotes,
cursor/continuação, retomada, persistência e auditoria/hash do conjunto
completo. Esses itens exigem contratos, versões e stories próprias.

Executar várias seeds independentes não é uma solução autorizada de escala,
porque não garante unicidade global nem continuidade auditável entre lotes.

## 10. Evidência operacional que sustenta o teto

Benchmarks read-only no ambiente de referência, com as primitivas reais de
PRNG, métricas e políticas, observaram:

| Cenário | Evidência observada |
| --- | --- |
| v1, 15, `NEUTRAL`, 10000 candidatos | aproximadamente 50 ms; RSS aproximado 117 MB |
| harness 16–20, classificado/ordenado, 10000 candidatos | aproximadamente 104–116 ms; RSS 118–121 MB; JSON 530–656 KB |
| varredura integral classificada, pior universo (`betSize=16`) | aproximadamente 5,40 s no caminho representativo; harness conservador aproximadamente 10,4 s |
| lote cooperativo de 1.024 ranks | até aproximadamente 5,21 ms observado |
| 100 candidatos raros `FOUR_PLUS_EXTREMES` | 27.014–68.109 visitas; aproximadamente 129–378 ms |

Esses valores justificam o P0 limitado, a verificação a cada 1.024 ranks e a
ausência de worker Python nesta story. São evidência de arquitetura, não SLA.
Benchmark, RSS e contagem de ranks visitados devem ser registrados no gate de
QA da implementação, separando geração produtiva de qualquer oráculo/teste.

## 11. Plano normativo de testes

1. Schemas estritos: campos desconhecidos em todos os níveis, uniões de modo,
   política/versão/hash incompatíveis, alocação maior que a massa disponível e
   resultado conjunto inválido.
   Verificar os vetores de violações simultâneas da seção 11.1, incluindo a
   alcançabilidade dos erros específicos de tamanho e modo; incluir os vetores
   de seeds da seção 3.2 e de opções/preaborto/callback/thenables da seção 6.2.
2. Bordas: `candidateCount` 1 e 10000 satisfazem a regra de contagem;
   sucesso exige request integralmente válido. Testes positivos usam `NEUTRAL`
   ou `ADVANCED` comprovadamente viável. Com as demais regras satisfeitas,
   `ADVANCED` inviável continua retornando o erro de alocação. Rejeitar 10001
   pelo erro de limite antes de avaliar a viabilidade, conforme seção 7.1.
   Para cada tamanho 16–20, `candidateCount = C(25,k)` é igual ao universo,
   mas excede o teto técnico de 10000 e recebe o mesmo erro de limite.
   Essas rejeições ocorrem no preflight, sem progresso; vetores em 11.1.
3. Propriedades, para cada `betSize` de 16 a 20: cada candidato satisfaz
   `numbers.length === betSize`, com dezenas inteiras, únicas, crescentes em
   1..25; `candidates.length === candidateCount`, com candidatos únicos, e
   determinismo por repetição. Na validação conjunta, aceitar resultados que
   satisfaçam todos os invariantes; rejeitar com
   `INVALID_PORTFOLIO_GENERATION_V2_RESULT` candidatos com `betSize - 1` ou
   `betSize + 1` dezenas, dezenas fracionárias/repetidas/fora de ordem/fora do
   domínio, total `candidateCount - 1` ou `candidateCount + 1` e candidatos
   duplicados mesmo quando o total estiver correto; sem publicação.
4. `NEUTRAL`: ausência de alocação e de qualquer filtro estrutural.
5. `ADVANCED`: cinco faixas exatas, maiores restos, desempate estável,
   quantidades produzidas e alocação inviável sem parcial; tolerância e
   ausência de normalização conforme os vetores da seção 11.2.
6. Confirmação de que núcleo, sinais auxiliares e E individuais não filtram.
7. Progresso monotônico, distância máxima de 1.024 ranks para cooperação,
   `AbortSignal` inclusive durante `FINALIZE_RESULT` e imediatamente antes da
   publicação, `SIGINT`/130, stdout vazio em falha/cancelamento anterior à
   publicação e ausência de resultado parcial produzido pelo gerador.
   Verificar zero eventos `FINALIZE_RESULT` quando erro/cancelamento impede
   entrar na finalização, uma emissão após seleção completa e nenhuma repetição;
   receber o evento não impede falha/cancelamento posterior antes da publicação.
   Em subprocesso, sincronizar pelo evento `FINALIZE_RESULT` e usar uma
   barreira exclusiva do harness dentro da finalização síncrona para enviar
   SIGINT real antes de liberá-la; não depender de sleeps nem simular apenas
   `AbortController.abort()` no callback. Exigir erro de cancelamento, exit
   `130` e zero bytes em stdout; o teste deve falhar se o yield for removido
   ou substituído apenas por microtasks. Cobrir também o trabalho síncrono de
   serialização CLI, o sucesso sem sinal e o sinal posterior ao início da
   escrita, que não pode reclassificar a operação como cancelada.
   Injetar falha de escrita após a fronteira: resultado matemático válido não
   implica entrega bem-sucedida; exigir falha, nunca exit `0`, e não exigir
   rollback dos bytes já escritos.
8. `timeoutApplied: false` e ausência de temporizador normativo.
9. CLI: stdout com um JSON final; progresso/diagnóstico JSONL somente em
   stderr; exits e erros públicos determinísticos.
   Testar os oito pares exatos da tabela normativa da seção 7 na rejeição da
   API e na serialização CLI, incluindo os vetores de 3.2, 6.2, 11.1 e 11.2.
   Variar seed/input e exceções internas/callback para comprovar que não
   alteram a mensagem. Em testes de tipos e do schema runtime planejado,
   aceitar os oito pares canônicos e rejeitar todos os pares trocados
   (cada código com mensagem de outro código) e mensagens arbitrárias;
   preservar os literais `type`/`contractVersion` e a estriteza do envelope.
   Verificar o mesmo mapeamento antes da rejeição API/serialização CLI.
   Verificar
   fluxo baseado somente em `code`, sem repetir os literais neste plano.
10. Regressão integral do universo de comportamento v1 de 15, incluindo os
    vetores canônicos já registrados: neutro
    `cbb8c1e1904355f07f2ccc5e3d1e9fe430c883fa6738001810705d1ab4c67d74`
    e estrutural 80/20
    `284c43b97087ab2111373984a2b8c01660c3bfb53ca965f819064c4c9e9b95bb`;
    regressões 4.7, 4.9, 4.10 e políticas 4.11 sem alteração de contratos ou
    resultados.
11. Determinismo entre execuções/ambientes suportados e memória proporcional ao
    resultado solicitado, não ao universo; vetores ASCII e não ASCII do PRNG,
    além de vetores de unranking e da permutação completa.
12. Ordenação numérica aprovada por Produto em 2026-09-09: vetores de 16
    dezenas devem distinguir comparação numérica de comparação textual das
    representações decimais sem zero à esquerda. Na primeira posição,
    `[2,3,4,5,6,7,8,9,10,11,12,13,14,15,16,17]` precede
    `[10,11,12,13,14,15,16,17,18,19,20,21,22,23,24,25]`; após prefixo comum,
    `[1,2,11,12,13,14,15,16,17,18,19,20,21,22,23,24]` precede
    `[1,10,11,12,13,14,15,16,17,18,19,20,21,22,23,24]`. A comparação textual
    inverte ambos os pares. Verificar igualdade e preservação do conjunto,
    quantidades e alocações após ordenar, com regressões 4.9/4.10 intactas.
13. Integridade: comparar bytes/hashes runtime–fixture e falhar por divergência.
    Validação matemática: preservar as regressões contra o oráculo independente
    da Story 4.11. Igualdade entre duas cópias não substitui esse oráculo.

O oráculo de ranking/unranking e alocação deve ser independente do caminho
produtivo, existir somente em testes e não reutilizar a função sob teste. Seus
vetores são revisados e fixos; nenhum comando produtivo ou teste pode atualizar
fixtures automaticamente.

### 11.1 Vetores de precedência

Partir de um request v2 `ADVANCED` válido, `betSize = 16`, `candidateCount = 1`,
alocação de 100% em `zeroExtremes` (demais faixas em 0) e referência exata da
fixture 4.11. Cada linha altera somente os campos indicados. `policyId =
"inexistente"` mantém a forma da referência, mas diverge da política normativa.

| Alterações simultâneas | Código esperado |
| --- | --- |
| Adicionar campo de topo `extra`; `strategy.betSize = 15` | `INVALID_PORTFOLIO_GENERATION_V2_REQUEST` |
| `strategy.betSize = 15.5` ou `16.5` (casos separados, isolados) | `INVALID_PORTFOLIO_GENERATION_V2_REQUEST` |
| `strategy.betSize = 15.5` ou `16.5`; `strategy.mode = "UNSUPPORTED"`; `candidateCount = 10001` | `INVALID_PORTFOLIO_GENERATION_V2_REQUEST` |
| `strategy.betSize = 15`; `strategy.mode = "UNSUPPORTED"` | `UNSUPPORTED_LOTOFACIL_BET_SIZE` |
| `strategy.mode = "UNSUPPORTED"`; `candidateCount = 10001` | `UNSUPPORTED_LOTOFACIL_GENERATION_MODE` |
| `candidateCount = 10001`; `policySetReference.policy.policyId = "inexistente"` | `LOTOFACIL_CANDIDATE_COUNT_LIMIT_EXCEEDED` |
| `candidateCount = 10000`; alocação 100% em `fourPlusExtremes` e 0 nas demais | `LOTOFACIL_STRUCTURAL_ALLOCATION_INFEASIBLE` |
| `candidateCount = 10001`; alocação 100% em `fourPlusExtremes` e 0 nas demais | `LOTOFACIL_CANDIDATE_COUNT_LIMIT_EXCEEDED` |
| `candidateCount = C(25,16)`; `policySetReference.policy.policyId = "inexistente"` | `LOTOFACIL_CANDIDATE_COUNT_LIMIT_EXCEEDED` |
| `candidateCount = 3173`; alocação 100% em `fourPlusExtremes` e 0 nas demais; `policySetReference.policy.policyId = "inexistente"` | `LOTOFACIL_STRUCTURAL_POLICY_MISMATCH` |
| Remover `structuralAllocation.zeroExtremes`; `candidateCount = 10001` | `INVALID_PORTFOLIO_GENERATION_V2_REQUEST` |
| `candidateCount = 0`, `-1` ou `1.5` (casos separados); `strategy.mode = "UNSUPPORTED"` | `INVALID_PORTFOLIO_GENERATION_V2_REQUEST` |

`candidateCount` e `structuralAllocation` na tabela abreviam, respectivamente,
`parameters.candidateCount` e `strategy.structuralAllocation`. A massa normativa
de `FOUR_PLUS_EXTREMES` para 16 é 3.172: restaurando somente o `policyId`
normativo no vetor com `candidateCount = 3173`, o erro esperado passa a
`LOTOFACIL_STRUCTURAL_ALLOCATION_INFEASIBLE`. Os vetores isolados de tamanho
15 e modo `"UNSUPPORTED"` também devem retornar seus códigos específicos.
Permutar a ordem das propriedades JSON em todos os níveis deve preservar
código, mensagem canônica correspondente da seção 7, exit `1` e ausência de
progresso/stdout em cada caso.
Para os vetores de tamanho inválido, comprovar zero chamadas à combinatória
e zero progresso. Repetir os fracionários com sinal previamente abortado:
o erro de request prevalece, conforme 6.2.

### 11.2 Evidência e vetores de fronteira da alocação

Conferência read-only em `9b3cb82642d84154cfda254bc43f223c54304d99`:
`packages/lotteries/lotofacil/src/index.ts`, funções
`validateLotofacilStructuralAllocation` e
`calculateLotofacilStructuralAllocationCounts`, confirma a seção 3.2.
`tests/lotofacil/portfolio-generation.test.ts` aceita ruído fracionário e
rejeita negativos/não finitos; a regressão de maiores restos em
`tests/portfolio-engine/lotofacil-deterministic-diversity-optimization.test.ts`
confirma 20/20/20/20/20 para 7 candidatos como 2/2/1/1/1.
Os dois arquivos passaram (27 testes); não cobrem ainda as fronteiras abaixo.

Testes planejados, sem alterar algoritmo ou fixtures: nas cinco chaves em
ordem canônica, usar `[50, 50 + u * 2**-46, 0, 0, 0]`, `candidateCount = 7`.
Os valores e resultados abaixo foram confirmados por sondagem read-only.

| `u` | `Math.abs(S - 100)` observado | Validação / contagens esperadas |
| ---: | ---: | --- |
| 0 | 0 | aceita; 4/3/0/0/0 |
| -70368 | 9.999894245993346e-10 | aceita; 4/3/0/0/0 |
| 70368 | 9.999894245993346e-10 | aceita; 3/4/0/0/0 |
| -70369 | 1.0000036354540498e-9 | rejeita soma; em v2, `INVALID_PORTFOLIO_GENERATION_V2_REQUEST`, sem progresso/stdout |
| 70369 | 1.0000036354540498e-9 | rejeita soma; em v2, `INVALID_PORTFOLIO_GENERATION_V2_REQUEST`, sem progresso/stdout |

A condição inclusiva é aplicada ao desvio calculado, não ao decimal ideal:
`100 ± 1e-9` em `Number` cai fora da tolerância. Os pares da tabela são os
vizinhos representáveis de `S` de cada lado da fronteira; não usar epsilon
extra nem arredondar a soma. Testar também que a entrada não é mutada e os
percentuais registrados no resultado são os recebidos, mesmo quando `S != 100`;
as cotas seguem `p_i * candidateCount / 100`, sem renormalização.

### 11.3 Vetores dos contadores

Planejar os casos abaixo em progresso e resultado, conforme 3.5, mantendo
válidos os demais campos e separando cada nível de validação:

- **Schemas isolados:** aceitar limites inclusivos e inteiros seguros válidos;
  rejeitar `-1`, `0.5` e `Number.MAX_SAFE_INTEGER + 1` em cada campo de contagem,
  inclusive cada faixa de `ADVANCED`. Rejeitar `candidateCount = 0`/`10001`,
  universo diferente de `C(25, betSize)`, visitas acima do universo e
  `selectedCount` acima de visitas ou de `candidateCount`.
- **Shapes/soma:** `NEUTRAL` aceita somente `structuralCounts: null`;
  `ADVANCED` exige exatamente as cinco faixas e soma igual a `selectedCount`.
  Rejeitar chave extra/ausente e soma divergente mesmo com valores válidos.
- **Sequência:** aceitar início com ambos os contadores em zero e séries
  monotônicas; rejeitar regressão de visitas, selecionados ou faixa mesmo
  quando cada evento isolado for válido. Rejeitar mudança de contagem/universo
  entre eventos; `FINALIZE_RESULT` exige seleção completa, sem sucesso implícito.
- **Conjunto com request:** rejeitar divergência de contagem/tamanho/modo,
  faixa acima do alvo ou resultado final que não iguala cada alvo. Rejeitar
  `selectedCount != candidateCount` ou `candidateCount != candidates.length`
  no sucesso e faixas divergentes da classificação dos candidatos. Alvos
  derivam sempre do request validado, não de dados autodeclarados pelo evento.

Violações de progresso/resultado geradas internamente seguem o erro genérico
de resultado de 7.1, sem disponibilizar resultado ou publicar JSON final.
Para request inválido, preservar separadamente os códigos de preflight de
7.1/11.1; nenhum teste de schema de saída altera essa precedência.

## 12. Dependências e gates

- Story 4.11 `Done`, políticas/massas e hashes disponíveis: satisfeita.
- F5-IPC-SPEC/4.12 com decisão `IN_PROCESS_TYPESCRIPT_LIMITED`: satisfeita por
  este contrato; não depende de `F5-IPC-DONE` para implementar a Story 4.12.
- Validação Arquitetura `PASS`, SM `PASS` e PO `GO`: obrigatórias antes de
  `Ready`; reexecutadas para o pacote local r2 identificado acima, não apenas
  herdadas dos gates históricos de 07/09 ou r1.
- Implementação exige gate QA, lint, typecheck, suíte completa, testes focados,
  regressões e CodeRabbit; este documento não os antecipa.
- Nenhuma dependência de runtime nova, manifest ou lockfile é prevista.

O Épico 4 permanece aberto até a Story 4.12 ser implementada, validada e
formalmente concluída. Este contrato não inicia nem conclui a implementação.
