import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import * as fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';
import { runCommand } from '../lib/installer.mjs';

const paths = {
  codex: ['.agents/skills/example/SKILL.md', '.codex/agents/reviewer.toml'],
  claude: ['.claude/skills/example/SKILL.md', '.claude/agents/reviewer.md'],
  cursor: ['.cursor/skills/example/SKILL.md', '.cursor/agents/reviewer.md'],
};
const read = (root, relative) => fs.readFile(path.join(root, relative), 'utf8');
async function write(root, relative, content) {
  await fs.mkdir(path.dirname(path.join(root, relative)), { recursive: true });
  await fs.writeFile(path.join(root, relative), content);
}
async function exists(filename) {
  try { await fs.lstat(filename); return true; } catch (error) { if (error.code === 'ENOENT') return false; throw error; }
}
async function refreshChecksums(dist) {
  const manifest = JSON.parse(await read(dist, 'manifest.json'));
  const files = {};
  async function walk(relative) {
    const info = await fs.lstat(path.join(dist, relative));
    if (info.isDirectory()) {
      for (const name of await fs.readdir(path.join(dist, relative))) await walk(`${relative}/${name}`);
    } else if (info.isFile()) {
      files[relative] = createHash('sha256').update(await fs.readFile(path.join(dist, relative))).digest('hex');
    }
  }
  for (const provider of manifest.providers) await walk(provider);
  await write(dist, 'manifest.json', JSON.stringify({ ...manifest, files }));
}
async function fixture(t) {
  const root = await fs.realpath(await fs.mkdtemp(path.join(os.tmpdir(), 'pstack-installer-')));
  t.after(() => fs.rm(root, { force: true, recursive: true }));
  const target = path.join(root, 'target');
  const dist = path.join(root, 'dist');
  await fs.mkdir(target);
  const manifest = { schemaVersion: 1, version: '1.0.0', upstream: { repository: 'https://example.test/upstream', commit: 'a'.repeat(40), version: '0.1.0' }, providers: ['codex', 'claude', 'cursor'] };
  await write(dist, 'manifest.json', JSON.stringify(manifest));
  for (const [provider, files] of Object.entries(paths)) {
    for (const relative of files) await write(dist, `${provider}/${relative}`, `original ${relative}\n`);
  }
  await refreshChecksums(dist);
  return { root, target, dist, manifest, run: async (command, options = {}) => {
    // Rebuild the fixture's package checksums after intentional source edits.
    if (command === 'install' || command === 'update') await refreshChecksums(dist);
    return runCommand(command, { target, dist, ...options });
  } };
}
async function conflict(promise, fragment) {
  await assert.rejects(promise, (error) => {
    assert.match(`${error.message}\n${error.details?.join('\n')}`, fragment);
    return true;
  });
}

test('installs multiple providers, preserves configuration, and reinstalls idempotently', async (t) => {
  const f = await fixture(t);
  await write(f.target, '.pstack/config.json', '{"custom":true}\n');
  const result = await f.run('install', { providers: ['codex', 'claude'] });
  assert.equal(result.writes.length, 4);
  assert.equal(await exists(path.join(f.target, 'manifest.json')), false);
  assert.equal(await exists(path.join(f.target, '.cursor')), false);
  for (const provider of ['codex', 'claude']) for (const relative of paths[provider]) assert.equal(await read(f.target, relative), `original ${relative}\n`);
  const state = await read(f.target, '.pstack/install.json');
  const again = await f.run('install', { providers: ['codex', 'claude'] });
  assert.deepEqual(again.writes, []);
  assert.equal(again.unchanged.length, 4);
  assert.equal(await read(f.target, '.pstack/install.json'), state);
  assert.equal(await read(f.target, '.pstack/config.json'), '{"custom":true}\n');
});

test('auto-detects hosts, defaults to Codex and Claude, and honors global target override', async (t) => {
  const f = await fixture(t);
  await fs.mkdir(path.join(f.target, '.cursor'));
  assert.deepEqual((await f.run('install')).providers, ['cursor']);
  const other = path.join(f.root, 'new-target');
  const result = await f.run('install', { scope: 'global', target: other });
  assert.deepEqual(result.providers, ['codex', 'claude']);
  assert.equal(await exists(path.join(other, '.agents/skills/example/SKILL.md')), true);
});

