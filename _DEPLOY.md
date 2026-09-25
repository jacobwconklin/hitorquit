# Deploy the frontend to S3

Requires Node.js 22.13+ and AWS CLI v2 on PATH. No additional npm packages are needed by the deploy script.

1. Copy the root `.env.example` to `.env` and fill in the AWS access key, secret key, and bucket region. Add `AWS_SESSION_TOKEN` when using temporary credentials. `.env` is ignored by Git; keep it at the project root, outside frontend assets.
2. Set the `S3_FRONTEND_PATH` constant near the top of `fe-deploy.mjs`, for example `s3://your-bucket/` or `s3://your-bucket/hit-or-quit/`.
3. Build and deploy from the project root:

```sh
npm --prefix hoq-fe run build:web
node fe-deploy.mjs --dry-run
node fe-deploy.mjs
```

The dry run contacts S3 to compare files but does not upload anything. Paths resolve relative to the script, so it also works when called from another directory.

The script syncs the **contents** of `hoq-fe/dist/` to the configured destination, preserving subfolders. It uploads dependencies first and always uploads `index.html` last, with `Cache-Control: no-cache` so clients revalidate. Sync uses the AWS CLI's size/modification-time comparison. An AWS command failure stops deployment and returns a nonzero exit code. Existing remote-only files are retained; there is no `--delete` operation.

The credentials need `s3:ListBucket` on the target bucket and `s3:PutObject` on the destination prefix. The script uses the credentials in `.env` rather than a selected CLI profile. It does not create buckets, change public access, configure hosting, or invalidate CloudFront caches. Existing CloudFront cache policies may require a separate invalidation after updating the site.

For a deployment under a URL subpath, ensure the web export's asset URLs are configured for that same subpath; the script does not rewrite them. Uploading to the root of a dedicated bucket is the simplest option for the current export.

References: [AWS sync behavior](https://docs.aws.amazon.com/cli/latest/reference/s3/sync.html), [AWS credential environment variables](https://docs.aws.amazon.com/cli/latest/userguide/cli-configure-envvars.html).

# Backend deployment skeleton for EC2

`be-deploy.mjs` is a Node.js skeleton with empty configuration values at the top and explicit, unimplemented method stubs. Filling the values alone does **not** enable deployment. `node be-deploy.mjs --help` describes this; normal execution stops at missing configuration or an unimplemented stub.

Node matches the frontend deployment tooling and works from this Windows checkout using the installed OpenSSH client. A single SSH call will run a short shell script on the Linux EC2 machine. No Python dependency or local Bash installation is needed.

Planned sequence:

1. Authenticate to EC2 with the root PEM file (ignored by Git).
2. Use the existing repository checkout, or clone it on the first deployment, then enter `hoq-be`.
3. Pull the configured branch with `git pull --ff-only`.
4. Run `npm ci` and `npm run build` on EC2.
5. Restart the named PM2 process, or start it if this is the first deployment.
6. Check `/health` and the PM2 process status, then save the PM2 process list.

Provision Node.js, npm, Git, curl, PM2, the backend environment file, and GitHub repository access on EC2 beforehand. Configure PM2 startup once for reboot recovery under the same SSH user. Verify the EC2 SSH host key locally. The PEM is for EC2 authentication; private GitHub access on EC2 needs its own credentials. Keep the whole repository on EC2 because the backend uses shared modules from `hoq-fe/src/game`.

The script should let PM2 start the backend directly rather than also launching `npm start`, which would create a second server. Use one PM2 instance: sessions live in process memory, and restarting the backend ends active games. TLS/reverse-proxy configuration and EC2 provisioning remain separate from these deployment stubs.
