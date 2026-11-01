# PC demo preparation: eqms.ngocthien.vn

This private preview serves a compiled frontend and virtual-path ONLYOFFICE through `127.0.0.1:8188`. It uses the current stack's backend and Document Server over the existing Docker network. It does **not** create a separate demo database, sanitize data, update backend settings, publish a tunnel or change DNS. Do not expose this preview as a finished deployment before the checks below.

Start from repository root:

```powershell
docker compose -f deploy/demo/docker-compose.preview.yml up -d --build
docker compose -f deploy/demo/docker-compose.preview.yml ps
```

Frontend production build settings:

- Application: `https://eqms.ngocthien.vn`
- API: `/api`
- Document Server browser URL: `https://eqms.ngocthien.vn/onlyoffice`
- OnlyOffice internal backend/callback routes remain on the Docker network.

## Before public routing

1. Confirm domain/DNS management access. Observed 2026-11-01: `eqms.ngocthien.vn` resolves to `103.28.36.123`; nameservers are Tenten. A cPanel subdomain does not itself route to the PC. Cloudflare Tunnel requires an appropriate Cloudflare zone setup; do not assume adding a CNAME at an external DNS provider alone is sufficient. Do not move nameservers or change website/email records without reviewing the complete DNS zone and domain-owner approval.
2. Decide whether to use the current test data or an isolated seeded demo stack. This preview deliberately does not copy data or overwrite current settings.
3. Set backend public URL, exact CORS origin, secure cookies and trusted proxy/client-IP policy in the chosen demo deployment. Do not bypass CORS or relax administrative network restrictions to make routing work. Verify rate limiting and administrative IP policy with actual external addresses.
4. Configure a stable HTTPS route to the gateway. Do not publish PostgreSQL, MinIO management, Adminer, MailHog or Docker's management endpoint.
5. Check the provider upload limit against application uploads (application gateway supports 150 MiB; Cloudflare proxied plans can limit requests to 100 MB). Acknowledge or resolve that difference before promising full upload support.
6. Verify HTTPS login/logout, session refresh, WebSocket editing and save callback, preview/publish, file upload/download, external email links, notifications/SSE, PWA and responsive UI. Authentication cannot be fully verified by the localhost preview alone because the compiled application URL and cookie/origin configuration target HTTPS.
7. Keep the PC powered and disable sleep only after the operator chooses the desired Windows power settings. Configure tunnel/service auto-start once credentials and DNS are approved. Tunnel credentials stay outside Git and logs.

Reference: https://github.com/ONLYOFFICE/document-server-proxy/blob/master/nginx/proxy-to-virtual-path.conf

## Private readiness evidence (2026-11-01)

- Compose validation and compiled frontend Docker build passed; Nginx configuration test passed.
- Private gateway is bound to loopback port 8188 only; both preview services became healthy.
- HTTP 200: `/demo-healthz`, `/`, `/api/branding`, `/onlyoffice/healthcheck` and `/onlyoffice/web-apps/apps/api/documents/api.js`.
- No public DNS, nameserver or tunnel was changed. Existing backend/database/Document Server containers were not restarted by preview startup.
- These checks establish private routing only. External HTTPS, authenticated editing/save callbacks, email links, CORS/proxy settings and public-domain cutover remain pending.

Rollback of private preview:

```powershell
docker compose -f deploy/demo/docker-compose.preview.yml down
```

This only stops the preview project; it does not delete existing development data or volumes. Public DNS/tunnel rollback must be reviewed separately if those are configured later.
