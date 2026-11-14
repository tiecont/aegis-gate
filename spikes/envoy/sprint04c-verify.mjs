import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { execFileSync, spawnSync } from 'node:child_process';
import { assertLock } from './wire-fixtures.mjs';
process.umask(0o077);assertLock();
const output=process.argv[2];assert.match(output??'',/^evidence\/sprint04c-d\/verification-\d+$/);assert.ok(!fs.existsSync(output));
const git=(...args)=>execFileSync('git',args,{encoding:'utf8',maxBuffer:32<<20}).trim();
assert.equal(git('status','--porcelain'),'');
const hash=(b)=>createHash('sha256').update(b).digest('hex');const read=(f)=>fs.readFileSync(f);
const record={source_commit:git('rev-parse','HEAD'),source_tree:git('rev-parse','HEAD^{tree}'),argv:process.argv,cwd:process.cwd(),started_at:new Date().toISOString(),node:process.version,node_sha256:hash(read(process.execPath)),commands:[]};
fs.mkdirSync(output,{recursive:true});const save=()=>fs.writeFileSync(`${output}/commands.json`,JSON.stringify(record,null,2)+'\n');
function run(label,program,args){assertLock();const start=new Date().toISOString();const c=spawnSync(program,args,{timeout:90000,maxBuffer:8<<20,env:{...process.env,GOTOOLCHAIN:'go1.27.4'}});const streams=['stdout','stderr'].map((s)=>{const file=`${output}/${label}.${s}`;fs.writeFileSync(file,c[s]??'');return{file,sha256:hash(read(file))};});record.commands.push({label,program,args,cwd:process.cwd(),started_at:start,ended_at:new Date().toISOString(),exit_code:c.status,signal:c.signal,streams});save();console.log(`${label}: exit=${c.status}`);assert.equal(c.status,0,label);}
try {
 const p='evidence/sprint04c-d/attempt-01';const r=JSON.parse(read(`${p}/commands.json`));assert.equal(r.source_tree,git('rev-parse',`${r.source_commit}^{tree}`));assert.equal(r.source_clean,true);assert.equal(r.observations_complete,true);assert.equal(r.semantic_security_pass,false);
 for(const s of [...r.sources,...r.immutable]){const original=execFileSync('git',['show',`${r.source_commit}:${s.file}`]);assert.equal(hash(original),s.sha256);if(s.file==='spikes/envoy/sprint04c-attribution/main_test.go'){assert.ok(read(s.file).toString().startsWith(original.toString()),'only appended adversarial tests allowed');}else assert.equal(hash(read(s.file)),s.sha256);}
 for(const c of r.commands){assert.equal(c.exit_code,0);for(const s of c.streams)assert.equal(hash(read(s.file)),s.sha256);}
 record.manifest=[];for(const line of read(`${p}/SHA256SUMS`).toString().trim().split('\n')){const [expected,file]=line.split('  ');assert.equal(hash(read(file)),expected);record.manifest.push({file,sha256:expected});}
 assert.deepEqual(r.cleanup.remaining_owned_containers,[]);assert.equal(r.cleanup.lock_held_through_cleanup,true);
 const historical=git('ls-tree','-r','--name-only','a325b9e','--','evidence/sprint04b-c','spikes/edge-comparison','spikes/envoy/wire-probes.mjs','spikes/pingora/lab.mjs').split('\n');
 record.protected_count=historical.length;for(const file of historical)assert.equal(hash(read(file)),hash(execFileSync('git',['show',`a325b9e:${file}`],{maxBuffer:32<<20})),file);
 const proto=JSON.parse(read(`${p}/protocol.json`));assert.equal(proto.tests.length,17);assert.equal(proto.semantic_security_pass,false);assert.ok(proto.tests.every((t)=>t.status==='observation-complete'));
 const summary=JSON.parse(read(`${p}/attribution-summary.json`));assert.equal(summary.semantic_security_pass,false);assert.equal(summary.connections.length,4);assert.ok(summary.connections.every((c)=>!c.capture_complete));
 record.incomplete_attribution=summary.connections;
 run('go-module-integrity','go',['mod','verify']);
 run('final-observer-tests',process.execPath,['--test','spikes/envoy/sprint04c-observer.test.mjs']);
 run('source-whitespace','git',['diff','--check','a325b9e','--','spikes/envoy/sprint04c-*','docs/reports/sprint04c-d-protocol.md','evidence/sprint04c-d/PLAN.md']);
 run('immutable-manifest',process.execPath,['spikes/edge-comparison/extract-baseline.mjs','--check']);
 for(const file of git('ls-files','spikes/envoy/sprint04c-*').split('\n').filter((f)=>f.endsWith('.mjs')))run(`syntax-${path.basename(file)}`,process.execPath,['--check',file]);
 const scanner='ghcr.io/gitleaks/gitleaks:v8.30.1@sha256:c00b6bd0aeb3071cbcb79009cb16a60dd9e0a7c60e2be9ab65d25e6bc8abbb7f';
 for(const [label,target] of [['source','spikes/envoy'],['evidence','evidence/sprint04c-d/attempt-01'],['report','docs/reports/sprint04c-d-protocol.md']])run(`secrets-${label}`,'docker',['run','--rm','--network','none','--user',`${process.getuid()}:${process.getgid()}`,'-v',`${process.cwd()}:/repo:ro`,'-v',`${path.resolve(output)}:/reports`,scanner,'dir',`/repo/${target}`,'--config','/repo/.github/gitleaks.toml','--redact','--report-format','json','--report-path',`/reports/${label}-secrets.json`,'--no-banner']);
 record.verified=true;record.semantic_security_pass=false;
}catch(e){record.error=e.stack;process.exitCode=1;}
finally{assertLock();record.lock_held_through_cleanup=true;record.ended_at=new Date().toISOString();save();fs.writeFileSync(`${output}/SHA256SUMS`,fs.readdirSync(output).sort().map((f)=>`${hash(read(`${output}/${f}`))}  ${output}/${f}`).join('\n')+'\n');}
