# Attribution and provenance

This project adapts pstack from https://github.com/cursor/plugins/tree/main/pstack.
The upstream pstack content is copyright (c) 2026 Lauren Tan and licensed under MIT.
The upstream license is retained at the package root and in every generated skill.

`upstream.lock.json` records the reviewed upstream Git commit and hashes. Each release
includes `dist/manifest.json` with the upstream repository, commit, pstack version,
port version, included skills, and generated file hashes.

Portable adapters, dependency replacements, the build tools, and the installer are
part of this independent port and are distributed under MIT. The port is not an
official release by Cursor, OpenAI, or Anthropic.

Impeccable's published installation flow informed the distribution design. No
Impeccable source code is incorporated.
