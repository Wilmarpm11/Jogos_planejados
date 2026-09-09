# PRD v0.4.17 - Plataforma de Engenharia de Bolões

**Status:** Aprovado condicionalmente para fundação e arquitetura  
**MVP:** Lotofácil  
**Modelo de licença:** GPL-3.0-or-later  
**Última atualização:** 2026-09-09

## Change log

| Data | Versão | Descrição | Autor |
| --- | --- | --- | --- |
| 2026-08-26 | 0.3 | PRD inicial multi-loteria | Produto |
| 2026-08-29 | 0.4 | Fórmula canônica, histórico versionado, impressão A4 e gates de qualidade | PM / AIOX |
| 2026-08-29 | 0.4.1 | Parecer final de Architect, PO e QA; gates de produção explicitados | PM / AIOX |
| 2026-08-29 | 0.4.2 | Removidos exemplos de carteira de teste; fórmula como única referência canônica | PM / AIOX |
| 2026-08-29 | 0.4.3 | Ocupação de linhas/colunas normalizada por tamanho de aposta (15–20) e raridade teórica por universo | PM / AIOX |
| 2026-08-30 | 0.4.4 | Modo avançado, coorte contextual, estratégia manual experimental e comparação pré-geração | Produto |
| 2026-09-02 | 0.4.5 | Gate operacional da auditoria quadrática: teto, progresso, cancelamento e rejeição em preflight | Produto |
| 2026-09-02 | 0.4.6 | Primeira distribuição estrutural de carteira restrita à Lotofácil simples, com agregação exata, progresso e cancelamento | Produto / Arquitetura |
| 2026-09-02 | 0.4.7 | Gate da cobertura única: método exato 12+, teto de 1.000 jogos simples, timeout de 30 s e erro zero | Produto / Arquitetura |
| 2026-09-02 | 0.4.8 | Primeira expansão canônica Lotofácil restrita a uma aposta de 15–20, materializada em combinações simples de 15 | Produto / Arquitetura |
| 2026-09-02 | 0.4.9 | Composição transitória de várias apostas-fonte Lotofácil com expansão canônica e cobertura exata, preservando o teto de 1.000 ocorrências simples | Produto / Arquitetura |
| 2026-09-04 | 0.4.10 | Reconciliação administrativa dos gates já comprovados de fórmula canônica e contratos CAIXA; massas estruturais 16–20 permanecem pendentes | PO / PM / Arquitetura |
| 2026-09-04 | 0.4.11 | Regra de produto para custo/cotas: taxa percentual configurável, padrão 0%, base oficial sem dupla contagem e rateio auditável em centavos | Produto / PM |
| 2026-09-05 | 0.4.12 | Contrato P0 de custo/cotas fechado: taxa em basis points, HALF_UP, quotaId numérico, base homogênea discriminada e limites de cotas do catálogo | Produto / PO / Arquitetura |
| 2026-09-05 | 0.4.13 | Política estrutural 16–20 fechada: métricas preservadas, limites por cauda exata, E9/E10 normalizados, faixas/núcleo próprios e enumeração integral | Produto / Análise / PO / Arquitetura |
| 2026-09-07 | 0.4.14 | Gate de políticas e massas 16–20 concluído pela Story 4.11, com QA, revisão remota, fixtures e hashes preservados | QA / PO / SM |
| 2026-09-07 | 0.4.15 | F5-IPC-SPEC/4.12 fechado: geração 16–20 em TypeScript limitado, API v2, modos P0, teto, observabilidade e compatibilidade aprovados; IPC geral permanece pendente para o Épico 5 | Produto / PO / Arquitetura / SM |
| 2026-09-09 | 0.4.16 | Precisões documentais de alocação, publicação e evento não terminal; readiness 4.12 revalidado no pacote local r1, incluindo a ordenação numérica já aprovada | Arquitetura / SM / PO |
| 2026-09-09 | 0.4.17 | Produto aprova seeds UTF-16 e superfície API/callback, incluindo thenables malformados; cardinalidade explicitada e readiness 4.12 revalidado no pacote r2, sem alterar v1 ou implementar código | Produto / Arquitetura / SM / PO |

## 1. Objetivo e contexto

Construir uma plataforma desktop, local-first, para planejar, gerar, auditar,
congelar, imprimir e conferir carteiras de bolão. O produto não promete prever
sorteios nem escolhe "números quentes". Ele transforma orçamento em uma carteira
matematicamente organizada, rastreável e operacionalmente imprimível.

A Lotofácil é o primeiro módulo completo. Mega-Sena e outras modalidades entram
depois na mesma base de processo, mas com suas próprias regras, métricas,
cobertura, preços, resultados e templates de impressão.

### 1.1 Metas

- Preservar a fórmula metodológica fornecida pelo produto como invariante.
- Gerar carteiras Lotofácil reproduzíveis, auditáveis e diversificadas.
- Manter histórico, pesquisa e geração tecnicamente separados.
- Atualizar resultados e catálogo de regras/preços da CAIXA ao abrir o app, sem
  bloquear a operação quando a fonte estiver indisponível.
- Exigir relatório de conferência e aprovação explícita antes de imprimir.
- Gerar PDF A4 paisagem com volantes recortáveis para registro presencial.
- Permitir exportação, impressão e conferência da mesma carteira congelada.

### 1.2 Não objetivos do MVP

- Prometer probabilidade futura, retorno financeiro ou "melhores dezenas".
- Usar frequência, atraso ou resultado recente como peso automático de geração.
- Intermediar aposta, pagamento, compra de cotas, cadastro de participantes ou
  armazenar credenciais da CAIXA.
- Entregar Mega-Sena no MVP.
- Declarar impressão aceita universalmente por lotéricas sem homologação física.

