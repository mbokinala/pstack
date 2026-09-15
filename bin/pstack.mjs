#!/usr/bin/env node
import { runCommand } from '../lib/installer.mjs';

const help = `Usage: pstack <install|update|remove|doctor> [options]

  --providers=codex,claude,cursor  Hosts to install (auto-detected by default)
  --scope=project|global          Install in the project or home (default: project)
  --target=/path                 Override the project/home directory
  --dry-run                      Preview changes without writing files
  --help                         Show this help

Install adds or refreshes the selected providers and retains other providers.
Update and remove default to all previously installed providers. Local edits
and unmanaged files are never overwritten. Remove preserves modified files.
Project Codex skills use .agents/skills; global skills use ~/.agents/skills.
Optional workflow tools checked by doctor: git, gh, bun, rg, jq, python3.
`;

function parse(argv) {
  const options = {};
  let command;
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === '--help' || arg === '-h') return { help: true };
    if (arg === '--dry-run') { options.dryRun = true; continue; }
    if (arg.startsWith('--')) {
      const [name, ...rest] = arg.slice(2).split('=');
      if (!['providers', 'scope', 'target'].includes(name)) throw new Error(`Unknown option: --${name}`);
      const value = rest.length ? rest.join('=') : argv[++i];
      if (!value || value.startsWith('--')) throw new Error(`Missing value for --${name}`);
      if (Object.hasOwn(options, name)) throw new Error(`Duplicate option: --${name}`);
      options[name] = name === 'providers' ? value.split(',').map((item) => item.trim()) : value;
    } else if (!command) command = arg;
    else throw new Error(`Unexpected argument: ${arg}`);
  }
  return command ? { command, options } : { help: true };
}

try {
  const args = parse(process.argv.slice(2));
  if (args.help) process.stdout.write(help);
  else {
    const result = await runCommand(args.command, args.options);
    if (result.command === 'doctor') {
      const healthy = result.checks.filter((check) => check.status === 'ok').length;
      process.stdout.write(`pstack doctor: ${result.target}\n${healthy} installed files verified.\n`);
      for (const check of result.checks.filter((check) => check.status !== 'ok')) process.stdout.write(`ERROR ${check.path}: ${check.message}\n`);
      for (const dependency of result.dependencies) process.stdout.write(`${dependency.status === 'ok' ? 'OK' : 'WARN'} ${dependency.name}: ${dependency.status === 'ok' ? 'available' : 'not found (optional)'}\n`);
      process.exitCode = result.ok ? 0 : 1;
    } else {
      process.stdout.write(`${result.dryRun ? 'Dry run: ' : ''}pstack ${result.command} — ${result.providers.join(', ')}\nTarget: ${result.target}\n`);
      process.stdout.write(`${result.writes.length} ${result.dryRun ? 'to write' : 'written'}, ${result.removes.length} ${result.dryRun ? 'to remove' : 'removed'}, ${result.unchanged.length} unchanged.\n`);
      if (result.dryRun) {
        for (const relative of result.writes) process.stdout.write(`WRITE ${relative}\n`);
        for (const relative of result.removes) process.stdout.write(`REMOVE ${relative}\n`);
      }
      for (const relative of result.preserved) process.stdout.write(`PRESERVED local changes: ${relative}\n`);
    }
  }
} catch (error) {
  process.stderr.write(`pstack: ${error.message}\n`);
  for (const detail of error.details ?? []) process.stderr.write(`  ${detail}\n`);
  process.exitCode = 1;
}
