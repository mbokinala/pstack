import { existsSync, readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { parse } from 'yaml';
import { root, files, sha256 } from '../lib/source.mjs';
import { frontmatter, providers } from '../lib/convert.mjs';

const dist = join(root, 'dist');
const manifest = JSON.parse(readFileSync(join(dist, 'manifest.json'), 'utf8'));
const errors = [];
const fail = text => errors.push(text);
for (const [path, expected] of Object.entries(manifest.files)) {
  if (!existsSync(join(dist, path)) || sha256(readFileSync(join(dist, path))) !== expected) fail(`Artifact differs from manifest: ${path}`);
}
for (const provider of manifest.providers) {
  const skillsRoot = join(dist, provider, providers[provider].skills);
  for (const name of manifest.skills) {
    const path = join(skillsRoot, name, 'SKILL.md');
    try {
      const { data, body } = frontmatter(readFileSync(path, 'utf8'), path);
      if (data.name !== name || name.length > 64 || !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(name)) fail(`Invalid name: ${path}`);
      if (!data.description.trim() || data.description.length > 1024) fail(`Invalid description: ${path}`);
      if (body.split('\n').length > 500) fail(`Skill exceeds 500 lines: ${path}`);
      if (provider === 'codex') {
        const metadata = parse(readFileSync(join(dirname(path), 'agents/openai.yaml'), 'utf8'));
        if (typeof metadata.policy?.allow_implicit_invocation !== 'boolean') fail(`Missing invocation policy: ${path}`);
      }
      const supported = new Set(['name', 'description', 'license', 'compatibility', 'metadata', 'allowed-tools', ...(provider === 'codex' ? [] : ['disable-model-invocation']), ...(provider === 'claude' ? ['paths'] : [])]);
      for (const key of Object.keys(data)) if (!supported.has(key)) fail(`Unsupported frontmatter ${key}: ${path}`);
    } catch (error) { fail(`${path}: ${error.message}`); }
  }
  for (const relative of files(skillsRoot).filter(p => p.endsWith('.md'))) {
    const path = join(skillsRoot, relative);
    const text = readFileSync(path, 'utf8');
    for (const match of text.matchAll(/\]\(([^)]+)\)/g)) {
      const link = match[1].split('#')[0];
      if (!link || /^(?:[a-z]+:|\/|<)/i.test(link) || /[<>\s]/.test(link)) continue;
      if (!existsSync(resolve(dirname(path), link))) fail(`Broken link ${link}: ${relative}`);
    }
    if (text.includes('{{SKILLS_DIR}}')) fail(`Unbound provider path: ${relative}`);
    if (provider !== 'cursor' && /\.cursor\/(?:skills|rules|projects)|api2\.cursor\.sh|git show origin\/main:pstack|subagent_type|cloud_base_branch|environment: "cloud"/.test(text)) fail(`Cursor runtime dependency: ${relative}`);
  }
}
if (errors.length) {
  console.error(errors.join('\n'));
  process.exitCode = 1;
} else console.log(`Validated metadata, invocation policies, links, hashes, and portability for ${manifest.skills.length * manifest.providers.length} skills.`);
