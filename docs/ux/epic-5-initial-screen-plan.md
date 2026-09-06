# Plano UX conceitual — capa/tela inicial do Épico 5

**Status:** Planejamento UX; sem autorização para implementação
**Escopo:** Arquitetura de informação e preparação do design da primeira tela
**Dependência bloqueante:** Fundação técnica de persistência local e contrato IPC
Tauri/TypeScript/Python especificada, aprovada, implementada e validada
**Referências:** [PRD](../prd.md), [Arquitetura](../architecture.md),
[invariantes de produto](../architecture/product-invariants.md) e
[análise de encerramento do Épico 4](../epic-4-closure-analysis.md)

## 1. Objetivo deste plano

Preparar a investigação e o desenho da capa/tela inicial do desktop sem antecipar
regras de negócio, persistência, integração entre processos ou implementação de
interface. A tela deverá orientar o operador dentro do fluxo já definido pelo
produto, sem se tornar fonte de verdade para cálculo, status, aprovação ou
congelamento.

Este documento não escolhe layout, CTA, métricas, identidade visual nem
comportamento final. Onde os artefatos existentes não determinam uma solução, o
item permanece registrado como decisão pendente de Produto/UX.

## 2. Limite obrigatório de sequência

A capa pode ser pesquisada, modelada conceitualmente e prototipada em baixa
fidelidade agora. Sua implementação é proibida até que:

1. a fundação técnica de persistência local e do contrato IPC
   Tauri/TypeScript/Python tenha story e contrato aprovados para desenvolvimento;
2. a fundação tenha sido implementada e validada, incluindo identidades,
   versionamento, auditoria, erros, limites, cancelamento e ausência de resultado
   parcial onde aplicável;
3. os casos de uso que a tela vier a expor já estejam funcionais pela CLI,
   conforme a ordem `CLI -> observabilidade -> UI`;
4. os modelos de leitura da interface possam derivar de contratos versionados,
   sem consulta direta a tabelas, reprodução de cálculo ou inferência de estado
   no frontend.

A Story 4.9 e seu contrato permanecem intocados. FR-06, políticas/massas e
geração 16–20, relatório, aprovação/congelamento, impressão e conferência não
são implementados por este plano.

## 3. Evidências e restrições já fixadas

- O produto é desktop e local-first; não há backend remoto, autenticação,
  pagamentos ou cadastro de participantes no MVP.
- O fluxo de negócio é sequencial: sincronizar dados, selecionar modalidade,
  gerar, otimizar, auditar, conferir relatório, aprovar/congelar, imprimir e
  conferir resultado.
- A interface é uma superfície posterior à CLI e deve usar os mesmos casos de
  uso, sem incorporar decisões matemáticas.
- Os estados de carteira já nomeados são `RASCUNHO`, `AUDITADA`, `APROVADA`,
  `CONGELADA`, `IMPRESSA` e `CONFERIDA`.
- Pesquisa, experimental e produção precisam ser distinguíveis sem linguagem de
  previsão ou promessa de vantagem futura.
- Quando a sincronização falhar, um último snapshot válido pode sustentar a
  operação com alerta; a falha não pode substituir dados válidos.
- Somente uma `FrozenPortfolio`, identificada por `portfolio_hash`, pode seguir
  para exportação, impressão ou conferência. A interface não pode regenerar,
  reordenar ou alterar seus jogos.
- A acessibilidade mínima é WCAG AA, com operação por teclado e estados
  comunicados também por texto, nunca somente por cor.
- Ainda não existe `apps/desktop` no repositório. Portanto, não há componentes,
  tokens, padrões visuais ou comportamento brownfield a assumir como base.

## 4. Papel possível da tela inicial — decisão ainda aberta

Os artefatos chamam essa superfície de dashboard, mas não determinam sua função
primária. Três direções devem ser comparadas antes do wireframe:

