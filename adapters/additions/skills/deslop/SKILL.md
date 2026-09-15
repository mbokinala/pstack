---
name: deslop
description: Review a scoped code diff for unnecessary abstractions, redundant guards, inconsistent style, and generated-code clutter. Use when asked to deslop code or when pstack routes a pre-commit cleanup.
disable-model-invocation: true
---

# Deslop a diff

Inspect the requested diff and nearby code before editing. Preserve intentional behavior, public contracts, and unrelated work.

Remove changes that do not earn their place: single-use abstractions that obscure a direct expression, repeated validation inside a trusted boundary, redundant state, unused code, and comments that merely narrate syntax. Follow the repository's existing conventions. Keep guards that protect actual untrusted inputs, concurrency constraints, and external API contracts.

For a suspected workaround, reproduce or trace its cause before deleting it. Do not remove a check just because it looks defensive. Prefer a small change whose behavior can be verified over a broad stylistic rewrite.

When the user requested review only, report findings without edits. Otherwise apply justified cleanup, inspect the resulting diff, and rerun the affected checks. Summarize what became simpler and which checks actually ran. This skill does not create commits or PRs on its own.