## 2. Invariantes de produto

O fluxo obrigatório é:

```text
Universo matemático
  -> métricas estruturais por modalidade
  -> histórico observado e lift
  -> validação temporal
  -> estratégia aprovada/versionada
  -> geração
  -> otimização de diversidade
  -> auditoria de cobertura
```

`PortfolioGenerator` recebe somente `LotteryDefinition`,
`ApprovedStrategyConfig` e parâmetros da execução. Ele não pode importar,
consultar ou receber resultados históricos brutos.

Uma alteração de jogos, cotas, concurso, catálogo, estratégia, seed ou parâmetros
cria uma revisão. Somente uma `FrozenPortfolio` pode ser exportada ou impressa.
PDF, CSV, TXT, relatório, ponte online e conferência carregam o mesmo
`portfolio_hash` e não podem recalcular ou reordenar os jogos.

### 2.1 Gate de reutilização por skill

Antes de implementar ou alterar qualquer capacidade estável e reutilizável, o
agente responsável deve avaliar explicitamente se ela precisa de uma skill ou
contrato específico. Isso é obrigatório para cálculo combinatório, métricas,
cobertura, sincronização de dados, estratégia, impressão, calibração e
conferência.

O agente deve registrar a decisão como uma destas opções antes de seguir:

1. **Criar skill/contrato reutilizável:** a capacidade será compartilhada por
   modalidades ou precisa manter comportamento idêntico ao longo do tempo.
2. **Usar skill/contrato existente:** a capacidade já tem uma fonte de verdade;
   a mudança deve preservar sua compatibilidade.
3. **Implementar apenas no módulo da modalidade:** a regra é comprovadamente
   específica e não deve contaminar o Core.

Nenhum agente pode duplicar ou alterar uma regra estável sem declarar essa decisão
e o impacto nas modalidades já existentes.

## 3. Escopo funcional do MVP

### FR-01 - Núcleo multi-loteria

O Core deve ser independente de Lotofácil. Toda modalidade entrega uma definição
versionada, métricas, expansão de apostas, faixas de prêmio, regras/preços,
parser de resultados, cálculo de cobertura e template de impressão.

### FR-02 - Lotofácil

O módulo Lotofácil deve suportar universo 01-25, sorteio de 15, apostas de 15-20,
grade 5x5, faixas 11-15 e as métricas da seção 7. A ocupação de linhas/colunas
é calculada para cada tamanho de aposta, sem reutilizar limites ou probabilidades
de apostas de 15 dezenas nas apostas maiores.

### FR-03 - Dados da CAIXA

Na abertura, o app inicia sincronização assíncrona de resultados, regras, preços,
limites de bolão e calendário da modalidade. A fonte oficial prioritária é a
página pública da CAIXA. Para o resultado mais recente da Lotofácil, fica
autorizada a exceção controlada do endpoint JSON no domínio oficial da CAIXA
`https://servicebus2.caixa.gov.br/portaldeloterias/api/lotofacil`; importação
manual de arquivo oficial permanece como contingência.

A exceção é restrita à URL exata, ao contrato de campos validado e ao parser
versionado. Nenhum outro endpoint não documentado fica autorizado por esta
decisão.

Cada importação guarda modalidade, URL, horário UTC, conteúdo bruto ou hash,
versão do parser, validações, status e `DatasetSnapshot` imutável. Dados inválidos
ou uma falha de rede não substituem o último snapshot validado.

### FR-04 - Pesquisa e estratégias

O laboratório deve analisar janelas 10/25/50/100/250/completa, coortes e lift
teórico versus observado. Hipóteses seguem:

```text
DRAFT -> EXPLORATORY -> VALIDATING -> HOLDOUT -> VALIDATED -> PRODUCTION
                                                      \-> REJECTED
```

Somente `PRODUCTION` pode alterar geração automática. `EXPERIMENTAL_SPECIAL`
exige seleção manual, aviso persistente, amostra, hipótese, concentração e
universo abandonado no relatório.

### FR-04.1 - Modos de estratégia e comparação pré-geração

O produto suporta `NEUTRAL`, `ADVANCED` e `MANUAL_EXPERIMENTAL`. No modo
neutro, a geração não impõe cotas estruturais. A massa teórica é referência de
auditoria da distribuição observada, não uma alocação obrigatória. Somente uma
estratégia com alocação estrutural explícita impõe percentuais por faixa. O
modo neutro nunca é enviesado automaticamente por coorte. Em `ADVANCED`, o
usuário pode escolher uma distribuição estrutural
explícita que some 100%, uma coorte de contexto opcional e restrições suportadas
pela modalidade/tamanho de aposta. A coorte é apenas contexto de análise: ela
não cria padrão, recomendação ou viés automático.

Critérios escolhidos manualmente com hipótese não `PRODUCTION` usam
`MANUAL_EXPERIMENTAL`, exigem confirmação e aviso explícito, mas não mudam o
status da hipótese nem são apresentados como vantagem preditiva. O gerador
recebe somente um `StrategyConfig` resolvido, sem consultar histórico ou
coortes. Antes de gerar, o usuário pode comparar configurações; a comparação
não gera ou congela carteira e só retorna indicadores que já possuam motor
matemático implementado.

### FR-05 - Geração, diversidade e auditoria

O gerador deve ser determinístico por seed. Antes de aprovação, a auditoria mostra
validade, duplicidade, frequência individual, frequência dos 300 pares,
interseções, distribuição estrutural, cobertura bruta e única, redundância e
eficiência. Cobertura aproximada deve declarar método, limite e erro; nunca pode
ser exibida como exata.

