# Deploy the Hit or Quit backend to the existing AWS EC2 instance

This is the manual setup guide we will work through before implementing backend update automation. Only the Hit or Quit backend runs on EC2. The Expo web frontend is exported to static files and served from S3, with CloudFront for HTTPS.

The existing application's frontend and backend continue running on this same instance. Use a separate checkout, PM2 process, backend port, nginx configuration, and API hostname for Hit or Quit. This guide uses the repository's name `hoq-be` (the request's `foq-be` refers to this backend).

## Architecture and values to choose

```text
Browser -- HTTPS --> CloudFront --> S3 (Hit or Quit static frontend)
        -- WSS ----> existing EC2 nginx :443
                       |-- existing app hostnames --> existing app ports
                       `-- hoq-api.example.com --> 127.0.0.1:8081
                                                  /ws and /health
```

| Setting | Value used in this guide |
| --- | --- |
| EC2 host | `54.163.185.78` — the instance's verified current public IP |
| SSH user | `ec2-user` |
| Backend hostname | `hoq-api.example.com` — replace throughout |
| Frontend hostname | Your S3/CloudFront site's hostname |
| Checkout | `~/HitOrQuit` — must be separate from the other app |
| PM2 process | `hoq-backend` |
| Backend listener | **`127.0.0.1:8081`**, subject to the free-port check below |
| Public endpoints | `https://hoq-api.example.com/health`, `wss://hoq-api.example.com/ws` |

Port 8081 is deliberately different from 3000, 5000, and the old guide's 3001. We have not inspected the live instance, so verify it is unused before reserving it. If occupied, choose another unused port and replace **every** 8081 reference below, including nginx and future automation settings. No application source change is needed: the server reads `HOST` and `PORT` from its environment.

Commands are run in the **EC2 Linux shell**, except where marked local. Replace placeholders before executing; work through each section and verify its result before proceeding.

## 1. Inspect the existing instance

From your local terminal:

```sh
ssh -o IdentitiesOnly=yes -i ~/.ssh/conkgames-ec2 ec2-user@54.163.185.78
```

Use the same Linux user that manages the existing PM2 apps. On EC2:

```bash
whoami
cat /etc/os-release
node --version
npm --version
command -v node
command -v pm2
pm2 list
sudo ss -ltnp
sudo nginx -t
sudo nginx -T
sudo certbot certificates
systemctl list-unit-files 'pm2-*'
free -h
df -h /
```

Confirm which ports, nginx files, domains, Node executable, and PM2 startup service the other application uses. `nginx -T` can contain sensitive configuration; inspect it on the server. Confirm there is enough memory and disk for another Node process and a TypeScript build. Check both existing application hostnames now so we have a baseline.

Check our proposed port specifically:

```bash
sudo ss -ltnp 'sport = :8081'
```

There should be no listener row. Also verify no existing PM2 process is named `hoq-backend`, and no nginx server block already claims the chosen API hostname.

Back up nginx before adding the new site:

```bash
sudo cp -a /etc/nginx "/etc/nginx.backup-before-hoq-$(date +%Y%m%d-%H%M%S)"
```

Keep the current Node/nginx/PM2 installation when suitable. The backend README requires Node.js 22 or newer; Node 22.13+ also meets this project's frontend tooling requirement. If the current runtime is older, arrange a separate supported Node installation for Hit or Quit and use its absolute interpreter path in PM2. Do not change the other application's runtime or shared PM2 startup configuration as part of this setup without reviewing it first.

Git, curl, Node/npm, nginx, PM2, and Certbot with nginx support are prerequisites. If anything is missing, install only what is needed for the actual OS. Ubuntu uses `apt`; Amazon Linux 2023 uses `dnf`, but package names and Certbot installation methods must be checked for that distribution. There is no need to launch another EC2 instance, run a blanket OS upgrade, reinstall nginx, or reboot the shared server for this guide.

## 2. Configure the backend DNS and network access

1. In Route 53 (or your DNS provider), add an **A record** for `hoq-api.example.com` pointing to the existing EC2 public IP. Use a new hostname, separate from the other app's API hostname.
2. Keep the other application's DNS records intact. Hit or Quit's frontend DNS points to its S3/CloudFront setup, not EC2.
3. Reuse the instance's existing Elastic IP if present. If it has no stable IP, plan that change separately: associating a new Elastic IP can affect the other app's DNS.
4. Confirm the EC2 security group and host firewall allow public TCP **80** and **443**, and SSH **22** from your permitted IP. Preserve existing rules needed by the other app.
5. Do **not** add a public inbound rule for 8081. nginx reaches it through loopback.

Verify the new hostname resolves to this instance before requesting its certificate. Only publish an IPv6 AAAA record if IPv6 access and nginx listeners are configured correctly.

## 3. Upload the repository and build only the backend

Use a dedicated checkout. Replace the repository URL and branch:

```bash
cd ~
git clone --branch YOUR_BRANCH YOUR_REPOSITORY_URL HitOrQuit
cd ~/HitOrQuit/hoq-be
npm ci --include=dev
npm test
test -f dist/hoq-be/src/server.js
test -d dist/hoq-fe/src/game
```

`npm test` runs the TypeScript build and backend tests. Stop if it fails. For a build without the tests, the build command is `npm run build`.

The backend uses Node's HTTP server plus `ws`, rather than Express. Its compiled entry point is **`dist/hoq-be/src/server.js`**, not `server.js` or `dist/server.js`.

Keep the sibling `hoq-fe/src/game` source files: the backend imports that shared game engine and TypeScript includes it under `hoq-be/dist/hoq-fe`. No frontend dependency install, frontend web build, Expo server, or Next.js process is needed on EC2. A private Git repository requires its own server-side repository credentials; the EC2 PEM authenticates SSH to EC2 only.

An alternative later is to build elsewhere and upload the **complete** backend `dist` tree plus package manifests, then install production dependencies on EC2. Copying only the compiled server file is insufficient.

## 4. Configure the backend environment

Create the backend's own file on EC2:

```bash
cd ~/HitOrQuit/hoq-be
nano .env
```

Use:

```dotenv
NODE_ENV=production
HOST=127.0.0.1
PORT=8081
MAX_PLAYERS=8
RECONNECT_MS=120000
IDLE_MS=300000
HEARTBEAT_MS=30000
```

```bash
chmod 600 .env
```

The backend does not automatically load `.env`; the Node command below explicitly loads it. This is separate from the repository-root `.env` used for S3 deployment credentials. Those AWS credentials are not needed by the game server.

Test in the foreground:

```bash
node --env-file=.env dist/hoq-be/src/server.js
```

From another SSH terminal:

```bash
curl --fail --show-error http://127.0.0.1:8081/health
sudo ss -ltnp 'sport = :8081'
```

Expect `{"status":"ok"}` and a listener at `127.0.0.1:8081`. Inherited shell environment variables override Node's env file, so resolve any conflicting `HOST`/`PORT` values if the actual listener differs. Stop the foreground server with **Ctrl+C** before starting PM2.

## 5. Start one backend process with PM2

Under the same Linux user used for the earlier PM2 inspection:

```bash
cd ~/HitOrQuit/hoq-be
pm2 start dist/hoq-be/src/server.js --name hoq-backend \
  --cwd "$PWD" --interpreter "$(command -v node)" \
  --node-args="--env-file=$PWD/.env" --time
pm2 describe hoq-backend
pm2 logs hoq-backend --lines 50 --nostream
curl --fail --show-error http://127.0.0.1:8081/health
pm2 list
```

For a separately installed Node version, replace the interpreter expression with its verified absolute path. Confirm the process is in **fork mode with one instance**, and the other applications remain online. If the process already exists, inspect its entry point, working directory, interpreter, and environment-file arguments instead of running a second start command.

All game sessions live in one process's memory. Do not enable PM2 cluster mode, multiple instances, or file watching. Every backend restart or crash ends active games; reconnect retention does not survive process restarts.

Save only after confirming the complete PM2 process list contains the existing applications as well as Hit or Quit:

```bash
pm2 save
```

This saves the **whole user's process list**. Back up an existing `~/.pm2/dump.pm2` before saving if you need to preserve the prior boot snapshot. If the user's PM2 startup service is already configured, reuse it. If absent, run `pm2 startup`, review and execute its generated command for this user, then run `pm2 save`. Verify the service is enabled with `systemctl is-enabled pm2-USER`, replacing `USER` with the actual username. Do not reboot the shared instance just to test this during setup. See [PM2 startup documentation](https://pm2.keymetrics.io/docs/usage/startup/).

## 6. Add a separate nginx site for Hit or Quit

Use the include layout actually shown by `sudo nginx -T`:

- Ubuntu with `sites-enabled`: create `/etc/nginx/sites-available/hoq-backend`, then enable its symlink.
- Amazon Linux or a `conf.d` layout: create `/etc/nginx/conf.d/hoq-backend.conf` directly; no symlink is needed when that directory is included.

Create **one** new config file in the chosen layout. Do not replace the other application's file or delete its default site. Paste the following, replacing the hostname:

```nginx
server {
    listen 80;
    server_name hoq-api.example.com;

    access_log /var/log/nginx/hoq-backend.access.log;
    error_log /var/log/nginx/hoq-backend.error.log;

    location = /health {
        proxy_pass http://127.0.0.1:8081;
        proxy_set_header Host $host;
    }

    location = /ws {
        proxy_pass http://127.0.0.1:8081;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_read_timeout 120s;
        proxy_send_timeout 120s;
        proxy_buffering off;
    }

    location / {
        return 404;
    }
}
```

The proxy preserves `/ws`, forwards the WebSocket upgrade headers, and allows more idle time than the default 30-second backend heartbeat. If changing the heartbeat, keep the proxy timeout longer. See [nginx WebSocket proxying](https://nginx.org/en/docs/http/websocket.html).

For the Ubuntu layout only, enable the new file once:

```bash
sudo ln -s /etc/nginx/sites-available/hoq-backend /etc/nginx/sites-enabled/hoq-backend
```

Test, and reload only if the test succeeds:

```bash
sudo nginx -t && sudo systemctl reload nginx
curl --fail --show-error -H 'Host: hoq-api.example.com' http://127.0.0.1/health
```

Recheck the other app's frontend and API after the reload. A graceful reload applies the added hostname without restarting nginx. If validation fails, fix or disable only the new file and retest; do not reload a failing configuration.

## 7. Enable HTTPS and WSS for the new API hostname

With DNS propagated and port 80 reachable:

```bash
sudo certbot --nginx --redirect -d hoq-api.example.com
sudo nginx -t
curl --fail --show-error https://hoq-api.example.com/health
```

Request a certificate for **only this new backend hostname**. Keep the other app's certificate and frontend domains separate. Certbot updates the matching nginx site for TLS and HTTP-to-HTTPS redirection. Inspect the resulting site and recheck the existing application's HTTPS endpoints.

Inspect the installed certificate renewal timer or cron job. To test just the new certificate, obtain its actual certificate name from `sudo certbot certificates`, then run:

```bash
sudo certbot renew --cert-name ACTUAL_HOQ_CERT_NAME --dry-run
```

## 8. Point the S3 frontend at the backend

On your **local development machine**, set this in `hoq-fe/.env.production` before exporting:

```dotenv
EXPO_PUBLIC_WS_URL=wss://hoq-api.example.com/ws
```

Remove or update any conflicting value in the build shell or other Expo env files. The public URL is baked into the static export; updating an EC2 variable cannot change an already-uploaded frontend.

From the local repository root, with frontend dependencies installed:

```sh
npm --prefix hoq-fe run build:web
node fe-deploy.mjs --dry-run
node fe-deploy.mjs
```

Follow [the existing S3 deployment instructions](../_DEPLOY.md) for bucket configuration and local deployment credentials. The frontend deploy script already exists; the backend deploy script is still a skeleton. Handle CloudFront invalidation if needed by the site's cache policy.

Use CloudFront in front of S3 for an HTTPS frontend: [S3 website endpoints do not support HTTPS](https://docs.aws.amazon.com/AmazonS3/latest/userguide/WebsiteEndpoints.html). The browser connects directly to the EC2 API hostname over WSS. There is no Hit or Quit frontend PM2 process or EC2 frontend nginx block.

The current WebSocket server does not enforce an Origin allowlist. It does not require an Express CORS middleware setting for this connection. If Origin restrictions are added later, include the actual frontend origin and account for native clients.

## 9. Verify the complete deployment

1. Confirm `https://hoq-api.example.com/health` returns `{"status":"ok"}`. A request to the API root `/` returning 404 is expected.
2. Open the deployed frontend and create a multiplayer table with **Host**.
3. Open a second tab/device, select **Join**, enter the code, and play a round. Solo mode alone does not test the backend.
4. In browser developer tools, verify the connection is `wss://hoq-api.example.com/ws` and upgrades with status **101**.
5. Refresh a player tab and verify **Rejoin saved table** works while the backend remains running.
6. Check `pm2 logs hoq-backend --lines 50 --nostream` and the dedicated nginx error log.
7. Verify both the other application's frontend and backend still work, and review instance memory usage.

Common diagnoses:

| Symptom | Check |
| --- | --- |
| `EADDRINUSE` | Another process owns 8081, or the foreground test was left running. |
| nginx 502 | PM2 status, local `/health`, loopback port, and nginx error log. On SELinux systems, inspect AVC denials and configure an appropriate proxy-connect policy rather than disabling SELinux. |
| Local health works but public request fails | DNS, security group/firewall, matching nginx hostname, TLS certificate. |
| Health succeeds but multiplayer fails | Exported `EXPO_PUBLIC_WS_URL`, `/ws` path, upgrade headers, and browser console. |
| Client tries the S3/CloudFront hostname for `/ws` | Rebuild with the explicit API URL and redeploy the static frontend. |
| Rooms disappear after an update | Expected: sessions are in memory and restarting the backend clears them. |

## 10. Manual updates and later automation

Schedule backend updates between games. For now, the manual sequence is:

```bash
cd ~/HitOrQuit
git status --short
git rev-parse HEAD
```

Record that commit as the previous known-good version. Resolve any local tracked changes before pulling; preserve the server's backend `.env`. Confirm you are on the intended deployment branch. Then run the dependent steps as a fail-fast sequence:

```bash
git pull --ff-only origin YOUR_BRANCH && \
  cd hoq-be && \
  npm ci --include=dev && \
  npm test && \
  pm2 restart hoq-backend && \
  curl --fail --show-error --retry 5 --retry-connrefused --retry-delay 2 \
    --max-time 5 http://127.0.0.1:8081/health
```

Inspect `pm2 describe hoq-backend`, logs, and the public HTTPS health check before declaring success. Save the PM2 list if its configuration changed. Node rereads the env file on restart, but any conflicting environment already held by PM2 must also be corrected. This procedure has a brief interruption and resets games; it is not a zero-downtime deployment.

If an update fails, keep the error output and previous commit. Restore the known-good source in this dedicated checkout, reinstall its dependencies, rebuild, and restart only `hoq-backend`; verify both health endpoints again. In-place dependency/build changes are not atomic, so later automation should stage a complete release before switching and retain the prior release for rollback.

Useful commands are scoped to this application:

```bash
pm2 describe hoq-backend
pm2 logs hoq-backend --lines 100
pm2 restart hoq-backend
pm2 stop hoq-backend
sudo tail -n 100 /var/log/nginx/hoq-backend.error.log
```

Avoid PM2 operations targeting `all`, replacing the shared nginx config, or restarting the other application's processes.

When we automate updates using `../be-deploy.mjs`, record the verified SSH host/user, branch, absolute checkout/backend/env-file paths, Node/PM2 paths, process name `hoq-backend`, entry `dist/hoq-be/src/server.js`, and health URL **`http://127.0.0.1:8081/health`**. Its current 8080 example must be replaced when filling in configuration. Automation should preserve this one-process setup, stop on build/test failure, restart only Hit or Quit, verify health with bounded retries, and support rollback. Provisioning, DNS, TLS, and frontend S3 updates remain separate steps.
