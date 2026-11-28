# Tesla Markets deployment and failover runbook

Last reviewed: 2026-11-28

## Goal

Keep the existing production site online and make a tested release available even if the current Vercel project reaches a build/deployment quota or becomes unavailable.

This is a fallback plan, not authorization to spend money, change billing, or redirect the production domain without the project owner's approval.

## Current primary

- Hosting: existing Vercel project `tesla-markets`
- Production: preserve the currently assigned production domain and deployment.
- Preview: use the Vercel preview generated from the current development pull request.
- Backend: keep the existing Supabase project and existing Cloudflare Worker/AI responder unless a separately tested migration is required.

## Safe release sequence

1. Finish the changes on the current development branch.
2. Run `npm ci` and `npm run build`.
3. Verify the preview, including direct product URLs, image fallbacks, cart, checkout, authentication, admin access, chat, and translation.
4. Confirm the Vercel deployment quota and project state.
5. If Vercel can deploy within the current plan, use the normal preview -> review -> owner-approved production promotion flow.
6. If Vercel cannot deploy, do not repeatedly trigger builds or upgrade a paid plan. Use the free static-hosting fallback below to create a separate staging deployment.
7. Test that staging with the existing Supabase and Cloudflare backends, using only the required public client configuration in frontend environment variables.
8. Only after staging passes and the owner explicitly approves, change the domain/DNS or promote the fallback to production.
9. Keep the previous production deployment and DNS values documented so rollback is possible.

## Static-hosting fallback A: Cloudflare Pages

The repository is a Vite + React application. For a static build, configure a Pages project from the GitHub repository:

- Repository: `helloprephub-alt/tesla-markets`
- Branch: `fix/product-permalinks-image-fallback-20261128` for staging; use the approved release branch for production.
- Build command: `npm ci && npm run build`
- Build output directory: `dist`
- Root directory: repository root
- Framework preset: Vite, if offered
- SPA fallback: ensure unknown paths serve `index.html`; preserve query-string product URLs such as `/?page=shop&product=<slug>`.
- Environment: configure only the public Supabase URL and anon/publishable key required by the client. Never place Supabase service-role keys, payment secrets, or AI-provider secrets in a frontend build variable.

Use the existing Supabase database/auth/Edge Functions and Cloudflare AI Worker as the backend. Do not duplicate or migrate data just to change static hosting.

## Serverless compatibility requirement (must be solved before cutover)

The current repository includes a Vercel serverless image endpoint at `api/tesla-image.ts`. A static-only deployment to Cloudflare Pages, Netlify, or GitHub Pages will not automatically run this Vercel function.

Before declaring any alternate host production-capable:

1. Inventory every `api/*` endpoint and every frontend request that depends on a Vercel runtime function.
2. For each required endpoint, implement and test the equivalent provider-native function (for example, a Cloudflare Pages Function or Netlify Function) using the provider's supported runtime.
3. Preserve the image proxy's HTTPS host/path allowlist, content-type validation, method restrictions, and safe error handling. Do not create an unrestricted URL fetch proxy.
4. Confirm product images still load if the proxy is unavailable; use direct verified image URLs only where the source permits browser image loading.
5. Verify Supabase Auth, Edge Functions, AI Worker, order/payment callbacks, and admin flows on the alternate hostname.
6. If any required endpoint has not been ported or verified, keep the alternate deployment as staging only and do not cut over production.

The Vercel API endpoint is a confirmed dependency; the complete API inventory still needs a repository-wide check.

## Static-hosting fallback B: Netlify

If Cloudflare Pages is unavailable or its free limits are insufficient, create a separate Netlify staging site from the same GitHub branch:

- Build command: `npm ci && npm run build`
- Publish directory: `dist`
- Configure SPA fallback to `/index.html` with status 200.
- Add only the required public frontend environment variables.
- Keep secrets in server-side functions/worker secrets, never in Vite's `VITE_*` variables.

Use this only if its current free plan and build limits are adequate; check before relying on it.

## Existing AppDeploy fallback

AppDeploy may be used as another staging or temporary hosting path only if the existing connected account can publish the project without purchasing credits or upgrading. First confirm it can import/build the repository, preserve environment variables securely, support SPA routing, and connect to the existing backend. Do not assume it can host all server-side functions.

## Not a suitable emergency production fallback by itself

GitHub Pages can host a static demo, but it is not the preferred production fallback for this app because environment handling, SPA routing, and server-side functionality require additional configuration. Use only for a non-sensitive static preview if needed.

## Cutover and rollback checklist

Before any live domain cutover:

- Confirm the alternate deployment is HTTPS and stable.
- Test every critical customer flow on the alternate hostname.
- Verify Supabase Auth redirect URLs and allowed origins include the new hostname.
- Verify CORS policies for Supabase Edge Functions and the AI Worker.
- Verify checkout/payment provider callback URLs and webhook configuration; never claim payment works until provider-side verification passes.
- Verify admin authentication and authorization.
- Confirm the custom domain/DNS change is reversible and record current DNS values.
- Get explicit owner approval before changing production DNS, promoting a deployment, or changing payment settings.

Rollback:

1. Restore the recorded previous DNS/domain assignment or return traffic to the last known-good production deployment.
2. Verify homepage, product links, authentication, checkout status, and admin access.
3. Preserve logs and investigate the failed release before retrying.

## Hard limits

- No plan upgrades, purchases, billing changes, or paid services without explicit approval.
- No bypassing provider quotas, account restrictions, authentication, or security controls.
- No production cutover without owner approval.
- A successful build or preview is not proof that production is live.
- Report the actual deployed URL, provider, commit, status, and smoke-test results after each release.
