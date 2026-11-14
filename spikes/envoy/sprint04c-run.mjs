// Scoped exact-source receipt runner; successful collection is never security acceptance.
import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { execFileSync, spawnSync } from 'node:child_process';
import { assertLock } from './wire-fixtures.mjs';
process.umask(0o077); assertLock();
const output = process.argv[2]; assert.match(output ?? '', /^evidence\/sprint04c-d\/attempt-\d+$/); assert.ok(!fs.existsSync(output));
const git = (...args) => execFileSync('git', args, { encoding: 'utf8' }).trim();
assert.equal(git('status', '--porcelain'), '', 'commit source before proof');
const hash = (b) => createHash('sha256').update(b).digest('hex');
fs.mkdirSync(output, { recursive: true });fs.mkdirSync('.local/bin', { recursive: true });
const root = process.cwd(); const go = process.env.AEGIS_GO_BIN ?? 'go';
const record = { source_commit: git('rev-parse', 'HEAD'), source_tree: git('rev-parse', 'HEAD^{tree}'),
  source_clean: true, argv: process.argv, cwd: root, started_at: new Date().toISOString(),
  node: process.version, node_binary: process.execPath, node_sha256: hash(fs.readFileSync(process.execPath)), commands: [],
  fixture_lock: '/tmp/aegisgate-sprint02-fixtures.lock', semantic_security_pass: false };
const save = () => fs.writeFileSync(`${output}/commands.json`, JSON.stringify(record, null, 2) + '\n');
function run(label, program, args, options = {}) {
  assertLock(); const began = new Date().toISOString();
  const r = spawnSync(program, args, { cwd: root, timeout: 120000, maxBuffer: 16 * 1024 * 1024,
    env: { ...process.env, GOTOOLCHAIN: 'go1.27.4' }, ...options });
  const streams = ['stdout', 'stderr'].map((stream) => {
    const file = `${output}/${label}.${stream}`;fs.writeFileSync(file, r[stream] ?? Buffer.alloc(0));return { file, sha256: hash(fs.readFileSync(file)) };
  });
  record.commands.push({ label, program, args, cwd: root, started_at: began, ended_at: new Date().toISOString(), exit_code: r.status, signal: r.signal,
    error: r.error?.message, ...(options.input ? { stdin_bytes: Buffer.byteLength(options.input), stdin_sha256: hash(options.input) } : {}), streams });save();
  console.log(`${label}: exit=${r.status}`);assert.equal(r.status, 0, `${label} failed; retain attempt`);return r;
}
const immutable = ['go.mod', 'go.sum', 'spikes/pingora/lab.mjs', 'spikes/envoy/wire-probes.mjs', ...['manifest.json','contract.mjs','supplemental.mjs','evaluate.mjs','tls-observer.mjs'].map((f) => `spikes/edge-comparison/${f}`)];
record.immutable = immutable.map((file) => {const expected=execFileSync('git',['show',`a325b9e:${file}`]);assert.equal(hash(fs.readFileSync(file)),hash(expected));return {file,sha256:hash(expected)};});
const sources=git('ls-files','spikes/envoy/sprint04c*').split('\n').filter(Boolean);
record.sources=sources.map((file)=>({file,sha256:hash(fs.readFileSync(file))}));
const fixture=fs.mkdtempSync(path.join(root,'.local/sprint04c-d-'));const initial=new Set(fs.readdirSync('.local'));record.fixture_root=fixture;save();
function owned() {
 const ids=execFileSync('docker',['ps','-aq','--filter','name=aegis-envoy-'],{encoding:'utf8'}).trim().split('\n').filter(Boolean);
 if(!ids.length)return [];
 return JSON.parse(execFileSync('docker',['inspect',...ids],{encoding:'utf8'})).filter((c)=>c.Mounts.some((m)=>m.Source.startsWith(`${root}/.local/`))).map((c)=>c.Name.slice(1));
}
try {
 run('go-version',go,['version']);run('decoder-module',go,['list','-m','-json','golang.org/x/net']);
 run('openssl','openssl',['version']);run('envoy-image','docker',['image','inspect',JSON.parse(fs.readFileSync('spikes/envoy/image.lock.json')).image,'--format','{{.Id}} {{.Os}}/{{.Architecture}}']);
 run('immutable-manifest',process.execPath,['spikes/edge-comparison/extract-baseline.mjs','--check']);
 run('observer-tests',process.execPath,['--test','spikes/envoy/sprint04c-observer.test.mjs']);
 run('decoder-build',go,['build','-o','.local/bin/sprint04c-attribution','./spikes/envoy/sprint04c-attribution']);
 record.decoder_binary_sha256=hash(fs.readFileSync('.local/bin/sprint04c-attribution'));save();
 run('protocol',process.execPath,['spikes/envoy/sprint04c-protocol.mjs',path.join(root,output,'protocol.json'),path.join(fixture,'protocol')]);
 const protocol=JSON.parse(fs.readFileSync(`${output}/protocol.json`));
 assert.equal(protocol.semantic_security_pass,false);assert.equal(protocol.tests.length,17);
 assert.ok(protocol.tests.every((t)=>t.status==='observation-complete'));
 const conclusions=[];
 for(const [i,c] of protocol.attribution_captures.entries()) {
  const { connection,hex,total_bytes,dropped_bytes,client_preface,capture_closed,dial_observed,new_connection,identity_complete,links }=c;
  const input=JSON.stringify({connection,hex,total_bytes,dropped_bytes,client_preface,capture_closed,dial_observed,new_connection,identity_complete,links,
    verified_sni:c.native_tls?.authorized?c.native_tls.sni:'',transport_errors:0,parser_errors:0});
  const r=run(`decode-${String(i).padStart(2,'0')}`,'.local/bin/sprint04c-attribution',[],{input});const decoded=JSON.parse(r.stdout);
  assert.equal(decoded.semantic_security_pass,false);assert.ok(decoded.incomplete.includes('authenticated identity/generation association unavailable'));
  conclusions.push({connection,direction:c.direction,total_bytes,dropped_bytes,decoded_frames:decoded.events.length,capture_complete:decoded.capture_complete,violations:decoded.violations,incomplete:decoded.incomplete});
 }
 fs.writeFileSync(`${output}/attribution-summary.json`,JSON.stringify({semantic_security_pass:false,connections:conclusions},null,2)+'\n');
 record.observations_complete=true;
} catch(e) {record.error=e.stack;process.exitCode=1;}
finally {
 record.cleanup={stopped:[],lock_held_through_cleanup:true};
 for(const name of owned()){const r=spawnSync('docker',['stop','--timeout','2',name],{timeout:7000});record.cleanup.stopped.push({name,exit_code:r.status});}
 record.cleanup.remaining_owned_containers=owned();assert.equal(record.cleanup.remaining_owned_containers.length,0);
 for(const name of fs.readdirSync('.local')) {if(!initial.has(name)&&name.startsWith('envoy-run-'))fs.rmSync(path.join('.local',name),{recursive:true});}
 fs.rmSync(fixture,{recursive:true,force:true});assertLock();
 for(const s of [...record.immutable,...record.sources])assert.equal(hash(fs.readFileSync(s.file)),s.sha256);
 record.ended_at=new Date().toISOString();save();
 const walk=(dir)=>fs.readdirSync(dir,{withFileTypes:true}).flatMap((e)=>e.isDirectory()?walk(`${dir}/${e.name}`):[`${dir}/${e.name}`]);
 fs.writeFileSync(`${output}/SHA256SUMS`,walk(output).sort().map((f)=>`${hash(fs.readFileSync(f))}  ${f}`).join('\n')+'\n');
}
