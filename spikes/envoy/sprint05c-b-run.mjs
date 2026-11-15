import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { receipt, sha, goRoot, archive } from './sprint05c-b-lib.mjs';
import { cleanupOwned } from './sprint05c-b-cleanup.mjs';
const [output] = process.argv.slice(2);
const { r, run, finish } = receipt(output);
fs.mkdirSync('.local', { recursive: true });
const fixture = fs.mkdtempSync(path.resolve('.local/sprint05c-b-proof-'));
const binary = path.join(fixture, 'proxy');
const before = new Set(fs.readdirSync('.local'));
try {
  run('protected-before', process.execPath, ['scripts/sprint05b-baseline.mjs']);
  assert.equal(sha(fs.readFileSync(archive)), '7ecd542f86ccbbb5017de33ac529872bc48c71f4edb658d63a18d2206f482b9b');
  assert.equal(sha(fs.readFileSync(`${goRoot}/bin/go`)), 'de0ae3e082ce7599eae4fb69fa2ef1e43b8f31ffd3fce62cdf81930aa9005050');
  r.toolchain = { version: fs.readFileSync(`${goRoot}/VERSION`, 'utf8'), archive,
    archive_sha256: sha(fs.readFileSync(archive)), local_ziphash: fs.readFileSync(`${archive}hash`, 'utf8'),
    authentication_scope: 'existing locally cached toolchain; pinned archive bytes and selected source/tools compared to archive; no new sumdb authentication claim' };
  const prefix = 'golang.org/toolchain@v0.0.1-go1.27.4.linux-amd64/';
  const sourceFiles = ['VERSION', 'bin/go', 'pkg/tool/linux_amd64/compile', 'pkg/tool/linux_amd64/link',
    'src/net/http/http.go', 'src/net/http/transport.go', 'src/net/http/server.go', 'src/net/http/httputil/reverseproxy.go',
    'src/net/http/internal/http2/transport.go', 'src/net/http/internal/http2/server.go'];
  r.toolchain.archive_matches = sourceFiles.map((file) => {
    const b = fs.readFileSync(`${goRoot}/${file}`);
    const z = execFileSync('unzip', ['-p', archive, `${prefix}${file}`], { maxBuffer: 64 << 20 });
    assert.deepEqual(b, z, file); return { file, bytes: b.length, sha256: sha(b) };
  });
  const source = fs.readFileSync(`${goRoot}/src/net/http/internal/http2/transport.go`, 'utf8').split('\n');
  fs.writeFileSync(`${output}/source-ordering.txt`, [[2066, 2133], [2723, 2738]].map(([start, end]) =>
    source.slice(start-1, end).map((line, i) => `${start+i}: ${line}`).join('\n')).join('\n\n')+'\n');
  run('go-version', `${goRoot}/bin/go`, ['version']);
  run('openssl-version', 'openssl', ['version']);
  run('docker-version', 'docker', ['version', '--format', '{{.Server.Version}}']);
  run('npm-ci', '/home/tiecont/Projects/aegis-gate/.local/toolchains/node/bin/npm', ['ci', '--ignore-scripts', '--no-audit', '--no-fund'], [0],
    { cwd: path.resolve('spikes/pingora'), env: { PATH: '/home/tiecont/Projects/aegis-gate/.local/toolchains/node/bin:/usr/bin:/bin' } });
  run('build', `${goRoot}/bin/go`, ['build', '-trimpath', '-buildvcs=false', '-o', binary, 'spikes/envoy/sprint05c-b-proxy.go']);
  run('binary-buildinfo', `${goRoot}/bin/go`, ['version', '-m', binary]);
  const environment = { AEGIS_05C_B_BINARY: binary, AEGIS_05C_B_BINARY_SHA256: sha(fs.readFileSync(binary)),
    NODE_OPTIONS: `--import=${path.resolve('spikes/envoy/sprint05c-b-select.mjs')}`,
    AEGIS_RUN_ROOT: fixture, AEGIS_CANDIDATE_NAME: 'sprint05c-b-go1.27.4-net-http-h2-only-lab',
    AEGIS_CANDIDATE_COMMAND: process.execPath, AEGIS_CANDIDATE_ARGS: JSON.stringify([path.resolve('spikes/envoy/sprint05c-b-launcher.mjs')]),
    AEGIS_CANDIDATE_ARTIFACTS: JSON.stringify([binary, path.resolve('spikes/envoy/sprint05c-b-proxy.go')]) };
  r.binary_sha256 = environment.AEGIS_05C_B_BINARY_SHA256;
  // The unchanged original suite and evaluator run before additive controls.
  const original = run('original75', process.execPath, ['--import', './spikes/envoy/sprint05b-b-tap.mjs', 'spikes/edge-comparison/run.mjs'], [0, 1],
    { env: { ...environment, AEGIS_05B_B_TAP: path.resolve(output, 'original75-wire.json') } });
  const resultPath = original.stdout.toString().match(/^Evidence: (.+)$/m)?.[1];
  assert.ok(resultPath?.startsWith(fixture+'/'));
  fs.copyFileSync(resultPath, `${output}/original75.json`);
  fs.copyFileSync(path.join(path.dirname(resultPath), 'proxy.log'), `${output}/original75-proxy.log`);
  const result = JSON.parse(fs.readFileSync(resultPath));
  r.original75 = { tests: result.tests.length, fatal: result.fatal ?? null, passed: result.tests.filter((t) => t.status === 'pass').length,
    h2: result.tests.find((t) => t.name === 'HTTP2-authority-Host-and-SNI-confusion-rejected') };
  run('evaluate75', process.execPath, ['spikes/edge-comparison/evaluate.mjs', `${output}/original75.json`], [0, 1]);
  run('original23', process.execPath, ['spikes/envoy/wire-probes.mjs', path.resolve(output, 'original23.json'), path.join(fixture, 'original23')], [0, 1], { env: environment });
  const extra = JSON.parse(fs.readFileSync(`${output}/original23.json`));
  r.original23 = { tests: extra.tests.length, fatal: extra.fatal ?? null, passed: extra.tests.filter((t) => t.status === 'pass').length, failures: extra.failures };
  run('matrix', process.execPath, ['spikes/envoy/sprint05c-b-matrix.mjs', path.resolve(output, 'matrix.json'), fixture], [0, 1], { env: environment });
  r.matrix = JSON.parse(fs.readFileSync(`${output}/matrix.json`));
  assert.equal(result.tests.length, 75); assert.ok(!result.fatal); assert.equal(extra.tests.length, 23); assert.ok(!extra.fatal);
  r.observations_complete = !r.matrix.error && r.matrix.cleanup_complete && r.matrix.tests.length === 12;
  run('protected-after', process.execPath, ['scripts/sprint05b-baseline.mjs']);
} catch (error) { r.error = error.stack; }
finally {
  try {
    // The original suite owns its nginx container. Recover only mounts in this fixture.
    const ids = execFileSync('docker', ['ps', '-aq'], { encoding: 'utf8', timeout: 15000 }).trim().split('\n').filter(Boolean);
    r.owned_containers = [];
    for (const id of ids) {
      const mounts = JSON.parse(execFileSync('docker', ['inspect', '--format', '{{json .Mounts}}', id], { timeout: 15000 }));
      if (mounts.some((m) => m.Source.startsWith(fixture+'/'))) {
        r.owned_containers.push(id); run(`cleanup-container-${id}`, 'docker', ['rm', '-f', id]);
      }
    }
    r.native_cleanup = await cleanupOwned();
    fs.rmSync(fixture, { recursive: true, force: true });
    r.remaining_launcher_directories = fs.readdirSync('.local').filter((f) => !before.has(f) && f.startsWith('sprint05c-b-launch-'));
    assert.equal(r.remaining_launcher_directories.length, 0);
    r.cleanup_complete = !fs.existsSync(fixture);
  } catch (error) { r.cleanup_error = error.stack; }
  finish();
  process.exitCode = r.error || r.cleanup_error || !r.observations_complete ? 1 : 0;
}
