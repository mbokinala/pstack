import { cpSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { root } from '../lib/source.mjs';

// This output is committed so Git marketplace users never need to run a build.
export function buildPlugin(provenance) {
  const plugin = join(root, 'plugins/pstack');
  const skills = join(plugin, 'skills');
  rmSync(skills, { recursive: true, force: true });
  cpSync(join(root, 'dist/codex/.agents/skills'), skills, { recursive: true });
  for (const name of ['LICENSE', 'NOTICE.md']) cpSync(join(root, name), join(plugin, name));
  const path = join(plugin, '.codex-plugin/plugin.json');
  const manifest = JSON.parse(readFileSync(path, 'utf8'));
  manifest.version = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8')).version;
  writeFileSync(path, `${JSON.stringify(manifest, null, 2)}\n`);
  writeFileSync(join(plugin, 'provenance.json'), `${JSON.stringify({ version: manifest.version, upstream: provenance }, null, 2)}\n`);
}
