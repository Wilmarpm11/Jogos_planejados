# Parser da página pública Lotofácil CAIXA

O parser `@boloes/result-ingestion` interpreta apenas conteúdo HTML/textual já
capturado da página pública oficial da Lotofácil. Ele não abre conexões nem faz
download. A coleta da Story 3.4 chama esse parser por uma fronteira separada e
mantém o parser puro e testável com snapshots locais.

Marcadores exigidos: `Resultado Concurso <número> (dd/mm/aaaa)` e quinze dezenas
entre 01 e 25, únicas. A versão atual também preserva local e município/UF quando
o texto `Sorteio realizado no ... em ...` estiver presente. Placeholders Angular,
marcadores ausentes, quantidade errada, repetição e dezenas fora do universo são
rejeitados.

```text
npm run cli -- data parse-lotofacil-page --input pagina-lotofacil.html
```

O resultado normalizado informa `sourceUrl`, `parserVersion` e validações. A
Story 3.1 continua sendo a única responsável por gravar proveniência e snapshots;
as Stories 3.3 e 3.4 conectam, respectivamente, a importação local e a coleta
com timeout/fallback a esse contrato, sem mover rede ou persistência para o parser.

Em verificação direta em 2026-08-30, a URL oficial retornou no HTML bruto os
placeholders Angular `{{resultado.numero}}` e `{{resultado.dataApuracao}}`. O
parser os rejeita corretamente e permanece disponível somente para snapshots
HTML locais.

Para a sincronização automática do resultado mais recente, o produto autorizou
em 2026-08-30 uma exceção restrita à URL exata
`https://servicebus2.caixa.gov.br/portaldeloterias/api/lotofacil`. O transporte
HTTP e a persistência existentes são reutilizados; um parser JSON separado e
versionado valida modalidade, concurso, data e quinze dezenas únicas de 01 a 25.
Essa decisão não autoriza outros endpoints, catálogo, histórico ou automação de
navegador.
