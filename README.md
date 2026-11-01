# Tesla Markets

Original AppDeploy source snapshot prepared for the GitHub/Vercel migration.

- Frontend: React 19 + Vite 6 + TypeScript
- AppDeploy project: `tesla-invest-8jwn28`
- Source version: `1793437639197`

## Local development

```bash
npm install
npm run dev
```

## Build

```bash
npm run build
```

## Migration warning

The original backend imports `@appdeploy/sdk`. It is AppDeploy-specific and must be migrated to Vercel-compatible serverless functions and replacement database/storage/auth services before the Vercel deployment is fully functional. Keep the existing AppDeploy deployment and its data intact until the replacement has been tested.