test('adding a provider retains previous ownership and discovers newly added host directories', async (t) => {
  const f = await fixture(t);
  await f.run('install', { providers: ['codex'] });
  await f.run('install', { providers: ['claude'] });
  await fs.mkdir(path.join(f.target, '.cursor'));
  await f.run('install');
  const state = JSON.parse(await read(f.target, '.pstack/install.json'));
  assert.deepEqual(state.providers, ['codex', 'claude', 'cursor']);
  assert.equal(Object.keys(state.files).length, 6);
});

test('updates selected providers, deletes obsolete files, and retains other release provenance', async (t) => {
  const f = await fixture(t);
  await f.run('install', { providers: ['codex', 'claude'] });
  await write(f.dist, 'manifest.json', JSON.stringify({ ...f.manifest, version: '2.0.0' }));
  await write(f.dist, `codex/${paths.codex[0]}`, 'new skill\n');
  await fs.unlink(path.join(f.dist, 'codex', paths.codex[1]));
  await write(f.dist, 'codex/.agents/skills/new/SKILL.md', 'newly added\n');
  await write(f.dist, `claude/${paths.claude[0]}`, 'unselected update\n');
  const result = await f.run('update', { providers: ['codex'] });
  assert.equal(result.writes.length, 2);
  assert.deepEqual(result.removes, [paths.codex[1]]);
  assert.equal(await exists(path.join(f.target, paths.codex[1])), false);
  assert.equal(await read(f.target, paths.codex[0]), 'new skill\n');
  assert.equal(await read(f.target, paths.claude[0]), `original ${paths.claude[0]}\n`);
  const state = JSON.parse(await read(f.target, '.pstack/install.json'));
  assert.equal(state.releases.codex.version, '2.0.0');
  assert.equal(state.releases.claude.version, '1.0.0');
});

test('repairs missing owned files and preserves executable source permissions', async (t) => {
  const f = await fixture(t);
  const script = '.agents/skills/example/scripts/run.sh';
  await write(f.dist, `codex/${script}`, '#!/bin/sh\nexit 0\n');
  await fs.chmod(path.join(f.dist, 'codex', script), 0o755);
  await f.run('install', { providers: ['codex'] });
  await fs.unlink(path.join(f.target, paths.codex[0]));
  const result = await f.run('update');
  assert.deepEqual(result.writes, [paths.codex[0]]);
  assert.equal((await fs.stat(path.join(f.target, script))).mode & 0o777, 0o755);
});

test('unmanaged collisions preflight the whole installation, even when content matches', async (t) => {
  const f = await fixture(t);
  await write(f.target, paths.claude[0], `original ${paths.claude[0]}\n`);
  await conflict(f.run('install', { providers: ['codex', 'claude'] }), /unmanaged file/);
  assert.equal(await exists(path.join(f.target, '.agents')), false);
  assert.equal(await exists(path.join(f.target, '.pstack')), false);
});

test('directory collisions and non-directory ancestors do not cause partial writes', async (t) => {
  const f = await fixture(t);
  await fs.mkdir(path.join(f.target, paths.claude[0]), { recursive: true });
  await conflict(f.run('install', { providers: ['codex', 'claude'] }), /not a regular file/);
  assert.equal(await exists(path.join(f.target, '.agents')), false);
  await fs.rm(path.join(f.target, '.claude'), { recursive: true });
  await write(f.target, '.claude', 'a file, not a directory');
  await conflict(f.run('install', { providers: ['codex', 'claude'] }), /non-directory ancestor/);
  assert.equal(await exists(path.join(f.target, '.agents')), false);
});

test('modified managed files and modified obsolete files block updates without any changes', async (t) => {
  const f = await fixture(t);
  await f.run('install', { providers: ['codex', 'claude'] });
  const state = await read(f.target, '.pstack/install.json');
  await write(f.target, paths.claude[0], 'local work');
  await write(f.dist, `codex/${paths.codex[0]}`, 'upstream work');
  await conflict(f.run('update'), /locally modified/);
  assert.equal(await read(f.target, paths.codex[0]), `original ${paths.codex[0]}\n`);
  assert.equal(await read(f.target, '.pstack/install.json'), state);
  await fs.unlink(path.join(f.dist, 'claude', paths.claude[0]));
  await conflict(f.run('update'), /obsolete installed file was locally modified/);
  assert.equal(await read(f.target, '.pstack/install.json'), state);
});

