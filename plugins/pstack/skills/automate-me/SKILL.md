---
name: automate-me
description: Create or update a personal mode skill from the user's working
  conventions, supplied examples, and optional project-scoped transcripts. Use
  for automate me, update my mode skill, or capture my preferences or working
  style into a skill.
license: MIT
---

Read [the pstack runtime contract](references/pstack-runtime.md) before following this workflow. It defines supported delegation, model configuration, permissions, paths, and missing-capability behavior.

# Automate me

Turn recurring working conventions into one concise personal `-mode` skill. Preserve the user's intent instead of copying the author's style or treating a past transcript as standing authorization.

## Flow

1. **Find the existing skill.** Check the installed skill catalog and `.agents/skills/` for the user's existing mode skill. Read a supplied or discovered user-level skill path when applicable. A request to update authorizes editing that skill; preserve its location and unaffected conventions. For a new skill, default to `.agents/skills/<handle>-mode/SKILL.md` in this project. Use the user's chosen handle when known; ask for one if needed to name the artifact.
2. **Gather evidence.** Use explicit preferences in this conversation and any supplied examples. Optional history mining follows [the runtime contract](references/pstack-runtime.md). Search only a supplied or configured project-scoped transcript source. For an update, focus on material since the prior edit when that date can be established. Split a large corpus among available agents, or inspect it sequentially. Look for response style, delegation, verification, code discipline, and project conventions. Cite the episodes behind each pattern. No history access is required to draft from stated preferences.
3. **Resolve intent.** Repeated corrections and explicit standing preferences carry more weight than a single incidental request. Drop contradicted or weak inferences. Ask one or two focused preference questions only where an answer changes the draft; use the host's question capability if available. Do not turn the task into a survey.
4. **Draft or revise.** Read the bundled **create-skill** fallback or an installed native skill-authoring skill. Give the mode a valid lowercase hyphenated name and a concise description about the named user's style. Reference available skills by discoverable path and explain when they apply. Keep only conventions that change a future agent's decisions. Preserve the existing invocation policy. For a new explicitly invoked mode, configure explicit invocation using the host's supported metadata as described by **create-skill**; do not claim it applies automatically to every future session.
5. **Review prose and behavior.** Apply **unslop**. Separate direct user preferences from inferred habits. Check that the draft preserves task scope, authorizes no new external actions, and refers only to available skills. For substantial operational instructions, walk through a representative task and verify the rules produce the intended choices. Run an available skill validator; a user preference is ultimately checked against the user's actual feedback.
6. **Deliver.** Save the local artifact and summarize what was captured and any inference worth reviewing. Apply feedback to the existing file. Commit, publish, or open a PR only when already requested or authorized by the task.

## Guardrails

- Do not overfit a single conversation or turn temporary project facts into universal conventions.
- Use **poteto-mode** as a reference for granularity only. The user's preferences are their own.
- Reference other skills when available instead of pasting their contents. Do not introduce dependencies a recipient cannot resolve.
- Omit sections without a specific rule. “Communicate clearly” adds no useful instruction; an evidenced preference for short paragraphs and comparison tables can.
- Keep a mode focused on working conventions. A narrow workflow or task-specific skill belongs in **create-skill** directly.
