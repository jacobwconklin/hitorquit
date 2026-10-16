# Deploy frontend and backend together

Run `node deploy-all.mjs` from the project root. This runs `fe-deploy.mjs` (including its build) followed by `be-deploy.mjs` and stops on the first failure. Push backend changes to GitHub first. The backend pulls the remote main branch; the frontend builds local files. A backend failure does not roll back the frontend.

The combined command has no dry-run option; use `node fe-deploy.mjs --dry-run` to preview frontend uploads.

# Deploy the frontend to S3

Requires Node.js 22.13+ and AWS CLI v2 on PATH. No additional npm packages are needed by the deploy script.

1. Copy the root `.env.example` to `.env` and fill in the AWS access key, secret key, and bucket region. Add `AWS_SESSION_TOKEN` when using temporary credentials. `.env` is ignored by Git; keep it at the project root, outside frontend assets.
2. Set the `S3_FRONTEND_PATH` constant near the top of `fe-deploy.mjs`, for example `s3://your-bucket/` or `s3://your-bucket/hit-or-quit/`.
3. Build and deploy from the project root:

```sh
node fe-deploy.mjs --dry-run
node fe-deploy.mjs
```

The script first runs `npx expo export --platform web` in `hoq-fe` and stops if the build fails. Install the frontend dependencies beforehand. Pass `--skip-build` to reuse the existing `hoq-fe/dist/` build. The dry run still builds unless `--skip-build` is passed, then contacts S3 to compare files without uploading anything. Paths resolve relative to the script, so it also works when called from another directory.

The script syncs the **contents** of `hoq-fe/dist/` to the configured destination, preserving subfolders. It uploads dependencies first and always uploads `index.html` last, with `Cache-Control: no-cache` so clients revalidate. Sync uses the AWS CLI's size/modification-time comparison. An AWS command failure stops deployment and returns a nonzero exit code. Existing remote-only files are retained; there is no `--delete` operation.

The credentials need `s3:ListBucket` on the target bucket and `s3:PutObject` on the destination prefix. The script uses the credentials in `.env` rather than a selected CLI profile. It does not create buckets, change public access, configure hosting, or invalidate CloudFront caches. Existing CloudFront cache policies may require a separate invalidation after updating the site.

For a deployment under a URL subpath, ensure the web export's asset URLs are configured for that same subpath; the script does not rewrite them. Uploading to the root of a dedicated bucket is the simplest option for the current export.

References: [AWS sync behavior](https://docs.aws.amazon.com/cli/latest/reference/s3/sync.html), [AWS credential environment variables](https://docs.aws.amazon.com/cli/latest/userguide/cli-configure-envvars.html).

# Deploy the backend to EC2

Commit and push changes to GitHub before deploying. The script prints this reminder on every run.

```sh
node be-deploy.mjs --dry-run
node be-deploy.mjs
```

The backend dry run prints the generated remote script without connecting to EC2. Normal deployment uses OpenSSH on PATH, the local key at ~/.ssh/conkgames-ec2, and strict host-key verification. The same SSH executable must already trust this server. No key contents are printed or uploaded.

The CONFIG in be-deploy.mjs contains the verified ec2-user@54.163.185.78 connection, /home/ec2-user/hitorquit checkout, main branch, Node v24.20.0 path, hoq-backend PM2 process, and http://127.0.0.1:8081/health endpoint.

Deployment performs these steps in one SSH session:

1. Verify the remote user, tools, checkout, origin, branch, clean working tree, readable backend .env, and existing PM2 process configuration. Lock the checkout against overlapping deployments.
2. Record the previous commit, fetch main from GitHub, and fast-forward to the fetched commit. Reject local commits ahead of or diverged from GitHub.
3. Run npm ci --include=dev and npm test inside hoq-be. The test script compiles the backend and shared frontend game modules before running backend tests.
4. Recheck PM2 configuration and restart only the matching process ID, preserving its interpreter and environment-file arguments.
5. Retry the local health endpoint with bounded waits, require JSON status ok, and verify the PM2 process is online.

This automates updates to the existing installation. It does not clone a missing checkout, create a missing PM2 process, provision EC2, modify nginx, or save other applications' PM2 state. A configuration mismatch stops deployment for inspection.

Build or test failures stop before the restart. Updates occur in place: dependencies and build files may already have changed when a failure occurs. No automatic rollback is performed. The previous commit is printed for manual recovery using the backend deployment guide. Successful restarts end active games because sessions are held in memory.