test('remove preserves local edits, unmanaged additions, and user configuration', async (t) => {
  const f = await fixture(t);
  await f.run('install', { providers: ['codex', 'claude'] });
  await write(f.target, paths.codex[0], 'local work');
  await write(f.target, '.agents/skills/example/notes.txt', 'my notes');
  await write(f.target, '.pstack/config.json', '{"mine":true}');
  const first = await f.run('remove', { providers: ['claude'] });
  assert.equal(first.removes.length, 2);
  assert.equal(await exists(path.join(f.target, '.claude')), false);
  assert.deepEqual(JSON.parse(await read(f.target, '.pstack/install.json')).providers, ['codex']);
  const second = await f.run('remove');
  assert.deepEqual(second.preserved, [paths.codex[0]]);
  assert.equal(await exists(path.join(f.target, '.pstack/install.json')), false);
  assert.equal(await read(f.target, '.pstack/config.json'), '{"mine":true}');
  assert.equal(await read(f.target, paths.codex[0]), 'local work');
  assert.equal(await read(f.target, '.agents/skills/example/notes.txt'), 'my notes');
  assert.equal(await exists(path.join(f.target, '.codex')), false);
});

test('dry-run install, update, and remove leave files and installation record untouched', async (t) => {
  const f = await fixture(t);
  const nonexistent = path.join(f.root, 'absent', 'target');
  const planned = await f.run('install', { providers: ['codex'], target: nonexistent, dryRun: true });
  assert.equal(planned.writes.length, 2);
  assert.equal(await exists(path.join(f.root, 'absent')), false);
  await f.run('install', { providers: ['codex'] });
  const state = await read(f.target, '.pstack/install.json');
  await write(f.dist, `codex/${paths.codex[0]}`, 'next');
  assert.equal((await f.run('update', { dryRun: true })).writes.length, 1);
  assert.equal((await f.run('remove', { dryRun: true })).removes.length, 2);
  assert.equal(await read(f.target, '.pstack/install.json'), state);
  assert.equal(await read(f.target, paths.codex[0]), `original ${paths.codex[0]}\n`);
});

test('rejects source symlinks and destination symlink ancestors without following them', async (t) => {
  const f = await fixture(t);
  const outside = path.join(f.root, 'outside');
  await fs.mkdir(outside);
  await fs.symlink(outside, path.join(f.target, '.claude'), 'dir');
  await conflict(f.run('install', { providers: ['codex', 'claude'] }), /symlink at .claude/);
  assert.deepEqual(await fs.readdir(outside), []);
  assert.equal(await exists(path.join(f.target, '.agents')), false);
  await fs.unlink(path.join(f.target, '.claude'));
  await fs.unlink(path.join(f.dist, 'codex', paths.codex[0]));
  await fs.symlink(path.join(f.dist, 'claude', paths.claude[0]), path.join(f.dist, 'codex', paths.codex[0]));
  await conflict(f.run('install', { providers: ['codex'] }), /symlinked distribution/);
  assert.equal(await exists(path.join(f.target, '.agents')), false);
});

test('rejects a symlinked target or installation record', async (t) => {
  const f = await fixture(t);
  const alias = path.join(f.root, 'alias');
  await fs.symlink(f.target, alias, 'dir');
  await conflict(f.run('install', { target: alias, providers: ['codex'] }), /Target is a symlink/);
  await fs.mkdir(path.join(f.target, '.pstack'));
  await fs.symlink(path.join(f.dist, 'manifest.json'), path.join(f.target, '.pstack/install.json'));
  await conflict(f.run('install', { providers: ['codex'] }), /symlink at .pstack\/install.json/);
});

