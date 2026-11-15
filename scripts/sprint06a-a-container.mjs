import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import { command, hash, rawCommand } from '../spikes/envoy/sprint05d-a-build.mjs';
import { assertLock } from '../spikes/envoy/wire-fixtures.mjs';

process.umask(0o077); assertLock();
const out = process.argv[2]; assert.match(out ?? '', /^evidence\/sprint06a-a\/run-\d+$/);
assert.ok(!fs.existsSync(out));
const record = { started: new Date().toISOString(), argv: process.argv, commands: [],
  fixtureLock: '/tmp/aegisgate-sprint02-fixtures.lock', lockPID: process.ppid,
  finiteControlsPass: false, streamingPass: false, runtimeGO: false, productionEligible: false };
const git = async (...args) => (await command(record, ['/usr/bin/git', ...args])).trim();
assert.equal(await git('status', '--porcelain', '--untracked-files=all'), '', 'commit source before tests');
assert.equal(await git('branch', '--show-current'), 'feat/sprint06a-finite-ingress');
record.sourceCommit = await git('rev-parse', 'HEAD'); record.sourceTree = await git('rev-parse', 'HEAD^{tree}');
record.sources = (await git('ls-files', 'spikes/envoy/sprint06a-a-*', 'scripts/sprint06a-a-*',
  'spikes/envoy/sprint05d-a-*', 'spikes/envoy/sprint05c-a-runtime.mjs', 'spikes/envoy/sprint05c-a-llhttp.c',
  'spikes/envoy/sprint05b-a-build.mjs', 'spikes/envoy/wire-fixtures.mjs', 'scripts/sprint05b-baseline.mjs',
  'evidence/sprint05a-b/source-01/sources.json', 'spikes/edge-comparison/manifest.json')).split('\n').map((file) => ({ file, sha256: hash(fs.readFileSync(file)) }));