| Alternativa conceitual | Intenção | Dependência/risco a validar |
| --- | --- | --- |
| Orientação por fluxo | Apresentar o estágio operacional e os próximos contextos disponíveis | Pode induzir uma ação como “recomendada” se a regra de habilitação não vier do domínio |
| Visão de situação | Resumir estado de dados locais, carteira em foco e operações em andamento | Depende de modelos de leitura e definição aprovada do que é relevante, atual ou bloqueante |
| Retomada de trabalho | Permitir que o operador reencontre um contexto persistido | Depende de identidade, ordenação, revisão ativa e política de retomada ainda inexistentes |

Produto deve decidir se uma dessas direções é primária, se haverá composição
entre elas e qual informação tem precedência. Nenhuma delas autoriza, por si só,
um CTA ou uma regra de navegação.

## 5. Arquitetura de informação conceitual

Antes de definir regiões visuais, a pesquisa deve validar se a primeira tela
precisa representar os seguintes grupos de informação:

1. **Contexto operacional:** modalidade, concurso, carteira/revisão em foco e
   estágio do fluxo, somente quando essas identidades existirem nos contratos.
2. **Confiabilidade dos dados:** existência do snapshot válido, proveniência,
   versão e condição de sincronização em linguagem compreensível.
3. **Continuidade do trabalho:** possibilidade de iniciar, localizar ou retomar
   um contexto. Quais dessas ações existem e como são nomeadas são decisões
   pendentes.
4. **Estado das operações:** progresso, conclusão, cancelamento ou falha apenas
   para operações realmente expostas pelo IPC e por casos de uso CLI existentes.
5. **Acesso ao fluxo do produto:** destinos já previstos no PRD — criação de
   carteira, estratégia/geração, auditoria/relatório,
   aprovação/congelamento, impressão, resultados, laboratório e configurações —
   sem decidir ainda menu, hierarquia, ordem, rótulos ou disponibilidade.
6. **Limites e avisos:** distinção entre pesquisa, experimental e produção,
   dados anteriores ainda válidos e impedimentos de progressão derivados do
   domínio.

Esses grupos são um inventário para validação, não um layout. A presença,
prioridade e granularidade de cada grupo dependem das decisões da seção 11.

## 6. Estados que o design precisa cobrir

| Estado a planejar | Evidência disponível | O que o design deve resolver depois | Decisão ainda necessária |
| --- | --- | --- | --- |
| Vazio/primeiro uso | Uma tela local pode não ter carteira ou snapshot disponível | Explicar a condição sem apresentar dados fictícios e oferecer um caminho compreensível, caso exista no contrato | O que constitui “vazio”; qual ação é permitida; se modalidade ou sincronização vem primeiro |
| Dados locais válidos | Snapshots válidos e versionados já fazem parte da arquitetura | Tornar origem, versão e condição compreensíveis sem excesso técnico | Quais campos aparecem e qual nível de detalhe/proveniência é necessário na capa |
| Último dado válido após falha de sincronização | PRD/NFR-03 exigem fallback e alerta | Diferenciar “válido, porém não recém-sincronizado” de erro incapacitante por texto e semântica | Critério de desatualização, mensagem, severidade e quais operações continuam permitidas |
| Falha sem fallback utilizável | A fundação futura deve definir erros e recuperação | Comunicar causa acionável sem inventar recuperação ou esconder contexto | Taxonomia, mensagem pública, repetição/retry e escalonamento devem vir dos contratos |
| Carteira em estados do ciclo de vida | Seis estados estão definidos no PRD/arquitetura | Evitar confusão entre rascunho, auditada, aprovada e congelada, sobretudo quanto à imutabilidade | Quais estados aparecem na capa e quais transições podem ser iniciadas a partir dela |
| Cálculo em andamento | Operações pesadas existentes usam progresso e cancelamento | Exibir fase, unidades, total e cancelamento somente quando o contrato IPC os expuser | Se a capa observa operações globais ou apenas direciona para a tela de origem; política após reabertura |
| Cálculo cancelado ou falho | Contratos existentes proíbem resultado parcial em operações aplicáveis | Não sugerir que um artefato parcial é utilizável | Persistência de tentativas, retenção de erro e ação de recuperação |
| Resultado disponível | Relatório/aprovação serão construídos no Épico 5 | Indicar existência e versão sem substituir a tela própria nem recalcular | Qual resultado é resumível e o que exige navegação para inspeção completa |
| Conteúdo desatualizado por versão | Mudanças de regras, preços, estratégia ou parâmetros criam revisão | Diferenciar carteira histórica íntegra de contexto atual incompatível | Regras de compatibilidade, severidade e ações permitidas dependem da fundação e do domínio |

