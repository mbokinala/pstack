---
name: control-ui
description: Verify a running browser, desktop, or mobile UI using available automation, with observed state and screenshots. Use when pstack requires runtime evidence on a visual surface.
disable-model-invocation: true
---

# Verify a visual surface

Prefer the repository's verification skill and existing harness. Discover an available browser or native automation tool from the current host. This skill supplies a procedure, not a browser connection or simulator.

1. Define the user-visible behavior and the action that reaches it. For a bug, reproduce on the same surface when possible.
2. Start the app with isolated test data through its documented entry point. Record the URL, app, or simulator actually used.
3. Drive the UI as a user would. Check visible state and the resulting behavior, including persistence, navigation, or restart when they matter.
4. Capture screenshots and relevant console/network evidence. Inspect captures yourself before claiming a visual result. Compare the outcome to the acceptance criteria, not just to whether a click succeeded.
5. Stop only sessions or processes created for this check.

If the required automation capability is absent, report exactly which scenario could not be exercised. Source inspection and unit tests can support the analysis, but do not satisfy a live UI verification gate. Use an existing supported harness; adding an external service or new tool integration requires the task to authorize that work.
