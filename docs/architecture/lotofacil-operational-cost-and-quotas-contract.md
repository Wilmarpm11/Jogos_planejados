# Contrato de custo operacional e cotas Lotofácil

**Status:** aprovado para implementação da Story 4.10

**Data:** 2026-09-05

**Contrato:** `1.0`

**Algoritmo:** `operational-cost-and-quotas/1.0.0`

**Modalidade inicial:** `lotofacil@1.0.0`

## 1. Decisão

Criar um contrato público, estrito e versionado para calcular o custo oficial
da carteira efetivamente comprada, uma taxa de serviço percentual e o rateio
exato do total em cotas identificadas. A operação é pura, determinística,
auditável e executável primeiro pela CLI.

A versão `1.0` usa o catálogo Lotofácil CAIXA já resolvido e persistido pela
Story 3.5. O chamador escolhe o registro aplicável ao concurso e o entrega por
inteiro; o motor valida sua consistência e registra sua proveniência, mas não
consulta banco, rede, relógio ou outra fonte de preço.

A taxa é representada por `feeBps`, inteiro de `0` a `10.000` basis points:
`100 bps = 1%` e `10.000 bps = 100%`. Quando omitida, vale `0`. O valor `30%`
não é padrão, obrigação ou taxa oficial e não é usado como constante normativa.

O resultado permanece transitório. Ele não vende cota, cobra, paga, cadastra
participante, persiste, aprova, congela ou imprime carteira.

## 2. Decisão de criação, reuso e restrição

| Capacidade | Decisão | Limite |
| --- | --- | --- |
| Request, resultado, erros, versões e interface de adaptação | **Criar contrato reutilizável** em `@boloes/lottery-contracts` | O Core não recebe constantes CAIXA ou Lotofácil implícitas. |
| Cálculo monetário e rateio | **Criar capacidade pura no package existente** `@boloes/portfolio-engine` | Aritmética inteira; sem catálogo, modalidade, banco ou UI dentro da primitiva. |
| Catálogo e proveniência | **Reutilizar** `LotofacilCatalogRecord` da Story 3.5 | Não duplicar parser, preço, snapshot ou persistência. |
| Canonização das apostas | **Reutilizar** validação e ordem canônica Lotofácil existentes | Duplicatas entre ocorrências continuam legítimas e não são deduplicadas. |
| Preço e limites por modalidade | **Restringir** ao adaptador `@boloes/lottery-lotofacil` | Outra modalidade precisa de catálogo e adaptador próprios. |
| CLI | **Reutilizar** a entrada local por arquivo e a separação de streams | Nenhuma UI ou IPC Python nesta story. |
| Skill AIOX dedicada | **Não criar** | O contrato executável, os adaptadores e testes são a fonte de verdade; não há workflow de agente reutilizável a extrair. |

## 3. Constantes normativas

- `contractVersion`: `1.0`.
- `algorithmVersion`: `operational-cost-and-quotas/1.0.0`.
- `lotteryId`: `lotofacil`.
- `lotteryDefinitionVersion`: `1.0.0`.
- `feeScaleBps`: `10_000`.
- `minimumFeeBps`: `0`.
- `maximumFeeBps`: `10_000`.
- `defaultFeeBps`: `0`.
- `feeRoundingRule`: `HALF_UP_TO_CENT_ON_TOTAL_OFFICIAL_COST`.
- `quotaDivisionRule`: `INTEGER_FLOOR_THEN_ASCENDING_QUOTA_ID_REMAINDER`.
- `purchasedBaseType`: `SOURCE_BETS | EXPANDED_SIMPLE_BETS`.
- `candidateOrderingVersion`:
  `locale-compare-of-comma-joined-canonical-games/1.0.0`.

Alterar escala/precisão do percentual, intervalo, arredondamento, incidência,
semântica da base, tratamento de duplicatas, ordem das cotas ou aplicação dos
limites CAIXA exige nova versão do contrato/algoritmo e vetores de regressão.

## 4. Request público estrito

