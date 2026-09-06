# Plano da fundação técnica anterior ao Épico 5

**Status:** planejamento arquitetural; não autoriza implementação

**Data:** 2026-09-05

**Escopo:** dois enablers/gates separáveis — persistência local de carteiras e
contrato IPC Tauri/TypeScript ↔ Python

**Fontes:** [PRD](../prd.md), [arquitetura full-stack](../architecture.md),
[invariantes](product-invariants.md),
[proveniência CAIXA](caixa-dataset-snapshots.md),
[lifecycle de estratégias](strategy-lifecycle-contract.md) e contratos das
Stories 4.2–4.9

## 1. Objetivo e condição de entrada no Épico 5

O Épico 5 precisa compor relatório, aprovação, `FrozenPortfolio`, revisão e
reimpressão sem recalcular, reordenar ou perder a proveniência dos artefatos já
produzidos. Antes disso, o projeto deve fechar duas fundações independentes:

1. **Enabler P — Persistência local de carteira:** decidir e contratar o estado
   persistido, suas identidades, versões, relações, imutabilidade, transações,
   recuperação, erros e limites.
2. **Enabler I — IPC local versionado:** decidir e contratar a fronteira entre
   Tauri/TypeScript e um processo Python reservado para cálculo pesado, sem
   permitir que o processo receba banco, histórico bruto, caminhos ou
   credenciais.

Os enablers devem ter stories e gates QA próprios. Eles podem ser especificados
e validados separadamente e nenhum deles autoriza implicitamente o outro. Pelo
direcionamento de Produto, ambos integram o backlog anterior ao Épico 5 e devem
atingir seus gates de saída `F5-PERSIST-DONE` e `F5-IPC-DONE`, ambos com QA
`PASS`, antes de implementar qualquer capacidade do Épico 5 ou a interface
desktop. O Enabler I não obriga a migrar para Python nenhum motor TypeScript já
aprovado.

Este documento não define schema físico, tabela, coluna ou migration e não
implementa persistência, processo Python, Tauri, interface ou fluxo do Épico 5.

## 2. Estado real já disponível

### 2.1 Evidências existentes que devem ser reutilizadas

- `@boloes/domain-core` já publica estados de carteira, canonização, SHA-256
  versionado e um tipo mínimo de `FrozenPortfolio`.
- `@boloes/data-access` já usa SQLite local, versionamento de schema, migrations
  transacionais, `foreign_keys`, `busy_timeout`, rollback em falha e validação
  Zod antes/depois da escrita.
- Importações, snapshots CAIXA, catálogos, resultados, perfis históricos,
  definições/resoluções de coorte e versões de estratégia já têm persistência
  local. Vários desses registros são append-only e protegidos contra alteração
  ou remoção.
- Geração, auditorias, cobertura e otimização de diversidade produzem hoje
  resultados transitórios e declaram que não persistem nem congelam carteira.
- A arquitetura reserva Python 3.12+ e NumPy para cálculo pesado e descreve JSON
  versionado entre processos. Não existe ainda `services/math-engine/`,
  `apps/desktop/` ou contrato de IPC implementado no repositório.
- A Story 4.9 permanece em TypeScript, limitada e sem IPC. Portá-la para Python
  exige decisão e versão próprias, além de regressão semântica.

### 2.2 Decisões de produto/arquitetura já vigentes

1. O produto é local-first e usa SQLite local; não há backend remoto,
   autenticação, pagamentos ou cadastro de participantes no MVP.
2. CLI é a superfície operacional primária. Desktop deve chamar os mesmos casos
   de uso e não criar lógica paralela.
3. Toda mudança de jogos, cotas, concurso, catálogo, estratégia, seed ou
   parâmetros cria uma revisão.
4. Somente uma `FrozenPortfolio`, identificada por hash canônico, pode ser
   exportada, impressa, enviada a adaptador online ou conferida.
5. Saídas não podem regenerar, reordenar ou alterar os jogos congelados.
6. Valores monetários usam centavos inteiros.
7. O processo Python é reservado a cálculo pesado. Ele não recebe banco,
   histórico bruto, impressão, caminhos de arquivo ou credenciais; a camada
   TypeScript valida a resposta e continua dona do domínio.
