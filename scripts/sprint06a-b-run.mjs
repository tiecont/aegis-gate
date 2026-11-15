import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { createHash, randomBytes } from 'node:crypto';
import { execFileSync, spawn } from 'node:child_process';
import { assertLock } from '../spikes/envoy/wire-fixtures.mjs';
import { build } from '../spikes/envoy/sprint05d-a-build.mjs';

assertLock(); process.umask(0o077);
const output = process.argv[2];
assert.match(output ?? '', /^evidence\/sprint06a-b\/attempt-\d+$/);
assert.ok(!fs.existsSync(output), 'retain every earlier attempt');
const git = (...args) => execFileSync('/usr/bin/git', args, { encoding: 'utf8' }).trim();
assert.equal(git('status', '--porcelain', '--untracked-files=all'), '', 'commit all source before testing');
const sha = (raw) => createHash('sha256').update(raw).digest('hex');
fs.mkdirSync('.local/tmp', { recursive: true, mode: 0o700 });
process.env.TMPDIR = path.resolve('.local/tmp');
const goDir = '/home/tiecont/go/pkg/mod/golang.org/toolchain@v0.0.1-go1.27.4.linux-amd64/bin';
const go = path.join(goDir, 'go');
const env = { ...process.env, TMPDIR: process.env.TMPDIR, GOAMD64: 'v1', GOTOOLCHAIN: 'go1.27.4',
  PATH: `${path.dirname(process.execPath)}:${goDir}:${process.env.PATH}`,
  AEGIS_NODE_BIN: process.execPath,
  COMPOSE_PROJECT_NAME: `aegisgate-06a-b-${randomBytes(6).toString('hex')}` };
fs.mkdirSync(output, { recursive: true });
const fixture = fs.mkdtempSync(path.resolve('.local/sprint06a-b-'));
const privateNames = ['pki', 'compose.env', 'postgres-password', 'redis-password', 'nats-token', 'redis.conf', 'nats.conf'];
for (const name of privateNames) assert.ok(!fs.existsSync(`.local/${name}`), `owned fixture directory must be fresh: ${name}`);
const sourceFiles = git('ls-files', 'internal/configsnapshot', 'internal/configconsumer', 'internal/configrollout', 'internal/configpublish',
  'spikes/sprint06a-admission', 'scripts/sprint06a-b-*', 'spikes/envoy/sprint05d-a-*',
  'spikes/envoy/sprint05c-a-*', 'spikes/envoy/wire-fixtures.mjs', 'go.mod', 'go.sum').split('\n').filter(Boolean);
const record = { sourceCommit: git('rev-parse', 'HEAD'), sourceTree: git('rev-parse', 'HEAD^{tree}'),
  argv: process.argv, cwd: process.cwd(), started: new Date().toISOString(),
  nodeVersion: process.version, nodeSha256: sha(fs.readFileSync(process.execPath)), goSha256: sha(fs.readFileSync(go)),
  flockSha256: sha(fs.readFileSync('/usr/bin/flock')), fixtureLock: '/tmp/aegisgate-sprint02-fixtures.lock',
  environment: Object.fromEntries(['TMPDIR','GOAMD64','GOTOOLCHAIN','COMPOSE_PROJECT_NAME','PATH'].map((k) => [k,env[k]])),
  sources: sourceFiles.map((file) => ({ file, sha256: sha(fs.readFileSync(file)) })), commands: [],
  hypothesis: { failure: 'unsigned or stale/cross-tenant admission can weaken a signed route',
    mechanism: 'actual Module03 verifier/trust/consumer/leases/LKG; build-tag-only detached hook; unchanged05D finite runtime and maintained JWT/TLS',
    positive: 'signed strict_finite POST exactly once and one captured generation through rollback',
    stop: 'experimental multi-hop fixture only; no production contract, SSRF or full gateway claim' },
  module01Pass: false, productionEligible: false, passed: false };
