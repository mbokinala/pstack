import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { lstatSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, realpathSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { root } from '../lib/source.mjs';

const skill = join(root, 'dist/codex/.agents/skills/poteto-mode');
const audit = join(skill, 'scripts/worktree-audit.sh');
const planChecker = join(skill, 'scripts/check-plan.mjs');
const run = (command, args, options = {}) => spawnSync(command, args, {
  encoding: 'utf8', timeout: 30_000, ...options,
});
const auditDependencies = ['bash', 'python3', 'git', 'du'];
const missing = auditDependencies.filter(command => run('sh', ['-c', 'command -v "$1"', 'check', command]).status !== 0);
const auditOptions = { skip: missing.length ? `Missing audit dependencies: ${missing.join(', ')}` : false };

function temporary(t) {
  const directory = realpathSync(mkdtempSync(join(tmpdir(), 'pstack-helpers-')));
  t.after(() => rmSync(directory, { recursive: true, force: true }));
  return directory;
}

function gitFixture(t) {
  const directory = temporary(t);
  const repo = join(directory, 'repo with spaces');
  mkdirSync(repo);
  const env = { ...process.env, GIT_CONFIG_NOSYSTEM: '1', GIT_CONFIG_GLOBAL: '/dev/null' };
  for (const key of ['GIT_DIR', 'GIT_WORK_TREE', 'GIT_INDEX_FILE', 'GIT_COMMON_DIR']) delete env[key];
  const git = (args, cwd = repo) => {
    const result = run('git', ['-c', 'core.hooksPath=/dev/null', '-c', 'commit.gpgsign=false', '-c', 'user.name=Fixture', '-c', 'user.email=fixture@example.test', '-C', cwd, ...args], { env });
    assert.equal(result.status, 0, result.stderr || result.error?.message);
    return result.stdout.trim();
  };
  git(['init', '-b', 'main']);
  writeFileSync(join(repo, 'tracked.txt'), 'base\n');
  writeFileSync(join(repo, '.gitignore'), 'build/\n');
  git(['add', '.']);
  git(['commit', '-m', 'fixture']);
  let number = 0;
  const worktree = name => {
    const path = join(directory, name);
    git(['worktree', 'add', '-b', `fixture-${++number}`, path]);
    return path;
  };
  return { directory, repo, env, git, worktree };
}

function snapshot(directory) {
  const result = {};
  function visit(relative) {
    const path = join(directory, relative);
    const stat = lstatSync(path, { bigint: true });
    result[relative] = { mode: stat.mode, mtime: stat.mtimeNs };
    if (stat.isDirectory()) {
      for (const child of readdirSync(path).sort()) visit(join(relative, child));
    } else {
      result[relative].hash = createHash('sha256').update(readFileSync(path)).digest('hex');
    }
  }
  visit('.');
  return result;
}

function auditRows(result) {
  assert.equal(result.status, 0, result.stderr || result.error?.message);
  const lines = result.stdout.trimEnd().split('\n');
  const header = lines.shift().split('\t');
  return new Map(lines.map(line => {
    const row = Object.fromEntries(line.split('\t').map((value, index) => [header[index], value]));
    return [JSON.parse(row.WORKTREE), row];
  }));
}

test('worktree audit preserves files and classifies dirty, untracked, ignored, locked, and whitespace paths', auditOptions, t => {
  const { directory, repo, env, git, worktree } = gitFixture(t);
  const clean = worktree('merged clean\tcopy\nnext');
  const tracked = worktree('dirty tracked');
  const untracked = worktree('valuable notes');
  const ignored = worktree('ignored database');
  const locked = worktree('locked worktree');
  const unmerged = worktree('unmerged work');
  writeFileSync(join(tracked, 'tracked.txt'), 'changed\n');
  writeFileSync(join(untracked, 'notes.txt'), 'valuable work\n');
  mkdirSync(join(ignored, 'build'));
  writeFileSync(join(ignored, 'build/database'), 'local data\n');
  git(['worktree', 'lock', locked]);
  writeFileSync(join(unmerged, 'tracked.txt'), 'new behavior\n');
  git(['commit', '-am', 'unmerged change'], unmerged);
  const before = snapshot(directory);
  const result = run('bash', [audit, repo], { env });
  const rows = auditRows(result);
  assert.deepEqual(snapshot(directory), before, 'audit must not change files, refs, index, or metadata mtimes');
  assert.equal(rows.size, 7);
  assert.equal(rows.get(repo).BUCKET, 'hold-primary');
  assert.equal(rows.get(clean).BUCKET, 'review-merged');
  assert.equal(rows.get(clean).MERGED, 'yes');
  assert.equal(rows.get(tracked).BUCKET, 'hold-files');
  assert.match(rows.get(tracked).FILES, /tracked:1/);
  assert.equal(rows.get(untracked).BUCKET, 'hold-files');
  assert.match(rows.get(untracked).FILES, /untracked:1/);
  assert.equal(rows.get(ignored).BUCKET, 'hold-files');
  assert.match(rows.get(ignored).FILES, /ignored:1/);
  assert.equal(rows.get(locked).BUCKET, 'hold-locked');
  assert.equal(rows.get(unmerged).MERGED, 'no');
  assert.equal(rows.get(unmerged).BUCKET, 'hold-unmerged-or-unknown');
  assert.match(result.stderr, /refs were not fetched/);
  const active = auditRows(run('bash', [audit, clean, '--base', 'main'], { env }));
  assert.equal(active.get(clean).BUCKET, 'hold-current');
});

test('worktree audit uses an explicit integration ref and rejects invalid arguments', auditOptions, t => {
  const { repo, env, git, worktree } = gitFixture(t);
  const linked = worktree('clean candidate');
  git(['branch', '-m', 'main', 'integration']);
  const unknown = auditRows(run('bash', [audit, repo], { env }));
  assert.equal(unknown.get(linked).MERGED, 'unknown');
  assert.equal(unknown.get(linked).BUCKET, 'hold-unmerged-or-unknown');
  const known = auditRows(run('bash', [audit, '--base', 'integration', repo], { env }));
  assert.equal(known.get(linked).MERGED, 'yes');
  for (const [args, diagnostic] of [
    [[repo, '--base', 'does-not-exist'], /--base must resolve/],
    [[repo, '--unexpected'], /unrecognized arguments/],
    [[temporary(t)], /pass a path inside a Git worktree/],
  ]) {
    const result = run('bash', [audit, ...args], { env });
    assert.equal(result.status, 2, result.stderr || result.error?.message);
    assert.match(result.stderr, diagnostic);
  }
});

function template() {
  const playbook = readFileSync(join(skill, 'playbooks/multi-phase-plan.md'), 'utf8');
  const match = playbook.match(/^````markdown\n(# [\s\S]*?)^````$/m);
  assert.ok(match, 'generated playbook must expose its actual fenced plan skeleton');
  assert.match(match[1], /^# <Program> plan\n/);
  return match[1];
}

test('patched plan checker accepts the actual portable template and ignores fenced examples', t => {
  const file = join(temporary(t), 'plan with spaces.md');
  const source = template();
  for (const text of [source, `---\ntitle: Plan fixture\n---\n${source}\n\`\`\`text\n## Not a real section\nExample: a long — dash and “quotes”.\n\`\`\`\n`.replaceAll('\n', '\r\n')]) {
    writeFileSync(file, text);
    const result = run(process.execPath, [planChecker, file]);
    assert.equal(result.status, 0, result.stderr || result.error?.message);
    assert.match(result.stdout, /1 PR sections, 0 problems/);
    assert.match(result.stdout, /verify-live=10/);
  }
});

test('patched plan checker reports missing evidence, program instructions, and prose violations', t => {
  const file = join(temporary(t), 'broken-plan.md');
  const source = template();
  const cases = [
    [source.replace(/^- \[ \] Lane 10\..*\n/m, ''), /lanes are \[1,2,3,4,5,6,7,8,9\], expected 1 to 10/],
    [source.replace('program objective', 'program summary'), /Program checklist lacks "program objective"/],
    [source.replace('installed skill distribution', 'local bundle'), /Program checklist lacks "installed skill distribution"/],
    [source.replace(/(Lane 2\..*)Save `[^`]+`/, '$1Save an image'), /lane 2 names no screenshot/],
    [source.replace('**Build.**', '**Implementation.**'), /sub-blocks are .*expected/],
    [source.replace('# <Program> plan', '# <Program> plan\nBad: prose — “example”.'), /mid-sentence colon/],
  ];
  for (const [text, diagnostic] of cases) {
    assert.notEqual(text, source, 'test mutation must change the extracted template');
    writeFileSync(file, text);
    const result = run(process.execPath, [planChecker, file]);
    assert.equal(result.status, 1, result.stderr || result.error?.message);
    assert.match(result.stderr, diagnostic);
  }
  const noArgument = run(process.execPath, [planChecker]);
  assert.equal(noArgument.status, 2);
  assert.match(noArgument.stderr, /Usage: node check-plan\.mjs/);
});
