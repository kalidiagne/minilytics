# Rules for agents working in this fork

This repo is a fork of [surendrapandar/minilytics](https://github.com/surendrapandar/minilytics) that runs **numbers.margins.me**.
It holds live analytics data. Read this before changing code, config or the database.

## Branches

- `deploy`: what runs in production. **Every push to `deploy` deploys automatically** (Cloudflare Workers Builds).
- `main`: a plain mirror of upstream `main`. Never commit to it. Never deploy from it (its `wrangler.jsonc` has upstream's placeholder database id).
- Work on a branch off `deploy` and open the PR against `deploy` in `kalidiagne/minilytics`. Merging it ships it.
- Never open a PR from `deploy` to upstream: it carries our production config. Upstream contributions go on a branch off `main`.

## Production

- Cloudflare worker `overview`, custom domain `numbers.margins.me`, workers.dev off.
- D1 database `overview` (id `b42fb130-1b47-419f-b90c-37e9cc31e7a4`). In `wrangler.jsonc` it keeps `database_name: "minilytics"` so the package.json scripts work; the id decides the target.
- Secrets `ADMIN_PASSWORD` and `SESSION_SECRET` live on the worker. Never delete or overwrite them.
- Do not change the worker name, the database id or the route in `wrangler.jsonc`.
- Workers Builds runs: build `npm run build`, deploy `npx wrangler d1 migrations apply minilytics --remote && npx wrangler deploy`. Preview builds are off.
- Manual fallback (only if Builds is down): `npm run deploy` from `deploy`.

## Pulling upstream changes

1. `git fetch upstream && git checkout main && git merge --ff-only upstream/main && git push origin main`
2. Branch off `deploy`, then `git merge main`. Resolve conflicts, keeping our `wrangler.jsonc`.
3. Look at every new file in `migrations/`. Only additive SQL (CREATE TABLE, ADD COLUMN, CREATE INDEX, INSERT OR IGNORE) is safe. A migration that drops, renames or rewrites a table needs the owner's approval first.
4. `npm ci && npm run typecheck && npm test && npm run build`.
5. If there are new migrations, back up first: `npx wrangler d1 export overview --remote --output ../minilytics-backups/overview-$(date +%Y%m%d-%H%M).sql`
6. Optionally rehearse: import the backup into local D1 (`npx wrangler d1 execute minilytics --local --file <backup>`), then `npm run db:migrate:local`, and check row counts.
7. Open a PR against `deploy` and merge it to ship.

## Data

- Never run DELETE, DROP or UPDATE against the remote database without the owner's explicit approval.
- Read-only checks are fine, e.g. `npx wrangler d1 execute minilytics --remote --command "SELECT count(*) FROM events"`.

## Cherry-picked upstream PRs

`deploy` also carries upstream PRs #17 (cookieless mode) and #7 (bot traffic), which aren't merged upstream yet. Both added a `0010_*` migration; keep those filenames so a later upstream merge doesn't re-run them. If upstream merges them under other names, check `d1_migrations` before applying.
