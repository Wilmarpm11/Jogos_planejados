# Contrato de ciclo de vida de estratégias

## Finalidade

O registry local registra versões imutáveis de hipóteses e determina se uma
transição de estado é permitida. Ele implementa o ciclo de vida de FR-04 sem
avaliar dados históricos, coortes, lift, validação temporal ou geração.

## Contrato público

`StrategyConfigVersion` estende a configuração consumível pelo domínio com:

- `recordId`: identidade imutável da versão persistida;
- `previousRecordId`: versão que originou a transição, quando houver;
- `createdAt`: horário UTC local de persistência.

Os únicos estados são `DRAFT`, `EXPLORATORY`, `VALIDATING`, `HOLDOUT`,
`VALIDATED`, `PRODUCTION` e `REJECTED`. As transições aceitas são:

```text
DRAFT -> EXPLORATORY -> VALIDATING -> HOLDOUT -> VALIDATED -> PRODUCTION
                                                       \-> REJECTED
```

Somente `PRODUCTION` é elegível à geração automática. Essa indicação é um
resultado do registry; este módulo não chama nem recebe o gerador.

Os modos persistidos neste registro (`NEUTRAL`, `BALANCED`, `CONCENTRATED` e
`EXPERIMENTAL_SPECIAL`) descrevem a hipótese versionada de FR-04. Eles não são o
mesmo contrato dos modos resolvidos de FR-04.1 (`NEUTRAL`, `ADVANCED` e
`MANUAL_EXPERIMENTAL`), usados depois da seleção para comparação ou execução.

## Persistência

A migration SQLite `5` cria `strategy_config_versions`, com unicidade por
`strategy_id` e `version`, referência opcional à versão anterior e triggers que
bloqueiam `UPDATE` e `DELETE`. A tabela é consultada por identificador e por
versão mais recente; versões não são sobrescritas.

## Uso local

```text
boloes strategy create --id hipotese-neutra --version 1.0 --mode NEUTRAL --parameters parametros.json
boloes strategy transition --id hipotese-neutra --from-version 1.0 --version 1.1 --to EXPLORATORY
boloes strategy latest --id hipotese-neutra
```

Cada comando opera somente sobre SQLite local. Não usa rede, resultados CAIXA,
coortes, lift ou geração.