Na geração P0 de apostas-fonte Lotofácil 16–20, a fronteira aprovada é
`IN_PROCESS_TYPESCRIPT_LIMITED`, por API v2 assíncrona e aditiva. São suportados
`NEUTRAL` e `ADVANCED`; este último exige alocação explícita somente nas faixas
0/1/2/3/4+ e usa `lotofacil-largest-remainder/1.0.0`: para a soma calculada `S`,
tolerância absoluta inclusiva `Math.abs(S - 100) <= 1e-9`, sem normalizar os
percentuais recebidos. As contagens inteiras devem reconciliar exatamente.
Cada candidato contém exatamente `betSize` dezenas (`numbers.length === betSize`),
inteiras, únicas, crescentes e pertencentes a 1..25; o resultado contém
exatamente `candidateCount` candidatos únicos (`candidates.length === candidateCount`).
Núcleo, sinais auxiliares e regras E individuais
não são filtros, e não há estratégia experimental 16–20. A API, o comparador e
os resultados v1 de 15 permanecem inalterados. Python/IPC continua fora desta
story e reservado à fundação técnica do Épico 5.

Nesse fluxo v2, o escopo de FR-04.1 fica restrito aos modos `NEUTRAL` e
`ADVANCED` acima: `cohortId`, `auxiliaryConstraints`, `hypothesisRefs` e
campos experimentais são rejeitados, mesmo como contexto opcional. Os schemas
são estritos em todos os níveis e rejeitam qualquer campo desconhecido.
A precedência v2 é estrutura do request → tamanho → modo → contagem →
política → viabilidade da alocação. Os domínios de tamanho/modo são avaliados
após a estrutura, preservando seus erros específicos; contagem não positiva
ou não inteira é erro de request, excesso do teto é erro de limite. A ordem
das propriedades JSON não altera o erro, conforme o contrato da Story 4.12.
Somente na v2, cada seed (`parameters.seed` e `strategy.seed`) contém de 1 a
1024 unidades UTF-16, sem truncamento ou normalização; excesso é erro de
request no preflight. Esse teto não limita a leitura/parse do arquivo JSON.
A API oferece opções opcionais de sinal e callback síncrono de progresso,
com retorno `undefined`: request inválido precede sinal previamente abortado;
request/opções válidos com sinal abortado não produzem progresso ou resultado.
Falha de callback usa o erro existente de execução/resultado, sem publicação;
Promises/thenables não são callbacks admitidos nem aguardados; inspeção e
tratamento, inclusive de thenables malformados, não deixam escapar exceção
bruta ou rejeição não observada, conforme seção 6.2 do contrato. Opções
inválidas são erro de request sem progresso. A API rejeita com o objeto
estruturado aprovado; somente a CLI serializa o envelope em stderr.
Os schemas, seeds e comportamentos v1 não mudam.

Na primeira entrega da distribuição estrutural de carteira, somente candidatos
canônicos da Lotofácil simples de 15 dezenas são aplicáveis. O auditor reutiliza
o MetricEngine, o StructuralClassifier e o resumo estrutural canônicos para
agregar as cinco faixas em ordem estável, incluindo faixas com contagem zero e
frequências exatas sobre o total de candidatos. A saída não compara estratégia,
alocação solicitada ou massa teórica, não filtra nem reordena jogos, não otimiza,
não calcula cobertura, não faz alegação preditiva e não altera o estado da
carteira. Apostas de 16–20 dezenas e outras modalidades são rejeitadas como não
aplicáveis até possuírem regras estruturais próprias versionadas.

Na primeira entrega de cobertura, somente carteiras de 1 a 1.000 apostas
canônicas simples de 15 dezenas da Lotofácil são aplicáveis. O cálculo enumera
exatamente os resultados cobertos nas faixas cumulativas 15, 14+, 13+ e 12+,
separa cobertura bruta, única e repetida e informa eficiência como fração exata.
O método não usa amostragem: resultados concluídos declaram erro absoluto e
relativo zero. A execução tem timeout rígido de 30 segundos, progresso e
cancelamento cooperativo; timeout ou cancelamento não publica resultado parcial.
Apostas de 16–20 dezenas, aproximação, persistência, congelamento e mudança de
estado permanecem fora desta primeira entrega.

Na primeira entrega de expansão, a ação recebe exatamente uma aposta
canônica Lotofácil de 15–20 dezenas e materializa todas as suas combinações
simples de 15 em ordem lexicográfica estável. Uma aposta simples retorna sua
própria identidade; as contagens para 16–20 seguem a seção 7.4. O resultado é
transitório e não agrega carteira, calcula cobertura, consulta preço/cotas,
persiste ou congela estado. Outras modalidades e integração da expansão com a
auditoria de cobertura permanecem fora desta primeira entrega.

Na primeira composição entre expansão e cobertura, a ação recebe uma ou mais
apostas-fonte canônicas da Lotofácil, preserva a ordem das fontes e a ordem
lexicográfica de cada expansão e encaminha todas as ocorrências simples ao
contrato exato de cobertura existente. Antes de materializar ou emitir
progresso, a operação soma `C(k,15)` de todas as fontes e rejeita a solicitação
quando o total excede 1.000; por isso, apostas de 19–20 dezenas não são elegíveis
enquanto o teto da cobertura permanecer inalterado. Combinações simples iguais
originadas por fontes distintas continuam como ocorrências independentes na
cobertura bruta e são expostas como duplicidade/redundância, sem deduplicação
silenciosa. A composição é transitória e não altera os contratos `1.0` de
expansão ou cobertura, nem persiste, congela, calcula custo/cotas ou cria UI.

### FR-06 - Bolão mínimo

