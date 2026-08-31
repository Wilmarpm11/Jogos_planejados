# Perfis métricos históricos Lotofácil

## Finalidade

O `statistics-engine` converte um resultado já versionado no ledger em um perfil
do `MetricEngine` Lotofácil. Essa fronteira prepara dados observados para etapas
posteriores de coortes e lift, sem fazer agregação ou orientar geração.

## Contrato

Cada `HistoricalMetricProfileRecord` carrega `sourceResultId`,
`sourceSnapshotId`, `lotteryId`, `metricEngineVersion`, o perfil serializado e
o horário local de persistência. A proveniência é copiada do resultado do
ledger; não é aceita uma origem divergente.

## Persistência e compatibilidade

A migration SQLite `6` adiciona `historical_metric_profiles`. A chave única
`(source_result_id, metric_engine_version)` faz a derivação ser idempotente e
permite que uma nova versão do algoritmo coexista com o perfil anterior.
Triggers bloqueiam alteração ou remoção dos perfis já gravados.

## Limites

Os comandos locais derivam e consultam perfis de janelas 10/25/50/100/250 ou
completa. Eles não calculam frequência, coorte, lift, validação temporal,
estratégia ou geração; `PortfolioGenerator` não importa este módulo.
