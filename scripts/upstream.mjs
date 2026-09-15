import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { root, snapshot, changes } from '../lib/source.mjs';

const command = process.argv[2];
if (!['review', 'accept'].includes(command)) throw new Error('Usage: node scripts/upstream.mjs review|accept');
const path = join(root, 'upstream.lock.json');
const current = snapshot();
const previous = existsSync(path) ? JSON.parse(readFileSync(path, 'utf8')) : { files: {} };
console.log(JSON.stringify({ previous: previous.commit ?? null, current: current.commit, changes: changes(previous, current) }, null, 2));
if (command === 'accept') {
  writeFileSync(path, `${JSON.stringify(current, null, 2)}\n`);
  console.log('Recorded reviewed upstream inputs. Run npm run check before releasing.');
}
