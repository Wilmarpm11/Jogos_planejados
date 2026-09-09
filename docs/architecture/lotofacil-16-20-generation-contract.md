# Contrato de geração Lotofácil 16–20

**Status:** especificação aprovada para readiness; não autoriza implementação

**Data:** 2026-09-07

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
atômico: falha ou cancelamento não publica resultado parcial.

## 2. Decisão de criar, reutilizar e restringir

| Capacidade | Decisão | Restrição |
| --- | --- | --- |
| Contrato de geração | **Criar** API v2 assíncrona e aditiva | Não alterar a API v1 nem seus tipos/resultados de 15. |
| Semântica do `PortfolioGenerator` | **Reutilizar** entrada mínima, resultado transitório e unicidade | A v2 pode ampliar tipos somente por novos exports discriminados. |
| PRNG, seed e permutação | **Reutilizar** as primitivas da Story 4.2 | Mesma versão e entrada completa devem reproduzir os mesmos ranks. |
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
  seed: non-empty string,
  candidateCount: safe integer
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

`parameters.seed` é a seed efetivamente consumida pelo PRNG, preservando a
semântica v1. `strategy.seed` permanece como proveniência da configuração
resolvida; os dois campos integram a identidade completa da entrada e não são
silenciosamente substituídos ou igualados.

- ramo `NEUTRAL`: `mode = "NEUTRAL"`, `statisticalLabel = "NEUTRAL"` e não
  existe `structuralAllocation`;
- ramo `ADVANCED`: `mode = "ADVANCED"`, `statisticalLabel = "PRODUCTION"` e
  existe `structuralAllocation` com exatamente `zeroExtremes`, `oneExtreme`,
  `twoExtremes`, `threeExtremes` e `fourPlusExtremes`. Cada valor é finito,
  entre 0 e 100, e a soma segue a tolerância já aprovada pelo contrato de
  maiores restos para representar 100%.

As chaves de alocação mapeiam, na mesma ordem, para `ZERO_EXTREMES`,
`ONE_EXTREME`, `TWO_EXTREMES`, `THREE_EXTREMES` e
`FOUR_PLUS_EXTREMES`. As quantidades inteiras usam
`lotofacil-largest-remainder/1.0.0`, inclusive seu desempate estável.

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

