# Tesla Markets — Vercel / Supabase migration

This working source is based on the supplied Tesla Markets source archive. The original page components, vehicle media, and styling have been retained. AppDeploy runtime imports and the AppDeploy backend folder have been removed from the Vercel source.

## Vercel environment

Set these environment variables for Production, Preview, and Development:

- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_ANON_KEY` (the Supabase publishable/anon client key; never use a service-role key in a browser build)

The connected Vercel project already has these two variables configured.

## Supabase setup

The migration adds:

- `site_visits`, `site_clicks`, and `site_presence` for lightweight anonymous site analytics
- `record_site_presence()` for safe presence updates without exposing the presence table publicly
- a private `support-attachments` storage bucket with customer/admin access scoped to the conversation
- a trigger to keep support conversation timestamps current when a message is inserted
- an admin-only customer profile read policy

Existing customer, order, payment, vehicle, and support records are not dropped or rewritten.

Enable **Authentication → Sign In / Providers → Anonymous Sign-Ins** in the Supabase dashboard. The public customer chat uses a Supabase anonymous session so existing RLS rules can continue protecting each customer's conversations. Admin access uses the existing authorised account and `customer_profiles.is_admin=true`.

## Build

```bash
npm install
npm run build
```

The current environment could not reach the npm registry during this migration pass, so a full dependency install and production build still need to be run in Vercel's build environment.
