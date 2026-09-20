# Settlement status contract

## requested

Evidence examples:
- bounty submission
- invoice sent
- payment request created
- claimant asks for a stated reward

This is not revenue.

## accepted

Require an explicit payer-side approval/acceptance that binds:
- claimant/order/reference
- amount and asset, or a deterministic reward schedule
- acceptance language

Words like "received", "under review", "looks good", and "eligible" are not acceptance unless the payer clearly commits to the award.

## pending

Require payer-side evidence of an actual payment process, such as:
- pending payment identifier
- transaction hash explicitly marked pending/unconfirmed
- queued transfer with concrete amount and destination/beneficiary
- provider payment object in a non-final state

A generic "we will pay" message remains accepted, not pending.

## settled

Require final authoritative evidence such as:
- confirmed/final transaction state from the payer or payment provider
- on-chain confirmation independently matched to the expected asset, amount, and beneficiary
- authoritative credited balance that the claimant can control/spend
- payment provider receipt with final status

Do not infer settlement from a transaction hash alone.

## Conflicts

If sources disagree on amount, asset, claimant, or status:
- preserve both observations
- mark the record `conflict`
- do not promote to a higher state
- request a bounded authoritative check

## Deduplication

Use a stable composite key where available:
`program_reference + claimant + asset + amount + payment_id`

If no payment id exists, keep source ids and avoid collapsing records merely because subject lines match.