A fixture normativa 4.11 permanece como oráculo independente. Um teste compara
bytes e hashes entre ela e o artefato empacotado; divergência bloqueia a suíte.
Nenhum comando atualiza qualquer uma das cópias automaticamente.

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
  candidates: [{ numbers: [strictly increasing integers in 1..25] }],
  execution: {
    visitedRanks,
    universeSize,
    selectedCount,
    structuralAllocation: null | exact five-key percentage object,
    structuralCounts: null | exact five-band integer object,
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

A ordem v2 é a comparação lexicográfica numérica das dezenas canônicas,
elemento a elemento. Ela não reutiliza nem modifica
`locale-compare-of-comma-joined-canonical-games/1.0.0`, preservado apenas no
caminho v1 de 15. Request e resultado são validados conjuntamente; divergência
de quantidade, tamanho, versões, política, faixas, ordenação ou flags invalida
o resultado antes da publicação.

## 4. Algoritmo determinístico

1. Fazer preflight completo do schema, definição, modo, contagem, universo e
   referência da política, sem emitir progresso. Em `ADVANCED`, converter a
   alocação em quantidades e compará-las às contagens exatas das faixas da massa
   referenciada; inviabilidade conhecida falha ainda no preflight.
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
6. Depois do evento `FINALIZE_RESULT`, verificar `AbortSignal` novamente,
   ordenar candidatos pelo comparador v2, construir o resultado completo,
   validar request/resultado conjuntamente, verificar `AbortSignal` uma última
   vez e somente então publicar o JSON final.

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
| 16 | 2.042.975 | 10.000 |
| 17 | 1.081.575 | 10.000 |
| 18 | 480.700 | 10.000 |
| 19 | 177.100 | 10.000 |
| 20 | 53.130 | 10.000 |

`10.000` é somente teto técnico por execução. Não é padrão, recomendação de
compra, limite comercial ou limite definitivo. `10.001` e qualquer contagem
acima do universo são rejeitadas no preflight, antes do primeiro progresso.
Elevar o teto exige benchmark atualizado, revisão arquitetural e nova versão do
contrato/algoritmo afetado.

O orçamento máximo de inspeção é um percurso do universo do tamanho solicitado.
Não há timeout normativo no contrato `1.0.0`; todo resultado registra
`timeoutApplied: false`.

## 6. Progresso, cancelamento e CLI

A API v2 é assíncrona e aceita `AbortSignal` e callback de progresso. Após o
preflight bem-sucedido, emite um evento inicial, eventos após cada lote de no
máximo 1.024 ranks e um evento `FINALIZE_RESULT` não terminal depois de
completar a seleção. Não existe evento de sucesso antes da validação conjunta;
o JSON validado em stdout é o único terminal de sucesso.

O schema estrito de progresso possui exatamente:

```text
{
  type: "progress",
  contractVersion: "lotofacil-16-20-generation/1.0.0",
  phase: "SELECT_CANDIDATES" | "FINALIZE_RESULT",
  betSize: integer 16..20,
  mode: "NEUTRAL" | "ADVANCED",
  visitedRanks,
  universeSize,
  selectedCount,
  candidateCount,
  structuralCounts: null | exact five-band integer object
}
```

O evento inicial usa `SELECT_CANDIDATES`, `visitedRanks = 0` e
`selectedCount = 0`. Os campos são monotônicos, derivados de contadores e nunca
do relógio. `FINALIZE_RESULT` ocorre exatamente uma vez; em `NEUTRAL`,
`structuralCounts` é sempre `null`; em `ADVANCED`, contém as cinco faixas.

Na CLI-first, a ação existente `portfolio generate --input PATH` despacha o
request discriminado para v1 ou v2 sem reinterpretá-lo. Para v2:

- `stdout` fica reservado ao único JSON final validado;
- progresso e diagnóstico estruturados usam somente JSONL em `stderr`;
- cancelamento por `SIGINT` produz exit `130`, sem stdout e sem resultado
  parcial;
- request inválido, limite, incompatibilidade de política e alocação inviável
  falham antes de resultado, com erro público estruturado e exit não zero;
- nenhum timeout é iniciado ou reportado como aplicado no contrato `1.0.0`.

## 7. Erros públicos

O único envelope de erro v2 é estrito, escrito como uma linha JSONL em stderr:

```text
{
  type: "error",
  contractVersion: "lotofacil-16-20-generation/1.0.0",
  code: one of the literals below,
  message: stable non-empty string for that code
}
```

Não há `stack`, path local ou campo adicional no envelope público. Os códigos
são:

- `INVALID_PORTFOLIO_GENERATION_V2_REQUEST`;
- `UNSUPPORTED_LOTOFACIL_BET_SIZE`;
- `UNSUPPORTED_LOTOFACIL_GENERATION_MODE`;
- `LOTOFACIL_STRUCTURAL_POLICY_MISMATCH`;
- `LOTOFACIL_CANDIDATE_COUNT_LIMIT_EXCEEDED`;
- `LOTOFACIL_STRUCTURAL_ALLOCATION_INFEASIBLE`;
- `LOTOFACIL_PORTFOLIO_GENERATION_CANCELLED`;
- `INVALID_PORTFOLIO_GENERATION_V2_RESULT`.

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
- cancelamento cooperativo por `AbortSignal`, inclusive acionado por `SIGINT`,
  usa `LOTOFACIL_PORTFOLIO_GENERATION_CANCELLED`.

Esses casos usam somente o envelope e os exits desta seção, com stdout vazio
em falha ou cancelamento e sem resultado parcial.

Entrada inválida nunca provoca progresso. Falha de execução ou validação e
cancelamento nunca publicam candidato parcial. Sucesso usa exit `0`; qualquer
erro não relacionado a cancelamento usa exit `1`; cancelamento, inclusive por
SIGINT, usa exit `130`. As mensagens são determinísticas por código e nunca
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
- Alterar o teto exige benchmark e revisão arquitetural; se mudar o conjunto de
  requests válidos, avança a versão do contrato.
- Nenhuma versão v2 pode alterar os bytes/resultados cobertos pelos vetores v1
  de 15.

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
| v1, 15, `NEUTRAL`, 10.000 candidatos | aproximadamente 50 ms; RSS aproximado 117 MB |
| harness 16–20, classificado/ordenado, 10.000 candidatos | aproximadamente 104–116 ms; RSS 118–121 MB; JSON 530–656 KB |
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
2. Bordas: aceitar `candidateCount` 1 e 10.000; rejeitar 10.001 e, para cada
   tamanho 16–20, rejeitar `candidateCount = C(25,k)` porque todos esses
   universos excedem o teto técnico de 10.000. Toda rejeição ocorre no
   preflight, sem progresso.
3. Propriedades 16–20: tamanho, domínio 01–25, ordem interna, unicidade,
   cardinalidade e determinismo por repetição.
4. `NEUTRAL`: ausência de alocação e de qualquer filtro estrutural.
5. `ADVANCED`: cinco faixas exatas, maiores restos, desempate estável,
   quantidades produzidas e alocação inviável sem parcial.
6. Confirmação de que núcleo, sinais auxiliares e E individuais não filtram.
7. Progresso monotônico, distância máxima de 1.024 ranks para cooperação,
   `AbortSignal` inclusive durante `FINALIZE_RESULT` e imediatamente antes da
   publicação, `SIGINT`/130, stdout vazio e ausência de parcial.
8. `timeoutApplied: false` e ausência de temporizador normativo.
9. CLI: stdout com um JSON final; progresso/diagnóstico JSONL somente em
   stderr; exits e erros públicos determinísticos.
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

O oráculo de ranking/unranking e alocação deve ser independente do caminho
produtivo, existir somente em testes e não reutilizar a função sob teste. Seus
vetores são revisados e fixos; nenhum comando produtivo ou teste pode atualizar
fixtures automaticamente.

## 12. Dependências e gates

- Story 4.11 `Done`, políticas/massas e hashes disponíveis: satisfeita.
- F5-IPC-SPEC/4.12 com decisão `IN_PROCESS_TYPESCRIPT_LIMITED`: satisfeita por
  este contrato; não depende de `F5-IPC-DONE` para implementar a Story 4.12.
- Validação Arquitetura `PASS`, SM e PO `GO`: obrigatórias antes de `Ready`.
- Implementação exige gate QA, lint, typecheck, suíte completa, testes focados,
  regressões e CodeRabbit; este documento não os antecipa.
- Nenhuma dependência de runtime nova, manifest ou lockfile é prevista.

O Épico 4 permanece aberto até a Story 4.12 ser implementada, validada e
formalmente concluída. Este contrato não inicia nem conclui a implementação.
