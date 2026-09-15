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
git add upstream/cursor-plugins upstream.lock.json adapters lib scripts
```

Commit the submodule pointer, updated lock, and adaptations together. `accept` records that review; it does not prove compatibility. Builds reject an unaccepted commit, dirty upstream pstack files, missing override targets, or a patch whose original text no longer occurs exactly once. The source lock also catches upstream additions and removals. The port never edits the submodule.

## Distribute a release

```sh
npm ci
npm pack
```

The prepack check builds, validates, and tests before creating `pstack-port-0.1.0.tgz` (the filename follows the package version). The archive contains generated files and a dependency-free installer; it excludes upstream Git history, adapters, build dependencies, and tests.

Developers can install directly from a shared archive:

```sh
npx --yes --package=/absolute/path/to/pstack-port-0.1.0.tgz pstack install --providers=codex,claude --scope=project
```

For an npm release, first choose an owned package name/scope and set the repository metadata, bump the version, run the checks, and publish through the owner account. No package has been published by this project setup. A native plugin/marketplace wrapper can be added later using the same generated skills; the current delivery path is the installer/archive.

## Validation

`npm run check` checks source pinning, patch anchors, generated YAML/names/invocation policy, resource links, artifact hashes, deterministic output, and installer behavior in temporary directories. Additional tests cover the portable helpers. These checks do not establish live behavior in every Codex/Claude/Cursor version; smoke-test representative prompts in each target host before claiming full behavioral parity.

