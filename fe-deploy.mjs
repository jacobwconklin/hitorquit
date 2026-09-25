#!/usr/bin/env node
import { spawnSync } from 'node:child_process';
import { existsSync, readFileSync, statSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseEnv } from 'node:util';

// First re-build frontend with: $ npm run build:web in hoq-fe

// Set your destination here, including an optional folder prefix.
// Example: 's3://my-website-bucket/hit-or-quit/'
const S3_FRONTEND_PATH = 's3://conkgames/hitorquit/';

const ROOT = dirname(fileURLToPath(import.meta.url));

export function createDeployment(root, destination, dryRun = false) {
  if (!/^s3:\/\/[a-z0-9][a-z0-9.-]{1,61}[a-z0-9](?:\/[^?#\r\n]*)?$/.test(destination)) {
    throw new Error('Set S3_FRONTEND_PATH in fe-deploy.mjs to s3://your-bucket/optional-prefix/.');
  }
  const target = `${destination.replace(/\/+$/, '')}/`;
  const dist = join(root, 'hoq-fe', 'dist');
  const index = join(dist, 'index.html');
  if (!existsSync(index) || !statSync(index).isFile() || statSync(index).size === 0) {
    throw new Error('Missing or empty hoq-fe/dist/index.html. Run npm run build:web in hoq-fe first.');
  }
  const envFile = join(root, '.env');
  if (!existsSync(envFile)) throw new Error('Missing root .env. Copy .env.example to .env and enter your AWS credentials.');
  const credentials = parseEnv(readFileSync(envFile, 'utf8'));
  for (const key of ['AWS_ACCESS_KEY_ID', 'AWS_SECRET_ACCESS_KEY']) {
    if (!credentials[key]?.trim() || credentials[key].startsWith('replace_')) {
      throw new Error(`Set ${key} in the root .env file.`);
    }
  }
  const region = credentials.AWS_REGION?.trim() || credentials.AWS_DEFAULT_REGION?.trim();
  if (!region) throw new Error('Set AWS_REGION in the root .env file.');

  // Pass only supported .env settings to the child process. Never evaluate .env
  // as code, print its contents, or put credentials into command-line arguments.
  const env = { ...process.env };
  for (const key of ['AWS_PROFILE', 'AWS_DEFAULT_PROFILE', 'AWS_SESSION_TOKEN', 'AWS_SECURITY_TOKEN']) delete env[key];
  Object.assign(env, {
    AWS_ACCESS_KEY_ID: credentials.AWS_ACCESS_KEY_ID,
    AWS_SECRET_ACCESS_KEY: credentials.AWS_SECRET_ACCESS_KEY,
    AWS_REGION: region,
    AWS_DEFAULT_REGION: region,
    AWS_PAGER: '',
    AWS_CLI_AUTO_PROMPT: 'off',
  });
  if (credentials.AWS_SESSION_TOKEN?.trim()) env.AWS_SESSION_TOKEN = credentials.AWS_SESSION_TOKEN;

  const common = ['--region', region, '--no-progress'];
  if (dryRun) common.push('--dryrun');
  return {
    target, env,
    commands: [
      // Upload new dependencies before publishing the new entry point. Retain old
      // assets so already-open tabs keep working and unrelated S3 files survive.
      ['s3', 'sync', dist, target, '--exclude', 'index.html', '--cache-control', 'no-cache', ...common],
      ['s3', 'cp', index, `${target}index.html`, '--content-type', 'text/html', '--cache-control', 'no-cache', ...common],
    ],
  };
}

export function executeDeployment(deployment, run = spawnSync) {
  for (const args of deployment.commands) {
    const result = run('aws', args, { env: deployment.env, stdio: 'inherit', shell: false });
    if (result.error) {
      if (result.error.code === 'ENOENT') throw new Error('AWS CLI was not found. Install AWS CLI v2 and ensure aws is on PATH.');
      throw new Error('Unable to start AWS CLI.');
    }
    if (result.status !== 0) throw new Error(`Deployment stopped: AWS CLI exited with ${result.status ?? result.signal ?? 'an error'}.`);
  }
}

function main() {
  const args = process.argv.slice(2);
  if (args.includes('--help')) {
    console.log('Usage: node fe-deploy.mjs [--dry-run]\nUploads hoq-fe/dist/ to S3_FRONTEND_PATH using the root .env.\nBuild the frontend first. Remote files are not deleted.');
    return;
  }
  if (args.some(arg => arg !== '--dry-run')) throw new Error('Unknown option. Use node fe-deploy.mjs --help.');
  const dryRun = args.includes('--dry-run');
  const deployment = createDeployment(ROOT, S3_FRONTEND_PATH, dryRun);
  console.log(`${dryRun ? 'Previewing' : 'Deploying'} hoq-fe/dist/ → ${deployment.target}`);
  executeDeployment(deployment);
  console.log(dryRun ? 'Preview complete. No files uploaded.' : 'Frontend uploaded to S3.');
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try { main(); }
  catch (error) { console.error(error instanceof Error ? error.message : 'Deployment failed.'); process.exitCode = 1; }
}
