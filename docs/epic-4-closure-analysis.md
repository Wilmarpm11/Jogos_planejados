# Análise de encerramento do Épico 4

**Data da auditoria:** 2026-09-07

**Base auditada:** `main` e `origin/main` em
`5ecb01f7768d7b8e2bc2d3895b7f11b88f7e9e63`, após o fechamento
administrativo da Story 4.11 pelo PR #12

**Decisão:** Épico 4 permanece aberto

## Estado verificado

- A `main` local coincide com `origin/main` em `5ecb01f`.
- A Story 4.8 foi incorporada pelo PR #7, com gate QA `PASS`, score 100 e
  regressão integral de 174 testes registrada no artefato de qualidade.
- A Story 4.9 foi incorporada pelo PR #8 no merge commit `9b91318`, com gate QA
  `PASS`, AC1–AC12 sem gaps, 194 testes regressivos e CodeRabbit final sem
  achados.
- A Story 4.10 foi incorporada pelo PR #10 no squash `f04a9ec`, com gate QA
  `PASS` 100/100.
- A Story 4.11 foi incorporada pelo PR #11 no squash `390c7cd`, com gate QA
  `PASS` 100/100, CodeRabbit `SUCCESS` e fixture, índice, seis `policyHash` e
  seis `massHash` preservados.
- A Story 4.12 está `Ready` e sem implementação. A Story 4.11 e a disposição
  `F5-IPC-SPEC/4.12` estão concluídas, com Arquitetura `PASS`, SM `PASS` e PO
  `GO`.
- Nenhuma branch foi removida durante esta auditoria.

## Parecer de encerramento

As Stories 4.1–4.11 estão incorporadas à `main`, mas o Épico 4 ainda não pode
ser encerrado enquanto a Story 4.12 não for implementada, validada e concluída.
O `F5-IPC-SPEC/4.12` selecionou TypeScript limitado e fechou seu contrato; isso
não conclui a story nem os gates fundacionais de persistência e IPC exigidos
para a entrada no Épico 5.

## Classificação das pendências

| Capacidade | Classificação | Impacto no encerramento |
| --- | --- | --- |
| Otimização de diversidade | Entregue e incorporada pela Story 4.9 | Política, contrato, implementação e QA estão concluídos no PR #8 e em `main@9b91318`. |
| Cálculo operacional de custo e cotas (FR-06) | Story 4.10, `Done` | Implementação, QA e fechamento concluídos pelo PR #10 em `main@f04a9ec`. |
| Políticas e massas 16–20 | Story 4.11, `Done` | Implementação versionada, fixture, hashes, QA e revisão concluídos pelo PR #11 em `main@390c7cd`. [closure-key: 4.11:commit:390c7cd4db44bbe0a2a7c92cb3ca467760b1bd4c] |
| Geração de apostas 16–20 | Story 4.12, `Ready` | 4.11 e `F5-IPC-SPEC/4.12` concluídos com os pareceres exigidos; nenhuma geração foi implementada e o Épico 4 permanece aberto. |
| Persistência local e IPC Tauri/Python | Fundação técnica anterior ao Épico 5 | Contratos, identidades, auditoria, erros, limites e packaging ainda precisam ser decididos; nenhuma implementação está autorizada. |
| Relatório pré-impressão | Escopo explícito do Épico 5 | Não é débito da Story 4.8; depende de custo/cotas e deve compor resultados existentes sem recalculá-los. |
| Aprovação e `FrozenPortfolio` | Escopo explícito do Épico 5 | Os tipos/hash básicos existem, mas o fluxo, a revisão e a persistência de congelamento ainda não. |
| Revisão e reimpressão | Escopo explícito do Épico 5 | Deve operar somente sobre carteira congelada e não pode regenerar ou reordenar jogos; PDF físico continua no Épico 6. |
| Capa/tela inicial | Planejamento UX do Épico 5 | O design pode amadurecer agora; código de interface fica bloqueado pela fundação técnica. |

