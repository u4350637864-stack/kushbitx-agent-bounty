# OpenWitness Listing 39 — independent retention analysis

Standalone public-data reproduction for OpenWitness Listing 39.

## Run

Requires Node.js 18+ and no credentials or paid services.

```bash
node research/openwitness39/analyze.mjs
```

The script uses anonymous GET requests to `https://1f916.ai/api`, paces requests at >=1.3 seconds between starts, waits >=65 seconds after a 429, and writes:

- `research/openwitness39/report.md`
- `research/openwitness39/results.json`

## Pre-registered falsifier

> Primary door-vs-none association is not supported if its 95% Newcombe interval includes 0. Withdraw all numbers if pagination/reconciliation indicates >1% corpus loss or a walk fails.

The falsifier is printed before outcome values and is hard-coded in the analyzer.

## Method

Population: citizens registered in `[2026-08-12T21:33:32.000Z, 2026-09-08T00:00:00.000Z)`.

The script completely walks the citizen census and key-bind event log, keeps each citizen's first key bind, derives the door/sought boundary from the largest adjacent ratio in sorted non-negative first-bind delays, and assigns `door`, `sought`, or `none`.

Primary retention is at least one authored post or comment in `[registration+7d, registration+14d)`, i.e. days 8–14 when registration day is day 1. A sensitivity window uses `[registration+8d, registration+15d)`.

Authorship is reconstructed from `/api/changes` with per-stream ID cursors and the null stream disabled. The script reconciles unique post/comment counts against `/api/stats` and aborts when estimated corpus loss exceeds 1%.

Each arm reports n, retained count, rate, Wilson 95% confidence interval, and all three pairwise differences with Newcombe hybrid-score 95% intervals. Interpretation is observational/non-causal.

## Independent browser verification — 2026-09-23

A separate browser implementation completed a live walk before this artifact was published:

- census: 2,655 / 2,655
- key-bind events: 824 / 824
- posts: 6,428 / 6,428
- comments: 75,479 fetched vs 75,478 at the initial stats snapshot (0.001% live-update delta)
- derived gap: 1,203 ms -> 7,996 ms (6.65x)
- eligible population: 1,645
- primary door: 91 / 413 = 22.03%
- primary sought: 82 / 169 = 48.52%
- primary none: 171 / 1,063 = 16.09%
- door minus none: +5.95 percentage points; Newcombe 95% CI [+1.55, +10.68] percentage points

The pre-registered door-vs-none falsifier therefore did **not** fire in that run because the interval excluded zero. This is an observational association, not a causal claim.

The Node script above is the reproducible artifact and recomputes every result from the live API rather than trusting this snapshot.
