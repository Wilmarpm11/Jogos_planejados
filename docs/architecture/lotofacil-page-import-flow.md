# Fluxo local de importação da página Lotofácil

`data import-lotofacil-page` lê um snapshot HTML local, aplica o parser
versionado da Story 3.2 e encaminha a proveniência para a Story 3.1. Um resultado
válido é persistido como `VALIDATED` com snapshot; uma rejeição do parser é
registrada como `INVALID`, sem snapshot e sem afetar o último válido.

O comando não coleta a página. A coleta síncrona limitada da Story 3.4 é exposta
separadamente por `data sync-lotofacil-page`. Por decisão de produto em
2026-08-30, esse sincronizador usa somente o endpoint JSON exato do resultado
mais recente no domínio oficial da CAIXA, com timeout e fallback para o último
snapshot válido; agendamento, retry e alerta continuam fora deste contrato.

A página pública continua entregando placeholders Angular no HTML bruto e a
importação local os registra como `INVALID`. O sincronizador reutiliza o contrato
de transporte e persistência, mas usa parser JSON próprio e versionado. Payload
recebido e inválido é auditado como `INVALID`; falha de transporte é `FAILED` e
retorna o último snapshot válido. Nenhum outro endpoint nem browser automation é
autorizado.
