# pstack port

Portable [pstack](https://github.com/cursor/plugins/tree/main/pstack) workflows for Codex, Claude Code, and Cursor. This independent port builds from a pinned upstream Git submodule and installs a complete skill bundle. It is not an official Cursor or OpenAI package.

## Use it locally

### Codex plugin from GitHub

Register this repository as a plugin marketplace:

```sh
codex plugin marketplace add mbokinala/pstack
```

Open the desktop Plugins Directory, select the marketplace from this repository, and install **pstack**. Start a new conversation and invoke **`$poteto-mode`**. All 51 individual skills are also included with their existing names.

The repository includes the generated plugin under `plugins/pstack`, so marketplace installation needs no Node.js build or upstream submodule checkout. Optional helper workflows still require their documented tools (such as Bun and GitHub CLI). The plugin bundles the two agent prompts as skill references; it does not install custom agents into `.codex/agents`.

Use either the Codex plugin or the Codex file installer to avoid duplicate skills. The installer below remains available for all three hosts.

### File installer

Node.js 22 or newer is required for the installer. From this checkout:

```sh
npm ci
npm run check
node bin/pstack.mjs install --providers=codex,claude --scope=project --target=/absolute/path/to/your-project
node bin/pstack.mjs doctor --scope=project --target=/absolute/path/to/your-project
```

In Codex, invoke `$poteto-mode`. In Claude Code or Cursor, invoke `/poteto-mode`. Individual skills such as `$how` or `/interrogate` remain available. Reload the host if newly installed skills or agents do not appear.

The installer writes:

| Provider | Skills | Custom agents |
|---|---|---|
| Codex | `.agents/skills/` | `.codex/agents/` |
| Claude Code | `.claude/skills/` | `.claude/agents/` |
| Cursor | `.cursor/skills/` | `.cursor/agents/` |

The two custom agents are `poteto-agent` and `comment-sicko`. Workflows can use their bundled prompt references if custom-agent registration is unavailable. Native delegation itself is optional, with explicit limits on what a sequential fallback proves.

For all projects on your machine:

```sh
node bin/pstack.mjs install --providers=codex,claude --scope=global
```

Global installation targets your home directory. `--target` overrides the target directory, including for isolated global-scope testing. Project installations are ordinary files that a team can commit. Global installation applies only where the host reads local user files; it does not provision cloud environments.

## Update and remove

Run these from the target project using the CLI from a newer built checkout or release package:

```sh
pstack update --scope=project
pstack remove --providers=claude --scope=project
```

For this unpublished checkout, replace `pstack` with `node /absolute/path/to/pstack-port/bin/pstack.mjs`. `update` applies the version bundled with the running CLI; it does not fetch npm or upstream Git by itself. Install/update/remove accept `--dry-run`.

`.pstack/install.json` records managed file hashes and release provenance. Installation refuses collisions with unmanaged or locally edited files before changing any files. Updates retire unchanged files removed from a release. Removal preserves modified files and unrelated content. User settings in `.pstack/config.json` are never managed by the installer.

Keep installed skill names distinct from other copies of pstack. Do not install this bundle alongside the original plugin into the same host unless you resolve duplicate names.

## Configure models

Run `setup-pstack` in the coding agent, or create `.pstack/config.json` in your project:

```json
{
  "version": 1,
  "roles": {
    "interrogate reviewers": ["inherit-parent", "inherit-parent", "inherit-parent"]
  }
}
```

All roles default to the parent model. User settings at `~/.pstack/config.json` are read first; project role values override them. Real model identifiers are used only when the host supports them. Multiple inherited-model reviewers provide separate contexts, not cross-provider model diversity.

Transcript-based skills use the current conversation or project-scoped exports supplied by the user/host. They do not guess internal Codex, Claude, or Cursor history locations. See the installed `references/pstack-runtime.md` for the optional transcript configuration schema.

## What is included

- All 47 upstream skills, 23 playbooks, and two agent prompts.
- Portable replacements for `deslop`, `control-cli`, `control-ui`, and `create-skill`, bringing the bundle to 51 skills.
- Existing orchestration and GitHub PR watcher helpers.
- Explicit adaptations for model setup, delegation, transcript access, webhook setup, and long-running work.

The four dependency replacements implement the required workflow locally. They do not install browser automation, MCP servers, or third-party services.

### Capability limits

- Agent Skills does not supply persistent modes, scheduling, background wakeups, or cloud worker infrastructure. The workflows use exposed host capabilities and report missing ones.
- Native model selection cannot reproduce Cursor's mixed Claude/GPT/Grok panels unless the host exposes equivalent models. Unavailable overrides fall back with disclosure.
- Historical recall needs supplied/exported history. Reflection on the current conversation works without private history access.
- Browser/desktop proof requires an available automation tool or project harness. Missing live verification remains a blocked verification gate.
- The PR watcher and orchestration tools require **Bun**; the watcher also needs authenticated **GitHub CLI**. Some orchestration commands require **Graphite**. The portable worktree audit requires **Python 3**, Git, and optionally `du` for sizes.
- The helper bootstrap installs its locked Bun dependencies beside the helper on first use, requiring network access and a writable skill directory. The installer itself requires no runtime npm dependencies or network access.
- Benny's Cursor automation service pack is excluded. `make-bot-ui` can use an existing webhook receiver or an explicitly labeled local mock; it does not provision Cursor routines.
- These are instruction workflows, not enforcement of policy or automatic permission grants. Host rules and the user's authorized scope still apply.

## Development

See [DEVELOPMENT.md](DEVELOPMENT.md) for upstream maintenance, release distribution, and validation.

## Sources and license

The content follows the [Agent Skills specification](https://agentskills.io/specification), with host metadata based on [Codex skills](https://learn.chatgpt.com/docs/build-skills) and [Claude Code skills](https://code.claude.com/docs/en/skills). The distribution approach is inspired by [Impeccable](https://github.com/pbakaus/impeccable); its installer code is not copied here.

MIT. Upstream pstack is copyright Lauren Tan. See [LICENSE](LICENSE) and [NOTICE.md](NOTICE.md).
