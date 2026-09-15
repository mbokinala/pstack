---
name: reflect
description: Review the current conversation through judgment, tooling, and
  divergent lenses, then propose durable improvements to the skills it used. Use
  when the user says reflect.
license: MIT
---

Read [the pstack runtime contract](references/pstack-runtime.md) before following this workflow. It defines supported delegation, model configuration, permissions, paths, and missing-capability behavior.

# Reflect

Mine the current conversation for durable lessons and route them to concrete skill improvements. Skip trivial, one-off, or already-covered findings.

## Process

1. **Prepare evidence.** Use the active transcript only when its path is supplied by the host/user or explicitly configured for this project under [the runtime contract](references/pstack-runtime.md). Verify that the candidate matches this conversation. Otherwise prepare a concise current-session digest containing the relevant user corrections, decisions, tool evidence, and skills read. Label a digest's omissions. Never search unrelated private histories.
2. **Run three review lenses.** Read and apply `references/judgment-reviewer.md`, `references/tooling-reviewer.md`, and `references/divergent-reviewer.md`. Delegate independent review contexts when available. The tooling role is `reflect tooling`; the other lenses use `reflect judgment, divergent, synthesizer`. All default to inherited models. Each reviewer receives the same source or digest and its lens template. Reviewers may inspect relevant code and linked records using available read capabilities, but may not edit files, commit, post messages, or mutate services. Without delegation, perform three distinct passes and disclose that independence is unavailable.
3. **Synthesize.** Read `references/synthesizer.md`. Supply the full lens outputs and the evidence required to verify them. Use a fresh native agent if supported, otherwise synthesize in the parent and label the limitation. The synthesizer reads target skills before accepting changes and returns Accepted, Rejected, and Backlog findings without applying them.
4. **Check structural enforcement.** A repeated mistake better prevented by a lint rule, metadata flag, script, or runtime check belongs in Backlog with a proposed mechanism. Read **principle-encode-lessons-in-structure** when deciding. Reject facts that expire with a SHA, path, model release, or one-off incident.
5. **Make changes reviewable.** Present concrete wording or a local draft diff for accepted findings. If the user's request already includes applying improvements, apply the authorized local edits. If the request is reflection alone, deliver the proposals and ask which durable behavior changes to adopt. Do not edit an installer-managed distribution as the source of truth; locate its maintained source or explain the upstream patch needed. Keep backlog recommendations local unless filing them was explicitly authorized.
6. **Validate and report.** Use the bundled **create-skill** fallback or an available native authoring skill for substantial edits or new skills. Run any available validator on touched skills and check reference resolution. Report edits actually applied, proposals awaiting a decision, backlog recommendations, and rejected findings with reasons. Include any missing review independence or evidence that limits confidence.

The reviewer templates govern analysis, not publication permission. Where a template refers to approval or filing backlog issues, the scope and authorization rules above govern the parent action.