## Decisões de reutilização, contrato e modalidade

| Capacidade | Criar | Reutilizar | Restringir | Skill AIOX |
| --- | --- | --- | --- | --- |
| Diversidade | Contrato público, estrito e versionado de otimização em `@boloes/lottery-contracts`; package `@boloes/portfolio-engine`, já previsto na arquitetura | `PortfolioGenerator`, candidatos canônicos, combinatório e semântica de interseção da Story 4.4 | Primeira adaptação à Lotofácil simples de 15 dezenas | Não criar; o contrato de domínio será a fonte de verdade reutilizável |
| Custo/cotas | Contrato reutilizável de cálculo monetário e cotas, com valores inteiros em centavos e regra auditável | Catálogo/snapshot versionado da Story 3.5 | Preços e regras da modalidade ao adaptador Lotofácil; a base oficial efetivamente comprada deve ser declarada e contada uma única vez | Não criar; contratos e testes de domínio são suficientes |
| Política/massas 16–20 | Políticas e massas versionadas específicas para cada universo 16–20 | `MetricEngine`, ocupação normalizada, manifesto e combinatório existentes | Implementação ao módulo Lotofácil; proibida a transferência da massa/limiares de 15 | Não criar; regra específica deve permanecer na modalidade |
| Geração 16–20 | Somente extensões compatíveis que a versão pública exigir | Contrato `PortfolioGenerator`, PRNG, canonização e combinatório existentes | Adaptador Lotofácil e políticas aprovadas para cada tamanho; preservar comportamento de 15 | Não criar; reutilizar a capacidade de geração existente |
| Persistência local | Contrato versionado do agregado, identidades e auditoria antes de schema/migration | SQLite, migrations e padrões imutáveis de `data-access` já entregues | Payloads por modalidade ficam em adaptadores/contratos próprios | Não criar; contrato e testes de persistência serão a fonte de verdade |
| IPC Tauri/Python | Contrato de processo versionado e suíte cruzada antes do motor Python | Schemas, progresso, cancelamento e erros das operações existentes | Python restrito a cálculo; sem banco, histórico bruto, paths ou credenciais | Não criar; automação de agente não substitui contrato entre processos |
| Épico 5 | Contratos versionados para relatório, aprovação, revisão e persistência de estado | Canonização, hash, `FrozenPortfolio`, auditorias, cobertura, estratégia, snapshots e `data-access` | Impressão/PDF ao Épico 6; nenhuma regeneração durante reimpressão | Não criar nesta fase; contratos operacionais serão a fonte de verdade |
| Interface inicial | Especificação UX e, futuramente, componentes/tokens somente após decisão | Casos de uso CLI e contratos do Épico 5 | UI não recalcula domínio nem se torna fonte paralela de estado | Nenhuma skill de produto; AIOX UX é ferramenta de planejamento, não runtime |

## Ordem proposta de stories

1. **Story 4.9 — Otimização determinística de diversidade da carteira
   Lotofácil simples.** Concluída e incorporada pelo PR #8 em `9b91318`.
2. **Story 4.10 — Cálculo operacional de custo e cotas Lotofácil.** Concluída
   e incorporada pelo PR #10 em `f04a9ec`.
3. **Story 4.11 — Políticas e massas estruturais versionadas Lotofácil
   16–20.** Concluída e incorporada pelo PR #11 em `390c7cd`, sem reutilizar
   parâmetros de 15.
4. **Gate F5-IPC-SPEC/4.12 — fronteira da geração.** Concluído sem código com
   `IN_PROCESS_TYPESCRIPT_LIMITED`; o IPC geral do Épico 5 permanece pendente.
5. **Story 4.12 — Geração determinística de apostas Lotofácil 16–20.** P1;
   depende da Story 4.11 e do contrato F5-IPC-SPEC/4.12, ambos satisfeitos; não
   depende de F5-IPC-DONE e ainda não foi implementada.
