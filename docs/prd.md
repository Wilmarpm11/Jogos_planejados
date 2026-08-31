# PRD v0.4 - Plataforma de Engenharia de Bolões

**Status:** Aprovado condicionalmente para fundação e arquitetura  
**MVP:** Lotofácil  
**Modelo de licença:** GPL-3.0-or-later  
**Última atualização:** 2026-08-29

## Change log

| Data | Versão | Descrição | Autor |
| --- | --- | --- | --- |
| 2026-08-26 | 0.3 | PRD inicial multi-loteria | Produto |
| 2026-08-29 | 0.4 | Fórmula canônica, histórico versionado, impressão A4 e gates de qualidade | PM / AIOX |
| 2026-08-29 | 0.4.1 | Parecer final de Architect, PO e QA; gates de produção explicitados | PM / AIOX |
| 2026-08-29 | 0.4.2 | Removidos exemplos de carteira de teste; fórmula como única referência canônica | PM / AIOX |
| 2026-08-29 | 0.4.3 | Ocupação de linhas/colunas normalizada por tamanho de aposta (15–20) e raridade teórica por universo | PM / AIOX |
| 2026-08-30 | 0.4.4 | Modo avançado, coorte contextual, estratégia manual experimental e comparação pré-geração | Produto |

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

O produto suporta `NEUTRAL`, `ADVANCED` e `MANUAL_EXPERIMENTAL`. O modo neutro
preserva a distribuição estrutural neutra e nunca é enviesado automaticamente
por coorte. Em `ADVANCED`, o usuário pode escolher uma distribuição estrutural
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

### FR-06 - Bolão mínimo

O usuário informa modalidade, concurso, tamanho de aposta e número inteiro de
cotas. O relatório mostra custo total, regra/preço aplicado e custo por cota com
regra de arredondamento declarada. Não existem pagamentos ou participantes no MVP.

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
  cobertura declara exatidão/estimativa.
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
| E9 | para 15: desvio de linhas >=8; para 16–20: não aplicável até estudo teórico específico |
| E10 | para 15: desvio de colunas >=8; para 16–20: não aplicável até estudo teórico específico |

Para apostas de 15 dezenas, a referência histórica de desvio absoluto pode ser
mantida somente como âncora equivalente a um limiar normalizado versionado. Ela
não pode ser reutilizada como limite absoluto para apostas de 16 a 20 dezenas.

`extreme_count` é a quantidade de regras satisfeitas.

### 7.3 Massa estrutural neutra

Esta massa é a referência teórica para cartelas simples de 15 dezenas. Para
apostas de 16 a 20, o sistema deve calcular e versionar a massa correspondente
ao respectivo universo; nunca deve reutilizar esta tabela.

| Faixa | Massa teórica |
| --- | ---: |
| 0 extremos | 90,4231% |
| 1 extremo | 7,7101% |
| 2 extremos | 1,2780% |
| 3 extremos | 0,3759% |
| 4+ extremos | 0,2129% |

O núcleo central usa pares 6-9, soma 176-214, moldura 8-12, dezenas 01-13 entre
7-10 e pares consecutivos 7-10. Ele é referência de análise/estratégia, não
predição.

### 7.4 Cobertura e expansão

Uma aposta de 15 dezenas cobre, de forma bruta: 15 = 1 resultado; 14+ = 151;
13+ = 4.876; 12+ = 59.476. O auditor separa cobertura bruta, única, resultados
repetidos, redundância e eficiência.

Expansão para combinações de 15: 15=1; 16=16; 17=136; 18=816; 19=3.876;
20=15.504. A unidade interna é a combinação simples de 15, mesmo para apostas
maiores.

### 7.5 Estratégias

`neutral` aloca pela massa teórica. `experimental_special` da Independência usa:

- bloco A: 143 jogos com 0 extremos, soma 176-214 e moldura 9-11;
- bloco B: 143 jogos com 0 extremos, sem obrigação adicional.

Essa estratégia é sempre experimental até evidência de validação/holdout e não
pode ser promovida automaticamente.

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

- [ ] Congelar em artefato versionado todas as constantes, métricas e massas da
  fórmula Lotofácil, incluindo semântica de pares consecutivos, sequências 2+,
  moldura, ocupação normalizada de linhas/colunas, desvios e canonização/ordenação
  de jogos.
- [ ] Definir algoritmo, limite de tempo e erro aceitável para cobertura única.
- [ ] Congelar URLs, campos, validações, versão do parser e regra de
  correção/substituição da fonte CAIXA, com import manual.
- [ ] Anexar PDF/foto/medidas finais do COLOGA ou ensaio equivalente.
- [ ] Homologar template A4 em impressora/driver/papel/loteria de teste.
- [ ] Definir o contrato entre interface TypeScript/Tauri e motor Python, incluindo
  serialização canônica, versão do motor e empacotamento local.

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