8. Cálculos pesados têm versões, progresso, cancelamento, limites de recursos e
   não publicam resultado parcial em falha ou cancelamento.

As enumerações de tabelas e o exemplo de `MathEngineRequest` em
`docs/architecture.md` são direcionais, não substituem os dois contratos ainda
pendentes.

## 3. Ordem e dependências do backlog anterior ao Épico 5

```text
4.10 FR-06 custo/cotas ───────────────> F5-PERSIST-DONE ─────────────┐
4.11 políticas/massas 16–20 ─> F5-IPC-SPEC ─> 4.12 geração 16–20 ───┤
contratos matemáticos estáveis ─> F5-IPC-SPEC ─> F5-IPC-DONE ────────┴─> Épico 5 CLI
                                      └─ se 4.12 usar Python ─> 4.12

planejamento UX da capa/tela inicial ────────────────────────────────┐
F5-PERSIST-DONE PASS + F5-IPC-DONE PASS ─────────────────────────────┴─> implementação UI
```

| Item | Dependências obrigatórias | Saída necessária para a fundação |
| --- | --- | --- |
| Story 4.10 — FR-06 | Catálogo CAIXA versionado e decisão de Produto já registrada | Contrato puro de custo/cotas, base comprada inequívoca, valores em centavos e proveniência do catálogo. |
| Story 4.11 — políticas/massas 16–20 | Fórmula e métricas canônicas existentes | Política versionada por tamanho 16–20 e massas de teste aprovadas, sem reutilizar a massa de 15. |
| Gate F5-IPC-SPEC | Story 4.11 e inventário das operações pesadas candidatas | Contrato IPC aprovado e decisão explícita sobre execução limitada em TypeScript ou por worker Python na 4.12. |
| Story 4.12 — geração 16–20 | Story 4.11 e F5-IPC-SPEC; se a especificação exigir Python, também F5-IPC-DONE com QA `PASS` | Resultados transitórios versionados e compatibilidade explícita com o contrato de geração existente. |
| Gate F5-PERSIST-DONE | Contratos finais dos artefatos que serão persistidos, inclusive 4.10; decisão sobre como os resultados de 4.12 entram no primeiro conteúdo congelável | Contrato, implementação e conformidade da persistência aprovados com QA `PASS`. |
| Gate F5-IPC-DONE | F5-IPC-SPEC, primeira operação e packaging aprovados | Protocolo, runner/worker aplicável, suíte de conformidade e packaging aprovados com QA `PASS`. |
| Épico 5 | F5-PERSIST-DONE e F5-IPC-DONE, ambos com QA `PASS`, além das stories prévias exigidas pelo item consumidor | Relatório CLI-first, aprovação/congelamento e revisão sem lógica de UI ou impressão física antecipada. |
| UX da capa/tela inicial | Fluxo e linguagem de Produto | Planejamento visual pode avançar agora; implementação somente após os dois enablers. |

Os itens 4.10, 4.11 e 4.12 continuam separados. A dependência 4.11 → 4.12 é
rígida. `F5-IPC-SPEC` também antecede a prontidão da 4.12 para decidir sua
fronteira de execução sem pressupor tecnologia. Se o gate escolher uma execução
TypeScript limitada, a 4.12 não depende da implementação IPC; se escolher
Python, `F5-IPC-DONE` passa a ser bloqueante antes do código. Qualquer execução
Python precisa ser autorizada operação por operação no Enabler I.

### 3.1 Dois gates distintos para o IPC

- **F5-IPC-SPEC — gate documental:** fecha I-01–I-14, aprova o contrato
  versionado e decide a fronteira TypeScript/Python da 4.12. Ele ocorre antes da
  4.12 ficar `Ready` e não autoriza implementação.
- **F5-IPC-DONE — gate de saída:** exige a implementação aplicável de
  protocolo, runner/worker e packaging, testes de contrato e conformidade
  cruzada e QA `PASS`. Ele antecede o Épico 5 e a interface; também antecede o
  código da 4.12 quando `F5-IPC-SPEC` selecionar Python.
- A persistência segue a mesma separação entre especificação e entrega. A
  entrada no Épico 5 requer especificamente `F5-PERSIST-DONE` com QA `PASS`, não
  apenas um contrato documental aprovado.

## 4. Enabler P — persistência local de carteira

