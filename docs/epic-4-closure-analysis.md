# Análise de encerramento do Épico 4

**Data da auditoria:** 2026-09-04

**Base auditada:** `origin/main@d9fbf066b1b5d9f9892d0e2ce22c81a3a1659d6d`

**Decisão:** Épico 4 permanece aberto

## Estado verificado

- A `main` local foi atualizada exclusivamente por fast-forward e coincide com
  `origin/main` em `d9fbf06`.
- Os sete PRs existentes estão `MERGED`; não há PR nem issue aberta.
- Antes da criação do novo draft, as 26 stories existentes estavam `Done` e os
  26 gates correspondentes em `docs/qa/gates/` estavam `PASS`.
- A Story 4.8 foi incorporada pelo PR #7, com gate QA `PASS`, score 100 e
  regressão integral de 174 testes registrada no artefato de qualidade.
- Nenhuma branch foi removida durante esta auditoria.
- As alterações administrativas foram isoladas na branch local
  `chore/epic-4-administrative-closure`, criada a partir de `d9fbf06`; ela é a
  branch ativa deste trabalho e não faz parte do inventário de limpeza.

## Parecer de encerramento

As Stories 4.1–4.8 podem ser consideradas administrativamente concluídas, mas
o Épico 4 não pode ser encerrado como capacidade funcional completa. O fluxo
invariante do produto exige `geração -> otimização de diversidade -> auditoria
de cobertura`, enquanto as Stories 4.2–4.5 adiaram explicitamente a otimização
e as Stories 4.6–4.8 avançaram para cobertura sem implementá-la. [Fonte:
`docs/prd.md` — seção 2; `docs/architecture/product-invariants.md`; Stories
4.2–4.5]

## Classificação das pendências

| Capacidade | Classificação | Impacto no encerramento |
| --- | --- | --- |
| Otimização de diversidade | Lacuna funcional P0 do Épico 4 | Bloqueia o encerramento; é uma etapa obrigatória e ainda não possui política nem implementação. |
| Cálculo operacional de custo e cotas (FR-06) | Enabler P0 entre os Épicos 4 e 5 | O catálogo versionado existe, mas não há cálculo de custo total/cota. Deve anteceder o relatório pré-impressão. |
| Geração de apostas 16–20 | Lacuna P1 de FR-02/FR-05 | Expansão 15–20 não equivale a geração. O gerador atual aceita somente 15 e depende de políticas/massas próprias para 16–20. |
| Relatório pré-impressão | Escopo explícito do Épico 5 | Não é débito da Story 4.8; depende de custo/cotas e deve compor resultados existentes sem recalculá-los. |
| Aprovação e `FrozenPortfolio` | Escopo explícito do Épico 5 | Os tipos/hash básicos existem, mas o fluxo, a revisão e a persistência de congelamento ainda não. |
| Revisão e reimpressão | Escopo explícito do Épico 5 | Deve operar somente sobre carteira congelada e não pode regenerar ou reordenar jogos; PDF físico continua no Épico 6. |

## Decisões de reutilização, contrato e modalidade

| Capacidade | Criar | Reutilizar | Restringir | Skill AIOX |
| --- | --- | --- | --- | --- |
| Diversidade | Contrato público, estrito e versionado de otimização em `@boloes/lottery-contracts`; package `@boloes/portfolio-engine`, já previsto na arquitetura | `PortfolioGenerator`, candidatos canônicos, combinatório e semântica de interseção da Story 4.4 | Primeira adaptação à Lotofácil simples de 15 dezenas | Não criar; o contrato de domínio será a fonte de verdade reutilizável |
| Custo/cotas | Contrato reutilizável de cálculo monetário e cotas, com valores inteiros em centavos e regra auditável | Catálogo/snapshot versionado da Story 3.5 | Preços e regras da modalidade ao adaptador Lotofácil; a base oficial efetivamente comprada deve ser declarada e contada uma única vez | Não criar; contratos e testes de domínio são suficientes |
| Política/massas 16–20 | Políticas e massas versionadas específicas para cada universo 16–20 | `MetricEngine`, ocupação normalizada, manifesto e combinatório existentes | Implementação ao módulo Lotofácil; proibida a transferência da massa/limiares de 15 | Não criar; regra específica deve permanecer na modalidade |
| Geração 16–20 | Somente extensões compatíveis que a versão pública exigir | Contrato `PortfolioGenerator`, PRNG, canonização e combinatório existentes | Adaptador Lotofácil e políticas aprovadas para cada tamanho; preservar comportamento de 15 | Não criar; reutilizar a capacidade de geração existente |
| Épico 5 | Contratos versionados para relatório, aprovação, revisão e persistência de estado | Canonização, hash, `FrozenPortfolio`, auditorias, cobertura, estratégia, snapshots e `data-access` | Impressão/PDF ao Épico 6; nenhuma regeneração durante reimpressão | Não criar nesta fase; contratos operacionais serão a fonte de verdade |