6. **Gate F5-PERSIST-DONE — Persistência local.** Define primeiro o agregado,
   identidades, versões, auditoria, erros e limites; depois implementa e valida
   sua conformidade em story própria.
7. **Gate F5-IPC-DONE — Contrato Tauri/TypeScript–Python.** Implementa e valida
   envelope, operações, cancelamento, erros, limites e packaging definidos em
   F5-IPC-SPEC.
8. **Story 5.1 — Relatório pré-impressão versionado.** Compõe carteira,
   estratégia, custo, auditorias, cobertura, snapshots e hash.
9. **Story 5.2 — Aprovação e congelamento imutável da carteira.** Cria a
   transição de estado e sua persistência auditável.
10. **Story 5.3 — Revisões e identidade para reimpressão.** Preserva jogos e hash
   sem executar o gerador; renderização e homologação física ficam no Épico 6.
11. **Interface do Épico 5.** A capa/tela inicial é planejada agora por UX, mas
    só entra em implementação depois dos dois gates fundacionais.

As stories de diversidade, custo/cotas, políticas/massas e geração 16–20
permanecem separadas. O backlog detalhado, suas dependências, critérios de Ready
e riscos estão em `docs/backlog-before-epic-5.md`.

## Decisão de Produto aprovada para custo/cotas — FR-06

- A taxa de serviço usa `feeBps`, inteiro entre `0` e `10.000`, inclusive;
  `100 bps = 1%`. Seu valor inicial seguro é `0`, que não adiciona cobrança.
  `30%` é permitido somente como exemplo, nunca como taxa oficial, obrigatória
  ou padrão.
- A incidência ocorre sobre o custo oficial total da carteira efetivamente
  comprada, conforme o catálogo CAIXA versionado. A base homogênea declara
  exclusivamente `SOURCE_BETS` ou `EXPANDED_SIMPLE_BETS`. Fonte usa o preço do
  tamanho 15–20; expansão usa o preço simples de 15. Cada ocorrência, inclusive
  duplicata legítima, é contabilizada uma única vez.
- Todos os cálculos são inteiros:
  `feeCents = HALF_UP(officialCostCents × feeBps / 10000)` e
  `totalCents = officialCostCents + feeCents`.
- O valor-base da cota usa piso. Cada centavo restante é atribuído pela ordem
  numérica crescente de `quotaId`, que é positivo, único, estável e fornecido no
  request. Rateio que produza qualquer cota de zero centavo é rejeitado.
- A quantidade de cotas deriva da lista de IDs e deve respeitar
  `minShares`/`maxShares` do catálogo; `maxGamesPerReceipt` não pertence ao
  cálculo.
- O resultado separa custo oficial, percentual, valor da taxa, total cobrado e
  valores das cotas, além de registrar base, HALF_UP, distribuição do resto,
  contrato e proveniência do catálogo fornecido já resolvido pelo chamador.
- A futura story implementará cálculo puro e auditável. Pagamento, venda de
  cotas, participantes e integração financeira ficam fora do escopo.

Essas decisões estão materializadas no contrato arquitetural
`docs/architecture/lotofacil-operational-cost-and-quotas-contract.md` `1.0`,
com parecer `PASS`. Isso fecha o gate de especificação sem implementar a
capacidade e não altera nem reabre a Story 4.9. A promoção formal da Story 4.10
para `Ready` foi aprovada pelo PO com `GO` 9/10 em 2026-09-05.

## Decisões da Story 4.9

A numeração/prioridade 4.9 foi recomendada nesta auditoria administrativa pela
coordenação com pareceres AIOX PM e Architect, porque o invariante do PRD já
exigia diversidade entre geração e cobertura. A story não existia como item
aprovado em `origin/main`; Produto aprovou posteriormente a política definitiva
descrita abaixo.