O usuário informa modalidade, concurso, a carteira efetivamente comprada, os
`quotaId` e, opcionalmente, uma taxa de serviço percentual configurável pelo
operador. A taxa usa basis points inteiros entre `0` e `10.000`, inclusive:
`100` representa `1,00%`. A taxa inicial segura é `0%`, que significa ausência
de cobrança adicional. O valor de `30%` pode aparecer somente como exemplo de
configuração; não é taxa oficial, obrigatória nem valor padrão do produto.

A base de cálculo da taxa é o custo oficial total da carteira efetivamente
comprada, obtido do catálogo CAIXA versionado aplicável. O cálculo declara qual
representação contém os itens comprados e contabiliza essa base uma única vez:
não é permitido cobrar simultaneamente pelas apostas-fonte e pelas combinações
simples produzidas por sua expansão. A versão P0 aceita exatamente uma base
homogênea por tamanho: `SOURCE_BETS`, precificada pelo tamanho de cada
aposta-fonte de 15–20 dezenas, ou `EXPANDED_SIMPLE_BETS`, precificada sempre
como aposta simples de 15 dezenas. Cada ocorrência representa uma compra;
duplicatas legítimas são preservadas e cobradas, nunca deduplicadas
silenciosamente.

O chamador fornece o registro de catálogo já resolvido como aplicável. O motor
valida modalidade, integridade e proveniência e registra a identidade usada,
mas não decide vigência por concurso. A quantidade de cotas é derivada da lista
de `quotaId` e respeita `minShares`/`maxShares` do catálogo para o tamanho
homogêneo da base. `maxGamesPerReceipt` não é validado nesta capacidade, que não
modela recibos.

Todos os valores monetários e cálculos são inteiros. A taxa é aplicada uma única
vez sobre o custo oficial total conforme
`feeCents = HALF_UP(officialCostCents × feeBps / 10000)`, com empate de meio
centavo arredondado para cima. Então
`totalCents = officialCostCents + feeCents`. O valor-base de cada cota é
`floor(totalCents / quotaCount)`; o resto inteiro é distribuído, um centavo por
cota, pela ordem numérica crescente de `quotaId` até ser esgotado. Cada
`quotaId` é fornecido no request como inteiro positivo, único e estável; gaps
são permitidos e `quotaCount` deriva da quantidade de IDs. Se qualquer cota
resultar em `R$ 0,00`, o request é rejeitado. A soma dos valores das cotas deve
ser exatamente igual a `totalCents`.

O resultado apresenta separadamente `officialCostCents`, `feeBps`, `feeCents`,
`totalCents`, o valor-base, o resto e o valor final de cada `quotaId`. Também
registra a base de cálculo, a regra `HALF_UP`, a regra de distribuição do resto,
a identidade/proveniência do catálogo e as versões contratuais. O cálculo é
puro, determinístico e auditável. Pagamentos, integração financeira, venda de
cotas e cadastro de participantes permanecem fora desta capacidade e do MVP.

### FR-07 - Relatório, aprovação e congelamento

O relatório pré-impressão deve listar jogos por volante, modalidade, concurso,
tamanho da aposta, custo, cotas, cobertura, auditoria, estratégia, snapshots,
avisos e hash. A ação `Aprovar e congelar` cria a `FrozenPortfolio` imutável.

### FR-08 - Impressão e exportação

O MVP gera relatório e PDF A4 em paisagem, com escala nominal 100%, linhas de
corte, marcas de sincronismo e marcações das dezenas. O usuário recebe instrução
explícita para não usar "ajustar à página". CSV e TXT contêm a mesma carteira.

O template começa em estado `EXPERIMENTAL`. Somente passa a `HOMOLOGATED` após
medição física, registro do modelo de impressora/driver/papel e aceite real em
lotérica. Isso não é uma garantia de aceite em todas as unidades.

### FR-09 - Resultado e conferência

O app importa/seleciona resultado validado, confere cada jogo e aposta expandida,
conta faixas e registra desempenho vinculado ao snapshot e regras vigentes.

### FR-10 - INJOLOCA

O componente GPL do INJOLOCA é mantido em `third_party/INJOLOCA/`, com autoria,
licença e commit preservados. Ele é adaptador opcional de preenchimento online da
CAIXA, isolado do Core matemático e do renderizador A4.

## 4. Requisitos não funcionais

- **NFR-01 - Reprodutibilidade:** seed, versões, parâmetros, jogos canônicos e
  hash são preservados em toda carteira congelada.
- **NFR-02 - Integridade:** qualquer saída reproduz semanticamente os mesmos
  jogos da `FrozenPortfolio`.
- **NFR-03 - Local-first:** banco SQLite local, cache e uso do último snapshot
  válido quando a sincronização falhar.
