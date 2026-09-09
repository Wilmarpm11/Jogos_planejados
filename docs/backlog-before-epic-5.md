# Backlog obrigatório antes do Épico 5

**Status:** planejamento — Stories 4.10 e 4.11 `Done`; Story 4.12 `Ready` após
F5-IPC-SPEC/4.12, Arquitetura `PASS`, SM `PASS` e PO `GO`; Épico 4 aberto
**Data:** 2026-09-07
**Escopo protegido:** a Story 4.9 permanece concluída e não é alterada por este
backlog.

## Objetivo e fontes

Este backlog separa as lacunas que precisam ser especificadas e entregues antes
do Épico 5. Ele deriva exclusivamente do PRD, da arquitetura fundacional, dos
invariantes e das decisões expressas de Produto. Não autoriza código,
persistência, IPC, interface, pagamento ou impressão.

Fontes: `docs/prd.md` — FR-02, FR-05, FR-06, FR-07, §§5, 7 e 9–11;
`docs/architecture.md` — §§1–7, 9, 11–14;
`docs/architecture/product-invariants.md`; Stories 2.1–2.5, 3.5, 4.2 e
4.7–4.9.

## Ordem e dependências

| Ordem | Item | Depende de | Libera |
| --- | --- | --- | --- |
| 1 | Story 4.10 — cálculo operacional de custo e cotas (FR-06), `Done` em `main@f04a9ec` | catálogo CAIXA versionado da 3.5 e contrato `1.0` aprovado | composição monetária auditável do relatório do Épico 5 |
| 2 | Story 4.11 — políticas e massas estruturais Lotofácil 16–20, `Done` pelo PR #11 em `main@390c7cd` | métricas, ocupação, faixas e manifesto das 2.1–2.5; contrato `1.0` aprovado | pré-requisito matemático da geração 16–20 |
| 3 | Gate F5-IPC-SPEC/4.12 — fronteira da geração, **concluído** | Story 4.11 e benchmarks read-only | decisão `IN_PROCESS_TYPESCRIPT_LIMITED` e contrato v2; não baixa o F5-IPC geral do Épico 5 |
| 4 | Story 4.12 — geração completa de apostas 16–20 | Story 4.11 concluída; F5-IPC-SPEC/4.12 aprovado; revalidação de Arquitetura/SM/PO registrada na story | geração de apostas-fonte 16–20 sem alterar o comportamento de 15; não depende de F5-IPC-DONE |
| 5 | Gate F5-PERSIST-DONE — fundação de persistência local | contratos dos artefatos que serão persistidos identificados; no mínimo custo/cotas 4.10 e carteira/auditorias já estáveis | relatório, aprovação, revisões e `FrozenPortfolio` persistidos |
| 6 | Gate F5-IPC-DONE — implementação e conformidade IPC | F5-IPC-SPEC aprovado; primeira operação e packaging definidos | integração desktop e eventual operação Python autorizada sem contrato implícito |
| Paralelo de design | Plano UX da capa/tela inicial | pode ser elaborado agora; implementação depende de F5-PERSIST-DONE e F5-IPC-DONE, ambos com QA `PASS` | story futura de interface do Épico 5 |
| Depois dos gates | Épico 5 — relatório, aprovação, congelamento, revisões e interface | 4.10–4.12 e fundação técnica concluídas conforme o item consumidor | Épico 6 de impressão, sem antecipar impressão física |

Na 4.12, o contrato/gerador da Story 4.2 e a fronteira de expansão da 4.7 são
referências de reutilização, não gates adicionais de prontidão. A expansão
4.7 é uma operação posterior explícita, nunca parte da geração.

4.10, 4.11 e 4.12 são entregas separadas. A fundação também possui dois
enablers independentes: persistência local não implica IPC, e IPC não autoriza
migrar automaticamente cálculos TypeScript para Python. A disposição
`F5-IPC-SPEC/4.12` foi concluída com TypeScript limitado e não exige
`F5-IPC-DONE` para a story. O gate IPC geral e `F5-IPC-DONE` continuam
pendentes e antecedem o Épico 5 e a UI.

## Story 4.10 — FR-06: custo e cotas

### Escopo e contrato aprovados

- Taxa de serviço configurável em `feeBps`, inteiro de `0` a `10.000`, com
  precisão de `0,01%` e valor inicial seguro `0`; `30%` somente como exemplo.
- Incidência única sobre o custo oficial total da carteira efetivamente
  comprada, obtido de catálogo CAIXA versionado.
- A base homogênea é uma união exclusiva: `SOURCE_BETS`, com preço do tamanho
  15–20 efetivamente comprado, ou `EXPANDED_SIMPLE_BETS`, com preço da aposta
  simples de 15. Cada ocorrência, inclusive duplicata legítima, conta uma vez.
