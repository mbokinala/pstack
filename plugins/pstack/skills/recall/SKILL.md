---
name: recall
description: Reconstruct recent working context from available project-scoped
  chat history, live state, and relevant shared records, then return a
  current-state brief. Use for recall my work on X, catch me up, what have I
  been working on, or where did I leave off.
license: MIT
---

Read [the pstack runtime contract](references/pstack-runtime.md) before following this workflow. It defines supported delegation, model configuration, permissions, paths, and missing-capability behavior.

# Recall

Rebuild the user's recent working context before resuming. Read only the in-scope records, reconcile the evidence with live state, then return a concise capsule.

1. **Classify.** One specific prior session belongs to `poteto-mode/playbooks/session-pickup.md`. Turning preferences into a skill belongs to **automate-me**. If the user supplied a complete state capsule, begin with it and skip redundant history mining.
2. **Lock the scope.** State the workspace, named topic, and time window. Default “recent” to seven days in the active project. Preserve an explicit request for all history rather than silently sampling it. Use only transcript sources permitted by [the runtime contract](references/pstack-runtime.md). With no transcript source, continue from current context and Git state and name the missing history.
3. **Mine available history.** Order candidate files by actual modification time, not UUID. Search for the topic before reading relevant regions. Exclude the current conversation and identified test/evaluation noise. For a large corpus, delegate disjoint slices to available agents; for a small corpus or no delegation, inspect directly. Return one block per session with the user's goal, decisions, open work, recurring corrections, and artifacts such as branches, PRs, or tickets. Cite the actual file/session identifier and relevant line or turn. Keep raw transcripts out of the main context when summaries suffice.
4. **Sweep the shared record for named targets.** A named feature, file, subsystem, or bug may have a history beyond the user's own chats. Read the **why** skill and use its applicable source-investigation references to establish current state, failed or reverted fixes, and continuing user reports. Dispatch only available, relevant read capabilities; report unavailable sources. For pure activity recall with no named target, history and live state are enough. Do not post messages or mutate tickets.
5. **Reconcile live state.** Check surfaced branches, commits, diffs, PRs, and tickets using Git and available read interfaces. A transcript saying “merged” is a claim to verify, not a live status. Read original tool evidence when the answer hinges on what the agent actually ran. Avoid rerunning expensive completed work without a specific evidence gap.
6. **Write the brief.** Apply **unslop**, group by thread, and stay on the named topic. An adjacent issue belongs only if it blocks this work. Sanitize private context before a public deliverable.

## Output contract

- **Capsule.** At most five bullets describing the work and its current overall state.
- **Threads.** One line per thread with an evidenced status, such as `[merged #N]`, `[open PR #N]`, `[in flight <branch>]`, `[verified, uncommitted]`, `[reverted #N]`, `[planned, not started]`, or `[status unverified]`. Never invent a completion tag to fit the format.
- **Problems.** At most five recurring blockers, reported symptoms, or reverted fixes.
- **Next move.** The single most useful concrete action.
- **Evidence gaps.** Missing history, inaccessible sources, or stale status only where they affect the conclusion.

Cite session findings by their real identifiers and shared-record findings by source links or IDs. Cut supporting detail before dropping a thread.