- **NFR-04 - Performance:** cálculos pesados mostram progresso e cancelamento;
  cobertura declara exatidão/estimativa. Na primeira auditoria de interseções
  par a par, cada execução aceita no máximo 1.000 candidatos, equivalentes a
  499.500 pares não ordenados. Até esse teto, o progresso informa unidades
  processadas, total e percentual, e o cancelamento cooperativo encerra a
  operação sem publicar resultado parcial. Acima do teto, a solicitação é
  rejeitada antes do cálculo com erro explícito e determinístico. O limite vale
  somente para a operação quadrática e qualquer aumento exige nova decisão
  versionada acompanhada de evidência de desempenho e consumo de memória.
  A distribuição estrutural de carteira é linear, não herda o teto de 1.000 e
  produz saída de tamanho fixo; ainda assim, processa candidatos em lotes,
  informa unidades processadas, total e percentual, aceita cancelamento
  cooperativo e não publica resultado parcial quando cancelada.
  A primeira cobertura única exata aceita de 1 a 1.000 apostas simples da
  Lotofácil e limita a execução a 30 segundos. O trabalho máximo é 59.476.000
  visitas de resultados cobertos, seguido por uma varredura do universo de
  3.268.760 resultados. O motor deve ceder o event loop e verificar progresso,
  timeout e cancelamento em lotes limitados; falha antes de publicar qualquer
  resultado quando o prazo é excedido.
  A primeira composição de expansão com cobertura preserva esse mesmo teto e
  timeout: a soma das ocorrências simples derivadas de todas as apostas-fonte
  deve ficar entre 1 e 1.000 e é validada integralmente antes da materialização
  e do primeiro progresso. O benchmark local de uma fonte de 18 dezenas, com
  816 ocorrências simples, concluiu expansão e cobertura em aproximadamente
  3,13 segundos no ambiente de referência.
  A geração P0 de apostas-fonte Lotofácil 16–20 aceita de 1 a 10.000 candidatos
  por execução e nunca mais que `C(25, betSize)`. O teto de 10.000 é técnico,
  não padrão, recomendação de compra, limite comercial ou limite definitivo;
  10.001 é rejeitado antes do progresso. A API assíncrona verifica cancelamento
  e cede o event loop no máximo a cada 1.024 ranks, emite progresso estruturado
  via callback na API e em JSONL somente no stderr da CLI. `FINALIZE_RESULT` é não terminal, emitido no
  máximo uma vez e somente após seleção completa; erro/cancelamento antes
  dessa etapa permite zero emissões. Após finalização e serialização, há yield real
  ao event loop e nova verificação de cancelamento antes da primeira chamada
  de escrita do JSON final em stdout. Falha ou cancelamento observado
  antes dessa fronteira mantém stdout vazio; cancelamento retorna 130. Depois
  dela, SIGINT tardio não reclassifica a operação. Resultado integralmente
  validado não garante entrega: falha de escrita continua sendo falha, nunca
  sucesso, pode deixar bytes truncados e stdout não oferece rollback.
  A versão inicial não aplica timeout e
  registra `timeoutApplied: false`. Aumento de teto exige benchmark, revisão
  arquitetural e versão apropriada.
- **NFR-05 - Impressão:** dimensões em mm, PDF vetorial e validação visual/física
  por template.
- **NFR-06 - Licença:** derivados do INJOLOCA obedecem GPL-3.0-or-later.
- **NFR-07 - Testes:** unidades, integração, regressão matemática, PDF e ensaios
  físicos documentados.

## 5. UX e telas

Fluxo principal:

```text
Sincronizar CAIXA -> selecionar Lotofácil -> gerar -> auditar -> conferir
-> aprovar/congelar -> imprimir A4 -> registrar -> conferir resultado
```

Telas: Dashboard; Novo bolão/carteira; Estratégia e geração; Auditoria e relatório;
Aprovação e congelamento; Central de impressão; Resultados; Histórico/laboratório;
Configurações. Estados visíveis: rascunho, auditada, aprovada, congelada, impressa
e conferida. A interface distingue obrigatoriamente pesquisa, experimental e
produção e não usa linguagem de previsão.

## 6. Arquitetura proposta

Monorepo, monólito modular, local-first:

```text
/apps/desktop                 UI e operação de impressão
/packages/domain-core         contratos e invariantes
/packages/combinatorics       combinações, bitmasks e interseções
/packages/portfolio-engine    geração, orçamento e otimização
/packages/coverage-engine     cobertura e redundância
/packages/audit-engine        auditoria e hash canônico
/packages/statistics-engine   histórico, lift e validação
/packages/strategy-registry   ciclo de vida de estratégias
/packages/data-access         SQLite, snapshots e migrações
/packages/result-ingestion    fontes CAIXA e parser
/packages/export-print        relatório, PDF e calibração
/packages/lotteries/lotofacil definição, métricas, regras e template
```

Tecnologias propostas: Tauri + React + TypeScript no desktop; Python + NumPy no
motor matemático; SQLite local; PDF com unidades físicas. A tecnologia pode mudar,
mas os contratos e invariantes não.

## 7. Fórmula canônica da Lotofácil

### 7.1 Métricas

Para cada jogo de 15 a 20 dezenas calcular: paridade; soma; quantidade 01-13/14-25;
moldura/centro 5x5; pares consecutivos; maior sequência; quantidade de sequências
com 2+ dezenas; amplitude; distribuição e desvio de linhas/colunas; repetição do
concurso anterior; E1-E10; `extreme_count`; faixa estrutural; núcleo central.

### 7.1.1 Ocupação de linhas e colunas para apostas de 15 a 20 dezenas

Para qualquer cartela válida, calcular ocupação completa:

~~~text
column_counts = [c1, c2, c3, c4, c5]
row_counts    = [r1, r2, r3, r4, r5]
~~~

Também calcular para cada eixo: mínimo, máximo e quantas linhas/colunas possuem
0, 1, 2, 3, 4 ou 5 dezenas.

O valor esperado por linha ou coluna depende do tamanho da aposta:

~~~text
expected_per_axis = bet_size / 5
~~~

Os valores esperados são 3,0 (15), 3,2 (16), 3,4 (17), 3,6 (18), 3,8 (19) e
4,0 (20). O MetricEngine calcula:

~~~text
column_deviation = SUM(abs(column_count - expected_per_axis))
row_deviation    = SUM(abs(row_count - expected_per_axis))

column_deviation_normalized = column_deviation / bet_size
row_deviation_normalized    = row_deviation / bet_size
~~~

Regras de extremo e comparações entre tamanhos usam o desvio normalizado ou um
limite explicitamente configurado por bet_size. É proibido aplicar a referência
fixa baseada em distância de 3 como regra universal para apostas de 16 a 20.