- Todo cálculo usa inteiros:
  `feeCents = HALF_UP(officialCostCents × feeBps / 10000)` e
  `totalCents = officialCostCents + feeCents`.
- O request fornece `quotaId` inteiros positivos e únicos. O valor-base usa
  piso; o resto é distribuído um centavo por ID em ordem numérica crescente.
  Qualquer rateio com cota de zero centavo é rejeitado.
- A quantidade deriva dos IDs e respeita `minShares`/`maxShares` do catálogo
  para o tamanho homogêneo. `maxGamesPerReceipt` fica fora do cálculo.
- Resultado separado em custo oficial, percentual, taxa, total, valores das
  cotas, base, arredondamento, distribuição do resto e proveniência do catálogo.
- Cálculo puro e auditável, sem pagamento, venda de cotas, participantes ou
  integração financeira.

### Decisões de especificação encerradas

1. Percentual serializável, precisão, faixa e default estão fechados em basis
   points inteiros.
2. Arredondamento da taxa está fechado como HALF_UP sobre o custo oficial total.
3. Identidade, unicidade e comparador numérico crescente de `quotaId` estão
   fechados; a quantidade deriva da lista.
4. Rateio por piso, resto determinístico e rejeição de cota zero estão fechados.
5. Base exclusiva, homogeneidade, multiplicidade e preço de cada ramo estão
   fechados sem dupla contagem.
6. O `LotofacilCatalogRecord` completo é fornecido já resolvido pelo chamador;
   o motor valida e registra a proveniência sem decidir vigência.
7. `minShares`/`maxShares` são bloqueantes; `maxGamesPerReceipt` não participa.
8. A precificação P0 aceita `SOURCE_BETS` de 15–20 compradas manualmente, sem
   gerar apostas, e `EXPANDED_SIMPLE_BETS` de 15.

### Definition of Ready

- [x] As oito decisões acima estão aprovadas por Produto e versionadas em
  `docs/architecture/lotofacil-operational-cost-and-quotas-contract.md` `1.0`,
  com parecer arquitetural `PASS`.
- [x] Request, resultado, erros públicos e invariantes de conservação estão
  definidos sem campos de pagamento ou participantes.
- [x] Casos de teste de `0%`, taxa fracionária, HALF_UP, resto zero/não zero,
  cota zero, catálogo
  incompatível e dupla contagem estão especificados com oráculos em centavos.
- [x] File List e limites de compatibilidade com 3.5, 4.7 e 4.8 estão revisados.
- [x] Decisão de reuso: criar contrato monetário reutilizável, reutilizar o catálogo
  3.5, restringir preços ao adaptador Lotofácil e não criar skill AIOX.
- [x] Validação PO emitiu `GO` 9/10 e promoveu formalmente a Story 4.10 de
  `Draft` para `Ready` em 2026-09-05.

## Story 4.11 — políticas e massas 16–20

### Resultado entregue

- Definir e calcular políticas e massas versionadas separadamente para cada
  `betSize` de 16 a 20, com regressão integral de 15.
- Reutilizar fórmulas, ocupação, classificador, combinatória e manifesto das
  Stories 2.1–2.5, criando somente políticas/massas próprias por tamanho.
- Entregar fixtures, hashes e evidências exatas que a Story 4.12 poderá
  referenciar futuramente sem regra estrutural implícita.

### Decisões de Produto aprovadas

1. E1–E8 mantêm fórmulas e derivam limites próprios por caudas exatas de cada
   universo; E8 permanece unilateral e as médias da soma são apenas descritivas.
2. E9/E10 são aplicáveis, separados e baseados nas distribuições normalizadas
   da Story 2.1; o limite absoluto 8 não é copiado e empate classifica menos
   extremos.
3. `extreme_count` soma uma vez cada flag E1–E10, sem pesos ou sinais
   auxiliares, resultando em 0–10.
4. As faixas 0/1/2/3/4+ mantêm semântica em todos os tamanhos e não rejeitam
   apostas no modo neutro.
5. O núcleo mantém as cinco métricas da Story 2.3, recebe limites próprios por
   caudas exatas, usa intervalo mais estreito em empate e permanece informativo.
6. As massas usam enumeração integral 15–20 e incluem regras, contadores,
   faixas, critérios/núcleo conjunto, faixa × núcleo, reconciliações, versões,
   fixtures e SHA-256 determinístico.
7. O consumo futuro aceita `NEUTRAL` sem cotas e alocação explícita somente nas
   cinco faixas, com maiores restos; não autoriza geração nesta story.

Resultados oficiais de 15 não são expandidos nem consultados no cálculo. A
operação é local, sem rede, histórico, amostragem, persistência, IPC ou UI.

### Formalização arquitetural