O schema conceitual é:

```ts
type LotofacilOperationalCostAndQuotasRequestV1 = {
  contractVersion: "1.0";
  lotteryDefinition: {
    id: "lotofacil";
    version: "1.0.0";
    totalNumbers: 25;
    drawSize: 15;
    minBetSize: 15;
    maxBetSize: 20;
  };
  contestNumber: number; // inteiro positivo e seguro
  catalog: LotofacilCatalogRecord;
  purchasedBase:
    | {
        type: "SOURCE_BETS";
        bets: readonly { numbers: readonly number[] }[];
      }
    | {
        type: "EXPANDED_SIMPLE_BETS";
        bets: readonly { numbers: readonly number[] }[];
      };
  quotaIds: readonly number[];
  feeBps?: number; // inteiro; default 0
};
```

Todos os objetos são estritos: campos desconhecidos são rejeitados. A união por
`purchasedBase.type` permite exatamente uma representação. Um request não pode
carregar listas paralelas de apostas-fonte e combinações expandidas.

### 4.1 Definição e catálogo

O preflight exige:

1. definição exata Lotofácil `25/15`, apostas `15–20`, versão `1.0.0`;
2. `catalog.lotteryId == "lotofacil"`;
3. `catalog` válido pelo `lotofacilCatalogRecordSchema`, incluindo `id`,
   `sourceSnapshotId`, `persistedAt`, `sourceUrl`, `parserVersion`, validações,
   preços e limites completos para 15–20;
4. preços positivos, inteiros em centavos e seguros para JSON;
5. em cada entrada de limites, `minShares <= maxShares` e todos os valores são
   inteiros positivos e seguros;
6. `contestNumber` inteiro positivo e seguro.

O registro do catálogo é a versão imutável operacional desta execução. Não se
inventa um `catalogVersion`: sua identidade é `catalog.id`, vinculada a
`sourceSnapshotId` e aos demais campos de proveniência da Story 3.5. A afirmação
de que esse registro é aplicável ao concurso pertence ao chamador. O motor não
consulta vigência, “catálogo atual” ou último snapshot.

### 4.2 Base comprada

Ambos os ramos exigem lista não vazia de ocorrências. Cada ocorrência contém uma
aposta canônica: inteiros únicos de `01–25`, em ordem estritamente crescente.
Ocorrências iguais são permitidas, representam compras legítimas distintas e
contribuem novamente para o custo. Não existe campo `quantity`, deduplicação ou
multiplicador implícito em `1.0`.

#### `SOURCE_BETS`

- Cada ocorrência representa uma aposta-fonte efetivamente comprada.
- A carteira é homogênea: todas as ocorrências têm o mesmo tamanho, entre 15 e
  20 dezenas.
- O preço unitário é o `priceInCents` do catálogo para esse tamanho.
- O motor não expande a aposta e não cobra também suas combinações simples.

#### `EXPANDED_SIMPLE_BETS`

- Cada ocorrência representa uma combinação simples de 15 dezenas efetivamente
  comprada.
- Todas as ocorrências têm exatamente 15 dezenas.
- O preço unitário é o `priceInCents` do catálogo para 15 dezenas.
- Duplicatas originadas de fontes diferentes continuam ocorrências compradas e
  são cobradas novamente; o motor não recebe nem cobra as fontes que as geraram.

A lista do ramo escolhido é canonizada pela ordem Lotofácil versionada antes de
aparecer no resultado. Duplicatas permanecem adjacentes e preservam sua
multiplicidade. A ordem de entrada não altera custo nem ordem semântica final.

### 4.3 Cotas

`quotaIds` é uma lista não vazia de identificadores fornecidos pelo chamador.
Cada `quotaId` é inteiro positivo, único e seguro para JSON. Não há participante,
nome, CPF ou outra identidade pessoal.

`quotaCount` é derivado exclusivamente de `quotaIds.length`; não existe um
segundo campo de quantidade. Os IDs são ordenados numericamente de forma
crescente antes do rateio. Assim, `2` precede `10`, independentemente da ordem
recebida.