## Ordem proposta de stories

1. **Story 4.9 — Otimização determinística de diversidade da carteira
   Lotofácil simples.** P0; restaura a sequência obrigatória antes do
   encerramento do Épico 4.
2. **Story 4.10 — Cálculo operacional de custo e cotas Lotofácil.** P0; compõe
   o catálogo existente e habilita o relatório do Épico 5.
3. **Story 4.11 — Políticas e massas estruturais versionadas Lotofácil
   16–20.** P1; fecha a lacuna matemática sem reutilizar parâmetros de 15.
4. **Story 4.12 — Geração determinística de apostas Lotofácil 16–20.** P1;
   depende da Story 4.11 e reutiliza o contrato de geração existente.
5. **Story 5.1 — Relatório pré-impressão versionado.** Compõe carteira,
   estratégia, custo, auditorias, cobertura, snapshots e hash.
6. **Story 5.2 — Aprovação e congelamento imutável da carteira.** Cria a
   transição de estado e sua persistência auditável.
7. **Story 5.3 — Revisões e identidade para reimpressão.** Preserva jogos e hash
   sem executar o gerador; renderização e homologação física ficam no Épico 6.

As stories de diversidade, custo/cotas e geração 16–20 permanecem separadas.
A numeração 4.11/4.12 pode ser movida após a primeira fatia do Épico 5 somente
por decisão explícita de Produto aceitando a lacuna temporária de FR-02.

## Decisão de Produto aprovada para custo/cotas — FR-06

- A taxa de serviço é um percentual configurável pelo operador. Seu valor
  inicial seguro é `0%`, que não adiciona cobrança. `30%` é permitido somente
  como exemplo, nunca como taxa oficial, obrigatória ou padrão.
- A incidência ocorre sobre o custo oficial total da carteira efetivamente
  comprada, conforme o catálogo CAIXA versionado. A base declara se os itens
  comprados são apostas-fonte ou combinações expandidas e os conta uma única
  vez; as duas representações não podem ser cobradas simultaneamente.
- Dinheiro é representado em centavos inteiros. O valor total da taxa é
  arredondado para centavos antes do rateio.
- O total cobrado é dividido em centavos pela quantidade de cotas. Qualquer
  resto é distribuído deterministicamente, um centavo adicional para cada uma
  das primeiras cotas em ordem canônica, e a soma das cotas conserva exatamente
  o total.
- O resultado separa custo oficial, percentual, valor da taxa, total cobrado e
  valores das cotas, além de registrar a base de cálculo, a regra de
  arredondamento e a distribuição do resto.
- A futura story implementará cálculo puro e auditável. Pagamento, venda de
  cotas, participantes e integração financeira ficam fora do escopo.

Essa decisão fecha a política funcional de incidência, arredondamento e rateio,
mas não implementa nem torna `Ready` a Story 4.10. A futura definição do
contrato ainda deve explicitar a representação decimal do percentual, seus
limites de validação e a identidade canônica das cotas sem alterar as regras
acima. Ela também não resolve nenhuma das decisões bloqueantes da Story 4.9.

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
`docs/architecture/portfolio-diversity-optimization-contract.md`. A decisão
fecha as cinco categorias antes abertas; após `PASS` de Arquitetura e `GO` do
PO em 2026-09-04, a Story 4.9 foi promovida de `Draft` para `Ready`, ainda sem
implementação.

## Decisões abertas

### Para as stories seguintes

1. Resolver e versionar E1–E10, classificação e massas para cada tamanho 16–20.
2. Decidir se 16–20 bloqueia a entrada no Épico 5 ou será extensão priorizada.
3. No Épico 5, decidir quais achados de auditoria bloqueiam aprovação e quais
   são apenas avisos.

## Inventário de branches

O repositório remoto possui `main` e seis branches de trabalho. Todas as seis
têm PR correspondente comprovadamente `MERGED` pelo GitHub e podem ser
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

A branch da Story 4.4 já não existe localmente nem no remoto; o PR #1 está
`MERGED` em `575297c`.