### 4.1 Fronteira pretendida

O enabler deve criar um contrato reutilizável de persistência de carteira e
integrá-lo à camada `@boloes/data-access`, preservando SQLite local e os padrões
transacionais existentes. Contratos de domínio permanecem fora de SQL e não
podem depender de `better-sqlite3`. Nenhuma regra Lotofácil deve entrar no Core
de persistência; valores e versões específicos de modalidade são fornecidos por
seus artefatos públicos.

O enabler não gera, otimiza, audita, aprova ou congela por conta própria. Ele
apenas valida e registra transições autorizadas pelos casos de uso. A UI não
acessa SQLite diretamente.

### 4.2 Inventário que precisa de decisão explícita

| Artefato/capacidade | Estado atual | Decisão pendente antes da story |
| --- | --- | --- |
| Carteira de trabalho | Resultados 4.x são transitórios | Definir se e em qual estágio passa a existir registro persistido. |
| Execução de geração | Resultado contém seed, parâmetros e versões | Definir se persiste o envelope completo, somente referência imutável ou ambos. |
| Revisões de carteira | PRD exige revisão a cada mudança material | Definir identidade da série, identidade de cada revisão, ancestralidade e regra de criação. |
| Jogos/apostas-fonte/ocorrências expandidas | Há representações diferentes em 4.7/4.8 e FR-06 proíbe dupla contagem | Definir qual representação é autoritativa em cada revisão e como as demais são referenciadas sem ambiguidade. |
| Otimização de diversidade | 4.9 produz subconjunto e proveniência transitórios | Definir se o resultado completo ou sua referência integra a revisão persistida. |
| Auditorias 4.3–4.6 e cobertura 4.8 | Resultados transitórios, versionados e com limites próprios | Definir granularidade persistida, vínculo com revisão e política para obsolescência após qualquer mudança. |
| Custo e cotas 4.10 | Ainda não implementado | Definir vínculo imutável com carteira efetivamente comprada e snapshot/versionamento do catálogo usado. |
| Estratégia e snapshots CAIXA | Já possuem identidades persistidas | Definir se a revisão copia um snapshot semântico ou armazena referências imutáveis verificáveis. |
| Aprovação | Regra de bloqueio versus aviso ainda está aberta | Definir identidade do ato, evidências exigidas, efeitos, revogação/correção e autoria local, sem inventar autenticação. |
| `FrozenPortfolio` | Tipo mínimo e hash existem; não há persistência do fluxo | Definir conteúdo congelado completo, relação com revisão/aprovação e escopo do hash. |
| Relatório pré-impressão | Épico 5, ainda inexistente | Definir se o relatório é projeção reproduzível, snapshot persistido ou artefato versionado, e seu vínculo com o hash. |
| Logs operacionais | Arquitetura prevê observabilidade | Definir eventos obrigatórios, correlação, retenção e separação entre diagnóstico e evidência de auditoria. |

### 4.3 Identidade, versão, imutabilidade e auditoria — decisões P

Nenhuma das decisões abaixo está fechada por este plano:

- **P-01 — Agregado persistido:** quais artefatos formam uma revisão completa e
  quais permanecem projeções deriváveis.
- **P-02 — Identidades:** formato e escopo da identidade da carteira, revisão,
  execução, auditoria, aprovação e congelamento; relações e unicidades entre
  elas.
- **P-03 — Escopo do hash:** confirmar se o `portfolio_hash` atual identifica
  somente modalidade/estratégia/jogos ou se um novo contrato versionado deve
  cobrir também concurso, custos, cotas, snapshots, auditorias, avisos e
  aprovação. O hash existente não pode ser ampliado silenciosamente.
- **P-04 — Versionamento:** versões de contrato, algoritmo, modalidade,
  estratégia, catálogo e schema que cada registro deve fixar, além da política
  de leitura de versões anteriores.
- **P-05 — Revisão:** evento que abre nova revisão, relação com a revisão
  anterior e destino de uma revisão obsoleta ou rejeitada.
- **P-06 — Imutabilidade:** quais registros são append-only e quais metadados
  operacionais podem mudar; correções devem criar nova evidência, não reescrever
  fatos imutáveis.
- **P-07 — Auditoria da aprovação:** evidências mínimas e regra que separa
  achado bloqueante de aviso. Esta é uma decisão de Produto pendente do Épico 5.
