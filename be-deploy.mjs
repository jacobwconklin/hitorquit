#!/usr/bin/env node

// Fill these in when ready. This file is a SKELETON: deployment methods below
// deliberately throw until implemented. Nothing is uploaded or executed remotely.
export const CONFIG = {
  sshHost: '',          // EC2 public DNS name or IP address.
  sshUser: '',          // e.g. ubuntu or ec2-user; also owns the PM2 process.
  sshPort: '',          // e.g. '22'.
  pemFile: '',          // e.g. './my-ec2-key.pem', relative to THIS file.
  repositoryUrl: '',    // e.g. git@github.com:owner/HitOrQuit.git (initial clone).
  gitBranch: '',        // Branch to deploy, e.g. main.
  remoteRepoDir: '',    // Absolute EC2 path, e.g. /home/ubuntu/HitOrQuit.
  remoteBackendDir: '', // Absolute EC2 path, e.g. /home/ubuntu/HitOrQuit/hoq-be.
  remotePath: '',       // PATH for noninteractive SSH: include node/npm/pm2/git.
  remoteEnvFile: '',    // Absolute backend env file on EC2; provision separately.
  pm2Name: '',          // Unique PM2 process name, e.g. hoq-backend.
  backendEntry: '',     // Relative to hoq-be: dist/hoq-be/src/server.js.
  healthUrl: '',        // URL to check ON EC2, e.g. http://127.0.0.1:8080/health.
};

import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

export function validateConfiguration(config) {
  const missing = Object.entries(config).filter(([, value]) => !value.trim()).map(([name]) => name);
  if (missing.length) throw new Error(`Fill in CONFIG at the top of be-deploy.mjs: ${missing.join(', ')}`);
  // TODO: Validate port, branch, absolute remote paths, and readable local PEM.
  // Resolve PEM relative to this script, not the caller's working directory.
}

function notImplemented(method) {
  throw new Error(`${method} is a deployment stub. Implement it before deploying.`);
}

// Each command builder will return a fragment of ONE remote shell script.
// Run that script with `set -eu` so failed pulls/builds never restart PM2.
// Quote every configuration value as a POSIX shell argument; do not interpolate
// raw values into shell commands. Keep deployment steps in one SSH invocation
// so working-directory changes and PATH settings persist.

export function prepareCheckoutCommands(config) {
  // TODO: Set the noninteractive PATH from config.remotePath.
  // If config.remoteRepoDir is missing, git clone --branch <gitBranch>
  // <repositoryUrl> <remoteRepoDir>. Otherwise verify it is the intended checkout.
  // The EC2 user's GitHub access must already be configured for private repos.
  // The local PEM authenticates to EC2, not to GitHub. Do not forward SSH agents.
  return notImplemented('prepareCheckoutCommands');
}

export function enterBackendCommands(config) {
  // TODO: cd <remoteBackendDir>; verify it belongs to remoteRepoDir.
  // Pull the WHOLE repository: the backend imports hoq-fe/src/game modules.
  return notImplemented('enterBackendCommands');
}

export function pullChangesCommands(config) {
  // TODO: Reject tracked local modifications or the wrong checked-out branch.
  // Then git pull --ff-only origin <gitBranch> from the backend directory.
  // Do not discard remote edits or create automatic merge commits.
  return notImplemented('pullChangesCommands');
}

export function buildBackendCommands(config) {
  // TODO: npm ci (include dev dependencies: TypeScript is needed to build).
  // Then npm run build; verify <backendEntry> exists before restarting anything.
  // Do not run npm start separately: PM2 must own the server process.
  return notImplemented('buildBackendCommands');
}

export function restartBackendCommands(config) {
  // TODO: Inspect PM2 for the exact config.pm2Name under config.sshUser.
  // Existing process: pm2 restart <pm2Name> --update-env.
  // First deployment: pm2 start <backendEntry> --name <pm2Name>
  //   --cwd <remoteBackendDir> --node-args="--env-file=<remoteEnvFile>".
  // Keep a single instance (fork mode): multiplayer state lives in memory.
  // Verify existing cwd, entry point, and env-file configuration match this config.
  // Node loads the remote env file; never print it or copy the PEM to EC2.
  return notImplemented('restartBackendCommands');
}

export function verifyBackendCommands(config) {
  // TODO: Poll config.healthUrl on EC2 with curl --fail and a bounded timeout.
  // Verify PM2 reports this process online, then pm2 save.
  // Surface failures and return nonzero; do not claim a rollback was performed.
  return notImplemented('verifyBackendCommands');
}

export function buildRemoteScript(config) {
  return ['set -eu', prepareCheckoutCommands(config), enterBackendCommands(config),
    pullChangesCommands(config), buildBackendCommands(config),
    restartBackendCommands(config), verifyBackendCommands(config)].join('\n');
}

export async function executeOverSsh(config, remoteScript) {
  // TODO: Spawn local OpenSSH with an argument array and shell:false:
  // ssh -i <resolvedPemFile> -p <sshPort> -o BatchMode=yes
  //   -o StrictHostKeyChecking=yes -o ConnectTimeout=15 <sshUser>@<sshHost> sh -s
  // Write remoteScript to SSH stdin; stream output and reject nonzero exit codes.
  // The EC2 host key must already be verified in the local known_hosts file.
  return notImplemented('executeOverSsh');
}

export async function deploy(config = CONFIG) {
  validateConfiguration(config);
  const script = buildRemoteScript(config);
  await executeOverSsh(config, script);
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  if (process.argv.includes('--help')) {
    console.log('Backend deployment skeleton. Fill CONFIG and implement the stubs before running node be-deploy.mjs. No deployment is implemented yet.');
  } else {
    deploy().catch(error => { console.error(error.message); process.exitCode = 1; });
  }
}
