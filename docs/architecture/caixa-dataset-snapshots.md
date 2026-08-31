# Proveniência e snapshots de dataset CAIXA

## Finalidade

O contrato de importação registra a proveniência de um material já validado,
sem assumir formato, parser ou mecanismo de obtenção da CAIXA. Ele atende ao
fluxo local-first de FR-03: o produto pode abrir o último snapshot válido
enquanto a sincronização da Story 3.4 ocorre pela fronteira de coleta separada.

## Envelope manual normalizado

O comando recebe um JSON que atende a `manualDatasetImportSchema`:

```json
{
  "lotteryId": "lotofacil",
  "sourceUrl": "https://fonte-exemplo.invalid/lotofacil",
  "importedAt": "2026-08-30T12:00:00.000Z",
  "contentHash": "sha256:...",
  "parserVersion": "caixa-parser/1",
  "validations": ["arquivo-assinado"],
  "status": "VALIDATED"
}
```

`rawContent` pode substituir `contentHash`, mas ao menos uma referência ao
conteúdo é obrigatória. O horário deve estar em UTC (`Z`). `VALIDATED` cria um
snapshot; `INVALID` e `FAILED` permanecem como registros de auditoria e não
substituem o último snapshot válido.

## Uso local

```text
npm run cli -- data import --input envelope.json --db .data/boloes.sqlite
npm run cli -- data latest --lottery lotofacil --db .data/boloes.sqlite
```

As saídas retornam IDs, modalidade, URL, horário, versão do parser,
validações, status e referência ao conteúdo. A consulta não relê nem
reprocessa o arquivo de origem.

## Persistência e imutabilidade

A migration SQLite `2` adiciona `data_imports` e `dataset_snapshots` de forma
aditiva. `dataset_snapshots.data_import_id` é único e referencia a importação
que o originou. Inserções de importação validada e snapshot ocorrem na mesma
transação. Triggers bloqueiam `UPDATE` e `DELETE` nessas tabelas, preservando o
histórico local auditável.

Na abertura, migrations são executadas somente quando `app_metadata` registra
uma versão anterior à versão corrente. Operações de consulta em schema atual não
reescrevem metadata nem adquirem transação de escrita; escritas necessárias usam
um `busy_timeout` limitado para tolerar bloqueios transitórios.

## Limites desta story

Não há acesso de rede, scraping, parser de arquivo oficial, catálogo,
histórico, regras, preço, estratégia, geração, cobertura, impressão ou UI dentro
do contrato desta story. As Stories 3.2–3.4 implementam parser, importação e
sincronização versionados reutilizando este mesmo envelope de proveniência.