- **P-08 — Atomicidade:** limite exato de cada transação para impedir revisão,
  auditoria, aprovação ou congelamento parcial; política de idempotência e
  repetição após falha.
- **P-09 — Concorrência:** política para duas operações locais simultâneas,
  detecção de revisão desatualizada e resposta a banco ocupado.
- **P-10 — Recuperação:** comportamento diante de migration interrompida,
  corrupção, referência ausente, escrita incompleta, disco cheio e versão de
  schema incompatível; definir backup/restauração sem apagar evidência.
- **P-11 — Erros públicos:** códigos tipados e estáveis para validação,
  conflito, não encontrado, revisão obsoleta, violação de estado, integridade,
  banco ocupado, incompatibilidade de versão, falha de escrita e recuperação.
  Mensagens não podem ser usadas para controle de fluxo.
- **P-12 — Limites e retenção:** limites de tamanho/quantidade por carteira,
  revisão, jogos, auditorias, payload e banco; retenção/arquivamento e custo de
  verificação de integridade. Valores devem vir de evidência e aprovação, não
  deste plano.

### 4.4 Contrato transacional mínimo a especificar

A futura story deve declarar, sem depender da disposição física do banco:

1. preflight completo e validação de referências antes da primeira escrita;
2. unidade atômica de criação de carteira/revisão e de aprovação/congelamento;
3. invariantes verificadas dentro da transação, inclusive revisão corrente,
   vínculos e hash;
4. resultado idempotente ou conflito determinístico para repetição do mesmo
   comando;
5. rollback integral em falha, sem `FrozenPortfolio` ou aprovação parcial;
6. leitura coerente de uma revisão e seus artefatos;
7. trilha append-only para fatos auditáveis e correções por nova versão;
8. diagnóstico observável sem registrar conteúdo sensível inexistente no MVP.

### 4.5 Decisão de reuso/skill/modalidade

| Capacidade | Decisão arquitetural | Limite |
| --- | --- | --- |
| Contrato persistido de carteira/revisão | **Criar contrato reutilizável** e versionado no domínio | Independente de SQLite e de modalidade. |
| Acesso SQLite, migrations e transações | **Reutilizar** `@boloes/data-access` e seus padrões comprovados | Nova migration somente na futura story; nenhuma neste plano. |
| Hash/canonização e `FrozenPortfolio` | **Reutilizar e versionar de forma compatível** `@boloes/domain-core` | Proibido alterar a semântica do hash existente sem novo contrato/versão. |
| Catálogo, snapshots, resultados e estratégia | **Reutilizar contratos existentes** por identidade/versionamento | Não copiar JSON sem decidir referência versus snapshot semântico. |
| Regras/preços da modalidade | **Restringir ao adaptador da modalidade** | Persistência não interpreta preço ou regra Lotofácil. |
| Skill AIOX dedicada | **Não criar neste planejamento** | Contratos, testes de integração e gates serão a fonte de verdade; reavaliar somente se surgir workflow repetível entre projetos, não por antecedência. |

### 4.6 Definition of Ready do Enabler P

- [ ] P-01 a P-12 decididas pelos responsáveis e registradas em contrato
  arquitetural versionado.
- [ ] Story independente criada por SM/PO com critérios de aceite, limites,
  riscos, testes, dependências e File List.
- [ ] Contratos finais de 4.10 e dos artefatos 4.x que entrarão na revisão estão
  disponíveis e sem campos ambíguos.
- [ ] Conteúdo normativo de revisão, aprovação e `FrozenPortfolio` aprovado por
  Produto/PO, inclusive achados bloqueantes versus avisos.
- [ ] Compatibilidade do hash atual avaliada; qualquer evolução possui versão e
  vetor de teste canônico.
- [ ] Plano de testes cobre atomicidade, rollback, idempotência, concorrência,
  imutabilidade, integridade referencial, versões anteriores e falhas de
  recuperação.
- [ ] Limites possuem justificativa/benchmark e comportamento de rejeição antes
  da escrita.
- [ ] Revisão de arquitetura e validação PO resultam em `PASS`/`GO` antes de
  mover a story para `Ready`.

### 4.7 Critério de saída do gate P

