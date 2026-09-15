import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { execFileSync } from 'node:child_process';
import { root, files, sha256 } from '../lib/source.mjs';
import { applyPatches, frontmatter, skill } from '../lib/convert.mjs';

test('upstream patch drift cannot silently omit an adaptation', () => {
  const patches = [{ path: 'x', find: 'old', replace: 'new', reason: 'compatibility' }];
  assert.equal(applyPatches('old text', 'x', patches), 'new text');
  assert.throws(() => applyPatches('upstream changed', 'x', patches), /Patch drift/);
  assert.throws(() => applyPatches('old old', 'x', patches), /Patch drift/);
});

test('normalizes real upstream malformed descriptions and preserves explicit-only policy', () => {
  for (const name of ['how', 'interrogate', 'maintain-verification-skill']) {
    const input = readFileSync(join(root, 'upstream/cursor-plugins/pstack/skills', name, 'SKILL.md'), 'utf8');
    const codex = skill(input, name, 'codex');
    const claude = skill(input, name, 'claude');
    assert.equal(codex.explicit, true);
    assert.equal(frontmatter(codex.text, name).data['disable-model-invocation'], undefined);
    assert.equal(frontmatter(claude.text, name).data['disable-model-invocation'], true);
  }
});

test('build is reproducible and packages all cross-skill dependencies', () => {
  const hash = () => sha256(files(join(root, 'dist')).map(p => `${p}:${sha256(readFileSync(join(root, 'dist', p)))}`).join('\n'));
  const before = hash();
  execFileSync(process.execPath, ['scripts/build.mjs'], { cwd: root });
  assert.equal(hash(), before);
  const manifest = JSON.parse(readFileSync(join(root, 'dist/manifest.json'), 'utf8'));
  for (const name of ['poteto-mode', 'how', 'why', 'deslop', 'control-cli', 'control-ui', 'create-skill']) assert.ok(manifest.skills.includes(name));
  for (const path of ['codex/.codex/agents/poteto-agent.toml', 'claude/.claude/agents/comment-sicko.md']) assert.ok(existsSync(join(root, 'dist', path)));
});
