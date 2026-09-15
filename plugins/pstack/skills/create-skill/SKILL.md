---
name: create-skill
description: Author or revise a portable Agent Skills directory with scoped
  triggers, useful instructions, and verified resources. Use when pstack routes
  skill authoring or reflection into a concrete skill change.
license: MIT
---

Read [the pstack runtime contract](references/pstack-runtime.md) before following this workflow. It defines supported delegation, model configuration, permissions, paths, and missing-capability behavior.

# Author a portable skill

Read the existing skill and its callers first. Prefer a focused improvement to an existing skill over adding a second skill for the same task. Record the request that should trigger it and the outcome that proves it useful.

Create the skill under .agents/skills/<skill-name>/ in the requested project, or under the user's corresponding skill directory when user scope is requested. Names use lowercase letters, digits, and single hyphens, match the folder, and are at most 64 characters.

SKILL.md begins with YAML frontmatter containing `name` and a nonempty `description` of at most 1024 characters. The description states when to use the skill. Quote descriptions containing punctuation that YAML could interpret as syntax. Follow the Agent Skills specification at https://agentskills.io/specification when additional metadata is needed.

Put the essential decisions and procedure in SKILL.md. Put substantial conditional guidance in relative references, deterministic helpers in scripts, and output templates in assets. Link resources from the steps that need them. Avoid tools or paths that only exist in the author's environment. Preserve user scope and host permission boundaries.

For an existing skill, preserve its invocation policy. For a new skill, use normal discovery unless the user requests explicit invocation only; configure that using the target host's supported metadata. Do not edit an installed, release-managed pstack file as a durable fix. Make the change in the port's source adaptation and rebuild, or create a separately named project skill.

Validate YAML, naming, links, and any executable helper. Test a realistic task in an isolated workspace when the workflow is substantial, observing actual results rather than checking headings. Revise only from demonstrated problems. A personal preference skill usually needs a review with its user rather than an artificial benchmark.
