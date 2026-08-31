# Manifesto canônico da fórmula Lotofácil

**Versão do manifesto:** 1.0.0
**Story de origem:** 2.5
**Escopo:** referência local, serializável e versionada das regras estruturais
Lotofácil já definidas pelo PRD.

## Composição

`getLotofacilCanonicalFormulaManifest` compõe, sem recalcular suas regras, a
definição 25/15, tamanhos de aposta 15–20, versão do MetricEngine, ocupação por
eixo, limites E1–E10, núcleo central, política auxiliar, massa estrutural e a
referência de identidade canônica de carteira.

A massa usa o snapshot imutável e versionado
`LOTOFACIL_STRUCTURAL_MASS_SNAPSHOT`, gerado e verificado contra
`calculateLotofacilStructuralMass`. Assim, a consulta do manifesto preserva as
contagens inteiras e frações exatas de `C(25,15)` sem enumerar o universo no
caminho síncrono. Ela declara `betSize: 15`; nenhuma massa para 16–20 é
produzida ou inferida.

## Fronteiras

O manifesto é uma consulta de auditoria para CLI. Não recebe ou consulta
histórico, resultados, estratégia, geração, cobertura, persistência, CAIXA,
impressão ou interface gráfica. Faixas, núcleo, raridade e massa permanecem
descritivos e não são recomendação, previsão ou filtro automático.

## Canonização

A identidade da carteira continua pertencendo a `@boloes/domain-core`. O
manifesto somente expõe a versão de contrato, algoritmo e versão de hash, além
do nome da função `canonicalizePortfolio` e das regras de ordenação já vigentes;
ele não recalcula hashes nem cria algoritmo alternativo.

## Uso por CLI

```text
npm run cli -- lotofacil formula
```

A saída JSON é determinística para a mesma versão dos contratos e pode ser
comparada em auditorias locais.
