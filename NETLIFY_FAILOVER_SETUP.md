# Netlify staging/failover setup

Status: configuration and compatibility wrappers are prepared on the development branch. This is **not yet a deployed or validated Netlify site**. Do not change production DNS or promote it until all checks below pass.

## Create a staging site

1. Sign in to Netlify using the project owner's account.
2. Import the GitHub repository `helloprephub-alt/tesla-markets`.
3. Select branch `fix/product-permalinks-image-fallback-20261128` for staging, not the production branch.
4. Confirm build command `npm ci && npm run build`.
5. Confirm publish directory `dist`.
6. Confirm Functions directory `netlify/functions`.
7. Keep the default Node function runtime and esbuild bundler.
8. Let Netlify create a staging hostname and test there first.

The repository's `netlify.toml` sets these build settings, routes the five existing `/api/*` endpoints to compatibility functions, and keeps the Vite SPA fallback last.

## Environment variables

Set runtime secrets in Netlify's site environment settings. Do not commit values to GitHub or place secrets in `netlify.toml` or any `VITE_*` variable.

Required or conditionally required variables based on the existing Vercel API handlers:

- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_ANON_KEY` (public client key; confirmed in `src/lib/supabase.ts`)
- `SUPABASE_SERVICE_ROLE_KEY` (server-only; email outbox worker)
- `BREVO_API_KEY` (server-only; email functions)
- `BREVO_SENDER_EMAIL`
- `BREVO_SENDER_NAME` (optional)
- `TESLA_EMAIL_WORKER_SECRET` or the existing `CRON_SECRET` (server-only)
- `TESLA_PUSH_VAPID_PUBLIC_KEY`
- `TESLA_PUSH_VAPID_PRIVATE_KEY` (server-only)
- `TESLA_PUSH_WEBHOOK_SECRET` (server-only)
- `TESLA_MARKETS_SITE_URL` (set to the staging hostname for staging tests; update only as part of approved cutover)

Confirm the exact public Supabase key variable against the current `src/lib/supabase.ts` before configuring it. The service-role key, Brevo key, worker/cron secret, VAPID private key, and push webhook secret must never be exposed to browser code.

## Before any production cutover

- Confirm the Netlify free plan's current monthly credit limit and whether usage is within it. Netlify currently advertises a $0 Free plan with 300 credits/month and no automatic recharge; free usage can pause when its hard limit is reached. Check the current plan terms: https://www.netlify.com/pricing/ and https://docs.netlify.com/manage/accounts-and-billing/billing/billing-for-credit-based-plans/credit-based-pricing-plans/
- Confirm the five API functions deploy and are reachable at their original `/api/*` URLs.
- Test `GET /api/tesla-image?url=<approved-url>` with a known approved Tesla image and verify `image/*` content type.
- Test invalid image hosts and paths return rejection; the proxy must not become an open proxy.
- Test `GET /api/push-config` returns the public key or the expected not-configured response.
- Test unauthorized `POST /api/push-notify` and `POST /api/process-email-outbox` are rejected.
- Test authenticated `POST /api/welcome-email` with a controlled test account and confirm no secret is exposed.
- Verify email outbox processing, push notifications, service-worker installation, and admin alerts.
- Add the staging hostname to Supabase Auth redirect allowlists and the required Edge Function/Worker CORS origins.
- Verify Supabase Auth, customer accounts, admin authorization, chat, translation, cart, checkout, payment verification, and order history.
- Check logs and network requests for errors; test mobile and desktop.
- Confirm payment provider callbacks/webhooks only after provider-side setup and test verification.

Only after staging passes, get explicit owner approval before changing production domain/DNS or moving the production branch. Keep Vercel's last known-good production deployment available for rollback.

## Important

The compatibility bridge adapts the existing Vercel-style request/response handlers to Netlify's function event/response shape. It is a migration aid, not proof of runtime equivalence. Validate binary image responses, headers, body parsing, authorization, status codes, and every endpoint in a real Netlify staging deployment before relying on it.