O contrato
`docs/architecture/lotofacil-16-20-structural-policies-and-masses.md` `1.0`
recebeu `PASS`. Ele fecha comparação racional de caudas e desempates, schemas,
IDs, versões/proveniência, serialização/hash, duas passagens integrais com teto
de 14.208.480 visitas, progresso JSONL, cancelamento/130, erros, ausência de
timeout e regressão bloqueante de 15. O manifesto foi estendido de modo aditivo
e versionado pela implementação concluída.

### Definition of Ready

- [x] Produto aprovou os sete pontos e a semântica por tamanho.
- [x] Arquitetura formalizou o método exato e emitiu `PASS`.
- [x] Cada massa possui universo, agregações, versões, reconciliações, fixtures
  e oráculos explícitos.
- [x] Progresso, cancelamento, erros e limites operacionais estão definidos.
- [x] A compatibilidade de 15 é regressão obrigatória e bloqueante.
- [x] Decisão de capacidade: reutilizar `MetricEngine`, ocupação, combinatória,
  classificador e contratos; criar apenas políticas/massas Lotofácil por
  `betSize`; não criar skill.
- [x] PO emitiu `GO` 9/10 e promoveu a Story 4.11 de `Draft` para `Ready` em
  2026-09-05.

### Fechamento da entrega

- Story 4.11 `Done` após o PR #11, com HEAD revisado
  `dac4910c43d1d9324cd9390157f8e35d5136a2c6` e squash em
  `main@390c7cd4db44bbe0a2a7c92cb3ca467760b1bd4c`.
- QA `PASS` 100/100 e CodeRabbit `SUCCESS`, sem threads ou achados acionáveis.
- Fixture, índice e os seis pares `policyHash`/`massHash` foram preservados.
  [closure-key: 4.11:commit:390c7cd4db44bbe0a2a7c92cb3ca467760b1bd4c]

## Story 4.12 — geração completa 16–20

**Estado do gate:** `Ready`. O pré-requisito 4.11 e o `F5-IPC-SPEC/4.12` estão
concluídos; o contrato recebeu Arquitetura `PASS`, SM `PASS` e PO `GO`. Nenhuma
implementação foi iniciada ou autorizada por este registro.
O gate atual é a revalidação local `4.12-readiness/2026-09-09-r2` registrada
na Story 4.12, incluindo cardinalidade, seeds/API/callback aprovados e ordenação
numérica; os pareceres de 07/09 e r1 são históricos, não substituem o gate atual.

### Resultado esperado

- Estender a geração determinística para apostas-fonte de 16–20 somente sobre
  as políticas aprovadas pela 4.11.
- Preservar integralmente o contrato e o resultado de 15 dezenas.
- Reutilizar seed, canonização, unicidade, combinatória e fronteira do
  `PortfolioGenerator` existentes.
- Manter expansão, diversidade 4.9, cobertura, custo/cotas, persistência,
  congelamento e UI como chamadas separadas; a extensão não as habilita
  automaticamente para 16–20.

### Decisões aprovadas para ficar Ready

1. `IN_PROCESS_TYPESCRIPT_LIMITED`; Python/IPC permanece na fundação do Épico 5.
2. API v2 assíncrona; API, comparador e resultados v1 de 15 imutáveis.
3. `NEUTRAL` e `ADVANCED`; este último somente por alocação explícita nas cinco
   faixas, com maiores restos. Núcleo, sinais auxiliares e E individuais não
   filtram; não há estratégia experimental 16–20.
4. `candidateCount` entre 1 e `min(10.000, C(25,k))`; 10.001 falha antes de
   progresso. O teto é técnico por execução, não recomendação ou limite final.
5. Progresso via callback na API e JSONL em stderr somente na CLI,
   cancelamento cooperativo em até 1.024 ranks,
   sem timeout normativo e `timeoutApplied: false`. Antes da primeira escrita
   do JSON final, falha/cancelamento deixa stdout vazio e SIGINT observado
   retorna 130. Depois, SIGINT tardio não reclassifica a operação; falha de
   escrita pode truncar bytes, sem rollback e nunca como sucesso.
6. Políticas 4.11 são consumidas por identidade/versões/hashes. Diversidade,
   cobertura e auditorias permanecem restritas até stories próprias.
7. Escala por partição determinística/lotes/cursor é futura; várias seeds
   independentes não são autorizadas como substituto de unicidade global.
8. Cada seed v2 tem 1..1024 unidades UTF-16, independentemente; sem truncamento
   ou normalização. API/callback e thenables seguem o tratamento controlado da
   seção 6.2 do contrato, sem código de erro novo. Cardinalidade é exata por
   candidato e resultado; API v1 permanece intacta. Não é limite de arquivo JSON.

### Definition of Ready