Estados de carregamento visual, skeletons, notificações, persistência de posição e
transições animadas não estão definidos e não devem ser presumidos.

## 7. Acessibilidade e inclusão — critérios mínimos de planejamento

O futuro design deve demonstrar conformidade WCAG AA e incluir no handoff:

- ordem de foco e navegação integral por teclado para todos os controles;
- foco visível e previsível, sem armadilhas de teclado;
- estrutura semântica e hierarquia de títulos compreensíveis;
- nomes, instruções e mensagens de erro textuais para controles e estados;
- contraste AA para texto, ícones essenciais, foco e componentes interativos;
- estados, severidade e progresso que não dependam exclusivamente de cor;
- anúncio acessível de mudanças assíncronas relevantes, sem excesso de
  interrupções;
- alternativa a movimento não essencial e respeito às preferências do sistema,
  se movimento vier a ser proposto;
- alvos, densidade e legibilidade avaliados no ambiente desktop;
- mensagens que distingam fato, aviso, condição experimental e erro, sem
  linguagem preditiva.

Os valores de contraste, comportamento de leitores de tela, atalhos e critérios
de movimento deverão ser verificados no protótipo e na implementação. O
checklist AIOX referenciado pela configuração do agente UX não está presente no
repositório atual; a revisão futura deve usar uma fonte de verificação WCAG
versionada e aprovada pelo projeto.

## 8. Dependências

### Bloqueantes para implementação da tela

1. **Fundação de persistência local:** definição do que persiste, identidade de
   carteira/revisão/operação, versionamento, integridade, auditoria, leitura,
   falha e limites.
2. **Contrato IPC Tauri/TypeScript/Python:** envelopes canônicos de request,
   progresso, resultado, cancelamento e erro; compatibilidade de versões;
   ciclo de vida do processo e empacotamento local.
3. **Casos de uso CLI correspondentes:** a UI só pode observar/invocar
   capacidades que já tenham comportamento operacional fora dela.
4. **Modelos de leitura versionados:** devem ser definidos pelo domínio ou por
   uma camada de aplicação; a tela não lê tabelas SQLite diretamente.

### Dependências do conteúdo do Épico 5

- A Story 4.10/FR-06 fornece custo oficial, taxa e cotas necessários ao relatório;
  a capa não calcula nem infere esses valores.
- As Stories 4.11 e 4.12 definem e depois habilitam geração 16–20. Até sua
  conclusão, a interface não pode apresentar essa geração como disponível.
- Relatório, critérios de aprovação, `FrozenPortfolio` operacional e regras de
  revisão precisam de stories e contratos próprios antes de aparecerem como
  ações funcionais.
- Impressão física/PDF e conferência permanecem em épicos posteriores e não são
  antecipadas pela capa.

## 9. Decisão de reuso, restrição e skills

