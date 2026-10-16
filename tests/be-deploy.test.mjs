import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { CONFIG, quote, validateConfiguration, checkProcess, buildRemoteScript, buildBackendCommands, restartBackendCommands, verifyBackendCommands, executeOverSsh, deploy, main } from '../be-deploy.mjs';

const shell = process.platform === 'win32' ? 'C:/Program Files/Git/bin/bash.exe' : '/bin/sh';
const hasShell = existsSync(shell);
const processInfo = () => ({ name: CONFIG.pm2Name, pm_id: 3, pm2_env: {
  pm_cwd: CONFIG.remoteBackendDir, pm_exec_path: CONFIG.remoteBackendDir + '/' + CONFIG.backendEntry,
  exec_interpreter: CONFIG.remoteNode, exec_mode: 'fork_mode', watch: false,
  node_args: ['--env-file=' + CONFIG.remoteEnvFile], status: 'online',
} });

test('rejects unsafe configuration', () => {
  validateConfiguration(CONFIG);
  for (const change of [{sshHost: '-bad'}, {sshPort: '0'}, {sshPort: '65536'}, {gitBranch: 'main;touch bad'},
    {remoteBackendDir: '/tmp/other'}, {backendEntry: '../server.js'}, {pm2Name: 'all'}, {healthUrl: 'https://example.com'}]) {
    assert.throws(() => validateConfiguration({...CONFIG, ...change}));
  }
});
test('PM2 matching excludes other apps and rejects changed, duplicate or offline processes', () => {
  assert.equal(checkProcess([{name: 'other'}, processInfo()], CONFIG, true), 3);
  assert.throws(() => checkProcess([], CONFIG));
  assert.throws(() => checkProcess([processInfo(), processInfo()], CONFIG));
  for (const field of ['pm_cwd', 'pm_exec_path', 'exec_interpreter', 'exec_mode', 'node_args']) {
    const p = processInfo(); p.pm2_env[field] = 'wrong';
    assert.throws(() => checkProcess([p], CONFIG));
  }
  const p = processInfo(); p.pm2_env.status = 'stopped';
  assert.throws(() => checkProcess([p], CONFIG, true));
});
test('SSH streams script on stdin and propagates failures', () => {
  const c = {...CONFIG, pemFile: fileURLToPath(import.meta.url)};
  executeOverSsh(c, 'test-script', (file, args, options) => {
    assert.equal(file, 'ssh');
    for (const value of ['BatchMode=yes', 'StrictHostKeyChecking=yes', 'IdentitiesOnly=yes', 'ForwardAgent=no']) assert.ok(args.includes(value));
    assert.equal(options.input, 'test-script');
    assert.deepEqual(options.stdio, ['pipe', 'inherit', 'inherit']);
    assert.equal(options.shell, false);
    return {status: 0};
  });
  assert.throws(() => executeOverSsh(c, '', () => ({status: 255})), /SSH exited with 255/);
  assert.throws(() => executeOverSsh(c, '', () => ({error: new Error('missing')})), /Unable to run SSH/);
});
test('dry run cannot connect, and rejects unsupported options', () => {
  const original = console.log;
  const output = [];
  console.log = text => output.push(text);
  try { deploy(CONFIG, {dryRun: true, run: () => assert.fail('must not connect')}); }
  finally { console.log = original; }
  assert.match(output[0], /commit and push/);
  assert.match(output[1], /No SSH connection/);
  assert.throws(() => main(['--skip-tests']), /Unknown option/);
});
test('complete remote script passes shell syntax validation', {skip: !hasShell}, () => {
  const result = spawnSync(shell, ['-n'], {input: buildRemoteScript(CONFIG), encoding: 'utf8'});
  assert.equal(result.status, 0, result.stderr);
});
test('shell quoting preserves metacharacters as literal data', {skip: !hasShell}, () => {
  const value = "one'two $(echo injected) `echo injected`";
  const result = spawnSync(shell, ['-c', 'printf %s ' + quote(value)], {encoding: 'utf8'});
  assert.equal(result.stdout, value);
});

// Execute actual generated build/restart/health shell fragments using fake services.
// No network, package installation, PM2 daemon, or production files are touched.
function simulate({install = 0, tests = 0, health = 'ok', mismatch = false, forceColor = '0'} = {}) {
  const c = {...CONFIG, backendEntry: 'be-deploy.mjs'};
  const p = processInfo(); p.pm2_env.pm_exec_path = c.remoteBackendDir + '/' + c.backendEntry;
  if (mismatch) p.pm2_env.exec_interpreter = '/wrong/node';
  const script = [
    'set -eu', 'fail() { echo "$1" >&2; exit 1; }',
    'npm() { if [ "$1" = ci ]; then return ' + install + '; else return ' + tests + '; fi; }',
    'pm2() { if [ "$1" = jlist ]; then printf %s ' + quote(JSON.stringify([p])) + '; else echo "RESTART:$2"; fi; }',
    'curl() { printf %s ' + quote(JSON.stringify({status: health})) + '; }',
    'sleep() { :; }',
    buildBackendCommands(c), restartBackendCommands(c), verifyBackendCommands(c),
  ].join('\n');
  return spawnSync(shell, ['-c', script], {encoding: 'utf8', env: {...process.env, FORCE_COLOR: forceColor}});
}
test('build and test failures prevent PM2 restart', {skip: !hasShell}, () => {
  for (const options of [{install: 1}, {tests: 1}]) {
    const result = simulate(options);
    assert.notEqual(result.status, 0);
    assert.doesNotMatch(result.stdout, /RESTART:/);
  }
});
test('PM2 configuration mismatch prevents restart', {skip: !hasShell}, () => {
  const result = simulate({mismatch: true});
  assert.notEqual(result.status, 0);
  assert.doesNotMatch(result.stdout, /RESTART:/);
  assert.match(result.stderr, /configuration differs/);
});
test('successful deployment restarts the matched ID and verifies health', {skip: !hasShell}, () => {
  const result = simulate();
  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /RESTART:3/);
  assert.match(result.stdout, /Backend deployment complete/);
});
test('forced terminal colors cannot contaminate the PM2 restart ID', {skip: !hasShell}, () => {
  const result = simulate({forceColor: '1'});
  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /^RESTART:3\r?$/m);
  assert.doesNotMatch(result.stdout, /\u001b/);
});
test('bad health response fails without claiming success', {skip: !hasShell}, () => {
  const result = simulate({health: 'bad'});
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /health check failed/);
  assert.doesNotMatch(result.stdout, /Backend deployment complete/);
});
