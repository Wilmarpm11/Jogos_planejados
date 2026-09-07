# Decision Log: Story 4.11

**Generated:** 2026-09-07T15:00:00Z
**Agent:** dev
**Mode:** Autonomous Development
**Story:** docs/stories/4.11.lotofacil-16-20-policies-and-test-masses.story.md
**Rollback reference:** `f04a9ecce4df946850a58cbd62d0bfeb380966dc`

## Context

Implementação local, determinística e auditável das políticas e massas
estruturais Lotofácil para `betSize` 15–20, preservando integralmente o
comportamento público v1 de 15 e sem iniciar geração 16–20.

## Decisions Made

### 1. Manter um mecanismo classificatório interno orientado por política

- **Tipo:** compatibilidade
- **Prioridade:** alta
- **Decisão:** wrappers v1 e APIs v2 delegam à mesma avaliação interna; a v1
  seleciona somente a política 15 congelada e mantém 16–20 não aplicável.
- **Razão:** evita duas implementações das regras sem recalibrar ou reinterpretar
  os resultados existentes de 15.

### 2. Reutilizar MetricEngine e ocupação na primeira passagem

- **Tipo:** arquitetura
- **Prioridade:** alta
- **Decisão:** métricas escalares e as seis distribuições de eixo são acumuladas
  durante a mesma visita produtiva por combinação.
- **Razão:** preserva as primitivas das Stories 2.1–2.2 e impede uma terceira
  enumeração oculta.

### 3. Estender combinatória com visita assíncrona cooperativa

- **Tipo:** operacional
- **Prioridade:** alta
- **Decisão:** a nova API conserva a ordem lexicográfica e o array reutilizado,
  cedendo o event loop e observando `AbortSignal` a cada no máximo 4.096 visitas.
- **Razão:** habilita progresso e SIGINT/130 sem armazenar o universo.

### 4. Separar artefatos públicos versionados do estado transitório

- **Tipo:** contrato
- **Prioridade:** alta
- **Decisão:** políticas, massas e índice usam schemas estritos, identidades por
  `betSize`, frações reduzidas, serialização canônica e SHA-256; histogramas e
  acumuladores internos nunca entram no resultado público.
- **Razão:** garante compatibilidade explícita, bytes determinísticos e
  publicação somente após reconciliação integral.

### 5. Congelar fixture e validar por oráculo independente

- **Tipo:** testes
- **Prioridade:** alta
- **Decisão:** a fixture é um arquivo estático sem auto-update; o oráculo usa DFS,
  métricas, seleção racional e agregações próprias, sem imports de runtime
  produtivo.
- **Razão:** evita fixture circular e comprova separadamente derivação e massas.

### 6. Preservar manifesto 1.0 e expor extensão 1.1 aditiva

- **Tipo:** versionamento
- **Prioridade:** alta
- **Decisão:** a API 1.0 permanece inalterada; a 1.1 inclui o manifesto legado e
  acrescenta referências ordenadas aos artefatos 15–20 verificados.
- **Razão:** consumidores antigos continuam reproduzíveis e novos consumidores
  recebem proveniência explícita.

### 7. Separar o desempate de extremos do desempate do núcleo

- **Tipo:** coerência matemática
- **Prioridade:** alta
- **Decisão:** o mesmo seletor racional recebe uma política explícita de
  desempate: regras E priorizam menor massa extrema; núcleo escolhe diretamente
  o limite que estreita o intervalo após empate de distância.
- **Razão:** o contrato §8 não aplica “menor cauda” ao núcleo. O empate real de
  k16/BORDER_COUNT entre limites 8 e 9 deve produzir `minInclusive: 9`.

## Verification

- `npm run lint` — PASS
- `npm run typecheck` — PASS
- teste focado — 28/28 PASS em 83,22 s, incluindo build CLI completo
- `npm test` — 27 arquivos, 252 testes PASS em 84,91 s
- `git diff --check` — PASS
- benchmark produtivo — 24.562 ms, pico RSS 117.587.968 bytes e 14.208.480 visitas
- oráculo separado — derivação 4.250 ms/7.104.240 visitas + massa
  4.270 ms/7.104.240 visitas
- fixture — 205.425 bytes, SHA-256
  `f64fd32bb00953a9b7dcff2d0b3159c8816b06fb17b6f7c9624c851fb9b710c1`
- gates Architect/QA/CodeRabbit — pendentes nesta etapa do log
- nenhum manifest ou `package-lock.json` alterado

## Consequences

A Story 4.12 poderá consumir políticas e massas explícitas por tamanho, mas
nenhum gerador, filtro, persistência ou integração foi criado nesta story.
Qualquer mudança futura de serialização, schema ou política exige o avanço das
versões normativas correspondentes e novas fixtures.