| Elemento | Decisão neste plano | Limite |
| --- | --- | --- |
| Contratos de negócio | **Reutilizar** contratos versionados de domínio, estados, hash, auditorias, snapshots e futuro `FrozenPortfolio` operacional | UX não cria nem redefine cálculo, aprovação, persistência, erro ou transição de estado |
| Contrato IPC/persistência | **Reutilizar quando aprovado** pela fundação técnica | A tela não cria um protocolo paralelo nem acessa Python/SQLite fora da camada definida |
| Modelo de apresentação | **Restringir à UI** como adaptação derivada de contratos públicos | Não vira fonte de verdade e não duplica regra por modalidade |
| Skill dedicada | **Não criar** | O planejamento não introduz capacidade executável reutilizável; revisões UX/A11y existentes são suficientes |
| Design tokens e componentes | **Decisão futura** | Não criar ou selecionar sistema, biblioteca, tokens ou variantes antes de branding, inventário visual e arquitetura frontend aprovados |
| Regra por modalidade | **Reutilizar a identidade da modalidade; restringir a apresentação quando necessário** | Nenhuma regra Lotofácil é codificada na capa ou promovida ao Core pela UX |

## 10. Critérios de pronto do design

O planejamento da capa poderá ser considerado pronto para handoff de
implementação somente quando houver evidência de que:

1. Produto aprovou a função primária da tela, seu público operacional, a
   hierarquia de informação e o modelo de navegação.
2. Todas as decisões pendentes da seção 11 estão respondidas ou explicitamente
   adiadas sem deixar comportamento implícito.
3. A fundação técnica bloqueante está concluída e seus contratos públicos podem
   ser mapeados para cada dado, estado, ação, erro e progresso mostrado.
4. Um fluxo conceitual e wireframes de baixa fidelidade cobrem os estados da
   seção 6, inclusive vazio, fallback válido, falha e operação em andamento
   quando aplicáveis.
5. O inventário de conteúdo registra fonte, versão, prioridade, linguagem e
   condição de visibilidade de cada informação, sem números demonstrativos
   apresentados como reais.
6. O protótipo define foco, teclado, semântica, avisos não cromáticos e critérios
   de contraste WCAG AA; a revisão acessível não tem bloqueadores conhecidos.
7. Rótulos e mensagens foram revisados para não alegar previsão, probabilidade
   futura ou recomendação matemática inexistente.
8. A distinção entre rascunho, auditada, aprovada e congelada está clara, e
   nenhuma interação permite alterar uma `FrozenPortfolio`.
9. O design identifica explicitamente os destinos ainda indisponíveis, sem
   simular funcionalidades de FR-06, 16–20, relatório, aprovação, impressão ou
   conferência antes de suas respectivas stories.
10. PO, UX e Arquitetura aprovam o handoff; QA recebe cenários de teste de estado,
    teclado, contraste e integração contratual.

Atender a estes critérios torna o design elegível para uma story de
implementação. Não supera, sozinho, o bloqueio técnico estabelecido na seção 2.

## 11. Decisões pendentes explícitas

### Produto e operação

1. A tela inicial é principalmente uma capa de orientação, um painel de situação
   ou um ponto de retomada de trabalho?
2. Quem é o operador primário e quais diferenças de experiência ou conhecimento
   precisam ser atendidas?
3. Qual contexto deve existir ao abrir: nenhuma seleção, última modalidade,
   última carteira/revisão ou outra identidade persistida?
4. O que constitui trabalho “recente”, “ativo” ou “retomável”, e qual ordenação é
   canônica?
5. Quais estados da carteira aparecem na capa e quais são apenas detalhes nas
   telas especializadas?
6. Quais condições bloqueiam avanço e quais são apenas avisos? Em especial, essa
   decisão ainda é necessária para os achados de auditoria antes da aprovação.
7. Como o operador distingue uma carteira histórica íntegra de dados atuais
   incompatíveis ou mais recentes?
8. Uma operação em andamento deve ser observável na capa? Se sim, quais campos e
   ações vêm do contrato, e o que acontece após fechar/reabrir o app?

### Navegação e conteúdo

9. Qual é a arquitetura de navegação: global persistente, orientada por etapas,
   contextual ou uma combinação validada?
10. Qual é a ordem e a nomenclatura dos destinos já previstos no PRD?
11. Quais ações, se houver, podem começar na capa e quais exigem entrada na tela
    especializada? Nenhum CTA está aprovado neste plano.
