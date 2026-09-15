import test from 'node:test';
import assert from 'node:assert/strict';
import { cpSync, mkdtempSync, readFileSync, rmSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { root, files } from '../lib/source.mjs';

test('marketplace package is self-contained after installation outside the checkout', () => {
  const catalog = JSON.parse(readFileSync(join(root, '.agents/plugins/marketplace.json')));
  const item = catalog.plugins.find(p => p.name === 'pstack');
  assert.equal(item.source.path, './plugins/pstack');
  const temporary = mkdtempSync(join(tmpdir(), 'pstack-plugin-'));
  try {
    const plugin = join(temporary, 'pstack');
    cpSync(resolve(root, item.source.path), plugin, { recursive: true });
    const manifest = JSON.parse(readFileSync(join(plugin, '.codex-plugin/plugin.json')));
    assert.equal(manifest.name, 'pstack');
    assert.equal(manifest.version, JSON.parse(readFileSync(join(root, 'package.json'))).version);
    const skills = resolve(plugin, manifest.skills);
    const built = join(root, 'dist/codex/.agents/skills');
    for (const file of files(built)) assert.deepEqual(readFileSync(join(skills, file)), readFileSync(join(built, file)), file);
    for (const file of files(skills).filter(p => p.endsWith('.md'))) {
      for (const match of readFileSync(join(skills, file), 'utf8').matchAll(/\]\(([^)]+)\)/g)) {
        const link = match[1].split('#')[0];
        if (!link || /^(?:[a-z]+:|\/|<)/i.test(link) || /[<>\s]/.test(link)) continue;
        const target = resolve(dirname(join(skills, file)), link);
        assert.ok(target.startsWith(`${plugin}/`) && existsSync(target), `${file}: ${link}`);
      }
    }
    for (const name of ['poteto-agent', 'comment-sicko']) assert.ok(existsSync(join(skills, 'poteto-mode/references', `${name}.md`)));
    assert.ok(existsSync(join(skills, 'poteto-mode/SKILL.md')));
    for (const file of ['LICENSE', 'NOTICE.md', 'provenance.json']) assert.ok(existsSync(join(plugin, file)));
  } finally { rmSync(temporary, { recursive: true, force: true }); }
});
