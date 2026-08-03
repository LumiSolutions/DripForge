<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

## Cursor Cloud specific instructions

Single Next.js 16 app (React 19, Turbopack). One dev server. Standard commands live in `package.json` (`dev`, `build`, `lint`, `start`). Persistence is Azure Cosmos DB with local JSON fallbacks under `data/admin/`.

### Env / running locally
- A dev `.env.local` is created during setup (gitignored). It intentionally omits Cosmos so the app uses the `data/admin/*.json` fallbacks. It sets `ADMIN_PASSWORD`/`TESTER_PASSWORD`, disables 2FA (`ENABLE_ADMIN_2FA=false`), and pins the session secrets so cookies survive restarts. If it is missing, recreate it: admin login has **no** fallback for `ADMIN_PASSWORD`, so login is impossible without it.
- Admin back-office is at the secret path `/dripforgehq` (not `/admin` — `/admin` and `/drip-forge-backoffice-2026` are legacy and redirect to `/`). Log in with the `ADMIN_PASSWORD` value.
- The storefront is behind a "launch gate": default `shopLive:false` (`data/admin/settings.json`) redirects most public pages to `/` (a countdown page). `/konto/*`, `/dripforgehq`, `/api`, `/konfigurator`, `/bestellung`, `/staging`, `/test`, `/vorschau` bypass the gate. To browse the full storefront, either set `data/admin/settings.json` → `launch.shopLive: true` (do not commit) or log in as tester to get the `dripforge_preview_access` cookie.

### Cosmos-less behavior (important gotchas)
- Read paths and login work on JSON fallbacks: storefront reads, **admin login**, and **customer login** all succeed.
- Write paths that use `withCosmosRequired` fail without Cosmos and surface "COSMOSDB nicht konfiguriert" / "Datenbank nicht erreichbar". This includes admin catalog/material/order writes AND **customer registration** (`POST /api/konto/register` returns 500 because `syncAccountToCrm` → `saveCustomer` requires Cosmos, even though the account is already written to `data/admin/customer-accounts.json`). To exercise write flows end to end, set real `COSMOSDB_ENDPOINT`/`COSMOSDB_KEY`.
- `data/admin/staff-accounts.json` is auto-created on first admin login and is gitignored. `data/admin/customer-accounts.json` IS tracked — revert it (`git checkout -- data/admin/customer-accounts.json`) after test registrations/logins.

### Build / lint caveats
- `npm run build` and `next dev` both auto-append `.next/dev/types/**/*.ts` to `tsconfig.json` (tracked). Revert with `git checkout -- tsconfig.json` if you don't intend to commit it.
- `npm run lint` currently exits non-zero on the clean `main` checkout (~110 pre-existing errors, mostly the new Next.js 16 `react-hooks/set-state-in-effect` rule). This is the repo baseline, not caused by your changes — only judge lint by *new* errors your diff introduces.
- Optional integrations (Stripe, SMTP/Hostpoint, Meshy 3D generator, WhatsApp/TWINT/Tawk) degrade gracefully when their env vars are unset.