12. “Bolão”, “carteira”, “aposta”, “jogo”, “revisão”, “auditoria” e
    “congelamento” precisam de glossário e microcopy aprovados?
13. Quanta proveniência técnica deve aparecer na capa e o que fica em uma visão
    de detalhes/auditoria?
14. Qual mensagem e qual caminho de recuperação se aplicam a primeiro uso, falta
    de snapshot, fallback válido, erro de persistência e incompatibilidade de IPC?
15. Como funcionalidades futuras aparecem antes de estarem disponíveis: ausentes,
    informativas ou desabilitadas? A regra deve evitar promessa enganosa.

### Branding e sistema visual

16. Nome exibido do produto, logotipo, assinatura, tom de voz e diretrizes de
    conteúdo ainda não estão definidos.
17. Paleta, tipografia, iconografia, densidade e linguagem visual ainda não estão
    aprovadas; nenhuma cor ou componente deve ser deduzido da modalidade.
18. Há referências de marca existentes que precisam ser preservadas ou restrições
    de uso das marcas CAIXA/Lotofácil?
19. Quais tamanhos mínimos de janela, escalas do sistema operacional e densidades
    de tela devem orientar o desktop?
20. Quais preferências de acessibilidade além do mínimo WCAG AA devem ser
    suportadas desde a primeira versão?

### Validação

21. Quem participará da validação do fluxo e quais tarefas reais serão usadas,
    sem inserir massas ou números fictícios como regra de negócio?
22. Qual evidência será suficiente para aprovar a direção: walkthrough com
    operadores, teste de usabilidade do protótipo ou outro método definido pelo
    Produto?
23. Métricas de usabilidade não estão definidas. Produto deve decidir se serão
    qualitativas, locais e/ou agregadas, respeitando o caráter local-first e sem
    introduzir telemetria remota por inferência.

## 12. Riscos e mitigação de planejamento

| Risco | Impacto | Mitigação antes da implementação |
| --- | --- | --- |
| Desenhar sobre identidades/estados ainda indefinidos | Retrabalho e divergência entre UI e persistência | Aprovar a fundação e mapear cada elemento ao contrato público |
| Duplicar regra no frontend | Cálculos ou habilitações inconsistentes com CLI | UI consome casos de uso e modelos de leitura; nenhuma lógica matemática local |
| Confundir falha de sincronização com dado inválido | Operador abandona snapshot utilizável ou confia em dado indevido | Definir taxonomia e continuidade no contrato; testar mensagens distintas |
| Confundir carteira aprovada com congelada | Saída mutável pode ser tratada como final | Representar estados por texto/semântica e impedir ações incompatíveis pelo domínio |
| Sugerir previsão ou vantagem | Viola invariantes e confiança do produto | Revisão de conteúdo e distinção clara de pesquisa/experimental/produção |
| Tornar cor a única portadora de estado | Falha de acessibilidade e interpretação | Texto, ícone/forma e semântica, com contraste e teclado validados |
| Sobrecarregar a primeira tela | Reduz orientação e aumenta erro operacional | Validar a função primária e aplicar divulgação progressiva após pesquisa |
| Fixar branding ou componentes cedo demais | Cria dívida visual sem evidência | Adiar tokens/componentes até decisões de marca e arquitetura frontend |
| Expor funcionalidades futuras como disponíveis | Promessa incorreta e fluxo quebrado | Vincular disponibilidade a capabilities versionadas e decidir tratamento de roadmap |
| Implementar UI antes de CLI/IPC/persistência | Superfície sem fonte de verdade auditável | Manter o bloqueio de sequência como critério formal da futura story |

## 13. Próximo passo de UX autorizado

Com as decisões de Produto das seções 4 e 11, UX pode preparar fluxo conceitual,
inventário de conteúdo e wireframes de baixa fidelidade. Mesmo aprovados, esses
artefatos continuam somente de planejamento até a fundação técnica atender aos
gates da seção 2. Não há autorização neste plano para criar componentes,
selecionar biblioteca visual, editar `apps/desktop` ou implementar a capa.
