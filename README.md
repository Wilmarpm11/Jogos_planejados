# Plataforma de Engenharia de Bolões

Fundação local-first para geração, auditoria, congelamento, impressão A4 e
conferência de carteiras. O produto não tenta prever sorteios.

## Pré-requisitos

- Node.js 24.14.0 ou superior;
- npm;
- Python 3.12+ e Rust serão exigidos antes das stories do motor matemático e do
  aplicativo Tauri.

## Comandos

```bash
npm ci
npm run lint
npm run typecheck
npm test
npm run cli -- --help
npm run cli -- diagnose
```

## Limites da fundação

Esta primeira story não implementa a fórmula Lotofácil, geração de jogos,
cobertura, sincronização CAIXA, PDF A4, desktop ou INJOLOCA. Os contratos
impedem que histórico bruto entre no pedido de geração. A arquitetura completa
está em [docs/architecture.md](docs/architecture.md).