O adaptador localiza em `catalog.bolaoLimits` a entrada do tamanho comprado e
exige:

```text
minShares <= quotaCount <= maxShares
```

Para `EXPANDED_SIMPLE_BETS`, o tamanho usado é 15. Para `SOURCE_BETS`, é o único
tamanho homogêneo da carteira. `maxGamesPerReceipt` não participa desta
operação e não bloqueia o cálculo `1.0`; recibos e agrupamento operacional ficam
fora da story.

## 5. Fórmula normativa

Seja:

- `m`: quantidade de ocorrências da base comprada;
- `p`: preço oficial unitário do tamanho comprado, em centavos;
- `b`: `feeBps`, já normalizado para o default `0`;
- `q`: quantidade de cotas, igual a `quotaIds.length`.

### 5.1 Custo oficial

Como a carteira é homogênea:

```text
officialCostCents = m × p
```

Cada ocorrência participa exatamente uma vez. A fórmula usa o ramo escolhido;
nunca soma fontes e expansões.

### 5.2 Taxa HALF_UP em centavos

Calcular sem ponto flutuante:

```text
feeNumerator = officialCostCents × b
feeWhole = floor(feeNumerator / 10_000)
feeRemainder = feeNumerator mod 10_000

feeCents =
  feeWhole + 1, se 2 × feeRemainder >= 10_000
  feeWhole,     caso contrário
```

Essa é a regra `HALF_UP_TO_CENT_ON_TOTAL_OFFICIAL_COST`: a taxa é aplicada uma
única vez ao custo oficial total e arredondada uma única vez. Não se arredonda
taxa por aposta nem por cota. Como todos os operandos são não negativos,
“HALF_UP” significa que exatamente meio centavo ou mais sobe para o próximo
centavo.

```text
totalCents = officialCostCents + feeCents
```

`feeBps = 0` produz `feeCents = 0` e
`totalCents = officialCostCents`. `feeBps = 10_000` produz taxa igual ao
custo oficial.

### 5.3 Rateio

```text
baseQuotaCents = floor(totalCents / q)
remainderCents = totalCents mod q
```

Após ordenar `quotaIds` numericamente, as primeiras `remainderCents` cotas
recebem `baseQuotaCents + 1`; as demais recebem `baseQuotaCents`.

Se `baseQuotaCents == 0`, o request é rejeitado antes de publicar resultado,
pois ao menos uma cota teria valor zero. Não existe rateio parcial.

### 5.4 Segurança numérica

Produtos, somas, comparação `2 × feeRemainder` e divisão são executados com
aritmética inteira exata, usando `bigint` internamente quando necessário. O
contrato JSON publica somente números inteiros seguros.

O preflight rejeita qualquer entrada ou resultado intermediário/final que não
possa ser representado exatamente como inteiro seguro, incluindo:

- preço de catálogo;
- quantidade de ocorrências e cotas;
- `officialCostCents`;
- `feeCents`;
- `totalCents`;
- valor individual e soma das cotas.

Não é permitido multiplicar primeiro em `number` e converter depois para
`bigint`, pois isso poderia perder precisão antes da validação.

## 6. Resultado público estrito

O schema conceitual é:

```ts
type LotofacilOperationalCostAndQuotasResultV1 = {
  contractVersion: "1.0";
  algorithmVersion: "operational-cost-and-quotas/1.0.0";
  lottery: {
    id: "lotofacil";
    definitionVersion: "1.0.0";
  };
  contestNumber: number;
  catalogProvenance: {
    catalogRecordId: string;
    sourceSnapshotId: string;
    sourceUrl: string;
    parserVersion: string;
    validations: readonly string[];
    persistedAt: string;
  };
  purchasedBase: {
    type: "SOURCE_BETS" | "EXPANDED_SIMPLE_BETS";
    betSize: number;
    occurrenceCount: number;
    unitPriceCents: number;
    candidateOrderingVersion:
      "locale-compare-of-comma-joined-canonical-games/1.0.0";
    bets: readonly { numbers: readonly number[] }[];
  };
  officialCostCents: number;
  fee: {
    feeBps: number;
    feeScaleBps: 10000;
    base: "OFFICIAL_COST_OF_EFFECTIVELY_PURCHASED_PORTFOLIO";
    roundingRule: "HALF_UP_TO_CENT_ON_TOTAL_OFFICIAL_COST";
    feeCents: number;
  };
  totalCents: number;
  quotaAllocation: {
    quotaCount: number;
    baseQuotaCents: number;
    remainderCents: number;
    distributionRule:
      "INTEGER_FLOOR_THEN_ASCENDING_QUOTA_ID_REMAINDER";
    appliedCaixaShareLimits: {
      betSize: number;
      minShares: number;
      maxShares: number;
      maxGamesPerReceiptApplied: false;
    };
    quotas: readonly {
      quotaId: number;
      valueCents: number;
      receivedRemainderCent: boolean;
    }[];
  };
  transient: true;
  persisted: false;
  frozen: false;
  portfolioStateChanged: false;
  paymentPerformed: false;
};
```

O resultado replica a base canônica efetivamente precificada, e não a
representação excluída. Isso permite auditar ocorrência, multiplicidade, tamanho
e preço sem reconsultar o banco. O contrato não inclui conteúdo bruto do
snapshot CAIXA.

## 7. Invariantes do resultado

O schema de resultado e uma validação conjunta request/resultado devem provar:

1. modalidade, definição, concurso e proveniência correspondem ao request;
2. tipo, apostas canonizadas, multiplicidade, tamanho e quantidade da base
   correspondem exatamente ao ramo escolhido;
3. `unitPriceCents` é o `priceInCents` do catálogo para o tamanho comprado;
4. `officialCostCents == occurrenceCount × unitPriceCents`;
5. `fee.feeBps` é o valor normalizado e `fee.feeCents` satisfaz o HALF_UP;
6. `totalCents == officialCostCents + fee.feeCents`;
7. `quotaCount == quotaIds únicos == quotas.length` e respeita o intervalo
   CAIXA aplicável;
8. `baseQuotaCents == floor(totalCents / quotaCount)`;
9. `remainderCents == totalCents mod quotaCount`;
10. cotas estão em `quotaId` numérico crescente, cada valor é positivo e as
    primeiras `remainderCents` têm exatamente um centavo adicional;
11. a diferença entre maior e menor cota é no máximo um centavo;
12. `sum(quotas.valueCents) == totalCents`;
13. regras/versões e marcadores transitórios usam os literais normativos.

Nenhum campo calculado do resultado é aceito apenas por estar bem tipado; as
relações aritméticas e semânticas acima são revalidadas.

## 8. Preflight e limites

Toda rejeição ocorre antes de publicar resultado. A ordem conceitual é:

1. validar schema estrito, definição, concurso e `feeBps`;
2. validar catálogo completo e proveniência;
3. validar o ramo único, lista não vazia e apostas canônicas;
4. validar homogeneidade e tamanho permitido do ramo;
5. localizar preço e limites CAIXA do tamanho;
6. validar IDs de cotas e `minShares <= quotaCount <= maxShares`;
7. calcular com inteiros exatos e validar o intervalo seguro;
8. rejeitar rateio que gere qualquer cota zero;
9. construir e validar o resultado final.

Limites `1.0`:

- taxa: `0..10.000 bps`, inclusiva;
- apostas-fonte: tamanho homogêneo `15..20`;
- combinações expandidas: tamanho `15`;
- base: pelo menos uma ocorrência;
- cotas: IDs positivos/únicos e quantidade entre `minShares` e `maxShares` do
  catálogo para o tamanho comprado;
- valores e contagens: inteiros seguros na fronteira JSON;
- cotas de zero centavo: proibidas;
- `maxGamesPerReceipt`: não aplicado.

