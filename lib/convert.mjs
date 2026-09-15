import { parse, stringify } from 'yaml';

export const providers = {
  codex: { skills: '.agents/skills', agents: '.codex/agents', invoke: '$' },
  claude: { skills: '.claude/skills', agents: '.claude/agents', invoke: '/' },
  cursor: { skills: '.cursor/skills', agents: '.cursor/agents', invoke: '/' },
};

export function frontmatter(text, path) {
  const match = text.match(/^---\r?\n([\s\S]*?)\r?\n---(?:\r?\n|$)([\s\S]*)$/);
  if (!match) throw new Error(`Missing frontmatter: ${path}`);
  // Some upstream descriptions double-escape quotes. Repair only this known form.
  const header = match[1].replace(/\\\\"/g, '\\"');
  const data = parse(header, { uniqueKeys: true });
  if (!data || typeof data.name !== 'string' || typeof data.description !== 'string') throw new Error(`Invalid skill metadata: ${path}`);
  return { data, body: match[2].trimStart() };
}

export function applyPatches(text, path, patches) {
  for (const patch of patches.filter(p => p.path === path)) {
    if (!patch.find || text.split(patch.find).length !== 2) throw new Error(`Patch drift at ${path}: ${patch.reason}`);
    text = text.replace(patch.find, patch.replace);
  }
  return text;
}

export function portable(text, provider) {
  const p = providers[provider];
  return text
    .replaceAll('{{SKILLS_DIR}}', p.skills)
    .replaceAll('pstack/skills/', `${p.skills}/`)
    .replaceAll('~/.cursor/rules/pstack-models.mdc', '.pstack/config.json')
    .replaceAll('~/.cursor/skills', `~/${p.skills}`)
    .replaceAll('.cursor/skills', p.skills)
    .replaceAll('~/.cursor/plugins/', 'the installed skill directories/')
    .replaceAll('`claude-fable-5-1-thinking-max`', '`inherit-parent`')
    .replaceAll('`claude-opus-5-thinking-xhigh`', '`inherit-parent`')
    .replaceAll('`gpt-5.6-sol-max`', '`inherit-parent`')
    .replaceAll('`grok-4.6-fast-xhigh`', '`inherit-parent`')
    .replaceAll("Cursor's built-in `create-skill` skill", 'the bundled `create-skill` skill')
    .replaceAll("Cursor's built-in `create-skill`", 'the bundled `create-skill`')
    .replaceAll("Cursor's built-in for authoring SKILL.md files", 'the bundled portable skill-authoring workflow')
    .replaceAll('from the `cursor-team-kit` plugin', 'bundled with this port')
    .replaceAll('from `cursor-team-kit`', 'bundled with this port')
    .replaceAll('`cursor-team-kit` publishes', 'This port bundles')
    .replaceAll('`Task`', 'native delegation')
    .replaceAll('Task tool', 'native delegation tool')
    .replaceAll('Task call', 'delegation call')
    .replaceAll('Task subagent', 'native subagent')
    .replaceAll('Task response', 'subagent result')
    .replaceAll('Task prompts', 'delegation prompts')
    .replaceAll('subagent_type', 'role')
    .replaceAll('generalPurpose', 'general-purpose')
    .replaceAll('`AskQuestion`', 'the host’s question interface')
    .replaceAll('AskQuestion', 'the host’s question interface')
    .replaceAll('`run_in_background: true`', 'background execution when supported')
    .replaceAll('`readonly`: `true`', 'Access: read-only; use the host’s supported permission controls')
    .replaceAll('`readonly`: `false`', 'Access: only the tools required for this task')
    .replaceAll('One Cursor cloud agent per PR', 'One native worker per PR')
    .replaceAll('Cursor cloud agent', 'native worker')
    .replaceAll('the Cursor dashboard', 'the host’s task-status interface')
    .replaceAll('a Cursor restart', 'a host restart')
    .replaceAll('Comment Sicko"', 'comment-sicko"');
}

export function skill(text, name, provider) {
  const { data, body } = frontmatter(text, name);
  const metadata = { name, description: data.description, license: 'MIT' };
  if (provider !== 'codex' && data['disable-model-invocation'] !== undefined) metadata['disable-model-invocation'] = data['disable-model-invocation'];
  if (provider === 'claude' && data.paths) metadata.paths = data.paths;
  const intro = 'Read [the pstack runtime contract](references/pstack-runtime.md) before following this workflow. It defines supported delegation, model configuration, permissions, paths, and missing-capability behavior.\n\n';
  return { text: `---\n${stringify(metadata)}---\n\n${intro}${portable(body, provider)}`, explicit: data['disable-model-invocation'] === true };
}
