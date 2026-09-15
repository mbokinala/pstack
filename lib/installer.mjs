import { createHash, randomUUID } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import * as fs from 'node:fs/promises';
import { homedir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export const PROVIDERS = Object.freeze(['codex', 'claude', 'cursor']);
const ROOTS = { codex: ['.agents', '.codex'], claude: ['.claude'], cursor: ['.cursor'] };
const STATE_PATH = '.pstack/install.json';
const DEFAULT_DIST = fileURLToPath(new URL('../dist/', import.meta.url));
const hash = (data) => createHash('sha256').update(data).digest('hex');

export class InstallError extends Error {
  constructor(message, details = []) {
    super(message);
    this.name = 'InstallError';
    this.details = details;
  }
}

async function stat(filename) {
  try { return await fs.lstat(filename); }
  catch (error) { if (error.code === 'ENOENT') return null; throw error; }
}

function validProviders(providers) {
  if (!Array.isArray(providers) || !providers.length || providers.some((p) => !PROVIDERS.includes(p))) {
    throw new InstallError(`Providers must be one or more of: ${PROVIDERS.join(', ')}.`);
  }
  return [...new Set(providers)];
}

function validateOwnedPath(relative, provider) {
  if (typeof relative !== 'string' || relative.includes('\\') || relative.split('/').some((part) => !part || part === '.' || part === '..') ||
      !ROOTS[provider]?.some((root) => relative.startsWith(`${root}/`))) {
    throw new InstallError(`Unsafe managed path: ${String(relative)}`);
  }
}

// Canonicalize system aliases (such as /tmp on macOS), but never follow a
// symlink at the target itself or inside an agent's managed directory tree.
async function targetPath(input) {
  const absolute = path.resolve(input);
  const targetStat = await stat(absolute);
  if (targetStat?.isSymbolicLink()) throw new InstallError(`Target is a symlink: ${absolute}`);
  if (targetStat && !targetStat.isDirectory()) throw new InstallError(`Target is not a directory: ${absolute}`);
  let ancestor = path.dirname(absolute);
  const missing = [path.basename(absolute)];
  while (!(await stat(ancestor))) {
    missing.unshift(path.basename(ancestor));
    ancestor = path.dirname(ancestor);
  }
  return path.join(await fs.realpath(ancestor), ...missing);
}

async function inspect(target, relative) {
  const parts = relative.split('/');
  let current = target;
  for (let i = 0; i < parts.length; i++) {
    current = path.join(current, parts[i]);
    const info = await stat(current);
    if (!info) return { kind: 'missing' };
    if (info.isSymbolicLink()) return { kind: 'unsafe', ancestor: i < parts.length - 1, reason: `symlink at ${parts.slice(0, i + 1).join('/')}` };
    if (i < parts.length - 1) {
      if (!info.isDirectory()) return { kind: 'unsafe', reason: `non-directory ancestor ${parts.slice(0, i + 1).join('/')}` };
    } else if (info.isFile()) {
      const data = await fs.readFile(current);
      return { kind: 'file', sha256: hash(data), data, mode: info.mode & 0o777 };
    } else return { kind: 'other', reason: 'path is not a regular file' };
  }
}

async function loadState(target) {
  const current = await inspect(target, STATE_PATH);
  if (current.kind === 'missing') return { state: null, current };
  if (current.kind !== 'file') throw new InstallError(`Cannot read installation record: ${current.reason}`);
  let state;
  try { state = JSON.parse(current.data.toString('utf8')); }
  catch { throw new InstallError('Invalid .pstack/install.json; refusing to change installed files.'); }
  if (state.schemaVersion !== 1 || !state.files || typeof state.files !== 'object' || Array.isArray(state.files)) {
    throw new InstallError('Unsupported or malformed .pstack/install.json.');
  }
  validProviders(state.providers);
  for (const [relative, entry] of Object.entries(state.files)) {
    validateOwnedPath(relative, entry?.provider);
    if (!state.providers.includes(entry.provider) || !/^[a-f0-9]{64}$/.test(entry.sha256)) {
      throw new InstallError(`Invalid installation record for ${relative}.`);
    }
  }
  return { state, current };
}

async function readDistribution(dist, providers) {
  let manifest;
  try { manifest = JSON.parse(await fs.readFile(path.join(dist, 'manifest.json'), 'utf8')); }
  catch (error) { throw new InstallError(`Cannot read bundled distribution at ${dist}: ${error.message}`); }
  if (manifest.schemaVersion !== 1 || typeof manifest.version !== 'string' || !Array.isArray(manifest.providers) ||
      !manifest.files || typeof manifest.files !== 'object' || Array.isArray(manifest.files)) {
    throw new InstallError('Unsupported distribution manifest.');
  }
  for (const [bundledPath, digest] of Object.entries(manifest.files)) {
    const [provider, ...parts] = bundledPath.split('/');
    validateOwnedPath(parts.join('/'), provider);
    if (!manifest.providers.includes(provider) || !/^[a-f0-9]{64}$/.test(digest)) throw new InstallError(`Invalid distribution checksum: ${bundledPath}`);
  }
  const files = new Map();
  for (const provider of providers) {
    if (!manifest.providers.includes(provider)) throw new InstallError(`Distribution does not include ${provider}.`);
    const base = path.join(dist, provider);
    let count = 0;
    async function walk(relative) {
      const info = await stat(path.join(base, relative));
      if (!info || info.isSymbolicLink()) throw new InstallError(`Missing or symlinked distribution path: ${provider}/${relative}`);
      if (info.isDirectory()) {
        for (const name of (await fs.readdir(path.join(base, relative))).sort()) await walk(`${relative}/${name}`);
      } else if (info.isFile()) {
        validateOwnedPath(relative, provider);
        const data = await fs.readFile(path.join(base, relative));
        const sha256 = hash(data);
        const bundledPath = `${provider}/${relative}`;
        if (!Object.hasOwn(manifest.files, bundledPath)) throw new InstallError(`Unrecorded bundled file: ${bundledPath}`);
        if (manifest.files[bundledPath] !== sha256) throw new InstallError(`Integrity check failed for bundled file: ${bundledPath}`);
        files.set(relative, { provider, data, sha256, mode: info.mode & 0o777 });
        count++;
      } else throw new InstallError(`Unsupported distribution file: ${provider}/${relative}`);
    }
    const baseInfo = await stat(base);
    if (!baseInfo?.isDirectory() || baseInfo.isSymbolicLink()) throw new InstallError(`Invalid provider directory: ${base}`);
    for (const root of ROOTS[provider]) if (await stat(path.join(base, root))) await walk(root);
    if (!count) throw new InstallError(`Distribution contains no files for ${provider}.`);
  }
  for (const bundledPath of Object.keys(manifest.files)) {
    const [provider, ...parts] = bundledPath.split('/');
    if (providers.includes(provider) && !files.has(parts.join('/'))) throw new InstallError(`Missing bundled file: ${bundledPath}`);
  }
  return { manifest, files };
}

async function detectProviders(target) {
  const detected = [];
  for (const provider of PROVIDERS) {
    for (const root of ROOTS[provider]) {
      if (await stat(path.join(target, root))) { detected.push(provider); break; }
    }
  }
  return detected.length ? detected : ['codex', 'claude'];
}

async function ensureDirectory(target, relative = '') {
  await fs.mkdir(target, { recursive: true });
  const targetInfo = await fs.lstat(target);
  if (!targetInfo.isDirectory() || targetInfo.isSymbolicLink()) throw new InstallError(`Unsafe target directory: ${target}`);
  let current = target;
  for (const part of relative.split('/').filter(Boolean)) {
    current = path.join(current, part);
    try { await fs.mkdir(current); }
    catch (error) { if (error.code !== 'EEXIST') throw error; }
    const info = await fs.lstat(current);
    if (!info.isDirectory() || info.isSymbolicLink()) throw new InstallError(`Unsafe destination directory: ${current}`);
  }
}

async function verifyUnchanged(target, relative, expected) {
  const actual = await inspect(target, relative);
  if (actual.kind !== expected.kind || (actual.kind === 'file' && actual.sha256 !== expected.sha256)) {
    throw new InstallError(`Destination changed while installing: ${relative}. Run the command again.`);
  }
}

async function writeAtomic(target, relative, data, mode, before) {
  await ensureDirectory(target, path.posix.dirname(relative));
  await verifyUnchanged(target, relative, before);
  const destination = path.join(target, relative);
  const temporary = `${destination}.pstack-${randomUUID()}.tmp`;
  try {
    await fs.writeFile(temporary, data, { flag: 'wx', mode });
    await fs.chmod(temporary, mode);
    await fs.rename(temporary, destination);
  } finally { await fs.rm(temporary, { force: true }); }
}

async function pruneDirectories(target, removed) {
  const directories = new Set();
  for (const relative of removed) {
    let directory = path.posix.dirname(relative);
    while (directory !== '.') { directories.add(directory); directory = path.posix.dirname(directory); }
  }
  for (const relative of [...directories].sort((a, b) => b.split('/').length - a.split('/').length)) {
    // rmdir only removes empty directories; user configuration/additions survive.
    try { await fs.rmdir(path.join(target, relative)); }
    catch (error) { if (!['ENOENT', 'ENOTEMPTY', 'EEXIST'].includes(error.code)) throw error; }
  }
}

async function doctor(target, state, requested) {
  const providers = requested ? validProviders(requested) : state?.providers ?? [];
  const checks = [];
  if (!state) checks.push({ status: 'error', path: STATE_PATH, message: 'No pstack installation found.' });
  for (const [relative, entry] of Object.entries(state?.files ?? {})) {
    if (!providers.includes(entry.provider)) continue;
    const current = await inspect(target, relative);
    checks.push(current.kind === 'file' && current.sha256 === entry.sha256
      ? { status: 'ok', path: relative, message: 'Matches installed file.' }
      : { status: 'error', path: relative, message: current.kind === 'file' ? 'Locally modified.' : current.reason ?? 'Missing.' });
  }
  for (const provider of providers) {
    if (!state?.providers.includes(provider)) checks.push({ status: 'error', path: provider, message: 'Provider is not installed.' });
  }
  const commands = { git: ['--version'], gh: ['--version'], bun: ['--version'], rg: ['--version'], jq: ['--version'], python3: ['--version'] };
  const dependencies = Object.entries(commands).map(([name, args]) => {
    const result = spawnSync(name, args, { encoding: 'utf8', timeout: 5000, stdio: 'ignore' });
    return { name, status: !result.error && result.status === 0 ? 'ok' : 'warning', message: 'Optional workflow dependency.' };
  });
  return { command: 'doctor', target, providers, version: state?.version, checks, dependencies, ok: checks.every((check) => check.status !== 'error') };
}

/** Install/update/remove only files recorded in .pstack/install.json. */
export async function runCommand(command, options = {}) {
  if (!['install', 'update', 'remove', 'doctor'].includes(command)) throw new InstallError(`Unknown command: ${command}`);
  const scope = options.scope ?? 'project';
  if (!['project', 'global'].includes(scope)) throw new InstallError('Scope must be project or global.');
  const target = await targetPath(options.target ?? (scope === 'global' ? homedir() : process.cwd()));
  const { state, current: stateBefore } = await loadState(target);
  if (command === 'doctor') return doctor(target, state, options.providers);
  if (command === 'update' && !state) throw new InstallError(`No pstack installation found in ${target}. Run install first.`);
  const providers = validProviders(options.providers ?? (command === 'install' ? await detectProviders(target) : state?.providers ?? await detectProviders(target)));
  if (command === 'remove' && !state) return { command, target, providers, dryRun: !!options.dryRun, writes: [], removes: [], preserved: [], unchanged: [], ok: true };

  const selected = new Set(providers);
  const nextFiles = { ...(state?.files ?? {}) };
  const writes = [], removes = [], preserved = [], unchanged = [], conflicts = [];
  let distribution;
  if (command !== 'remove') {
    distribution = await readDistribution(path.resolve(options.dist ?? DEFAULT_DIST), providers);
    for (const [relative, desired] of distribution.files) {
      const previous = state?.files[relative];
      const current = await inspect(target, relative);
      if (current.kind === 'unsafe' || current.kind === 'other') conflicts.push(`${relative}: ${current.reason}`);
      else if (current.kind === 'file' && !previous) conflicts.push(`${relative}: unmanaged file already exists`);
      else if (current.kind === 'file' && current.sha256 !== previous.sha256) conflicts.push(`${relative}: installed file was locally modified`);
      else if (current.kind === 'file' && current.sha256 === desired.sha256) unchanged.push(relative);
      else writes.push({ relative, desired, before: current });
      nextFiles[relative] = { provider: desired.provider, sha256: desired.sha256 };
    }
  }
  for (const [relative, previous] of Object.entries(state?.files ?? {})) {
    if (!selected.has(previous.provider) || distribution?.files.has(relative)) continue;
    const current = await inspect(target, relative);
    if (current.kind === 'missing') delete nextFiles[relative];
    else if (current.kind === 'file' && current.sha256 === previous.sha256) {
      removes.push({ relative, before: current });
      delete nextFiles[relative];
    } else if (command === 'remove') {
      // Do not traverse symlinked ancestors even to remove unrelated files.
      if (current.kind === 'unsafe' && current.ancestor !== false) conflicts.push(`${relative}: ${current.reason}`);
      else { preserved.push(relative); delete nextFiles[relative]; }
    } else conflicts.push(`${relative}: obsolete installed file was locally modified (${current.reason ?? 'content changed'})`);
  }
  if (conflicts.length) throw new InstallError('No files changed. Resolve these conflicts before retrying:', conflicts);
  const nextProviders = command === 'remove'
    ? state.providers.filter((provider) => !selected.has(provider))
    : [...new Set([...(state?.providers ?? []), ...providers])];
  const releases = { ...(state?.releases ?? {}) };
  for (const provider of providers) {
    if (command === 'remove') delete releases[provider];
    else releases[provider] = { version: distribution.manifest.version, upstream: distribution.manifest.upstream };
  }
  const nextState = {
    schemaVersion: 1,
    version: distribution?.manifest.version ?? state?.version,
    upstream: distribution?.manifest.upstream ?? state?.upstream,
    providers: nextProviders,
    releases,
    files: Object.fromEntries(Object.entries(nextFiles).sort(([a], [b]) => a.localeCompare(b))),
  };
  if (!options.dryRun) {
    for (const change of writes) await writeAtomic(target, change.relative, change.desired.data, change.desired.mode, change.before);
    for (const change of removes) {
      await verifyUnchanged(target, change.relative, change.before);
      await fs.unlink(path.join(target, change.relative));
    }
    if (nextProviders.length) {
      const stateData = Buffer.from(`${JSON.stringify(nextState, null, 2)}\n`);
      if (stateBefore.sha256 !== hash(stateData)) await writeAtomic(target, STATE_PATH, stateData, 0o644, stateBefore);
    } else {
      await verifyUnchanged(target, STATE_PATH, stateBefore);
      await fs.unlink(path.join(target, STATE_PATH));
    }
    await pruneDirectories(target, [...removes.map((change) => change.relative), ...(nextProviders.length ? [] : [STATE_PATH])]);
  }
  return { command, target, providers, version: nextState.version, dryRun: !!options.dryRun, writes: writes.map((change) => change.relative), removes: removes.map((change) => change.relative), preserved, unchanged, ok: true };
}