const save = () => fs.writeFileSync(`${output}/receipt.json`, JSON.stringify(record,null,2)+'\n');
async function run(label, executable, args, extra = {}, timeout = 180000, cwd = process.cwd()) {
  assertLock();
  const started = new Date().toISOString();
  const result = await new Promise((resolve) => {
    const child = spawn(executable,args,{ cwd, env:{...env,...extra}, stdio:['ignore','pipe','pipe'] });
    const chunks = { stdout:[], stderr:[] }; let error;
    child.stdout.on('data',(b)=>chunks.stdout.push(b)); child.stderr.on('data',(b)=>chunks.stderr.push(b));
    const timer = setTimeout(()=>{error='bounded command deadline';child.kill('SIGTERM');},timeout);
    child.on('error',(e)=>{error=e.message;});
    child.on('close',(exit,signal)=>{clearTimeout(timer);resolve({exit,signal,error,stdout:Buffer.concat(chunks.stdout),stderr:Buffer.concat(chunks.stderr)});});
  });
  const streams = ['stdout','stderr'].map((name)=>{const file=`${output}/${label}.${name}`;fs.writeFileSync(file,result[name]);return {file,bytes:result[name].length,sha256:sha(result[name])};});
  record.commands.push({label,argv:[executable,...args],cwd,extra,started,ended:new Date().toISOString(),
    exit:result.exit,signal:result.signal,error:result.error,streams,
    executableSha256:sha(fs.readFileSync(fs.realpathSync(executable)))});save();
  console.log(`${label}: exit=${result.exit}`);
  assert.equal(result.error,undefined,label);assert.equal(result.exit,0,label);
  return result.stdout.toString();
}
let composeStarted = false;
const compose = ['compose','--env-file','.local/compose.env','--env-file','.local/fixture-images.env','-f','infra/compose/compose.yaml'];
try {
  await run('node-version',process.execPath,['--version']);await run('go-version',go,['version']);
  await run('openssl-version','/usr/bin/openssl',['version']);await run('git-version','/usr/bin/git',['--version']);
  record.protectedBefore = JSON.parse(await run('protected-before',process.execPath,['scripts/sprint05b-baseline.mjs']));
  const buildRecord = { commands:[] };record.build=buildRecord;
  const { output:addon } = await build(fixture,buildRecord);save();
  await run('normal-build-snapshot',go,['list','-f','{{join .GoFiles ","}}','./internal/configsnapshot']);
  const normal = fs.readFileSync(`${output}/normal-build-snapshot.stdout`,'utf8');
  assert.ok(!normal.includes('sprint06a_experimental.go'),'research verifier excluded from normal build');
  const binary=path.join(fixture,'signed-admission.test');
  await run('build-admission',go,['test','-c','-race','-tags=aegisgate_sprint06a_feasibility','-o',binary,'./spikes/sprint06a-admission']);
  record.admissionBinarySha256=sha(fs.readFileSync(binary));
  const custom = await run('signed-finite-race',binary,['-test.v','-test.count=1','-test.timeout=90s'],{
    AEGIS_SPRINT06A_NODE:process.execPath,AEGIS_SPRINT06A_ROOT:process.cwd(),AEGIS_SPRINT06A_ADDON:addon });
  assert.ok(!/--- (FAIL|SKIP):/.test(custom));
  record.admissionTests={topLevel:(custom.match(/^--- PASS:/gm)??[]).length,subtests:(custom.match(/^\s+--- PASS:/gm)??[]).length,skipped:0};
  composeStarted=true;
  await run('fixtures-up','/usr/bin/make',['dev-up'],{},300000);
  for (const packageName of ['configsnapshot','configconsumer','configpublish','configrollout']) {
    const testBinary=path.join(fixture,`${packageName}.test`);
    await run(`build-${packageName}`,go,['test','-c','-race','-o',testBinary,`./internal/${packageName}`]);
    const raw=await run(`module03-${packageName}`,testBinary,['-test.v','-test.count=1','-test.timeout=120s'],{AEGIS_TENANCY_INTEGRATION:'1',AEGIS_FIXTURE_ROOT:process.cwd()},180000,path.resolve(`internal/${packageName}`));
    assert.ok(!/--- (FAIL|SKIP):/.test(raw),`${packageName}: no skipped real integration`);
  }
  await run('go-vet-tagged',go,['vet','-tags=aegisgate_sprint06a_feasibility','./spikes/sprint06a-admission','./internal/configsnapshot']);
  record.protectedAfter=JSON.parse(await run('protected-after',process.execPath,['scripts/sprint05b-baseline.mjs']));
  assert.deepEqual(record.protectedAfter,record.protectedBefore);
  record.passed=true;
} catch(error) {record.error=error.stack;} finally {
  assertLock();
  const cleanup = async(label,action) => {try{await action();}catch(e){record.passed=false;(record.cleanupErrors??=[]).push({label,error:e.message});}};
  if(composeStarted)await cleanup('compose',()=>run('cleanup-compose','/usr/bin/docker',[...compose,'down','--volumes','--remove-orphans']));
  for(const kind of ['container','network','volume'])if(composeStarted)await cleanup(`remaining-${kind}`,async()=>{
    assert.equal((await run(`remaining-${kind}`,'/usr/bin/docker',[kind,'ls','--filter',`label=com.docker.compose.project=${env.COMPOSE_PROJECT_NAME}`,'--format','{{.ID}}'])).trim(),'');});
  await cleanup('private-material',async()=>{
    const values=['postgres-password','redis-password','nats-token','pki/valid.jwt'].filter((name)=>fs.existsSync(`.local/${name}`)).map((name)=>fs.readFileSync(`.local/${name}`,'utf8').trim()).filter(Boolean);
    for(const name of fs.readdirSync(output)){const raw=fs.readFileSync(`${output}/${name}`);assert.ok(!values.some((value)=>raw.includes(value)),'private fixture value in retained stream');assert.ok(!/-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/.test(raw.toString()));assert.ok(!/Bearer eyJ/.test(raw.toString()),'JWT in evidence');}
    record.privateMatches=0;
  });
  fs.rmSync(fixture,{recursive:true,force:true});for(const name of privateNames)fs.rmSync(`.local/${name}`,{recursive:true,force:true});
  record.privateFixtureAbsent=!fs.existsSync(fixture)&&privateNames.every((name)=>!fs.existsSync(`.local/${name}`));
  record.sourcesUnchanged=record.sources.every(({file,sha256})=>sha(fs.readFileSync(file))===sha256);
  record.lockHeldThroughCleanupAndHashes=true;record.ended=new Date().toISOString();save();
  fs.writeFileSync(`${output}/SHA256SUMS`,fs.readdirSync(output).sort().map((name)=>`${sha(fs.readFileSync(`${output}/${name}`))}  ${output}/${name}\n`).join(''));
}
console.log(JSON.stringify({passed:record.passed,error:record.error,tests:record.admissionTests,privateFixtureAbsent:record.privateFixtureAbsent}));
process.exitCode=record.passed&&record.privateFixtureAbsent&&record.sourcesUnchanged?0:1;
