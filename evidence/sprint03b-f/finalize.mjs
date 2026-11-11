import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { gunzipSync } from 'node:zlib';

const root = process.cwd();
const directory = path.join(root, 'evidence/sprint03b-f');
const commands = [];
const hash = (bytes) => createHash('sha256').update(bytes).digest('hex');
const parserCommands = JSON.parse(fs.readFileSync(path.join(directory, 'parser-runtime-host-retention/commands.json')));
if (hash(gunzipSync(fs.readFileSync(path.join(directory, 'parser-runtime-host-retention/lab.stderr.txt.gz')))) !== parserCommands.commands.find((command) => command.label === 'lab').stderr_sha256) throw new Error('raw stderr changed');
function run(label, program, args, cwd = root) {
  const started = new Date().toISOString();
  const result = spawnSync(program, args, { cwd, encoding: 'utf8', maxBuffer: 4 << 20 });
  const output = (result.stdout || '') + (result.stderr || '');
  fs.writeFileSync(path.join(directory, `${label}.log`), output);
  commands.push({ argv: [program, ...args], cwd, started_at: started, ended_at: new Date().toISOString(), exit_code: result.status, log: `${label}.log`, log_sha256: hash(output) });
  if (result.status !== 0) {
    fs.writeFileSync(path.join(directory, 'final-verification.json'), JSON.stringify(commands, null, 2) + '\n');
    throw new Error(`${label} failed with exit ${result.status}: ${output}`);
  }
}
run('finalize-syntax', 'node', ['--check', 'evidence/sprint03b-f/finalize.mjs']);
for (const file of ['recovery-config.mjs', 'recovery-launcher.mjs', 'recovery-run.mjs', 'recovery-raw-h2.mjs']) {
  run(file.replace('.mjs', '-syntax'), '/home/tiecont/Projects/aegis-gate/.local/toolchains/node/bin/node', ['--check', `spikes/envoy/${file}`], '/tmp/aegisgate-03b-f-parser');
}
run('diff-check', 'git', ['diff', '--check']);
run('new-evidence-secret-scan', 'docker', ['run', '--rm', '--network', 'none', '-v', `${directory}:/evidence:ro`, '-v', `${root}/.github/gitleaks.toml:/config.toml:ro`, 'ghcr.io/gitleaks/gitleaks:v8.30.1@sha256:c00b6bd0aeb3071cbcb79009cb16a60dd9e0a7c60e2be9ab65d25e6bc8abbb7f', 'dir', '/evidence', '--config', '/config.toml', '--redact', '--no-banner']);
fs.writeFileSync(path.join(directory, 'final-verification.json'), JSON.stringify(commands, null, 2) + '\n');
function files(dir) {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const name = path.join(dir, entry.name);
    return entry.isDirectory() ? files(name) : [name];
  });
}
const inputs = files(directory).filter((file) => path.basename(file) !== 'SHA256SUMS');
inputs.push(path.join(root, 'docs/reports/sprint03b-f-security-review.md'));
inputs.push(path.join(root, 'internal/configreview/review_test.go'));
inputs.push(path.join(root, 'apps/control-api/internal/persistence/sprint03b_independent_e2e_test.go'));
fs.writeFileSync(path.join(directory, 'SHA256SUMS'), inputs.sort().map((file) => `${hash(fs.readFileSync(file))}  ${path.relative(root, file)}`).join('\n') + '\n');
console.log(JSON.stringify({ checks: commands.map(({ argv, exit_code }) => ({ argv, exit_code })), hashed_files: inputs.length }));
