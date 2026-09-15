import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { readdirSync, readFileSync, lstatSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

export const root = dirname(dirname(fileURLToPath(import.meta.url)));
export const upstream = join(root, 'upstream/cursor-plugins');
export const source = join(upstream, 'pstack');
export const repository = 'https://github.com/cursor/plugins.git';
export const sha256 = data => createHash('sha256').update(data).digest('hex');
export const git = (...args) => execFileSync('git', ['-C', upstream, ...args], { encoding: 'utf8' }).trim();

export function files(directory, prefix = '') {
  return readdirSync(join(directory, prefix)).sort().flatMap(name => {
    const relative = prefix ? `${prefix}/${name}` : name;
    const stat = lstatSync(join(directory, relative));
    if (stat.isSymbolicLink()) throw new Error(`Source symlink is not supported: ${relative}`);
    return stat.isDirectory() ? files(directory, relative) : [relative];
  });
}

export function snapshot() {
  if (git('status', '--porcelain', '--', 'pstack')) throw new Error('Upstream pstack has local changes. Keep the submodule untouched.');
  const paths = files(source).filter(path => path.startsWith('skills/') || path.startsWith('agents/') || path === 'LICENSE' || path === '.cursor-plugin/plugin.json');
  return {
    repository,
    commit: git('rev-parse', 'HEAD'),
    version: JSON.parse(readFileSync(join(source, '.cursor-plugin/plugin.json'), 'utf8')).version,
    files: Object.fromEntries(paths.map(path => [path, sha256(readFileSync(join(source, path)))])),
  };
}

export function changes(before, after) {
  return [...new Set([...Object.keys(before.files), ...Object.keys(after.files)])].sort()
    .filter(path => before.files[path] !== after.files[path])
    .map(path => ({ path, status: !before.files[path] ? 'added' : !after.files[path] ? 'removed' : 'changed' }));
}

export function verifyPin() {
  const approved = JSON.parse(readFileSync(join(root, 'upstream.lock.json'), 'utf8'));
  const current = snapshot();
  const diff = changes(approved, current);
  if (approved.commit !== current.commit || diff.length) {
    throw new Error(`Unreviewed upstream revision. Run npm run upstream:review, reconcile adaptations, then npm run upstream:accept.\n${diff.map(x => `${x.status}: ${x.path}`).join('\n')}`);
  }
  return current;
}
