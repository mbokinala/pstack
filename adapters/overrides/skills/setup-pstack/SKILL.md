---
name: setup-pstack
description: Configure pstack's per-role models for this project or user, using models the current host actually supports. Use for setup-pstack, configure pstack models, pstack budget, or changing pstack's model choices.
---

# Setup pstack

Write portable model preferences that pstack reads when it runs. See [the runtime contract](references/pstack-runtime.md) for exact precedence and delegation behavior.

## Steps

1. **Load current state.** Read `~/.pstack/config.json` and the active project's `.pstack/config.json` if present. Project role values override user values. Keep existing settings and unknown fields. Report malformed JSON or an unsupported version before changing that file.
2. **Choose scope.** Honor the user's requested project or user scope. For a new setup without a scope preference, use `.pstack/config.json` in the active project. A repeat run updates the existing relevant configuration. Do not write host rules or alter unrelated agent settings.
3. **Check capabilities.** Inspect the native delegation interface and available model options. Do not infer entitled models from marketing names, the parent model, or upstream defaults. When discovery is unavailable, `inherit-parent` is a working default. `auto` is an equivalent alias. Disclose if the host cannot delegate or select models.
4. **Map roles.** Honor stated model and budget preferences. Show the resulting model table when making substantive choices. A budget such as small or large expresses a preference; translate it only using supported model or reasoning settings, never by constructing model slugs. Ask only for choices that the user needs to make. With no preference, an empty `roles` object inherits the parent for every role.
5. **Validate and save.** Every configured real model must be confirmed available for native delegation. Keep unresolved choices out of the config and report them. Write valid JSON atomically, preserving other fields. A scalar role takes a nonempty string; a panel role takes a nonempty array of strings. Duplicate alias entries retain independent review passes. Record no credentials.
6. **Report.** Give the path, configured changes, and any capability limitations. The settings apply on the next pstack invocation that reads them. Installation of pstack alone does not register persistent host rules.

Minimal configuration:

```json
{
  "version": 1,
  "roles": {}
}
```

## Role labels

Use these existing workflow labels verbatim so role lookup stays consistent:

| Scalar roles | Panel or pool roles |
|---|---|
| `feature, refactoring` | `arena runners` |
| `bug-fix` | `arena cross-judge pool` |
| `perf-issue` | `architect runners` |
| `hillclimb` | `interrogate reviewers` |
| `judgment and prose` | |
| `hardest tasks` | |
| `how explorer` | |
| `how explainer` | |
| `why investigators` | |
| `why synthesizer` | |
| `reflect tooling` | |
| `reflect judgment, divergent, synthesizer` | |
| `swarm workers` | |

For example, to keep three review contexts on the parent model:

```json
{
  "version": 1,
  "roles": {
    "interrogate reviewers": ["inherit-parent", "inherit-parent", "inherit-parent"]
  }
}
```

Transcript paths are optional and separate from model configuration. Add them only when the user supplies a project-scoped source, using the runtime contract's `transcripts` schema. Do not discover private host storage by guessing paths.

If the user also wants runtime verification configured, inspect the project's existing harness and read the **create-verification-skill** skill when one is needed. Model setup itself does not require a new verification skill.
