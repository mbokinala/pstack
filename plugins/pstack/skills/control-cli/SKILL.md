---
name: control-cli
description: Verify actual CLI or terminal UI behavior through the available
  shell or PTY, capturing commands, results, and observable state. Use when
  pstack needs runtime proof on a command-line surface.
license: MIT
---

Read [the pstack runtime contract](references/pstack-runtime.md) before following this workflow. It defines supported delegation, model configuration, permissions, paths, and missing-capability behavior.

# Verify a command-line surface

Read the project's documented launch and test commands. Reuse a project-specific verify skill when one exists. Check that the shell or PTY tool can drive the actual surface before promising a runtime result.

1. Name the user action and expected observable outcome. For a bug, reproduce the reported behavior before changing it when feasible.
2. Start the real command in a temporary workspace or with isolated test data. Use a PTY for interactive terminal behavior if the host provides one. Track processes you start.
3. Exercise the relevant path through the public CLI: inputs, flags, interactions, stdout/stderr, exit status, and persisted state. Include the failure path or restart when relevant to the change.
4. Save a reproducible command and concise output or terminal capture. Compare actual output with the expected outcome; a successful build is not runtime proof.
5. Stop only processes you started and remove only disposable artifacts you created.

If no PTY is available, verify noninteractive paths and identify the interactive behavior that remains unverified. Do not represent redirected output as evidence of terminal rendering.