- [x] Story 4.11 está `Done` com gate PASS.
- [x] `F5-IPC-SPEC/4.12` aprovou `IN_PROCESS_TYPESCRIPT_LIMITED`; o IPC geral
  continua separado e não bloqueia a implementação desta story.
- [x] Contrato de entrada/saída, limites, ordenação e erros estão congelados.
- [x] Testes de reprodução, validade, unicidade, fronteiras combinatórias,
  alocação, observabilidade e regressão de 15 possuem oráculos definidos.
- [x] Decisão de capacidade: criar API v2 aditiva; reutilizar gerador, PRNG,
  permutação, combinatória e classificador; restringir políticas à Lotofácil e
  não criar skill nova.
- [x] Arquitetura `PASS`, SM `PASS` e PO `GO` revalidados no pacote local
  `4.12-readiness/2026-09-09-r2`, com evidências e escopo na Story 4.12.

## Fundação técnica anterior ao Épico 5

O detalhamento está em
`docs/architecture/epic-5-technical-foundation-plan.md`. Antes de qualquer
implementação, F5-PERSIST deve decidir o agregado persistido, identidades,
versões, imutabilidade, auditoria, erros, atomicidade, recuperação e limites.
Para a 4.12, o F5-IPC-SPEC foi encerrado escolhendo TypeScript limitado. O
Enabler I geral deve, separadamente, passar por `SPEC`, decidindo serialização,
envelope/versionamento, operações, progresso, cancelamento, erros, limites e
empacotamento Tauri/TypeScript–Python, e depois por `DONE`, que exige
implementação/conformidade com QA `PASS` antes do Épico 5 e da UI.

As duas capacidades exigem contratos reutilizáveis e testes de contrato; não
exigem skill AIOX. Regras específicas da Lotofácil permanecem em seu adaptador.
O processo Python não recebe banco, histórico bruto, caminhos ou credenciais.

## Épico 5 e plano UX

Ordem mínima proposta após os gates:

1. Relatório pré-impressão que compõe artefatos existentes sem recalculá-los.
2. Aprovação explícita e criação imutável de `FrozenPortfolio`/hash.
3. Revisões e identidade de reimpressão sem regenerar ou reordenar jogos.
4. Interface desktop para os casos de uso já funcionais pelo CLI, incluindo a
   capa/tela inicial planejada em
   `docs/ux/epic-5-initial-screen-plan.md`.

### Decisões de Épico 5 ainda abertas

- Quais achados/avisos de auditoria bloqueiam aprovação.
- Conteúdo obrigatório, agrupamento e identidade versionada do relatório.
- Quem/qual ação representa aprovação local e quais confirmações são exigidas.
- Momento exato em que o hash é calculado e quais versões entram em sua
  identidade, sem contrariar o contrato básico já existente.
- Política de criação de revisão e quais alterações obrigam novo hash.
- Conteúdo, prioridade de ações, navegação, estados e identidade visual da tela
  inicial; nenhuma dessas decisões pode ser inferida pelo desenvolvimento.

## Riscos consolidados

| Risco | Impacto | Mitigação de planejamento |
| --- | --- | --- |
| Dupla contagem de custo entre fonte e expansão | cobrança incorreta | união discriminada da base e teste de conservação na 4.10 |
| Arredondamento ou ordem de cotas implícitos | resultados monetários não reproduzíveis | bloquear Ready até regra e identidade canônica serem aprovadas |
| Reusar massa de 15 em 16–20 | política matemática inválida | 4.11 separada e obrigatória antes da 4.12 |
| Ampliar o gerador e alterar 15 | quebra retroativa | versão explícita e regressão integral de 15 |
| Persistir artefato transitório sem identidade suficiente | perda de auditoria/reprodução | gate F5-PERSIST antes das stories consumidoras |
| Divergência TypeScript/Python | resultado ou erro incompatível entre CLI e desktop | contrato IPC canônico e suíte cruzada antes do motor Python |
| UI antecipar regra de negócio | fluxo visual virar fonte de verdade paralela | design agora; implementação só após os contratos fundacionais |
| Relatório recalcular dados | divergência com artefatos aprovados | composição por referências/versionamento, regra a confirmar no Épico 5 |
| Confundir reimpressão com regeneração | quebra do hash/congelamento | fluxo de revisão/reimpressão limitado a `FrozenPortfolio` |

## Critério de entrada no Épico 5

O Épico 5 só pode iniciar implementação quando 4.10, 4.11 e 4.12 estiverem
concluídas com seus gates, `F5-PERSIST-DONE` e `F5-IPC-DONE` estiverem
implementados e com QA `PASS`, e as decisões de relatório/aprovação/hash
necessárias à primeira story estiverem fechadas. O plano UX pode amadurecer em
paralelo, mas nenhum componente deve ser implementado antes da fundação
técnica.
