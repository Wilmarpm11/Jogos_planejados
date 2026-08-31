# Contrato de seleção de coortes

O Core aceita os seletores genéricos `ALL_DRAWS`, `LAST_N_DRAWS`,
`CONTEST_RANGE` e `SPECIAL_DRAW_TYPE`. Coortes selecionam Draws por identidade
objetiva; métricas calculadas, dezenas e datas não participam da seleção.

Uma definição combina `lotteryId` e `selectorRule`. Cada resolução imutável
registra os Draw IDs ordenados por concurso decrescente, limites, contagem, hash
da composição e horário. `LAST_N_DRAWS` é reavaliado a cada resolução. A leitura
dos resultados e a gravação da resolução acontecem na mesma transação SQLite,
preservando um único snapshot lógico da composição materializada.

Quando um concurso possui versões em snapshots diferentes, a resolução usa
somente a versão mais recente por `persisted_at` e `rowid`. Assim, uma correção
preserva o registro antigo no ledger sem contar o mesmo concurso duas vezes.

Classificação especial é relação explícita entre resultado e tipo especial. O
Core não conhece tipos de uma modalidade; Lotofácil declara
`LOTOFACIL_INDEPENDENCIA` e a CLI valida esse tipo antes de registrá-lo.
