# bfc-optimize — Cut List → Lumber Purchase Optimizer
<!-- bfc-badges -->
<div align="center">

**English** · [简体中文](./docs/README.zh-CN.md)

![TypeScript](https://img.shields.io/badge/TypeScript-5-3178C6?logo=typescript&logoColor=white)
![Node.js](https://img.shields.io/badge/Node.js-%3E%3D18-339933?logo=nodedotjs&logoColor=white)
![CLI](https://img.shields.io/badge/CLI-Commander-6F42C1?logo=gnubash&logoColor=white)
![Tests](https://img.shields.io/badge/tests-20%20passed-2ea44f)
![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)

</div>


Turn a woodworking cut list into an optimized, **lowest-waste lumber purchase
plan**. The tool matches every required part against your existing inventory
and supplier stock, places pieces along boards with kerf accounted for, and
explains every board, every placement and every unfulfilled part in plain
text.

Companion guide: [Board Foot Cut List Calculator](https://boardfootcalc.net/board-foot-cut-list-calculator/) ·
See also [How to Buy Lumber by Board Foot](https://boardfootcalc.net/how-to-buy-lumber-by-board-foot/)
and [Lumber Waste Factor Guide](https://boardfootcalc.net/lumber-waste-factor-guide/).

## Features

- **1D cutting-stock optimization** over whole boards: 4 strategies
  (`lowest-cost`, `lowest-waste`, `min-boards`, `balanced`).
- **Existing inventory reuse** — AVAILABLE boards are preferred and valued at
  their on-hand cost; supplier boards are priced at cost/BF + fixed cost.
- **Kerf-aware** — a saw kerf is consumed between every pair of pieces, never
  ignored.
- **Compatibility filtering** — species, thickness quarter (8/4 vs 4/4),
  width (with rotation when grain allows), grain direction and edge
  requirements.
- **Defect zones** — subtract defect areas from usable board length.
- **Explainable** — every board plan lists each piece, its start position, and
  why unfulfilled parts couldn't fit.
- **Exports** — purchase list CSV, cutting plan JSON, project file
  (`.lumberproject`).

## Install

```bash
git clone https://github.com/anleeylee/boardfootcalc-cut-list-optimizer bfc-optimize
cd bfc-optimize
npm install
npm run build        # compile to dist/
npm test             # 20 tests
```

## Quick start

```bash
npm run demo
# generates ./demo/{cutlist.csv, inventory.csv, suppliers.csv} and runs a full plan
```

Or step by step:

```bash
# 1. Start a project
bfc-optimize init --project myjob.lumberproject --name "Sideboard"

# 2. Import the cut list and available boards
bfc-optimize import-cutlist --project myjob.lumberproject cutlist.csv
bfc-optimize import-boards --project myjob.lumberproject inventory.csv --source inventory
bfc-optimize import-boards --project myjob.lumberproject suppliers.csv --source supplier

# 3. Optimize
bfc-optimize run --project myjob.lumberproject --strategy balanced --kerf 0.125 --waste 0.3

# 4. Export the purchase list
bfc-optimize export-purchase --project myjob.lumberproject --out purchase-list.csv
bfc-optimize report --project myjob.lumberproject
```

## CLI reference

```
bfc-optimize init [--name <name>] --project <file>
bfc-optimize import-cutlist --project <file> <cutlist.csv|xlsx>
bfc-optimize import-boards --project <file> <boards.csv|xlsx> --source inventory|supplier
bfc-optimize list-cutlist --project <file>
bfc-optimize list-boards --project <file>
bfc-optimize run --project <file> [--strategy lowest-cost|lowest-waste|min-boards|balanced] [--kerf 0.125] [--waste 0.3]
bfc-optimize export-purchase --project <file> --out <purchase-list.csv>
bfc-optimize report --project <file>
bfc-optimize demo
```

## Input formats

**Cut list CSV** — headers are matched by synonym, order does not matter:

| Part ID | Part Name | Quantity | Species | Grade | Thickness | Width | Length | Grain Direction | Rotation Allowed |
|---|---|---|---|---|---|---|---|---|---|
| T1 | Top | 1 | Black Walnut | FAS | 8/4 | 24 | 48 | vertical | no |
| D1 | Drawer Front | 4 | Black Walnut | FAS | 4/4 | 6 | 14 | any | yes |

**Boards CSV** (add `Status` for inventory boards; supplier boards are
always purchasable):

| Board ID | Species | Grade | Thickness | Width | Length | Cost/BF | Fixed Cost | Location | Status |
|---|---|---|---|---|---|---|---|---|---|
| INV-01 | Black Walnut | FAS | 8/4 | 10 | 72 | 0 | 0 | Rack A | AVAILABLE |
| SUP-03 | Black Walnut | FAS | 4/4 | 8 | 96 | 10.5 | 0 | Dealer B | |

Thickness accepts `8/4`, `2`, `2.0`; width/length accept inches or
`4ft` / `48` / `4'`.

## How it works

Boards are bought whole. For each part (largest/densest first), the optimizer
reuses a board that already has room (densest fit), otherwise buys the board
that best matches the strategy — cheapest for `lowest-cost`, smallest board
for `lowest-waste`, longest board for `min-boards`, weighted score for
`balanced`. A kerf is consumed between pieces; defect zones shorten usable
length; parts that fit no board are reported with the exact reason.

## Engine

This tool ships with a frozen copy of the shared
[BoardFootCalc Desktop Lumber Calculation Engine](https://boardfootcalc.net/) in `src/core/`
(board feet, units, nominal/actual, quarter thickness, waste, species,
pricing, CSV). All five tools use the same math, so a number computed here
matches the web calculators.

## Tests

```bash
npm test   # import + optimization (20 tests)
```

## License

MIT. Estimates are for planning purposes — verify dimensions, kerf and
pricing against your lumber yard before purchasing.
