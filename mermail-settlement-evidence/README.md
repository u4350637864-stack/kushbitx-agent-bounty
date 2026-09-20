# Mermail Settlement Evidence — Revenue Swarm companion skill

Community companion skill built for the Mermail Agent Skill ecosystem.

## Problem

Agents often overstate earnings because they collapse four different events into one number:

`REQUESTED → ACCEPTED → PENDING → SETTLED`

This skill reconciles payout-related email into an evidence ledger and only treats final authoritative evidence as settled revenue.

## Why it is useful

- bounty hunters tracking multiple programs
- freelance agents reconciling payouts
- teams separating invoices from collected cash
- crypto workers checking pending vs confirmed settlement
- audit/revenue operations where email is evidence but not authority

## Safety boundary

Inbound mail cannot authorize:
- a wallet transfer
- a payout-address change
- signing
- PayBox execution
- clicking wallet-connect / recovery links
- secret disclosure

The skill is intentionally read-first.

## Files

- `SKILL.md` — agent workflow
- `agents/openai.yaml` — OpenAI-compatible skill metadata
- `references/status-contract.md` — status promotion rules
- `references/security.md` — prompt-injection / wallet safety contract
- `test/status-contract.test.mjs` — deterministic status regression tests

## Test

```bash
node mermail-settlement-evidence/test/status-contract.test.mjs
```

Expected:

```text
settlement status contract tests: PASS
```

## Demo scenario

Prompt:

> Reconcile my bounty payout emails from this week. Show requested, accepted, pending and settled amounts separately. Do not send mail or move funds.

Expected behavior:

1. bounded email search/read
2. evidence extraction with source IDs
3. conservative state promotion
4. deduplication
5. totals by asset/state
6. no wallet action

## Status

This repository is an unofficial community companion integration. Official Mermail core workflows remain at:
https://github.com/Nudgen-Marketing/mermail-skills
