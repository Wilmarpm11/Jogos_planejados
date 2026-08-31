# Contrato de StrategyConfig avançado

`StrategyConfig` é o objeto resolvido que separa a seleção de estratégia da
execução futura de uma carteira. Ele transporta identidade e versão, modalidade,
tamanho da aposta, modo, seed, alocação estrutural, coorte contextual,
restrições auxiliares, referências de hipótese, rótulo estatístico e a confirmação
manual necessária.

O contrato genérico conhece apenas os modos `NEUTRAL`, `ADVANCED` e
`MANUAL_EXPERIMENTAL`. Em particular, não conhece concursos, resultados,
coortes especiais ou faixas estatísticas de uma modalidade.

Para Lotofácil, o adaptador da modalidade valida as cinco chaves de alocação:
`zeroExtremes`, `oneExtreme`, `twoExtremes`, `threeExtremes` e
`fourPlusExtremes`; a soma deve ser exatamente 100. A CLI mostra também a massa
combinatória teórica existente, sem consultar histórico ou persistir uma
carteira.

Uma referência de hipótese que não esteja em `PRODUCTION` só é aceita no modo
`MANUAL_EXPERIMENTAL`, com reconhecimento explícito e rótulo experimental. Isso
não altera o status da hipótese e não é recomendação automática.

`MANUAL_EXPERIMENTAL` é um modo do contrato resolvido para execução manual. Ele
não substitui `EXPERIMENTAL_SPECIAL`, que pertence ao registro versionado da
hipótese de pesquisa em FR-04; a resolução apenas referencia a hipótese e mantém
seu lifecycle inalterado.

O comparador `strategy compare` e o gerador transitório `portfolio generate`
recebem somente esse contrato resolvido. Portanto, eles não leem `Draw`, coortes
ou dados históricos diretamente.

O comparador inicial apenas projeta configurações validadas. Para Lotofácil,
ele confronta a alocação solicitada com a massa combinatória canônica de cada
banda e sempre declara que não persistiu nem gerou carteira. Custo, cobertura,
redundância e demais indicadores só serão acrescentados quando seus respectivos
motores determinísticos existirem.
