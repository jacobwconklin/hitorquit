import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createDeployment, executeDeployment } from '../fe-deploy.mjs';

function fixture(t) {
  const root = mkdtempSync(join(tmpdir(), 'hoq-deploy-'));
  t.after(() => rmSync(root, { recursive: true, force: true }));
  mkdirSync(join(root, 'hoq-fe', 'dist'), { recursive: true });
  writeFileSync(join(root, 'hoq-fe', 'dist', 'index.html'), '<html>Test</html>');
  writeFileSync(join(root, '.env'), 'AWS_ACCESS_KEY_ID=test-key\nAWS_SECRET_ACCESS_KEY="test=secret"\nAWS_REGION=us-east-1\nAWS_SESSION_TOKEN=test-token\n');
  return root;
}

test('scopes uploads to the prefix, passes credentials only through env, publishes index last', t => {
  const root = fixture(t);
  const plan = createDeployment(root, 's3://test-bucket/game/');
  const calls = [];
  executeDeployment(plan, (file, args, options) => { calls.push({ file, args, options }); return { status: 0 }; });
  assert.equal(calls.length, 2);
  assert.equal(calls[0].file, 'aws');
  assert.deepEqual(calls[0].args.slice(0, 4), ['s3', 'sync', join(root, 'hoq-fe', 'dist'), 's3://test-bucket/game/']);
  assert.equal(calls[1].args[3], 's3://test-bucket/game/index.html');
  assert.equal(calls[0].options.env.AWS_SECRET_ACCESS_KEY, 'test=secret');
  assert.equal(calls[0].options.env.AWS_SESSION_TOKEN, 'test-token');
  assert.equal(calls[0].options.shell, false);
  assert.ok(!JSON.stringify(plan.commands).includes('test=secret'));
  assert.ok(plan.commands.every(args => !args.includes('--delete')));
});

test('dry-run applies to both operations and bucket-root destinations are supported', t => {
  const plan = createDeployment(fixture(t), 's3://test-bucket', true);
  assert.equal(plan.target, 's3://test-bucket/');
  assert.ok(plan.commands.every(args => args.includes('--dryrun')));
});

test('rejects missing settings, missing build and absent credentials before invoking AWS', t => {
  const root = fixture(t);
  for (const path of ['', 'https://test-bucket', 's3://', 's3://test-bucket?query']) assert.throws(() => createDeployment(root, path), /S3_FRONTEND_PATH/);
  writeFileSync(join(root, '.env'), 'AWS_REGION=us-east-1');
  assert.throws(() => createDeployment(root, 's3://test-bucket'), /AWS_ACCESS_KEY_ID/);
  writeFileSync(join(root, 'hoq-fe', 'dist', 'index.html'), '');
  assert.throws(() => createDeployment(root, 's3://test-bucket'), /build:web/);
});

test('stops after upload failure without publishing the new index', t => {
  let calls = 0;
  assert.throws(() => executeDeployment(createDeployment(fixture(t), 's3://test-bucket'), () => { calls++; return { status: 1 }; }), /Deployment stopped/);
  assert.equal(calls, 1);
});