Não se cria um teto adicional de apostas ou timeout sem decisão e evidência. O
cálculo é linear no número de ocorrências e cotas, não tem loop combinatório e
não precisa de progresso, cancelamento ou Python na versão `1.0`.

## 9. Erros públicos

O enum `OperationalCostAndQuotasErrorCode` `1.0` contém:

- `INVALID_OPERATIONAL_COST_AND_QUOTAS_REQUEST`: schema, concurso, campo
  desconhecido ou invariante geral inválida;
- `UNSUPPORTED_OPERATIONAL_COST_LOTTERY`: modalidade ou definição não suportada
  pelo adaptador;
- `INCOMPATIBLE_OPERATIONAL_COST_CATALOG`: catálogo inválido, modalidade,
  proveniência, preço ou limite incompatível/ausente;
- `AMBIGUOUS_PURCHASED_COST_BASE`: mais de uma representação ou shape que não
  corresponda ao discriminador;
- `INVALID_PURCHASED_COST_BET`: aposta fora do universo, não canônica, tamanho
  inválido ou ramo expandido não simples;
- `HETEROGENEOUS_PURCHASED_COST_PORTFOLIO`: ocorrências-fonte com tamanhos
  distintos;
- `INVALID_SERVICE_FEE_BPS`: valor fornecido não inteiro ou fora de
  `0..10.000`; quando `feeBps` é omitido, ele é normalizado para `0` e não
  produz erro;
- `INVALID_QUOTA_IDS`: lista vazia, ID não inteiro/positivo/seguro ou duplicado;
- `QUOTA_COUNT_OUTSIDE_CAIXA_LIMITS`: quantidade fora de `minShares..maxShares`;
- `ZERO_VALUE_QUOTA`: o rateio produziria ao menos uma cota de zero centavo;
- `OPERATIONAL_COST_MONETARY_OVERFLOW`: contagem, produto, taxa, total ou rateio
  não cabe exatamente na fronteira de inteiro seguro.

Erros são classes tipadas com `code` literal. Mensagens servem a diagnóstico e
não ao controle de fluxo. Não há erro de rede, banco, pagamento, timeout ou
cancelamento porque essas capacidades não participam da operação.

## 10. CLI-first

A primeira superfície é:

```text
boloes portfolio calculate-cost-and-quotas --input PATH
```

- `--input` contém exatamente o request JSON `1.0`, inclusive o registro de
  catálogo já resolvido;
- sucesso escreve um único resultado JSON em `stdout` e usa exit code `0`;
- erro deixa `stdout` vazio, escreve uma linha JSONL estrita
  `{ "type": "error", "code": "...", "message": "..." }` em `stderr` e
  usa exit code `1`;
- não há `--db`, busca de “último catálogo”, rede, progresso, timeout ou
  cancelamento nessa ação.

Uma futura UI deve chamar o mesmo caso de uso; não pode reproduzir taxa, preço,
arredondamento ou rateio no frontend.

## 11. Testes normativos

### 11.1 Contrato e preflight

- request/resultado estritos e rejeição de campos desconhecidos;
- definição Lotofácil exata e rejeição de outra modalidade/versão/dimensões;
- catálogo completo válido e incompatibilidades de ID, snapshot, preço e
  limites, inclusive `minShares > maxShares`;
- concurso positivo/seguro;
- união discriminada exclusiva e rejeição de shape ambíguo;
- apostas canônicas 01–25, SOURCE homogêneo 15–20 e EXPANDED exatamente 15;
- base vazia, taxa fracionária/negativa/acima de 10.000 e IDs de cota inválidos;
- quantidade abaixo/acima dos limites CAIXA e `maxGamesPerReceipt` não aplicado.

### 11.2 Custo e duplicatas

- uma e várias ocorrências SOURCE em cada tamanho 15–20 usam o preço direto do
  catálogo;
- ocorrências EXPANDED usam exclusivamente o preço de 15;
- duplicatas em ambos os ramos permanecem no resultado e aumentam custo por
  ocorrência;
- permutar apostas não altera base canônica, custo ou totais;
- ausência de qualquer soma entre os ramos e ausência de expansão implícita.