Colunas e linhas com 0 ou 1 dezena são métricas auxiliares. Uma delas com uma
dezena não é extrema por regra fixa nem gera rejeição automática. A raridade vem
da distribuição teórica do universo específico C(25, bet_size).

Para cada bet_size de 15 a 20, o sistema pré-calcula a distribuição teórica de:

~~~text
columns_with_0, columns_with_1,
rows_with_0, rows_with_1,
column_deviation_normalized, row_deviation_normalized
~~~

Cada evento recebe classificação configurável:

| Classe | Frequência teórica |
| --- | --- |
| NORMAL | >= 10% |
| ATTENTION | >= 2% e < 10% |
| RARE | >= 0,5% e < 2% |
| VERY_RARE | < 0,5% |

O modo neutro não aplica restrição auxiliar de linhas/colunas. Uma estratégia
só pode restringir ocupação ao declarar a classe máxima aceita e o tamanho de
aposta a que a distribuição se aplica:

~~~yaml
auxiliary_constraints:
  columns:
    max_rarity_class: ATTENTION
  rows:
    max_rarity_class: ATTENTION
~~~

No modo neutro, columns e rows são nulos.

As distribuições de `columns_with_0`, `columns_with_1`, `rows_with_0` e
`rows_with_1` já existem para todos os tamanhos de 15 a 20 e permanecem sinais
auxiliares auditáveis. Elas não entram em E1–E10, `extreme_count`, faixas,
núcleo ou geração P0. As distribuições `row_deviation_normalized` e
`column_deviation_normalized` são reutilizadas exclusivamente por E9 e E10,
respectivamente, conforme a seção 7.2. A política auxiliar operacional
específica de 15 não é transferida para outros tamanhos.

#### Baseline auxiliar de auditoria para cartelas simples de 15

Além da raridade teórica configurável, a Lotofácil mantém uma política auxiliar
versionada de leitura operacional para apostas simples de 15. Ela não substitui
percentis teóricos, não altera E1–E10, não soma em `extreme_count` e não
rejeita jogos:

| Ocupação no mesmo eixo | Sinal auxiliar |
| --- | --- |
| duas ou mais posições com exatamente uma dezena | ATTENTION |
| uma posição vazia | RARE |
| duas ou mais posições vazias | VERY_RARE |

A prioridade é `VERY_RARE -> RARE -> ATTENTION -> NONE`. O sinal é exposto
separadamente para linhas e colunas. Uma posição com apenas uma dezena não gera
sinal por si só.

Referência histórica de auditoria para colunas de apostas simples de 15:
alguma coluna com uma dezena = 29,58%; exatamente duas colunas com uma dezena =
0,72%; alguma coluna vazia = 2,12%; duas colunas vazias não foram observadas na
base analisada. Esses percentuais não são transferidos para apostas 16–20.

### 7.2 Regras E1-E10

| Regra | Extremo |
| --- | --- |
| E1 | pares <=4 ou >=11 |
| E2 | soma <=149 ou >=241 |
| E3 | moldura <=6 ou >=14 |
| E4 | dezenas 01-13 <=4 ou >=12 |
| E5 | pares consecutivos <=5 ou >=12 |
| E6 | maior sequência <=2 ou >=9 |
| E7 | sequências <=1 ou >=7 |
| E8 | amplitude <=18 |
| E9 | para 15: desvio de linhas >=8; para 16–20: limite próprio sobre o desvio normalizado |
| E10 | para 15: desvio de colunas >=8; para 16–20: limite próprio sobre o desvio normalizado |

Para apostas de 15 dezenas, a referência histórica de desvio absoluto pode ser
mantida somente como âncora equivalente a um limiar normalizado versionado. Ela
não pode ser reutilizada como limite absoluto para apostas de 16 a 20 dezenas.

As fórmulas de E1–E8 permanecem semanticamente iguais para 15–20. Para cada
tamanho de 16 a 20, limites próprios são derivados das distribuições teóricas
exatas, preservando separadamente, tanto quanto a discretização permitir, as
raridades das caudas inferior e superior da regra de 15. E8 permanece
unilateral. Contagens e frequências exatas acompanham cada limite; média ou
interpolação manual não definem extremos. A média descritiva da soma é 195,
208, 221, 234, 247 e 260 para `betSize` 15, 16, 17, 18, 19 e 20,
respectivamente.

E9 e E10 consomem integralmente as distribuições exatas de ocupação da Story
2.1. Cada regra escolhe sua própria cauda de desvio normalizado por tamanho,
usando como referência a raridade da regra equivalente de 15; empate entre
limites igualmente próximos escolhe a alternativa mais conservadora, que
classifica menos apostas como extremas. Linhas e colunas permanecem regras
separadas.

`extreme_count` é a quantidade de regras E1–E10 com `isExtreme = true`. Cada
regra vale zero ou um, sem pesos ou duplicidade; sinais auxiliares não
participam. O resultado de 0 a 10 registra as classificações individuais e a
versão dos limites e não expressa chance de prêmio.

### 7.3 Massa estrutural neutra

Cada tamanho de 15 a 20 possui massa teórica própria, obtida por enumeração
integral de `C(25, betSize)`, sem amostragem, histórico ou download. A tabela
abaixo é somente uma apresentação arredondada dos valores atuais de 15 e não é
a fonte canônica. A fonte canônica é `LOTOFACIL_STRUCTURAL_MASS_SNAPSHOT`, que
registra contagens inteiras e frações exatas `count/universeSize`. Os valores e
percentuais apresentados permanecem inalterados e não são recalculados nesta
correção; a massa de 15 nunca é transferida para 16–20.

