# Backlog obrigatório antes do Épico 5

**Status:** planejamento — Stories 4.10 e 4.11 `Done`; Story 4.12 `Draft`; Épico 4 aberto
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
| 2 | Story 4.11 — políticas e massas estruturais Lotofácil 16–20, `Done` pelo PR #11 em `main@390c7cd` | métricas, ocupação, faixas e manifesto das 2.1–2.5; contrato `1.0` aprovado | pré-requisito matemático da geração 16–20; não promove a 4.12 sem `F5-IPC-SPEC` e os demais gates |
| 3 | Gate F5-IPC-SPEC — especificação Tauri/TypeScript–Python | operações e limites computacionais candidatos identificados | decisão versionada sobre a fronteira de execução da 4.12 e sobre o primeiro uso autorizado de Python |
| 4 | Story 4.12 — geração completa de apostas 16–20 | Story 4.11 concluída; contrato/gerador da 4.2; fronteira de expansão da 4.7; F5-IPC-SPEC aprovado | geração de apostas-fonte 16–20 sem alterar o comportamento de 15; se Python for obrigatório, F5-IPC-DONE também precede o código |
| 5 | Gate F5-PERSIST-DONE — fundação de persistência local | contratos dos artefatos que serão persistidos identificados; no mínimo custo/cotas 4.10 e carteira/auditorias já estáveis | relatório, aprovação, revisões e `FrozenPortfolio` persistidos |
| 6 | Gate F5-IPC-DONE — implementação e conformidade IPC | F5-IPC-SPEC aprovado; primeira operação e packaging definidos | integração desktop e eventual operação Python autorizada sem contrato implícito |
| Paralelo de design | Plano UX da capa/tela inicial | pode ser elaborado agora; implementação depende de F5-PERSIST-DONE e F5-IPC-DONE, ambos com QA `PASS` | story futura de interface do Épico 5 |
| Depois dos gates | Épico 5 — relatório, aprovação, congelamento, revisões e interface | 4.10–4.12 e fundação técnica concluídas conforme o item consumidor | Épico 6 de impressão, sem antecipar impressão física |

4.10, 4.11 e 4.12 são entregas separadas. A fundação também possui dois
enablers independentes: persistência local não implica IPC, e IPC não autoriza
migrar automaticamente cálculos TypeScript para Python. `F5-IPC-SPEC` é o gate
documental que antecede a prontidão da 4.12; `F5-IPC-DONE` é o gate de saída da
implementação/conformidade e antecede o Épico 5 e a UI. Se a especificação
escolher Python para a 4.12, `F5-IPC-DONE` passa a anteceder também a
implementação da própria 4.12.

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

**Status preservado:** `Draft`. A Story 4.11 satisfez somente o pré-requisito
matemático; `F5-IPC-SPEC`, as decisões contratuais e os demais gates abaixo
continuam bloqueando a promoção para `Ready`.

### Resultado esperado

- Estender a geração determinística para apostas-fonte de 16–20 somente sobre
  as políticas aprovadas pela 4.11.
- Preservar integralmente o contrato e o resultado de 15 dezenas.
- Reutilizar seed, canonização, unicidade, combinatória e fronteira do
  `PortfolioGenerator` existentes.
- Manter expansão, diversidade 4.9, cobertura, custo/cotas, persistência,
  congelamento e UI como chamadas separadas; a extensão não as habilita
  automaticamente para 16–20.

### Decisões pendentes para ficar Ready

1. Modos/estratégias autorizados para cada `betSize` e vínculo exato com 4.11.
2. Limites de candidatos e trabalho por tamanho, incluindo progresso,
   cancelamento e eventual timeout.
3. Semântica de seed/versionamento ao ampliar o gerador sem mudar 15.
4. Erros públicos para política ausente, alocação inviável e limite excedido.
5. Relação explícita com otimização de diversidade, expansão e cobertura,
   especialmente a inelegibilidade atual de 19–20 na composição limitada a
   1.000 ocorrências.
6. Fronteira de execução aprovada no `F5-IPC-SPEC`: TypeScript limitado ou
   processo Python. Nenhuma das opções é escolhida neste backlog; se Python for
   obrigatório, o enabler IPC deve estar `Done` com QA `PASS` antes do código.

### Definition of Ready

- Story 4.11 está `Done` com gate PASS.
- `F5-IPC-SPEC` está aprovado e decidiu explicitamente a fronteira da execução;
  quando exigir Python, `F5-IPC-DONE` também está concluído com QA `PASS`.
- Contrato de entrada/saída, limites e erros estão congelados por tamanho.
- Testes de reprodução, validade, unicidade, fronteiras combinatórias,
  alocação e regressão de 15 possuem oráculos definidos.
- Decisão de reuso: estender o contrato existente de geração, restringir as
  políticas ao adaptador Lotofácil e não criar skill nova.

## Fundação técnica anterior ao Épico 5

O detalhamento está em
`docs/architecture/epic-5-technical-foundation-plan.md`. Antes de qualquer
implementação, F5-PERSIST deve decidir o agregado persistido, identidades,
versões, imutabilidade, auditoria, erros, atomicidade, recuperação e limites.
F5-IPC deve primeiro passar por `SPEC`, decidindo serialização,
envelope/versionamento, operações, progresso, cancelamento, erros, limites e
empacotamento Tauri/TypeScript–Python, e depois por `DONE`, que exige
implementação/conformidade com QA `PASS`.

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
