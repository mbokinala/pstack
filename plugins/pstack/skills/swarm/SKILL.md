---
name: swarm
description: Fan out N parallel workers, drain them, and return one report. Use
  for /swarm, 'swarm this', or parallel coverage, races, gauntlets, and
  exploration.
license: MIT
---

Read [the pstack runtime contract](references/pstack-runtime.md) before following this workflow. It defines supported delegation, model configuration, permissions, paths, and missing-capability behavior.

# Swarm

Fan out N workers using the host's native delegation when available. They may cover separate slices, race the same brief, or mix both. The parent waits, aggregates, and returns one report. Local workers with isolated state are the default. Cloud workers require an explicitly available and authorized service.

## Start

Open a todolist with one entry per phase before launching anything.

1. Frame
2. Fan out
3. Aggregate
4. Report

## Phase A: Frame

1. State the done predicate and the artifact or report the swarm must return.
2. Choose the shape. Partition into slices, race N workers on identical briefs, or mix both. For a race or mixed shape, declare `first pass`, `rank all`, or `best-of` before spawning.
3. Set N from the user or derive it from the shape. N is the total coverage or candidate count. Run workers in batches within the host's actual concurrency limit.
4. Pick supported worker models from the `swarm workers` preference in `.pstack/config.json` when present. Otherwise inherit the parent model. For a model race, name the actual models available up front and report when cross-model coverage is unavailable.
5. Give each worker its own writable output when it writes.

## Phase B: Fan out

Spawn workers with the host's native delegation tool and only its supported parameters, within its concurrency limit. Pass each worker a concrete scope, isolated writable paths, and the verification brief. If delegation is unavailable, cover the slices sequentially and mark the loss of independent execution. Never claim cloud isolation for local worktrees.

When a worker needs a non-default branch, create its isolated worktree at the requested commit and pass that path. Verify the checkout before it writes. A remote worker service may use its documented branch option only when that service is actually available.

Every brief stands alone. Include the goal, scope, exact slice or race arm, how to verify, and what to report. Reports use `PASS`, `ISSUES`, or `BLOCKED` with evidence.

If a worker drops out, proceed with N-1 and note it.

## Phase C: Aggregate

Read the terminal results. For coverage, every required slice needs a result. For a race, apply the selection rule declared up front. Use first pass, rank all, or best-of. Do not paste raw worker dumps.

Keep a compact result table, one-line evidenced issues, and explicit gaps or dropouts.

## Phase D: Report

Return one consolidated in-chat report with the table, issue one-liners, gaps or dropouts, and the race rule when used.
