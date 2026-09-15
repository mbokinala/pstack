# Development

Development and maintenance guidance for pstack port. See [README.md](README.md) for installation, configuration, and usage.

## Maintain upstream

```text
upstream/cursor-plugins/     Git submodule, unchanged upstream source
upstream.lock.json          Reviewed commit and source file hashes
adapters/patches.json       Exact, single-match content adaptations
adapters/overrides/         Rewritten host-dependent workflows
adapters/additions/         Portable dependency skills
adapters/runtime.md        Shared runtime contract
lib/convert.mjs             Metadata and provider path conversion
scripts/build.mjs          Generates all provider distributions
scripts/build-plugin.mjs   Packages the Codex plugin from generated skills
.agents/plugins/marketplace.json  GitHub marketplace catalog
plugins/pstack/             Generated plugin bundle, committed to Git
dist/                      Generated, ignored by Git, included in npm package
```

Initialize a fresh clone with `git submodule update --init --recursive`, or clone with `--recurse-submodules`. A submodule pins the entire `cursor/plugins` repository; the build consumes only pstack's skills, agents, license, and version metadata.

To review an upstream update:

```sh
git submodule update --remote upstream/cursor-plugins
npm run upstream:review
git -C upstream/cursor-plugins diff OLD_COMMIT HEAD -- pstack
```

Replace `OLD_COMMIT` with the previous commit printed by the review command. Review changed source and reconcile patches and overrides. New dependencies and runtime assumptions require review even if the patch anchors still match.

After reviewing:

```sh
npm run upstream:accept
npm run check
git add upstream/cursor-plugins upstream.lock.json adapters lib scripts plugins/pstack
```

Commit the submodule pointer, updated lock, and adaptations together. `accept` records that review; it does not prove compatibility. Builds reject an unaccepted commit, dirty upstream pstack files, missing override targets, or a patch whose original text no longer occurs exactly once. The source lock also catches upstream additions and removals. The port never edits the submodule.

## Distribute a release

```sh
npm ci
npm pack
```

The prepack check builds, validates, and tests before creating `mbokinala-pstack-0.1.0.tgz` (the filename follows the package name and version). The archive contains generated files and a dependency-free installer; it excludes upstream Git history, adapters, build dependencies, and tests.

Developers can install directly from a shared archive:

```sh
npx --yes --package=/absolute/path/to/mbokinala-pstack-0.1.0.tgz pstack install --providers=codex,claude --scope=project
```

### npm releases from Git tags

`.github/workflows/publish.yml` publishes `@mbokinala/pstack` when a `v*` tag is pushed to GitHub. The tag must exactly match `package.json` (for example, `v0.1.0`). The workflow builds, validates, tests, and checks committed marketplace artifacts before publishing. Stable versions use npm's `latest` channel; prereleases such as `v0.2.0-beta.1` use `next`.

`package.json` is the source of truth for the release version. Use `npm version` to update it and the lockfile together. The `version` lifecycle hook rebuilds and stages the marketplace bundle before npm creates the release commit and tag. Full validation and tests run in CI before publishing; you do not need to run `npm run check` manually for each release.

After committing your source changes, start with a clean working tree and installed dependencies (`npm ci` on a fresh checkout):

```sh
npm version patch -m "Release v%s"
git push --follow-tags
```

Use `minor`, `major`, or an explicit version (for example, `npm version 0.3.0-beta.1`) as needed. Do not hand-edit the version or bypass lifecycle scripts with `--ignore-scripts`; the hook keeps the committed plugin metadata synchronized. A tag push triggers publication. If checks fail, publication is blocked even though the tag has already been pushed.

After npm publishing succeeds, a separate job creates a GitHub Release for the same tag with automatically generated release notes. Versions containing a prerelease suffix are marked as GitHub prereleases. If GitHub Release creation fails after npm publishing succeeds, rerun only the failed job to retry without attempting to publish the npm version again.

### GitHub marketplace release

`.agents/plugins/marketplace.json` exposes the **pstack** plugin from `plugins/pstack`. The plugin keeps `$poteto-mode` and the other 50 skill names unchanged. `npm run build` copies the generated Codex skills, bundled resources, licenses, and provenance into this directory and synchronizes the plugin version with `package.json`.

Commit the generated `plugins/pstack/` files together with source changes. Git marketplace installs consume these files directly and do not run npm or initialize the upstream submodule. Do not edit generated skills by hand; edit adapters and rebuild. Plugin presentation metadata is maintained in `plugins/pstack/.codex-plugin/plugin.json`.

For a versioned release, use the `npm version` flow above to regenerate and commit the bundle automatically. For source-only marketplace updates, run `npm run build`, review the generated diff, and commit it with the source changes. CI runs the full checks and verifies that the committed plugin matches the build. Marketplace updates become available when changes are pushed to the repository's default branch (or the ref users install). Users can pin a published tag with `codex plugin marketplace add mbokinala/pstack --ref v0.1.0` (substitute an existing release tag).

Once published, the user installation command is:

```sh
codex plugin marketplace add mbokinala/pstack
```

Users then select the **pstack** marketplace in the desktop Plugins Directory, install **pstack**, and invoke **`$poteto-mode`** in a new conversation. See [the installation walkthrough](README.md#codex-plugin-from-github).

Install **pstack** from the desktop Plugins Directory and test `$poteto-mode`, a direct individual skill invocation, and a workflow using bundled resources in a new conversation. The plugin uses the bundled agent prompt fallback rather than registering the file installer's custom agents. Helper dependency bootstrap still needs network access and a writable installed scripts directory; installation alone does not verify those optional runtime capabilities.

## Validation

`npm run check` checks source pinning, patch anchors, generated YAML/names/invocation policy, resource links, artifact hashes, deterministic output, and installer behavior in temporary directories. Additional tests cover the portable helpers. These checks do not establish live behavior in every Codex/Claude/Cursor version; smoke-test representative prompts in each target host before claiming full behavioral parity.