O gate somente passa quando a futura implementação tiver contrato público,
migration aditiva/transacional, comandos CLI-first, testes de contrato e de
falha, documentação de compatibilidade e QA `PASS`. Nenhum registro parcial
pode sobreviver a erro. A passagem do gate não aprova relatório, UI ou impressão.

## 5. Enabler I — contrato IPC Tauri/TypeScript ↔ Python

### 5.1 Fronteira pretendida

O IPC é um adaptador local para operações matemáticas pesadas explicitamente
autorizadas. TypeScript permanece dono de validação de entrada, domínio,
persistência, estados, hash, aprovação e exposição por CLI/UI. Python recebe
somente um payload matemático validado e devolve eventos previstos pelo
contrato. Nenhum consumidor conversa diretamente com o processo fora desse
adaptador.

O protocolo deve funcionar primeiro por um caso de uso CLI e por testes de
contrato. Tauri reutiliza o mesmo adaptador depois; a interface não cria outro
envelope nem interpreta `stdout` de maneira independente.

### 5.2 Decisões I ainda pendentes

- **I-01 — Proprietário do processo:** definir qual camada inicia, supervisiona
  e encerra Python no CLI e no desktop, incluindo a fronteira com o runtime
  Tauri/Rust. Não presumir que o frontend tem acesso irrestrito ao sistema.
- **I-02 — Transporte e framing:** stdin/stdout está indicado na arquitetura,
  mas faltam decisão normativa de framing, codificação, delimitação, canal de
  diagnóstico e comportamento diante de linha/mensagem inválida ou truncada.
- **I-03 — Envelope:** campos obrigatórios de correlação, versão do contrato,
  operação, versão do motor/algoritmo, payload e capacidades; regra para campos
  desconhecidos e negociação de compatibilidade.
- **I-04 — Serialização canônica:** representação de inteiros, frações,
  percentuais, listas, objetos, chaves, Unicode e ausência de ponto flutuante
  ambíguo; material exato usado em hashes ou vetores de conformidade.
- **I-05 — Operações autorizadas:** whitelist fechada por versão. O exemplo
  `generate | optimize | coverage` em `docs/architecture.md` não autoriza a
  migração dos motores atuais. Cada operação exige contrato estável, necessidade
  comprovada e teste de equivalência com a semântica aprovada.
- **I-06 — Eventos:** união discriminada e ordem válida de `accepted`,
  progresso, resultado e erro; total/unidade/fase, monotonicidade e condição
  terminal.
- **I-07 — Cancelamento e encerramento:** sinal do chamador até o processo,
  cooperação, prazo de graça, encerramento forçado, limpeza e exit codes; nunca
  publicar resultado depois de cancelado.
- **I-08 — Erros públicos:** separação tipada entre request inválido, operação
  não suportada, incompatibilidade de versão, falha de protocolo, falha de
  cálculo, limite, timeout quando aplicável, cancelamento, crash e resposta
  inválida. Mensagens e traceback são diagnóstico, não contrato de controle.
- **I-09 — Resultado:** validação Zod no retorno, versões/proveniência
  obrigatórias, resultado único e proibição de parcial em erro/cancelamento.
- **I-10 — Limites:** tamanho da mensagem/payload/resultado, quantidade de jobs,
  concorrência, memória, CPU, tempo e volume de progresso. Cada operação pode
  manter teto próprio já aprovado; o IPC não os aumenta implicitamente.
- **I-11 — Packaging:** Python embutido versus runtime instalado, versão exata,
  dependências/lock, descoberta do executável, plataformas suportadas,
  integridade do bundle, atualização compatível e diagnóstico quando ausente.
- **I-12 — Isolamento:** política executável para impedir acesso do payload a
  banco, histórico bruto, paths e credenciais; diretório de trabalho, arquivos
  temporários, ambiente herdado, rede, permissões e sanitização de logs.
- **I-13 — Ciclo de vida:** inicialização por job ou processo duradouro,
  healthcheck/capabilities, job órfão, reinício, backpressure e encerramento do
  app.
- **I-14 — Conformidade:** fixtures canônicas comuns TypeScript/Python,
  determinismo, ordem, hashes, limites, progresso/cancelamento, entradas
  malformadas, crash e compatibilidade entre versões.

