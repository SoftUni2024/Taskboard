# Task Board

A full-stack JavaScript project management app with a responsive React interface, a Workers API, and a persistent D1 database.

## Features
- ChatGPT sign-in and automatic first-visit profile registration
- Overview, projects, project board, and account pages
- Owner-managed project CRUD and email-based project membership
- Task CRUD with rich-text descriptions
- Three default stages, drag-and-drop movement and ordering, and accessible alternative controls
- Project/task search, progress indicators, and explicit refresh
- Server-side access checks and rich-text sanitization

## Local development

Requires Node.js 22.13+ (Node 24+ for the SQLite integration test).

```sh
npm run install:ci
npm run build
node --import ./scripts/sites-env.mjs ./node_modules/wrangler/bin/wrangler.js d1 execute DB --local --config dist/server/wrangler.json --persist-to .wrangler/state --file drizzle/0000_dazzling_stranger.sql
npm run dev -- --port 5173
```

Apply each migration only once to the local database. Open the printed loopback URL. Local sign-in simulates a test account; production uses platform authentication.

## Verification

```sh
node scripts/test-board.mjs
npm run build
```

The integration test runs the actual API handlers against an isolated SQLite database, covering CRUD, permissions, membership revocation, ordering, stage changes, sanitization, and dependent deletion.

## Deployment and access

Sites configuration lives in `.openai/hosting.json`. Publish via the Sites source/build/package workflow. D1 migrations are included in the deployment artifact and applied by hosting.

New Sites are owner-private. Project members also need hosting-level access before they can use a shared board. Adding a member records access in the app; it does not send email or modify the hosting audience. First sign-in automatically registers the profile; there is no separate password database.

Optional real-time collaboration, attachments, comments, labels, deadlines, checklists, administration, and pagination are not included.

See `instructions.md` for project development guidelines.
