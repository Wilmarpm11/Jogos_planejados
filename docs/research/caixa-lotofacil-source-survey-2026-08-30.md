# Levantamento de fonte CAIXA — Lotofácil

**Status:** evidência para validação do produto; não é ainda um contrato de
parser nem uma alteração do PRD.
**Data da consulta:** 2026-08-30
**Escopo:** desbloquear a decisão de fonte, campos e correção exigida pelo
PRD §11 antes de implementar sincronização ou parser.

## Fontes oficiais verificadas

| Uso | Fonte oficial | Evidência observada |
| --- | --- | --- |
| Página primária da modalidade | [Lotofácil — Portal Loterias CAIXA](https://loterias.caixa.gov.br/Paginas/Lotofacil.aspx) | Exibe resultado por concurso e disponibiliza a seção “Download de resultados”. |
| Regras do sorteio | [Regras dos Sorteios — Portal Loterias CAIXA](https://loterias.caixa.gov.br/Paginas/regras-sorteios.aspx) | Declara que a Lotofácil sorteia 15 números, sem repetição, no universo 01–25. |

O Portal oficial confirma que a modalidade tem resultados por concurso e um
download histórico. A URL final, o tipo MIME, o cabeçalho e o layout do arquivo
baixado não ficaram expostos pelo conteúdo público indexável consultado; eles
devem ser capturados numa amostra manual antes de o parser ser especificado.

## Campos efetivamente observáveis na página

A página contém um modelo de resultado com `numero`, `dataApuracao`,
`localSorteio`, `nomeMunicipioUFSorteio`, dezenas, dados do próximo concurso,
acumulados e `observacao`. Em resultados renderizados, também aparecem a
situação de acumulação, faixas de premiação, ganhadores e arrecadação.

Para um primeiro parser de **resultado**, a menor base que pode ser verificada
contra a fonte é:

| Campo candidato | Base da evidência | Regra verificável |
| --- | --- | --- |
| número do concurso | resultado por concurso | inteiro positivo e identidade do resultado |
| data da apuração | resultado por concurso | data presente no material de origem |
| dezenas sorteadas | resultado e regras | exatamente 15, únicas, entre 01 e 25 |
| local e município/UF | resultado por concurso | conservar como metadado de origem quando disponível |
| observação/situação | resultado por concurso | conservar sem inferir semântica financeira |

Os preços, limites de bolão, faixas e valores de prêmio também aparecem na
página, mas devem formar um **catálogo versionado separado**: eles podem mudar
e não devem alterar retroativamente um resultado ou uma carteira congelada.

## Lacunas que impedem congelar o parser hoje

1. A URL concreta do botão de download, sua extensão, codificação e estrutura
   de colunas não foram publicadas como especificação pela CAIXA nas fontes
   examinadas.
2. Não foi encontrada documentação oficial de API pública nem schema estável
   para o endpoint `servicebus2.caixa.gov.br`; portanto, ele não deve ser
   tratado como contrato oficial do produto.
3. A política oficial de correção/republicação de um concurso não foi localizada
   nas páginas verificadas. O sistema pode preservar versões, mas não deve
   inventar qual versão é “correta”.

## Validação manual pedida ao produto

Baixar uma vez o arquivo disponível em “Download de resultados” e registrar,
sem editar o conteúdo:

1. URL final após o clique e data/hora UTC da coleta;
2. nome/extensão, `Content-Type`, charset e hash SHA-256 do arquivo;
3. cabeçalho e três linhas representativas: uma inicial, uma regular e a mais
   recente;
4. como o arquivo sinaliza concurso, data, 15 dezenas, local, UF e eventual
   correção; e
5. confirmação de que o arquivo pode ser redistribuído/armazenado localmente
   para auditoria sob as condições de uso da CAIXA.

## Proposta de decisão para aprovação posterior

Após a validação manual, congelar uma versão de `CaixaLotofacilSourceProfile`
com a URL de download observada, assinatura de cabeçalho, codificação, campos
aceitos, fixture com hash e versão de parser. A regra de correção recomendada
para o produto — derivada de FR-03 e NFR-03, não atribuída à CAIXA — é registrar
cada coleta como nova importação; somente material validado cria novo
`DatasetSnapshot`, e nenhum snapshot anterior é alterado ou apagado.

Isso permite que a Story 3.2 implemente parser e sincronização sem depender de
endpoint não documentado: a página e o download oficial são a fonte, a fixture
capturada é a prova de compatibilidade, e a Story 3.1 já preserva o fallback
local quando a fonte falhar.