const cwd = process.cwd(), local = path.resolve('.local');
fs.mkdirSync(path.join(local, 'tmp'), { recursive: true, mode: 0o700 });
process.env.TMPDIR = path.join(local, 'tmp'); record.tmpdir = process.env.TMPDIR;
fs.mkdirSync(out, { recursive: true });
const name = `aegisgate-sprint06a-a-${path.basename(out)}-${process.pid}`;
let created = false;
try {
  record.baselineBefore = JSON.parse(await command(record, [process.execPath, 'scripts/sprint05b-baseline.mjs']));
  const pins = JSON.parse(fs.readFileSync('evidence/sprint05a-b/source-01/sources.json'));
  const cache = path.join(local, 'sprint06a-a-sources'); fs.mkdirSync(cache, { recursive: true, mode: 0o700 });
  record.cachedSources = [];
  for (const name of ['include/llhttp.h', 'src/api.c', 'src/http.c', 'src/llhttp.c', 'LICENSE-MIT']) {
    const pin = pins.downloads.find((p) => p.name === `llhttp/${name}`), target = path.join(cache, path.basename(name));
    if (!fs.existsSync(target)) {
      const retained = path.join('evidence/sprint05a-b/source-01/llhttp', name + '.stdout');
      if (fs.existsSync(retained) && hash(fs.readFileSync(retained)) === pin.sha256) fs.copyFileSync(retained, target);
      else await command(record, ['/usr/bin/curl', '--fail', '--silent', '--show-error', '--location', '--proto', '=https',
        '--proto-redir', '=https', '--tlsv1.2', '--connect-timeout', '10', '--max-time', '30', '--max-filesize', '1048576', '--output', target, pin.url]);
    }
    assert.equal(fs.lstatSync(target).isSymbolicLink(), false); assert.equal(hash(fs.readFileSync(target)), pin.sha256);
    fs.chmodSync(target, 0o600); record.cachedSources.push({ name, sha256: pin.sha256, bytes: fs.statSync(target).size });
  }
  record.dockerVersion = await command(record, ['/usr/bin/docker', 'version', '--format', '{{json .}}']);
  const image = 'sha256:582460f614631b59b824ac6020533b9bf339c7fdf3a6d7db31abb6b4065f0212';
  record.image = JSON.parse(await command(record, ['/usr/bin/docker', 'image', 'inspect', image, '--format', '{{json .}}']));
  const spool = path.join(local, 'sprint06a-a-spool'); fs.mkdirSync(spool, { mode: 0o700 });
  const gitRoot = path.resolve(await git('rev-parse', '--git-common-dir'));
  const nodeRoot = path.resolve(path.dirname(process.execPath), '..');
  const argv = ['/usr/bin/docker', 'create', '--name', name, '--pull=never', '--network=none', '--pid=host',
    '--cgroupns=private', '--read-only', '--cap-drop=ALL', '--security-opt=no-new-privileges', '--log-driver=none',
    '--memory=384m', '--memory-swap=384m', '--cpus=0.75', '--pids-limit=64', '--ulimit', 'core=0:0',
    '--user', `${process.getuid()}:${process.getgid()}`, '--workdir', cwd,
    '--mount', `type=bind,src=${cwd},dst=${cwd},readonly`, '--mount', `type=bind,src=${local},dst=${local}`,
    '--mount', `type=bind,src=${path.resolve('evidence/sprint06a-a')},dst=${path.resolve('evidence/sprint06a-a')}`,
    '--mount', `type=bind,src=${gitRoot},dst=${gitRoot},readonly`,
    '--mount', `type=bind,src=${nodeRoot},dst=${nodeRoot},readonly`,
    '--mount', 'type=bind,src=/usr,dst=/usr,readonly',
    '--mount', 'type=bind,src=/tmp/aegisgate-sprint02-fixtures.lock,dst=/tmp/aegisgate-sprint02-fixtures.lock',
    '--tmpfs', `${spool}:rw,noexec,nosuid,nodev,size=8m,mode=0700,uid=${process.getuid()},gid=${process.getgid()}`,
    '--env', 'LD_LIBRARY_PATH=/usr/lib', '--env', 'PATH=/usr/bin:/bin', '--env', `TMPDIR=${record.tmpdir}`,
    '--env', 'AEGIS06A_CONTAINER=1', '--env', `AEGIS06A_HOST_LOCK_PID=${record.lockPID}`, '--env', `AEGIS06A_SPOOL_ROOT=${spool}`,
    '--entrypoint', process.execPath, image, '--max-old-space-size=96', 'spikes/envoy/sprint06a-a-run.mjs', out];
  record.containerID = (await command(record, argv)).trim(); created = true;
  record.inspectBefore = JSON.parse(await command(record, ['/usr/bin/docker', 'inspect', name, '--format', '{{json .}}']));
  const result = await rawCommand(['/usr/bin/docker', 'start', '--attach', name], { timeout: 240000 });
  record.run = result;
  fs.writeFileSync(`${out}/run.stdout`, result.stdout); fs.writeFileSync(`${out}/run.stderr`, result.stderr);
  record.inspectAfter = JSON.parse(await command(record, ['/usr/bin/docker', 'inspect', name, '--format', '{{json .}}']));
  assert.equal(result.exit, 0, result.stderr || result.stdout); assert.equal(result.error, undefined);
  assert.equal(record.inspectAfter.State.ExitCode, 0); assert.equal(record.inspectAfter.State.OOMKilled, false);
  const receipt = JSON.parse(fs.readFileSync(`${out}/receipt.json`));
  assert.equal(receipt.completeValidationPass, true); assert.equal(receipt.streamingPass, false);
  assert.ok(receipt.cgroupFinal); assert.ok(receipt.probes.find((p) => p.name === 'actual-tmpfs-ENOSPC-before-origin'));
  record.finiteControlsPass = true;
} catch (e) { record.error = { message: e.message, stack: e.stack }; process.exitCode = 1; }
finally {
  assertLock();
  if (created) {
    const removal = await rawCommand(['/usr/bin/docker', 'rm', '--force', name]); record.removeContainer = removal;
    if (removal.exit !== 0) process.exitCode = 1;
  }
  const remaining = await rawCommand(['/usr/bin/docker', 'ps', '-aq', '--filter', `name=^/${name}$`]);
  record.remainingContainers = remaining; if (remaining.exit !== 0 || remaining.stdout.trim()) process.exitCode = 1;
  record.baselineAfter = JSON.parse(await command(record, [process.execPath, 'scripts/sprint05b-baseline.mjs']));
  assert.deepEqual(record.baselineAfter, record.baselineBefore);
  record.sourceBytesUnchanged = record.sources.every(({ file, sha256 }) => hash(fs.readFileSync(file)) === sha256);
  assert.equal(record.sourceBytesUnchanged, true);
  record.lockHeldThroughCleanupAndHash = true; record.ended = new Date().toISOString();
  fs.writeFileSync(`${out}/collector.json`, JSON.stringify(record, null, 2) + '\n');
  const names = fs.readdirSync(out).filter((n) => n !== 'SHA256SUMS').sort();
  fs.writeFileSync(`${out}/SHA256SUMS`, names.map((name) => `${hash(fs.readFileSync(`${out}/${name}`))}  ${out}/${name}\n`).join(''));
  console.log(JSON.stringify({ out, source: record.sourceCommit, finiteControlsPass: record.finiteControlsPass,
    streamingPass: false, error: record.error, containerRemoved: !remaining.stdout.trim() }));
}
