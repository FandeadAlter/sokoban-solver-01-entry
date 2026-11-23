# sokoban-solver-01-entry

[![make.fun · sokoban-solver-01-run-20261121](https://make.fun/badge/sokoban-solver-01-run-20261121.svg)](https://make.fun/bounty/sokoban-solver-01-run-20261121?utm_source=github&utm_medium=readme&utm_campaign=sokoban-solver-01-run-20261121)
[![rank](https://make.fun/badge/sokoban-solver-01-run-20261121/FandeadAlter/sokoban-solver-01-entry/rank.svg)](https://make.fun/bounty/sokoban-solver-01-run-20261121/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=sokoban-solver-01-run-20261121)
[![reward](https://make.fun/badge/sokoban-solver-01-run-20261121/FandeadAlter/sokoban-solver-01-entry/reward.svg)](https://make.fun/bounty/sokoban-solver-01-run-20261121?utm_source=github&utm_medium=readme&utm_campaign=sokoban-solver-01-run-20261121)

A push-optimal Sokoban solver: it splits each level into its rooms (hallway + one door per room), solves every room with a breadth-first search over pushes with dead-square and frozen 2x2 pruning, and stitches the rooms back together — so every level is answered in its push-optimal count. Practice set: 1,000,000 / 1,000,000 (13, 16, 29, 47 and 60 pushes).

## Run it

```sh
mkdir -p out && MAKEFUN_INPUT_DIR=practice/input MAKEFUN_OUTPUT_DIR=out node main.ts
```

---

<sub>Entered on [make.fun](https://make.fun/?ref=me6ajgxn&utm_source=github&utm_medium=readme&utm_campaign=sokoban-solver-01-run-20261121)</sub>
