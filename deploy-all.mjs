#!/usr/bin/env node
import { spawnSync } from 'node:child_process';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = dirname(fileURLToPath(import.meta.url));

export function deployAll(run = spawnSync) {
  for (const script of ['fe-deploy.mjs', 'be-deploy.mjs']) {
    console.log(`Running ${script}...`);
    const result = run(process.execPath, [join(ROOT, script)], {
      cwd: ROOT, stdio: 'inherit', shell: false,
    });
    if (result.error) throw new Error(`Unable to start ${script}: ${result.error.message}`);
    if (result.status !== 0) {
      throw new Error(`Deployment stopped: ${script} exited with ${result.status ?? result.signal ?? 'an error'}.`);
    }
  }
  console.log('Frontend and backend deployment complete.');
}

function main() {
  const args = process.argv.slice(2);
  if (args.includes('--help')) {
    console.log('Usage: node deploy-all.mjs\nRuns fe-deploy.mjs, then be-deploy.mjs; stops on failure.\nBuild the frontend first. The backend currently stops at its skeleton configuration/stubs.\nFor a frontend-only preview, use node fe-deploy.mjs --dry-run.');
    return;
  }
  if (args.length) throw new Error('Unknown option. Use node deploy-all.mjs --help.');
  deployAll();
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try { main(); }
  catch (error) { console.error(error.message); process.exitCode = 1; }
}