### 5.3 Isolamento obrigatório da informação

O request matemático não pode carregar:

- caminho do SQLite, handle/conexão ou consulta de banco;
- resultados históricos brutos ou mecanismo para consultá-los;
- caminho arbitrário de entrada/saída, diretório de impressão ou template;
- credencial, token, cookie ou configuração de fonte CAIXA;
- decisão de aprovação, transição de estado ou permissão para persistir;
- conteúdo de relatório, PDF, UI ou dados de participante/pagamento.

O adaptador TypeScript resolve referências persistidas, valida o payload e
envia somente dados matemáticos necessários à operação autorizada. A resposta
Python também não pode instruir escrita no banco ou mudança de estado. Como o
enforcement de filesystem, ambiente e rede depende do packaging escolhido, sua
forma concreta permanece na decisão I-12 e deve ser testada.

### 5.4 Decisão de reuso/skill/modalidade

| Capacidade | Decisão arquitetural | Limite |
| --- | --- | --- |
| Envelope, eventos e erros IPC | **Criar contrato reutilizável**, estrito e versionado | Compartilhado por operações e modalidades; payloads permanecem discriminados. |
| Validação TypeScript | **Reutilizar Zod e contratos públicos existentes** | Validar request e resposta nos dois lados da fronteira. |
| Progresso/cancelamento/limites | **Reutilizar a semântica aprovada de cada operação** | Não uniformizar removendo timeout, teto ou unidade específica. |
| Algoritmos existentes | **Reutilizar, não duplicar** contratos e vetores de regressão | Python só implementa operação autorizada; não cria nova regra matemática. |
| Adaptação por modalidade | **Restringir ao adaptador da modalidade** | O envelope não contém constantes Lotofácil nem aceita outra modalidade por inferência. |
| Banco, histórico, paths e credenciais | **Restringir ao host TypeScript e fora do payload** | Python não recebe acesso direto nem identificador resolvível como caminho. |
| Skill AIOX dedicada | **Não criar neste planejamento** | Contrato e suíte de conformidade são a fonte de verdade; reavaliar apenas após workflow estável/repetido. |

### 5.5 Definition of Ready do Enabler I

- [ ] I-01 a I-14 decididas e registradas em contrato arquitetural versionado.
- [ ] Story independente criada por SM/PO com critérios de aceite, limites,
  riscos, testes, dependências e File List.
- [ ] Primeira operação autorizada e necessidade de Python aprovadas sem
  ampliar o escopo funcional de seu contrato existente.
- [ ] Responsabilidade de spawn/supervisão em CLI e Tauri definida e revisada
  por Arquitetura/DevOps.
- [ ] Envelope, framing, serialização, eventos, erros e compatibilidade possuem
  schemas/fixtures de conformidade planejados para TypeScript e Python.
- [ ] Packaging e matriz de plataformas têm estratégia verificável, versões
  travadas e diagnóstico de ausência/incompatibilidade.
- [ ] Limites e política de cancelamento/crash têm testes negativos e não
  permitem resultado parcial.
- [ ] Isolamento de banco, histórico, paths e credenciais possui critérios de
  teste objetivos.
- [ ] Revisão de arquitetura e validação PO resultam em `PASS`/`GO` antes de
  mover a story para `Ready`.

### 5.6 Critério de saída do gate I

O gate somente passa quando a futura implementação tiver protocolo público,
runner CLI-first, worker Python empacotável, suíte de conformidade cruzada,
testes de progresso/cancelamento/crash/limites, observabilidade sem contaminar o
canal de resultado e QA `PASS`. A passagem do gate autoriza apenas as operações
expressamente listadas na versão entregue; não autoriza UI, persistência pelo
worker ou migração dos demais motores.

## 6. Riscos e controles exigidos