### 11.3 Percentual e HALF_UP

- `feeBps` omitido e explícito `0` produzem taxa zero;
- extremos `0` e `10.000` são aceitos; `10.001` é rejeitado;
- vetor unitário com numerador abaixo de meio centavo arredonda para baixo;
- vetor com numerador exatamente em meio centavo arredonda para cima;
- vetor acima de meio centavo arredonda para cima;
- taxa é arredondada sobre o custo total, nunca por ocorrência/cota;
- nenhum teste usa `30%` como taxa oficial ou default.

### 11.4 Cotas e conservação

- entrada de IDs fora de ordem retorna ordem numérica crescente, inclusive
  `2 < 10`;
- divisão sem resto;
- restos de um e vários centavos;
- apenas as primeiras cotas por ID recebem o centavo adicional;
- diferença máxima de um centavo e conservação exata do total;
- quotaCount deriva somente da lista de IDs;
- rateio que produziria cota zero é rejeitado sem resultado;
- limite mínimo e máximo do catálogo é aceito nos extremos.

### 11.5 Segurança, pureza e compatibilidade

- operações próximas do inteiro seguro e overflow intermediário/final;
- prova de que multiplicação não passa antes por `number` inexato;
- repetição da mesma entrada produz resultado semanticamente idêntico;
- ausência de rede, banco, relógio, persistência, pagamento e estado global;
- CLI separa `stdout`/`stderr` e usa exits `0/1`;
- regressão integral do catálogo 3.5 e dos contratos canônicos usados;
- lint, typecheck, suíte completa e CodeRabbit sem achado crítico.

## 12. Decisão sobre catálogo e limites de bolão

A versão `1.0` aplica somente `minShares` e `maxShares` da entrada de
`bolaoLimits` correspondente ao único tamanho homogêneo comprado. Essa regra é
inequívoca porque o contrato proíbe carteira mista.

`maxGamesPerReceipt` não altera custo oficial, taxa nem rateio e fica fora do
cálculo. Valores de cota mínima/máxima em reais não fazem parte do contrato de
catálogo 3.5 e não são inventados nesta story.

O motor recebe o catálogo completo resolvido para manter pureza. Resolver o
catálogo pelo banco, escolher “mais recente”, sincronizar, validar vigência por
concurso ou decidir fallback pertence ao chamador e às capacidades CAIXA.

## 13. Fora do escopo

- Alterar a Story 4.9 ou qualquer contrato de diversidade.
- Sincronizar, consultar ou persistir catálogo; alterar o parser da Story 3.5.
- Aceitar carteira com tamanhos mistos ou as duas bases no mesmo request.
- Expandir, deduplicar, gerar, otimizar, auditar ou calcular cobertura.
- Aplicar `maxGamesPerReceipt`, agrupar recibos ou planejar registro presencial.
- Persistir resultado, criar revisão, relatório, aprovação ou
  `FrozenPortfolio`.
- Pagamento, cobrança, venda de cotas, participante, dados pessoais, conta
  bancária ou integração financeira.
- UI, Tauri, IPC Python, PDF, impressão, exportação ou conferência.
- Preço manual, desconto, promoção, imposto, taxa por aposta/cota ou moeda
  diferente do catálogo oficial em centavos.

## 14. Parecer arquitetural

**Decisão:** `PASS`.

As decisões de Produto fecham os bloqueios de precisão, arredondamento,
identidade/ordem das cotas, base comprada, homogeneidade, duplicatas, limites e
proveniência. O contrato `1.0` é implementável sem regra implícita, preserva o
catálogo 3.5, mantém a operação pura e CLI-first e não antecipa persistência ou
Épico 5.

Não há bloqueio arquitetural remanescente para `Ready`. A validação PO foi
concluída com `GO` e a Story 4.10 está `Ready`. Esse estado confirma a prontidão
para implementação; não significa que a implementação esteja iniciada ou
concluída.

— Aria, arquitetando o futuro 🏗️
