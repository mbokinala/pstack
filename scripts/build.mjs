import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync, chmodSync } from 'node:fs';
import { join, dirname, basename } from 'node:path';
import { root, source, files, verifyPin, sha256 } from '../lib/source.mjs';
import { applyPatches, frontmatter, portable, providers, skill } from '../lib/convert.mjs';

const provenance = verifyPin();
const version = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8')).version;
const patches = JSON.parse(readFileSync(join(root, 'adapters/patches.json'), 'utf8'));
const runtime = readFileSync(join(root, 'adapters/runtime.md'), 'utf8');
const overrides = join(root, 'adapters/overrides');
const additions = join(root, 'adapters/additions');
const dist = join(root, 'dist');
const write = (path, text) => { mkdirSync(dirname(path), { recursive: true }); writeFileSync(path, text); };
const inputFiles = files(source).filter(p => p.startsWith('skills/'));
for (const path of files(overrides)) if (!existsSync(join(source, path))) throw new Error(`Override has no upstream source: ${path}`);
for (const patch of patches) if (!inputFiles.includes(patch.path)) throw new Error(`Patch targets absent source: ${patch.path}`);

const inputs = new Map(inputFiles.map(path => {
  const location = existsSync(join(overrides, path)) ? join(overrides, path) : join(source, path);
  let data = readFileSync(location);
  if (patches.some(p => p.path === path)) {
    if (location.startsWith(overrides)) throw new Error(`Both override and patches target ${path}`);
    data = Buffer.from(applyPatches(data.toString(), path, patches));
  }
  return [path, data];
}));
for (const path of files(additions)) {
  if (inputs.has(path)) throw new Error(`Addition collides with source: ${path}`);
  inputs.set(path, readFileSync(join(additions, path)));
}

rmSync(dist, { recursive: true, force: true });
for (const [provider, settings] of Object.entries(providers)) {
  const target = join(dist, provider);
  for (const [path, data] of inputs) {
    const destination = join(target, settings.skills, path.slice('skills/'.length));
    if (basename(path) === 'SKILL.md') {
      const converted = skill(data.toString(), path.split('/')[1], provider);
      write(destination, converted.text);
      if (provider === 'codex') {
        write(join(dirname(destination), 'agents/openai.yaml'), `policy:\n  allow_implicit_invocation: ${!converted.explicit}\n`);
      }
      write(join(dirname(destination), 'references/pstack-runtime.md'), portable(runtime, provider));
      write(join(dirname(destination), 'LICENSE'), readFileSync(join(source, 'LICENSE')));
    } else if (path.endsWith('.md')) {
      write(destination, portable(data.toString(), provider));
    } else {
      write(destination, data);
      if (data.toString().startsWith('#!')) chmodSync(destination, 0o755);
    }
  }
  const entry = join(target, settings.skills, 'poteto-mode');
  for (const name of ['poteto-agent', 'comment-sicko']) {
    const { data, body } = frontmatter(readFileSync(join(source, 'agents', `${name}.md`), 'utf8'), name);
    const prompt = `Find the installed poteto-mode skill and read references/pstack-runtime.md first. Skill names resolve from the installed skill catalog; if absent, use ${settings.skills} in the project or home directory.\n\n${portable(body, provider)}`;
    write(join(entry, 'references', `${name}.md`), prompt);
    if (provider === 'codex') {
      const quoted = JSON.stringify;
      write(join(target, settings.agents, `${name}.toml`), `name = ${quoted(name)}\ndescription = ${quoted(portable(data.description, provider))}\ndeveloper_instructions = ${quoted(prompt)}\n`);
    } else {
      write(join(target, settings.agents, `${name}.md`), `---\nname: ${name}\ndescription: ${JSON.stringify(portable(data.description, provider))}\n${provider === 'claude' ? 'model: inherit\n' : ''}---\n\n${prompt}`);
    }
  }
}
const manifest = {
  schemaVersion: 1, version,
  upstream: { repository: provenance.repository, commit: provenance.commit, version: provenance.version },
  providers: Object.keys(providers),
  skills: [...inputs.keys()].filter(p => p.endsWith('/SKILL.md')).map(p => p.split('/')[1]).sort(),
  excluded: [{ path: 'automations/benny', reason: 'Cursor automation service integration; not part of the portable skill package.' }],
  files: Object.fromEntries(files(dist).map(path => [path, sha256(readFileSync(join(dist, path)))])),
};
write(join(dist, 'manifest.json'), `${JSON.stringify(manifest, null, 2)}\n`);
console.log(`Built ${manifest.skills.length} skills and 2 agents for ${manifest.providers.join(', ')} from pstack ${provenance.version} (${provenance.commit.slice(0, 12)}).`);