| Faixa | Massa teórica |
| --- | ---: |
| 0 extremos | 90,4231% |
| 1 extremo | 7,7101% |
| 2 extremos | 1,2780% |
| 3 extremos | 0,3759% |
| 4+ extremos | 0,2129% |

Para todos os tamanhos, as faixas continuam sendo 0, 1, 2, 3 e 4+ extremos,
sem rejeição automática no modo neutro. Cada universo calcula massas próprias
para E1–E10, `extreme_count` 0–10, cinco faixas, critérios do núcleo, núcleo
conjunto e cruzamento faixa × núcleo. Contagens são inteiros; frequências são
frações exatas `count/universeSize`; percentuais são somente apresentação. Os
artefatos registram `betSize`, versões de política, algoritmo, classificador e
manifesto e hash determinístico.

O núcleo central de 15 permanece pares 6–9, soma 176–214, moldura 8–12,
dezenas 01–13 entre 7–10 e pares consecutivos 7–10. Para 16–20, as mesmas cinco
métricas recebem limites próprios derivados das distribuições teóricas exatas,
usando separadamente as massas das caudas inferior e superior de 15 como
referência. Empates escolhem a faixa mais conservadora e estreita.
`isCentralCore` exige os cinco critérios simultaneamente e registra cada
resultado individual. O núcleo é informativo/auditável, não é filtro P0 nem
predição.

Resultados oficiais de 15 dezenas podem auditar a política original de 15 e
alimentar pesquisa futura, mas não fornecem distribuições para cartelas 16–20,
não são expandidos artificialmente e não entram nas massas, limites,
classificador ou gerador.

### 7.4 Cobertura e expansão

Uma aposta de 15 dezenas cobre, de forma bruta: 15 = 1 resultado; 14+ = 151;
13+ = 4.876; 12+ = 59.476. O auditor separa cobertura bruta, única, resultados
repetidos, redundância e eficiência.

Na versão exata inicial, cada resultado de 15 dezenas recebe um índice
combinatório determinístico no universo `C(25,15)`. Para cada aposta simples, o
motor enumera resultados com interseção de 12 a 15 dezenas e registra o maior
número de acertos observado por resultado. A contagem única de cada faixa é o
número de índices cujo maior acerto alcança o limiar; cobertura repetida é
`bruta - única` e eficiência é `única / bruta` como fração inteira reduzida.

Expansão para combinações de 15: 15=1; 16=16; 17=136; 18=816; 19=3.876;
20=15.504. A unidade interna é a combinação simples de 15, mesmo para apostas
maiores.

Ao compor várias apostas-fonte com a cobertura exata, o total operacional é
`SUM(C(k_i,15))`. A ordem determinística é a ordem das fontes seguida da ordem
lexicográfica dentro de cada fonte. Ocorrências simples iguais entre fontes não
são eliminadas: contam novamente na cobertura bruta, não ampliam a cobertura
única e tornam a redundância observável.

### 7.5 Estratégias

`neutral` não aplica alocação, filtro ou cota estrutural. A massa teórica serve
somente como referência de auditoria. Apenas uma estratégia que declare
explicitamente uma alocação estrutural pode impor percentuais nas faixas
0/1/2/3/4+, convertidos em quantidades pela regra de maiores restos.

`experimental_special` da Independência permanece restrita ao contrato já
existente para apostas simples de 15 dezenas e usa:

- bloco A: 143 jogos com 0 extremos, soma 176-214 e moldura 9-11;
- bloco B: 143 jogos com 0 extremos, sem obrigação adicional.

Essa estratégia é sempre experimental até evidência de validação/holdout e não
pode ser promovida automaticamente. Nenhuma estratégia experimental específica
para apostas de 16–20 dezenas integra o P0.

## 8. Impressão A4 Lotofácil

O template inicial é configurável/versionado e registra a origem de toda medida.
Referências atuais: A4 paisagem; largura do volante de aproximadamente 82 mm;
quadrinhos de 4 x 3 mm; passo vertical de 5,08 mm; marcas de sincronismo de
3,5 x 2,5 mm; linhas de corte e marcações laterais. A disposição inicial é de
três volantes por folha A4, validada pelo PDF e por ensaio físico. Outras
modalidades podem definir outra paginação em seus próprios templates.

O sistema deve gerar, antes da impressão, um relatório de conferência. Depois de
aprovar e congelar, a central gera um lote com prévia, hash, instruções de
orientação paisagem/100%, data, template e perfil de impressora. Reimpressão usa a
mesma carteira; nunca chama o gerador.

## 9. Épicos e histórias

| Épico | Histórias principais |
| --- | --- |
| 1. Fundação | app/banco; entidades versionadas; hash/auditoria |
| 2. Lotofácil | definição 25/15; MetricEngine; E1-E10; ocupação 15–20 normalizada; núcleo/faixas; universo |
| 3. CAIXA e laboratório | import manual; sync/fallback; catálogo; métricas; lift/coortes; estratégias |
| 4. Carteira e cobertura | seed; neutral; experimental; pares/interseções; expansão e cobertura |
| 5. Congelamento | relatório; aprovação/hash; revisão/reimpressão |
| 6. Impressão | geometria; PDF; paginação A4; exports; lote; calibração; homologação |
| 7. Conferência | resultado; checagem; desempenho |
| 8. INJOLOCA | boundary GPL; ponte online; E2E; homologação final |

As histórias devem manter a sequência: fundação -> definição/metrificação ->
estratégias -> geração/auditoria -> congelamento -> impressão -> conferência.

## 10. Critérios de aceite do produto