| Risco | Impacto | Controle exigido antes/depois da implementação futura |
| --- | --- | --- |
| Ampliar silenciosamente o significado de `portfolio_hash` | Saídas com mesmo nome e identidades incompatíveis | P-03, versão nova quando necessária e vetores canônicos de regressão. |
| Misturar aposta-fonte e ocorrência expandida | Dupla contagem de custo ou carteira ambígua | P-01 e P-02 devem fixar a representação autoritativa; reutilizar a decisão da 4.10. |
| Aprovar auditoria obsoleta | Congelamento de revisão diferente da auditada | Vínculo imutável entre revisão, auditorias e aprovação, verificado na mesma transação. |
| Escrita parcial ou retry duplicado | Carteira/freeze inconsistente | P-08, rollback, idempotência/conflito determinístico e testes com falha injetada. |
| Corrupção, lock ou incompatibilidade de schema | Indisponibilidade ou perda de evidência local | P-09/P-10, recuperação documentada, diagnóstico e proibição de apagamento silencioso. |
| Crescimento ilimitado do banco/payload | Degradação ou falha de disco/memória | P-12 e I-10 com limites medidos e rejeição previsível. |
| Drift TypeScript/Python | Resultado matemático divergente | I-03/I-04/I-14, fixtures comuns, versões e equivalência semântica. |
| Logs Python em `stdout` | Corrupção do protocolo | I-02/I-06: canal de resultado reservado e diagnóstico separado. |
| Cancelamento/crash deixa processo ou resultado tardio | Consumo residual ou publicação inválida | I-07/I-13, supervisão, limpeza e terminalidade testada. |
| Packaging depende do ambiente do operador | Desktop funciona apenas na máquina de desenvolvimento | I-11, bundle/descoberta e matriz de plataforma verificáveis. |
| Worker acessa banco, histórico, path ou credencial | Quebra de separação e superfície de segurança | I-12, payload mínimo, ambiente restrito e testes de isolamento. |
| UI contorna contratos CLI/Core | Regras duplicadas e estados divergentes | UI somente após gates; chamadas pelos mesmos casos de uso e contratos. |
| Massas de 15 vazam para 16–20 | Regra matemática inválida | 4.11 obrigatória antes de 4.12; adaptador Lotofácil versionado e testes por tamanho. |

## 7. Decisões ainda requeridas

### Produto/PO

1. Definir como os resultados das Stories 4.11/4.12, já posicionadas antes do
   Épico 5, participam do primeiro conteúdo congelável e de suas auditorias.
2. Classificar achados de auditoria em bloqueios e avisos para aprovação.
3. Definir o conteúdo semântico mínimo de uma revisão, do ato de aprovação e da
   `FrozenPortfolio`, inclusive concurso, custo/cotas e avisos.
4. Definir correção/revogação local de aprovação sem inventar usuário,
   autenticação ou assinatura não previstos no MVP.
5. Definir retenção/arquivamento observável, sem autorizar exclusão silenciosa.

### Arquitetura/Data/QA/DevOps

1. Fechar P-01–P-12 e I-01–I-14 após as decisões de Produto correspondentes.
2. Definir contrato e compatibilidade antes de qualquer schema físico ou código.
3. Escolher packaging e modelo de supervisão Python com evidência de plataforma;
   nenhuma tecnologia adicional é aprovada por este plano.
4. Definir testes de recuperação, segurança, desempenho e conformidade que
   materializem os dois gates.

## 8. Fora do escopo

- Alterar ou reabrir a Story 4.9.
- Implementar FR-06, políticas/massas ou geração 16–20.
- Desenhar schema físico, tabelas, colunas, índices ou migrations.
- Persistir, aprovar ou congelar carteira neste documento.
- Implementar Tauri, React, Python, NumPy, IPC ou packaging.
- Definir layout da capa/tela inicial; seu planejamento pertence à UX.
- Implementar relatório, aprovação, `FrozenPortfolio`, revisão ou reimpressão.
- Gerar PDF, calibrar ou homologar impressão física; esses itens permanecem no
  Épico 6.
- Criar pagamento, integração financeira, participantes, autenticação ou
  backend remoto.

## 9. Parecer arquitetural

**Decisão:** `CONDITIONAL — NOT READY FOR IMPLEMENTATION`.

O projeto possui padrões locais de persistência e contratos matemáticos
suficientes para decompor os dois enablers, mas ainda não para implementá-los.
O Enabler P depende das decisões P-01–P-12 e dos contratos de backlog que
alimentarão a revisão. O Enabler I depende das decisões I-01–I-14, especialmente
operação inicial, framing, packaging, supervisão e isolamento. A interface do
Épico 5 pode ser planejada em UX, mas não implementada antes dos dois gates.

— Aria, arquitetando o futuro 🏗️
