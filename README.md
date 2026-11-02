# Tesla Markets

Independent Tesla Markets web application built with React, Vite, TypeScript, and Supabase. This repository is deployed through Vercel and does not call the legacy AppDeploy backend.

## Local development

1. Install dependencies: `npm install`
2. Add `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` to `.env.local`.
3. Start the app: `npm run dev`

## Build

`npm run build`

## Backend

Supabase Auth handles customer sign-in and registration. `support_conversations` and `support_messages` store enquiries. Row-level security is expected to protect all customer records. Administrator access is granted in Supabase through `customer_profiles.is_admin`; do not expose a service-role key in frontend variables.