1. O gerador não aceita histórico bruto e registra versões, seed e hash.
2. Jogos respeitam modalidade, tamanho e unicidade; auditoria revela exceções.
3. Sincronização cria snapshots; falha abre com dados válidos anteriores e alerta.
4. Alteração de regras/preços não muda carteira congelada retroativamente.
5. Cobertura única não soma resultados sobrepostos e informa precisão.
6. Relatório é obrigatório antes de aprovar/congelar.
7. PDF/CSV/TXT usam exatamente os jogos e o hash congelados.
8. PDF Lotofácil é A4 paisagem, 100%, recortável e contém instruções de escala.
9. Template só é homologado após ensaio físico registrado e aceite real.
10. Bolão mostra custo/cota, sem pagamentos ou cadastro de pessoas.
11. Nova modalidade prova seu contrato sem modificar o comportamento da Lotofácil.

## 11. Gates antes de iniciar implementação de geração/impressão final

- [x] Congelar em artefato versionado a fórmula canônica vigente: definição
  25/15, métricas e ocupação normalizada para 15–20, aplicabilidade versionada
  de E1–E10, massa estrutural das apostas simples de 15 dezenas e
  canonização/ordenação de jogos. Evidências:
  `docs/architecture/lotofacil-canonical-formula.md`, Story 2.5,
  `tests/lotofacil/canonical-formula-manifest.test.ts` e gate QA 2.5.
- [x] Implementar e validar as massas e políticas estruturais próprias dos
  universos de apostas 16–20 antes de habilitar sua geração automática. As
  decisões de Produto, o contrato matemático e a entrega executável foram
  concluídos na Story 4.11 e em
  `docs/architecture/lotofacil-16-20-structural-policies-and-masses.md`. O PR
  #11 foi incorporado por squash em `main@390c7cd`, com QA `PASS` 100/100,
  CodeRabbit `SUCCESS`, regressão bloqueante de 15, fixture, índice, seis
  `policyHash` e seis `massHash` preservados. O manifesto foi estendido apenas
  de modo aditivo e versionado.
- [x] Definir a fronteira e o contrato P0 da geração Lotofácil 16–20. O
  `F5-IPC-SPEC/4.12` selecionou `IN_PROCESS_TYPESCRIPT_LIMITED` e o contrato
  `docs/architecture/lotofacil-16-20-generation-contract.md` fixa API v2,
  modos, teto, progresso, cancelamento, compatibilidade e isolamento. Essa
  decisão não conclui o contrato IPC geral nem `F5-IPC-DONE` do Épico 5.
  A revalidação local `4.12-readiness/2026-09-09-r2`, incluindo cardinalidade,
  seeds/API/callback aprovados e a ordenação numérica, tem Arquitetura `PASS`, SM `PASS` e PO `GO`
  registrados com a revisão examinada na Story 4.12; não autoriza código.
- [x] Definir algoritmo, limite de tempo e erro aceitável para cobertura única.
  Método exato por índice combinatório e mapa denso, teto de 1.000 apostas
  simples, timeout de 30 s e erro zero, conforme
  `docs/architecture/lotofacil-exact-coverage-contract.md`.
- [x] Congelar URLs, campos, validações, versão do parser e regra de
  correção/substituição da fonte CAIXA, com import manual. Evidências: Stories
  3.1–3.5, contratos de proveniência/snapshot, parsers versionados, testes de
  importação/sincronização/fallback e respectivos gates QA.
- [ ] Anexar PDF/foto/medidas finais do COLOGA ou ensaio equivalente.
- [ ] Homologar template A4 em impressora/driver/papel/loteria de teste.
- [ ] Definir o contrato geral entre interface TypeScript/Tauri e motor Python,
  incluindo serialização canônica, versão do motor e empacotamento local. Esse
  gate permanece pendente para o Épico 5; Python/IPC não integra a Story 4.12.

## 12. Evidências e fontes

- PRD v0.3 fornecido pelo produto.
- Diretriz técnica consolidada fornecida pelo produto.
- Imagens de referência de impressão e fluxo operacional fornecidas pelo produto.
- CAIXA: https://loterias.caixa.gov.br/Paginas/Lotofacil.aspx
- CAIXA, resultado Lotofácil em JSON: https://servicebus2.caixa.gov.br/portaldeloterias/api/lotofacil
- CAIXA, regras de sorteios: https://loterias.caixa.gov.br/Paginas/regras-sorteios.aspx
- INJOLOCA GPL: https://github.com/guynovaes/INJOLOCA
- COLOGA: https://www.cologa.com.br/

## 13. Pareceres AIOX

- **Analyst:** aprova uso de fontes públicas com importação manual de contingência;
  recomenda snapshots e não dependência ampla de API não documentada. Por
  decisão de produto em 2026-08-30, a recomendação foi restringida pela exceção
  controlada do endpoint JSON exato do resultado mais recente da Lotofácil.
- **PO:** `APPROVE_WITH_CONDITIONS`; aprova arquitetura e fundação. Exige fórmula
  executável, contrato CAIXA, método de cobertura e impressão física antes de
  geração de produção.
- **QA:** `APPROVE_WITH_CONDITIONS`; aprova fundação/métricas. Exige cobertura
  verificável, fallback, hash e template experimental até homologação antes de
  geração/impressão final.
- **Architect:** `APPROVE_WITH_CONDITIONS`; aprova o monólito modular e a
  separação de dados/estratégia/produção. Exige os gates acima e o contrato entre
  TypeScript e Python antes do motor de produção.
- **SM:** aprova épicos após decomposição em histórias sequenciais e pequenas.

## 14. Decisão de aprovação

O PRD está aprovado condicionalmente para arquitetura, fundação, persistência,
métricas e preparação de histórias. Geração de produção, cobertura final e
impressão homologada ficam condicionadas aos gates da seção 11.
