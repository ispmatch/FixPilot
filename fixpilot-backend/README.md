# FixPilot Backend (Base44 replacement)

Node/TypeScript + Express + Postgres (Drizzle ORM) + Lucia auth + Claude API.
This replaces the Base44-hosted Deno functions, entity store, and built-in
auth/AI integrations from the original export.

## What's here so far

- `src/db/schema.ts` — every entity from the Base44 export (`Domain`,
  `FixExecution`, `FixRecipe`, `ChatSession`, etc.), as real Postgres tables.
- `src/auth/` — Lucia session auth (replaces `base44.auth`), plus a
  timing-safe API-key check for requests coming from the WP plugin
  (mirrors the plugin's own `hash_equals()` check).
- `src/routes/entities.routes.ts` — generic CRUD REST endpoints replacing
  `base44.entities.<Name>.*` calls the React dashboard makes.
- `src/routes/plugin.routes.ts` — domain registration + ping, called by the
  WordPress plugin.
- `src/lib/llm.ts` — replacement for `base44.integrations.Core.InvokeLLM`,
  backed by the Claude API. Supports web search, image input (for the
  screenshot verification step), and schema-guaranteed structured output.

**Not yet ported** (next steps): the AI fix orchestrator itself
(`aiFixOrchestrator`), Stripe checkout/webhook, vulnerability scanner,
plugin knowledge ingester, notification dispatch. These will reuse
`invokeLLM` from `src/lib/llm.ts` as their model-calling layer.

## Local setup

```bash
npm install
cp .env.example .env   # fill in DATABASE_URL and ANTHROPIC_API_KEY
npm run db:generate    # generates SQL migration from schema.ts
npm run db:migrate     # applies it
npm run dev             # starts on :8080 with hot reload
```

## Deploying to Railway

1. Create a new Railway project → **New Service → Deploy from GitHub repo**
   (push this folder to a repo first), or use the Railway CLI:
   ```bash
   npm install -g @railway/cli
   railway login
   railway init
   railway up
   ```
2. **Add a Postgres database**: in the Railway project, click *New →
   Database → PostgreSQL*. Railway wires up a `DATABASE_URL` automatically.
3. On your backend service, go to **Variables** and add:
   - `DATABASE_URL` → reference the Postgres service: `${{Postgres.DATABASE_URL}}`
   - `ANTHROPIC_API_KEY` → your Claude API key
   - `DASHBOARD_ORIGIN` → your dashboard's URL once deployed
   - `NODE_ENV` → `production`
4. Railway will build from the included `Dockerfile` automatically (it also
   respects `railway.json`).
5. Run the migration once against the live DB — easiest way is
   `railway run npm run db:migrate` from your local machine (the Railway
   CLI proxies your local process into the project's env vars).
6. Grab the generated public URL (Settings → Networking → Generate Domain)
   — this is what the WordPress plugin's REST calls and the dashboard's
   `VITE_API_URL` should point to.

## API shape

- `POST /api/auth/register`, `/login`, `/logout`, `GET /api/auth/me`
- `GET/POST /api/domains`, `/api/fix-executions`, `/api/fix-recipes`, …
  (one CRUD resource per entity, session-authenticated)
- `POST /api/plugin/register` — open endpoint, WP plugin calls this once on
  first admin load to get its `api_key`
- `POST /api/plugin/ping` — authenticated via `x-fixpilot-key` header
