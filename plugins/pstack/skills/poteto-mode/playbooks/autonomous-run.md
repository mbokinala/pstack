### Autonomous run

**Own the exit condition. Define done, then drive to it with evidence.**

1. State a checkable completion predicate before the first iteration. Include the authorized scope and any user-supplied runtime or cost budget. A completed implementation, passing behavioral repro, or a set of verified PRs is stronger than a vague claim of progress.
2. Check the host's execution capabilities. Use an available event watcher or native scheduling facility only when the task calls for it and the host exposes it. Agent Skills itself cannot schedule a wakeup. Otherwise continue within this active session and poll only when new evidence is likely. Do useful independent work between checks. Do not claim that work will continue after the session ends.
3. Make the smallest change the evidence justifies, verify against the predicate, and keep advances. Revert only your own unsuccessful experimental changes. Apply **principle-sequence-verifiable-units** so each unit has evidence before the next. Commit or update remote artifacts when that delivery is authorized.
4. Resolve discoveries that block the requested outcome. Keep unrelated ideas in a local follow-up list. Retry a failed approach only with a changed hypothesis or new evidence; repeated infrastructure failures need a bounded retry and a resumable handoff. Ask only when an unresolved user decision or missing authority blocks progress. Existing authorization remains valid.
5. Keep a decision trail through **show-me-your-work**. Each iteration records the hypothesis, change, evidence, and whether the completion predicate advanced. Checkpoint current state in a durable local task directory when the run may outlive the session.
6. Stop when the predicate is met, the user stops the run, a stated budget is exhausted, or no further progress is possible without a specific missing input or external change. A plateau calls for a new approach, not a relaxed success criterion. If unfinished, leave exact completed/pending work, artifact paths, and resume instructions. Report any absence of a scheduled continuation explicitly.

**Reply:** the completion predicate, iterations and evidence, accepted and discarded changes, final predicate state, and any concrete resume point.
