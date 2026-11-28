# Tesla Markets deployment and failover runbook

Last reviewed: 2026-11-28

## Goal

Keep Tesla Markets available and complete a verified release even if Vercel reaches its current plan's deployment/build limits or becomes unavailable. Use a compatible alternative rather than treating one provider as a permanent blocker.

This is a failover plan. It is not authorization to spend money, upgrade a plan, change billing, or redirect production DNS without the project owner's explicit approval.

## Current hosting status

- Primary: existing Vercel project `tesla-markets`, on the current Hobby plan.
- Last known production deployment: READY, `final-translation-hardening-20261120`, commit `cf1ebfe4d679713ba85325a9034b80e1e477522d`.
- Latest development preview: READY at https://tesla-markets-hx30ttt9m-tesla-5c9c.vercel.app, commit `ce35c613e63f515c33058b04ff58b14c5d34e7fe`.
- The exact remaining Vercel quota is not exposed by the deployment status tool; do not assume a numeric quota from the plan name.
- No production promotion or DNS change has been made.

## Failover order

### 1. Netlify — first alternative to validate

Netlify is the first alternative because it supports Node-based serverless functions, which are closer to the current Vercel API handlers than a static-only host.

The current branch now includes:

- `netlify.toml` build, function-directory, API rewrite, and SPA routing configuration.
- `netlify/lib/bridge.ts` to adapt the existing Vercel-style request/response handlers to Netlify function events.
- Function wrappers for the five current `api/*` endpoints.
- `NETLIFY_FAILOVER_SETUP.md` with staging setup, environment variables, security requirements, and validation checklist.

**This is prepared code, not a deployed/verified Netlify site.** Netlify account authorization and a staging deployment are still required. Run the full test list in `NETLIFY_FAILOVER_SETUP.md` before relying on it.

Netlify currently advertises a $0 Free plan with 300 credits/month and a hard limit/no automatic recharge. Check the live terms and actual account usage before choosing it for production: https://www.netlify.com/pricing/ and https://docs.netlify.com/manage/accounts-and-billing/billing/billing-for-credit-based-plans/credit-based-pricing-plans/

### 2. Cloudflare Pages — second alternative

The frontend is Vite + React and can build to `dist`. Cloudflare Pages can host the static frontend and supports provider-native Pages Functions.

However, a static deployment alone does not run the current Vercel API handlers. Before Cloudflare Pages can be production-ready, port and test all required API endpoints into Pages Functions/Workers with equivalent security, response behavior, and secret storage. Keep the existing Cloudflare AI responder Worker separate unless a migration is explicitly needed.

### 3. Cloudflare Workers / other compatible serverless runtimes — evaluate only if needed

If Netlify staging cannot be completed within its current free allowance or does not pass compatibility tests, evaluate a provider-native serverless runtime that can host the required API routes. Cloudflare Pages Functions/Workers are the next candidate, subject to testing the Vite frontend, all API endpoints, secrets, Supabase Auth/CORS, and payment callbacks.

Do not select a provider solely because it can host static files. The full application needs the existing server-side endpoints and secure secret handling.

AppDeploy is explicitly excluded from all hosting, migration, failover, and production-release alternatives by the project owner. Do not propose or use it for this project.

## Current Vercel API inventory

The branch contains these server-side endpoints; every required endpoint must work on an alternate host:

- `api/tesla-image.ts` — image proxy with HTTPS host/path allowlist and image content-type validation.
- `api/process-email-outbox.ts` — protected email outbox worker; uses Supabase service-role access and Brevo secrets.
- `api/push-config.ts` — public VAPID key configuration endpoint.
- `api/push-notify.ts` — protected web-push sender; uses VAPID private key and webhook secret.
- `api/welcome-email.ts` — authenticated welcome email endpoint; uses Brevo and Supabase auth.

Do not expose the email outbox, push sender, service-role key, Brevo key, VAPID private key, worker secrets, or webhook secret to the browser.

## Safe release sequence

1. Finish changes on the existing development branch and keep PR #13 open for review.
2. Run `npm ci` and `npm run build`; run all existing project checks.
3. Verify the Vercel preview and all customer/admin flows.
4. If Vercel's current plan and quota permit, use preview -> review -> owner-approved production promotion.
5. If Vercel blocks deployment, use the prepared Netlify configuration for a separate staging deployment; configure secrets securely and test all five API routes.
6. If Netlify is unavailable or the account's free allowance is insufficient, port the API endpoints to Cloudflare Pages Functions/Workers or evaluate AppDeploy within its current free allowance.
7. Test every alternative hostname end-to-end: product URLs, image proxy/fallback, Supabase Auth, CORS, customer accounts, admin authorization, chat, translation, cart, checkout, payment verification, orders, email, push notifications, and service worker.
8. Only after staging passes and the owner explicitly approves, change production DNS/domain or promote the fallback.
9. Keep the last known-good production deployment and DNS values recorded for rollback.

## Required environment and domain checks

- Configure only public Supabase URL and anon/publishable key in frontend build variables.
- Put service-role keys, payment secrets, Brevo keys, VAPID private key, and webhook/worker secrets in the provider's server-side secret store.
- Add the staging hostname to Supabase Auth redirect allowlists and required Edge Function/Worker CORS origins.
- Verify payment provider callbacks/webhooks and provider-side payment verification.
- Verify push subscriptions and email delivery using controlled test accounts.
- Check the selected provider's current free allowance and usage; do not assume free hosting is unlimited.

## Rollback

1. Restore the recorded previous DNS/domain assignment or return traffic to the last known-good production deployment.
2. Verify homepage, product links, authentication, checkout/payment status, and admin access.
3. Preserve logs and diagnose the failed release before retrying.

## Hard limits

- No paid upgrades, purchases, billing changes, or paid services without explicit approval.
- No bypassing provider quotas, account restrictions, authentication, or security controls.
- No production cutover without explicit approval.
- A successful build or preview is not proof that production is live.
- Report the actual deployed URL, provider, commit, status, and smoke-test results after each release.
