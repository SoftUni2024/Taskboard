# Task Board

A multi-page task-management app built with Vite, JavaScript, HTML, CSS, and Bootstrap. No frontend framework is required.

## Run locally

Requires Node.js 24+ (Vite supports Node 22.13+; the integration tests use Node SQLite).

```sh
npm ci
npm run build
node --import ./scripts/sites-env.mjs ./node_modules/wrangler/bin/wrangler.js d1 execute DB --local --config dist/server/wrangler.json --persist-to .wrangler/state --file drizzle/0000_dazzling_stranger.sql
npm run dev
```

Apply the migration only once per local database. Open the printed loopback URL, normally `http://127.0.0.1:5173`. The development-only Sites middleware simulates a test account. Production identity comes from ChatGPT sign-in.

## Routes

| URL | Page |
| --- | --- |
| `/` | Home |
| `/login` | Sign-in / automatic profile registration |
| `/dashboard` | Projects and progress overview |
| `/projects/{id}/tasks` | Project task board |
| `/account` | Account settings |

The History API router intercepts internal `data-link` anchors, handles back/forward navigation, and dynamically imports each page. Unknown URLs display a not-found page. Protected pages redirect visitors to `/login` with a safe return URL. Hosting serves `index.html` for deep links, including browser refreshes.

## Modular structure

```text
index.html
vite.config.js          # Auth middleware, Workers plugin, dev/preview/build settings
src/
  main.js               # Header + page outlet + footer
  router.js             # Navigation lifecycle and History API
  routes.js             # Route definitions and safe return paths
  components/           # header, footer, dialog, project-card, project-form,
                        # task-card, task-form, members
  pages/                # home, login, dashboard, tasks, account, not-found
  services/api.js       # Fetch client and safe text helpers
  styles/global.css
server/board.js         # Validated, authorized database API
worker/index.js         # API dispatch and static asset fallback
db/schema.ts            # Drizzle schema (tooling only)
drizzle/                # Versioned D1 migrations
```

Every page and UI component owns its `.html`, `.css`, and `.js` files. Vite imports HTML fragments using `?raw`, bundles CSS, and creates separate lazy-loaded page chunks. Bootstrap supplies the responsive grid, forms, buttons, and accessible modal behavior.

## Features and checks

Project/task creation, editing, deletion, memberships, rich-text descriptions, task movement, persistent ordering, search, profiles, and server-side authorization are implemented. Drag tasks between columns or before another card; use arrow buttons to reorder and the task editor to select a stage on touch or keyboard.

```sh
npm test
npm run build
npm run preview
```

Tests cover the actual API handlers with isolated SQLite storage, project/task permissions and revocation, CRUD, ordering, stage changes, rich-text sanitization, route matching, and safe login redirects.

## Deployment

Sites configuration is in `.openai/hosting.json`. The Vite Cloudflare plugin builds `dist/client` and `dist/server`; the Sites plugin includes the manifest and migrations. Publish using the Sites source/build/package workflow.

The existing site remains private. Project members also need hosting-level access. Adding a member does not send email or change the hosting audience. Optional real-time sync, attachments, comments, labels, deadlines, checklists, administration, and paging are not included.
