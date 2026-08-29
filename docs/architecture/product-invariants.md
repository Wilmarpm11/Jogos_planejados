# Product invariants

## Non-negotiable mathematical workflow

The portfolio formula and its separation of concerns are product invariants:

`Mathematical universe -> structural metrics -> observed history -> lift -> temporal validation -> approved strategy -> generation -> diversity optimization -> coverage audit`

`PortfolioGenerator` must not read raw historical results. It receives a
versioned `LotteryDefinition` and a versioned `ApprovedStrategyConfig` only.

## Lotofacil first; multi-lottery by design

Lotofacil is the first complete module. New lotteries must use the same core
workflow while supplying their own rules, metrics, prize tiers, pricing,
coverage calculation, result parser, and print template.

## Frozen portfolio

Every printable or exportable portfolio is frozen and identified by a canonical
hash. No output adapter may regenerate, reorder, or alter its numbers.

## INJOLOCA boundary

The vendored INJOLOCA extension may be reused for its online-entry workflow.
It must remain isolated from the mathematical engine. A4 printing is a separate
first-class module built against `FrozenPortfolio`.

## Reuse and skill gate

Before implementing or changing a stable, reusable capability, the responsible
agent must explicitly decide whether it requires a dedicated skill or reusable
contract. This is mandatory for combinatorics, metrics, coverage, data sync,
strategy, printing, calibration, and result checking.

The decision must be one of: create a reusable skill/contract; use an existing
skill/contract; or implement only in a lottery module. Changes must not duplicate
or silently alter an established behavior for existing lotteries.