test('uninstall preserves leaf symlinks, but rejects traversal through symlink ancestors', async (t) => {
  const f = await fixture(t);
  await f.run('install', { providers: ['codex'] });
  const outside = path.join(f.root, 'external.txt');
  await fs.writeFile(outside, 'keep me');
  await fs.unlink(path.join(f.target, paths.codex[0]));
  await fs.symlink(outside, path.join(f.target, paths.codex[0]));
  const result = await f.run('remove');
  assert.deepEqual(result.preserved, [paths.codex[0]]);
  assert.equal(await fs.readFile(outside, 'utf8'), 'keep me');
  assert.equal((await fs.lstat(path.join(f.target, paths.codex[0]))).isSymbolicLink(), true);
  await fs.rm(path.join(f.target, '.agents'), { recursive: true });
  await f.run('install', { providers: ['codex'] });
  await fs.rename(path.join(f.target, '.agents'), path.join(f.root, 'moved-agents'));
  await fs.symlink(path.join(f.root, 'moved-agents'), path.join(f.target, '.agents'), 'dir');
  await conflict(f.run('remove'), /symlink at .agents/);
  assert.equal(await exists(path.join(f.target, paths.codex[1])), true);
});

test('rejects path traversal in the ownership manifest before changing anything', async (t) => {
  const f = await fixture(t);
  await f.run('install', { providers: ['codex'] });
  const state = JSON.parse(await read(f.target, '.pstack/install.json'));
  const entry = Object.values(state.files)[0];
  for (const dangerous of ['../external', '.agents/../../external', '/tmp/external', '.agents\\..\\external', '.pstack/config.json']) {
    await write(f.target, '.pstack/install.json', JSON.stringify({ ...state, files: { ...state.files, [dangerous]: entry } }));
    await conflict(f.run('remove'), /Unsafe managed path/);
    assert.equal(await exists(path.join(f.target, paths.codex[0])), true);
  }
});

test('doctor detects edited and missing files; missing optional commands are only warnings', async (t) => {
  const f = await fixture(t);
  await f.run('install', { providers: ['codex'] });
  const originalPath = process.env.PATH;
  let healthy;
  try {
    process.env.PATH = path.join(f.root, 'no-tools');
    healthy = await f.run('doctor');
  } finally { process.env.PATH = originalPath; }
  assert.equal(healthy.ok, true);
  assert.equal(healthy.checks.length, 2);
  assert.equal(healthy.dependencies.length, 6);
  assert.equal(healthy.dependencies.every((dependency) => dependency.status === 'warning'), true);
  await write(f.target, paths.codex[0], 'edited');
  await fs.unlink(path.join(f.target, paths.codex[1]));
  const broken = await f.run('doctor');
  assert.equal(broken.ok, false);
  assert.equal(broken.checks.filter((check) => check.status === 'error').length, 2);
  assert.equal((await f.run('doctor', { providers: ['claude'] })).ok, false);
});

test('CLI provides help and rejects unknown commands/options without installation side effects', async (t) => {
  const f = await fixture(t);
  const cli = fileURLToPath(new URL('../bin/pstack.mjs', import.meta.url));
  const help = spawnSync(process.execPath, [cli, '--help'], { encoding: 'utf8', cwd: f.target });
  assert.equal(help.status, 0);
  assert.match(help.stdout, /Usage: pstack/);
  for (const args of [['explode'], ['install', '--unexpected'], ['install', '--providers'], ['install', '--scope=everywhere'], ['install', '--providers=unknown']]) {
    const result = spawnSync(process.execPath, [cli, ...args], { encoding: 'utf8', cwd: f.target });
    assert.equal(result.status, 1, result.stderr);
  }
  assert.deepEqual(await fs.readdir(f.target), []);
});


test('rejects corrupt, missing, and unrecorded bundled files before destination writes', async (t) => {
  const f = await fixture(t);
  const original = await read(f.dist, `claude/${paths.claude[0]}`);
  const rawInstall = () => runCommand('install', { target: f.target, dist: f.dist, providers: ['codex', 'claude'] });
  await write(f.dist, `claude/${paths.claude[0]}`, 'corrupted bundle');
  await conflict(rawInstall(), /Integrity check failed/);
  assert.deepEqual(await fs.readdir(f.target), []);
  await write(f.dist, `claude/${paths.claude[0]}`, original);
  await fs.unlink(path.join(f.dist, 'claude', paths.claude[1]));
  await conflict(rawInstall(), /Missing bundled file/);
  assert.deepEqual(await fs.readdir(f.target), []);
  await write(f.dist, `claude/${paths.claude[1]}`, `original ${paths.claude[1]}\n`);
  await write(f.dist, 'codex/.agents/skills/example/unrecorded.md', 'extra');
  await conflict(rawInstall(), /Unrecorded bundled file/);
  assert.deepEqual(await fs.readdir(f.target), []);
});
