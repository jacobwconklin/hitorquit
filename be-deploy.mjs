#!/usr/bin/env node
import { spawnSync } from 'node:child_process';
import { accessSync, constants, statSync } from 'node:fs';
import { homedir } from 'node:os';
import { dirname, join, posix, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = dirname(fileURLToPath(import.meta.url));
export const CONFIG = {
  sshHost: '54.163.185.78',
  sshUser: 'ec2-user',
  sshPort: '22',
  pemFile: '~/.ssh/conkgames-ec2',
  repositoryUrl: 'https://github.com/jacobwconklin/hitorquit.git',
  gitBranch: 'main',
  remoteRepoDir: '/home/ec2-user/hitorquit',
  remoteBackendDir: '/home/ec2-user/hitorquit/hoq-be',
  remotePath: '/home/ec2-user/.nvm/versions/node/v24.20.0/bin:/usr/local/bin:/usr/bin:/bin',
  remoteNode: '/home/ec2-user/.nvm/versions/node/v24.20.0/bin/node',
  remoteEnvFile: '/home/ec2-user/hitorquit/hoq-be/.env',
  pm2Name: 'hoq-backend',
  backendEntry: 'dist/hoq-be/src/server.js',
  healthUrl: 'http://127.0.0.1:8081/health',
};
export const PUSH_REMINDER = 'Before deploying, commit and push all changes you want to deploy to GitHub. Backend deployment pulls from GitHub; local unpushed changes are not included.';
export const quote = value => "'" + String(value).replaceAll("'", "'\\''") + "'";
export function keyPath(c) {
  return c.pemFile.startsWith('~/') ? join(homedir(), c.pemFile.slice(2)) : resolve(ROOT, c.pemFile);
}
export function validateConfiguration(c) {
  for (const key of Object.keys(CONFIG)) {
    if (typeof c[key] !== 'string' || !c[key].trim() || /[\r\n\0]/.test(c[key])) throw new Error('Invalid CONFIG.' + key);
  }
  if (!/^[a-zA-Z0-9][a-zA-Z0-9.-]*$/.test(c.sshHost)) throw new Error('Invalid SSH host.');
  if (!/^[a-z_][a-z0-9_-]*$/.test(c.sshUser)) throw new Error('Invalid SSH user.');
  if (!/^\d+$/.test(c.sshPort) || Number(c.sshPort) < 1 || Number(c.sshPort) > 65535) throw new Error('Invalid SSH port.');
  if (!/^[a-zA-Z0-9][a-zA-Z0-9_./-]*$/.test(c.gitBranch)) throw new Error('Invalid branch.');
  for (const key of ['remoteRepoDir', 'remoteBackendDir', 'remoteEnvFile', 'remoteNode']) {
    if (!posix.isAbsolute(c[key]) || posix.normalize(c[key]) !== c[key] || c[key] === '/') throw new Error('Invalid absolute path: ' + key);
  }
  if (c.remoteBackendDir !== posix.join(c.remoteRepoDir, 'hoq-be')) throw new Error('Backend must be inside the checkout.');
  if (posix.isAbsolute(c.backendEntry) || c.backendEntry.startsWith('-') || c.backendEntry.split('/').includes('..')) throw new Error('Invalid backend entry.');
  if (!/^[a-zA-Z0-9][a-zA-Z0-9_-]*$/.test(c.pm2Name) || c.pm2Name === 'all') throw new Error('Invalid PM2 name.');
  const health = new URL(c.healthUrl);
  if (health.protocol !== 'http:' || health.hostname !== '127.0.0.1' || health.username || health.password) throw new Error('Health URL must use HTTP on 127.0.0.1.');
}

// Validate selected fields without printing PM2's environment.
export function checkProcess(processes, c, requireOnline = false) {
  const matches = processes.filter(item => item.name === c.pm2Name);
  if (matches.length !== 1) throw new Error('Expected exactly one existing ' + c.pm2Name + ' process.');
  const p = matches[0];
  const env = p.pm2_env;
  const args = typeof env?.node_args === 'string' ? [env.node_args] : env?.node_args;
  if (!env || env.pm_cwd !== c.remoteBackendDir || env.pm_exec_path !== c.remoteBackendDir + '/' + c.backendEntry ||
      env.exec_interpreter !== c.remoteNode || env.exec_mode !== 'fork_mode' || env.watch ||
      !Array.isArray(args) || args.length !== 1 || args[0] !== '--env-file=' + c.remoteEnvFile ||
      !Number.isInteger(p.pm_id) || p.pm_id < 0) throw new Error('PM2 configuration differs from the verified backend configuration.');
  if (requireOnline && env.status !== 'online') throw new Error('Backend PM2 process is not online.');
  return p.pm_id;
}
function pm2Check(c, online = false) {
  // Machine-readable IDs must bypass console's numeric color formatting.
  const code = 'const fs = require("node:fs"); const check = ' + checkProcess.toString() +
    '; try { process.stdout.write(String(check(JSON.parse(fs.readFileSync(0, "utf8")), ' + JSON.stringify(c) + ', ' + online +
    '))); } catch (error) { console.error(error.message); process.exit(1); }';
  return 'pm2_json=$(pm2 jlist)\nbackend_id=$(printf "%s" "$pm2_json" | node -e ' + quote(code) + ')\nunset pm2_json';
}
export function prepareCheckoutCommands(c) {
  return [
    'export PATH=' + quote(c.remotePath),
    'export GIT_TERMINAL_PROMPT=0',
    '[ "$(id -un)" = ' + quote(c.sshUser) + ' ] || fail "Unexpected remote user."',
    'for tool in node npm pm2 git curl flock; do command -v "$tool" >/dev/null || fail "Missing tool: $tool"; done',
    '[ "$(command -v node)" = ' + quote(c.remoteNode) + ' ] || fail "Unexpected Node interpreter."',
    'cd ' + quote(c.remoteRepoDir),
    '[ "$(pwd -P)" = ' + quote(c.remoteRepoDir) + ' ] || fail "Checkout resolves to another directory."',
    '[ "$(git rev-parse --show-toplevel)" = ' + quote(c.remoteRepoDir) + ' ] || fail "Wrong Git checkout."',
    'exec 9>.git/hoq-deploy.lock',
    'flock -n 9 || fail "Another backend deployment is running."',
    '[ "$(git remote get-url origin)" = ' + quote(c.repositoryUrl) + ' ] || fail "Unexpected origin URL."',
    'git check-ref-format --branch ' + quote(c.gitBranch) + ' >/dev/null',
    '[ "$(git branch --show-current)" = ' + quote(c.gitBranch) + ' ] || fail "Unexpected branch."',
    'checkout_status=$(git status --porcelain --untracked-files=normal)',
    '[ -z "$checkout_status" ] || fail "Checkout has local changes; resolve them before deploying."',
    '[ -r ' + quote(c.remoteEnvFile) + ' ] || fail "Backend env file is missing or unreadable."',
    pm2Check(c),
    'previous_commit=$(git rev-parse HEAD)',
    'printf "Previous commit: %s\\n" "$previous_commit"',
  ].join('\n');
}
export function enterBackendCommands(c) {
  return 'cd ' + quote(c.remoteBackendDir) + '\n[ "$(pwd -P)" = ' + quote(c.remoteBackendDir) + ' ] || fail "Backend resolves to another directory."';
}
export function pullChangesCommands(c) {
  return [
    'echo "Fetching GitHub updates..."',
    'git fetch origin ' + quote(c.gitBranch),
    'target_commit=$(git rev-parse FETCH_HEAD)',
    'git merge-base --is-ancestor HEAD "$target_commit" || fail "Local branch is ahead of or diverged from GitHub."',
    'git merge --ff-only "$target_commit"',
    'printf "Deploying commit: %s\\n" "$target_commit"',
  ].join('\n');
}
export function buildBackendCommands(c) {
  return ['echo "Installing dependencies and running backend build/tests..."', 'npm ci --include=dev', 'npm test', 'test -s ' + quote(c.backendEntry)].join('\n');
}
export function restartBackendCommands(c) {
  // Preserve PM2's environment and interpreter; Node reloads its env file.
  return [pm2Check(c), 'echo "Restarting ' + c.pm2Name + ' (active games will end)..."', 'pm2 restart "$backend_id"'].join('\n');
}
export function verifyBackendCommands(c) {
  return [
    'echo "Checking backend health..."', 'healthy=0',
    'for attempt in 1 2 3 4 5 6 7 8 9 10; do',
    '  if health_body=$(curl --silent --show-error --fail --max-time 5 ' + quote(c.healthUrl) + '); then',
    '    if printf "%s" "$health_body" | node -e ' + quote('try { const data = JSON.parse(require("node:fs").readFileSync(0, "utf8")); process.exit(data.status === "ok" ? 0 : 1); } catch { process.exit(1); }') + '; then',
    '      healthy=1', '      break', '    fi', '  fi', '  sleep 2', 'done',
    '[ "$healthy" = 1 ] || fail "Backend health check failed."', pm2Check(c, true),
    // Restart does not change the saved definition; do not save other apps' state.
    'echo "Backend deployment complete."',
  ].join('\n');
}
export function buildRemoteScript(c) {
  validateConfiguration(c);
  return ['set -eu', 'previous_commit="not recorded"', 'fail() { echo "$1" >&2; exit 1; }',
    'trap \'code=$?; if [ "$code" -ne 0 ]; then echo "Backend deployment failed. No automatic rollback was performed. Previous commit: $previous_commit" >&2; fi\' EXIT',
    prepareCheckoutCommands(c), enterBackendCommands(c), pullChangesCommands(c), buildBackendCommands(c),
    restartBackendCommands(c), verifyBackendCommands(c), ''].join('\n');
}
export function executeOverSsh(c, remoteScript, run = spawnSync) {
  const key = keyPath(c);
  accessSync(key, constants.R_OK);
  if (!statSync(key).isFile()) throw new Error('SSH key path is not a file.');
  const args = ['-T', '-i', key, '-p', c.sshPort, '-o', 'BatchMode=yes', '-o', 'StrictHostKeyChecking=yes',
    '-o', 'IdentitiesOnly=yes', '-o', 'ForwardAgent=no', '-o', 'ConnectTimeout=15',
    '-o', 'ServerAliveInterval=15', '-o', 'ServerAliveCountMax=3', c.sshUser + '@' + c.sshHost, 'sh', '-s'];
  const result = run('ssh', args, { input: remoteScript, stdio: ['pipe', 'inherit', 'inherit'], shell: false });
  if (result.error) throw new Error('Unable to run SSH: ' + result.error.message);
  if (result.status !== 0) throw new Error('Backend deployment stopped: SSH exited with ' + (result.status ?? result.signal ?? 'an error') + '.');
}
export function deploy(c = CONFIG, { dryRun = false, run = spawnSync } = {}) {
  console.log(PUSH_REMINDER);
  const script = buildRemoteScript(c);
  if (dryRun) { console.log('Preview only. No SSH connection or deployment will occur.\n' + script); return; }
  executeOverSsh(c, script, run);
}
export function main(args = process.argv.slice(2)) {
  if (args.includes('--help')) {
    console.log('Usage: node be-deploy.mjs [--dry-run]\n' + PUSH_REMINDER + '\nUpdates the existing EC2 checkout, builds/tests the backend, restarts only hoq-backend, and checks health.\n--dry-run prints commands without connecting.\nRestarts end active games. Failed deployments do not automatically roll back.');
    return;
  }
  if (args.some(arg => arg !== '--dry-run')) throw new Error('Unknown option. Use node be-deploy.mjs --help.');
  deploy(CONFIG, { dryRun: args.includes('--dry-run') });
}
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try { main(); } catch (error) { console.error(error.message); process.exitCode = 1; }
}
