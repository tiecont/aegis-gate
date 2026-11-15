// Exit zero verifies this scoped STOP, never a runtime security PASS.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { receipt, sha, git, goRoot, archive } from './sprint05c-b-lib.mjs';
const output = process.argv[2], {r,run,finish}=receipt(output);
try {
  const directories=['go-ordering-01','recovery-01','go-ordering-02'];
  r.verified_artifacts=0; r.verified_source_bindings=0;
  for(const directory of directories) {
    const base=`evidence/sprint05c-b/${directory}`;
    const hashes=JSON.parse(fs.readFileSync(`${base}/SHA256.json`));
    for(const h of hashes) { assert.equal(sha(fs.readFileSync(`${base}/${h.file}`)),h.sha256); r.verified_artifacts++; }
    const captured=JSON.parse(fs.readFileSync(`${base}/receipt.json`));
    assert.equal(git('rev-parse',`${captured.source_commit}^{tree}`),captured.source_tree);
    for(const source of captured.sources) {
      assert.equal(sha(execFileSync('git',['show',`${captured.source_commit}:${source.file}`],{maxBuffer:16<<20})),source.sha256);
      r.verified_source_bindings++;
    }
    assert.equal(captured.source_clean,true); assert.equal(captured.lock_held_through_cleanup_and_hashes,true);
  }
  const base='evidence/sprint05c-b/go-ordering-02';
  const captured=JSON.parse(fs.readFileSync(`${base}/receipt.json`));
  assert.equal(captured.cleanup_complete,true); assert.equal(captured.observations_complete,true);
  assert.equal(captured.error,undefined); assert.equal(captured.cleanup_error,undefined);
  assert.equal(captured.resource_eligible,false); assert.equal(captured.security_pass,false);
  for(const label of ['original75','evaluate75','original23','matrix'])assert.equal(captured.commands.find((c)=>c.label===label).exit_code,1);
  const original=JSON.parse(fs.readFileSync(`${base}/original75.json`));
  const extra=JSON.parse(fs.readFileSync(`${base}/original23.json`));
  const matrix=JSON.parse(fs.readFileSync(`${base}/matrix.json`));
  assert.equal(original.tests.length,75); assert.equal(original.tests.filter((t)=>t.status==='pass').length,56);
  assert.equal(extra.tests.length,23); assert.equal(extra.tests.filter((t)=>t.status==='pass').length,17);
  const h2=original.tests.find((t)=>t.name==='HTTP2-authority-Host-and-SNI-confusion-rejected');
  assert.equal(h2.status,'fail'); assert.match(h2.error,/NGHTTP2_PROTOCOL_ERROR/);
  assert.equal(h2.origin.decrypted_bytes,0); assert.equal(h2.origin.handler_invocations,0);
  const wire=JSON.parse(fs.readFileSync(`${base}/original75-wire.json`));
  assert.equal(wire.omitted,0);
  const prior=wire.events.find((e)=>e.kind==='test-end'&&e.message==='PASS HTTP2-downstream-and-upstream-ALPN');
  const failed=wire.events.find((e)=>e.kind==='test-end'&&e.message.startsWith('FAIL HTTP2-authority'));
  const ack=wire.events.find((e)=>e.kind==='bytes'&&e.direction==='envoy_to_origin'&&e.hex==='000000040100000000');
  assert.ok(ack.sequence<prior.sequence&&prior.sequence<failed.sequence);
  assert.deepEqual(prior.offsets,failed.offsets);
  assert.equal(matrix.tests.length,12); assert.equal(matrix.tests.filter((t)=>t.status==='pass').length,11);
  assert.deepEqual(matrix.tests.filter((t)=>t.status!=='pass').map((t)=>t.name),['warm-original-authority-status-requirements']);
  assert.equal(matrix.capture.omitted,0); assert.equal(matrix.cleanup_complete,true);
  for(const name of ['independent-origin-settings-cause-exact-nine-byte-ack','settings-during-421-is-all-byte-counterexample']) {
    const t=matrix.tests.find((t)=>t.name===name); assert.equal(t.status,'pass');
    assert.equal(t.detail.raw_hex,'000000040100000000');
    assert.equal(t.after.bytes-t.before.bytes,9); assert.equal(t.after.handlers,t.before.handlers); assert.equal(t.after.accepts,t.before.accepts);
  }
  assert.equal(matrix.authority_observations[2].response.status,null); assert.equal(matrix.authority_observations[2].response.rst_code,1);
  const first=JSON.parse(fs.readFileSync('evidence/sprint05c-b/go-ordering-01/receipt.json'));
  assert.ok(first.error&&first.cleanup_error); assert.match(fs.readFileSync('evidence/sprint05c-b/go-ordering-01/original75.stderr','utf8'),/Unhandled 'error' event/);
  const recovered=JSON.parse(fs.readFileSync('evidence/sprint05c-b/recovery-01/receipt.json'));
  assert.equal(recovered.recovery.complete,true);
  assert.ok(!fs.readdirSync('.local').some((s)=>s.startsWith('sprint05c-b-')));
  const baseline='078d83c0ab1cb1364d0245d4c4f62f0fe0439e97';
  const inventory=git('ls-tree','-r',baseline).split('\n');
  const current=new Map(git('ls-tree','-r','HEAD').split('\n').map((line)=>[line.split('\t')[1],line]));
  const working=execFileSync('git',['hash-object','--stdin-paths'],{encoding:'utf8',maxBuffer:16<<20,
    input:inventory.map((line)=>line.split('\t')[1]).join('\n')+'\n'}).trim().split('\n');
  for(const [i,entry] of inventory.entries()) {
    const [meta,file]=entry.split('\t');
    assert.equal(current.get(file),`${meta}\t${file}`);
    const object=meta.split(' ')[2]; assert.equal(working[i],object);
  }
  r.baseline_objects_unchanged=inventory.length;
  run('protected',process.execPath,['scripts/sprint05b-baseline.mjs']);
  run('protected-tests',process.execPath,['--test','spikes/edge-comparison/contract.test.mjs','spikes/edge-comparison/evaluate.test.mjs',
    'spikes/edge-comparison/tls-observer.test.mjs','spikes/envoy/wire-observer.test.mjs','spikes/envoy/sprint05a-a-config.test.mjs']);
  const files=git('ls-files','spikes/envoy/sprint05c-b*','docs/reports/sprint05c-b-h2-isolation.md').split('\n');
  for(const file of files.filter((f)=>f.endsWith('.mjs')))run(`syntax-${path.basename(file)}`,process.execPath,['--check',file]);
  run('whitespace','git',['diff','--check',baseline,'--',...files]);
  run('gofmt',`${goRoot}/bin/gofmt`,['-l','spikes/envoy/sprint05c-b-proxy.go']);
  assert.equal(fs.readFileSync(`${output}/gofmt.stdout`,'utf8'),'');
  const common='src/net/http/internal/httpcommon/httpcommon.go';
  const commonBytes=execFileSync('unzip',['-p',archive,`golang.org/toolchain@v0.0.1-go1.27.4.linux-amd64/${common}`]);
  assert.deepEqual(fs.readFileSync(`${goRoot}/${common}`),commonBytes);
  r.userinfo_source={file:common,sha256:sha(commonBytes),excerpt:commonBytes.toString().split('\n').slice(586,595).join('\n')};
  r.prior_evidence_references=['evidence/sprint05b-b/native-tap-01/receipt.json','evidence/sprint05b-b/native-tap-01/wire.json',
    'evidence/sprint05b-b/cause-01/receipt.json','docs/reports/sprint05b-b-h2-lifecycle.md','docs/reports/sprint05b-f-security-review.md']
    .map((file)=>({file,sha256:sha(fs.readFileSync(file))}));
  const scanner='ghcr.io/gitleaks/gitleaks:v8.30.1@sha256:c00b6bd0aeb3071cbcb79009cb16a60dd9e0a7c60e2be9ab65d25e6bc8abbb7f';
  run('scanner-image','docker',['image','inspect',scanner,'--format','{{.Id}} {{json .RepoDigests}}']);
  for(const [label,target] of [['source','spikes/envoy'],['evidence','evidence/sprint05c-b'],['report','docs/reports/sprint05c-b-h2-isolation.md']]) {
    run(`scan-${label}`,'docker',['run','--rm','--network','none','--name',`aegis-sprint05c-b-scan-${process.pid}-${label}`,
      '--user',`${process.getuid()}:${process.getgid()}`,'-v',`${process.cwd()}:/repo:ro`,'-v',`${path.resolve(output)}:/reports`,
      scanner,'dir',`/repo/${target}`,'--config','/repo/.github/gitleaks.toml','--redact','--report-format','json','--report-path',`/reports/${label}-secrets.json`,'--no-banner']);
  }
  r.verdict='SCOPED STOP: synchronous maintained SETTINGS scheduling is not sufficient for aggregate origin isolation; original H2 still FAIL';
  r.exit_code=0;
} catch(error) { r.error=error.stack; r.exit_code=1; process.exitCode=1; }
finally { finish(); }