Produto aprovou em 2026-09-04 a política
`DETERMINISTIC_GREEDY_MIN_OVERLAP`: seleção gulosa por histograma incremental de
interseções em ordem 14→0, canonização e desempate lexicográficos, subconjunto de
`1 <= target <= pool <= 1.000`, preservação rígida da alocação estrutural
explícita por maiores restos, modo neutro sem inferência, progresso
`BUILD_OVERLAP_MATRIX`/`SELECT_CANDIDATES`, cancelamento cooperativo sem
resultado parcial, ausência de timeout em `1.0` e uma primitiva compartilhada de
interseção em `@boloes/combinatorics`.

O contrato arquitetural está em
`docs/architecture/portfolio-diversity-optimization-contract.md`. A Story 4.9
foi concluída em 2026-09-05 com gate QA `PASS`, 194 testes e CodeRabbit final
sem achados. O commit final da branch foi `2c9dc3c` e o PR #8 foi incorporado à
`main` em 2026-09-06 pelo merge commit `9b91318`.

## Decisões abertas

### Para as stories seguintes

1. F5-PERSIST: inventário persistido, identidades, mutabilidade, versionamento,
   auditoria, atomicidade, recuperação, erros e limites; contrato aprovado não
   equivale ao gate de saída `F5-PERSIST-DONE`.
2. F5-IPC-SPEC geral: envelope, serialização, operações Python autorizadas,
   progresso, cancelamento, erros, limites, compatibilidade e empacotamento
   local; a disposição TypeScript da 4.12 não fecha esse contrato.
3. F5-IPC-DONE: implementação aplicável e conformidade cruzada do contrato;
   bloqueia a entrada no Épico 5 e a implementação da UI, não a Story 4.12.
4. Épico 5: decidir quais achados bloqueiam aprovação, conteúdo/identidade do
   relatório, ato de aprovação, fronteira do hash, revisões e navegação/conteúdo
   da tela inicial.

## Inventário de branches

O repositório remoto possui `main` e dez branches de trabalho relacionadas ao
Épico 4. Todas as dez têm PR correspondente comprovadamente `MERGED` pelo
GitHub e podem ser
removidas após autorização explícita, apesar de seus commits não aparecerem
como ancestrais diretos da `main` por causa do squash merge.

| Branch | Tip local/remoto | Evidência de merge | Merge commit |
| --- | --- | --- | --- |
| `feature/4.5-lotofacil-portfolio-structural-distribution` | `be2b45e` | PR #2 `MERGED` | `ec2415d` |
| `chore/4.5-post-merge-closure` | `8a81680` | PR #3 `MERGED` | `31243c7` |
| `feature/4.6-lotofacil-exact-coverage-audit` | `b6b45ca` | PR #4 `MERGED` | `dac8d22` |
| `chore/4.6-post-merge-closure` | `8bbe0c6` | PR #5 `MERGED` | `affa226` |
| `feature/4.7-lotofacil-canonical-bet-expansion` | `22ad241` | PR #6 `MERGED` | `59cefa4` |
| `feature/4.8-lotofacil-expanded-coverage-composition` | `868aee3` | PR #7 `MERGED` | `d9fbf06` |
| `feature/4.9-lotofacil-deterministic-diversity-optimization` | `2c9dc3c` | PR #8 `MERGED` | `9b91318` |
| `docs/epic-4-backlog-4.10-4.11-ready` | `4ec4bc8` | PR #9 `MERGED` | `134d0ae` |
| `feature/4.10-lotofacil-operational-cost-and-quotas` | `9178e35` | PR #10 `MERGED` | `f04a9ec` |
| `feature/4.11-lotofacil-16-20-structural-policies-and-masses` | `dac4910` | PR #11 `MERGED` | `390c7cd` |

A branch da Story 4.4 já não existe localmente nem no remoto; o PR #1 está
`MERGED` em `575297c`.

A branch local `chore/epic-4-administrative-closure` e a branch ativa
`docs/4.11-post-merge-closure` também foram preservadas; nenhuma exclusão foi
executada.
