# Task Board

A multi-page project-management app built with Vite, vanilla JavaScript, HTML, CSS, Bootstrap, and Supabase Auth/Postgres.

## Run locally

Requires Node.js 24+ for the complete test suite.

```sh
npm ci
npm run dev
```

Open `http://127.0.0.1:5173`. Browser configuration in `src/services/supabase.js` contains the project's public URL and publishable key. Every data request is protected by Supabase RLS. Never put secret/service-role keys in browser code or `VITE_*` variables.

## Pages and authentication

| URL | Page |
| --- | --- |
| `/` | Visitor landing page |
| `/login` | Email/password login and registration |
| `/login?mode=register` | Registration mode |
| `/dashboard` | Current user's projects and progress |
| `/projects` | Searchable project table with descriptions, stage counts, and open/done task totals |
| `/project/add` | Create a project with three default stages |
| `/project/{id}/edit` | Edit an owned project's title and description |
| `/project/{id}/tasks` | Owned or assigned project board |
| `/account` | Display-name settings and logout |

Registration accepts a display name, email, password, and matching password confirmation. Supabase email confirmations are disabled for this project, so registration establishes a session immediately. Successful registration/login redirects to `/dashboard`. Logout clears the current app session and returns to `/`. Sessions persist across refreshes and refresh automatically; logout is synchronized across tabs.

Protected pages redirect signed-out visitors to `/login`. Supabase RLS independently enforces owner/member access to projects, stages, tasks, and attachments. Project owners manage membership.

Dashboard is the signed-in home page. It shows the project count (linked to Projects), total task count, open task count, and done task count across the current user's projects. Open tasks are all tasks whose completion flag is false. The header links signed-in users to Dashboard and Projects; the brand returns them to Dashboard.

## Notifications

`src/components/notifications/` owns the shared HTML, CSS, and JavaScript toast component. Errors from forms, Auth, page loading, and mutations use dismissible error toasts. Successful account creation and project/task/profile mutations use info toasts. Navigation, login/logout, data loading, refreshes, and obvious task moves remain quiet.

Info toasts close after five seconds and pause while hovered or focused; errors remain until dismissed. Duplicate messages are combined and the stack is capped at four. Native form validation shows the first invalid field as a toast and focuses that field. Messages use text content, with separate polite/assertive live regions and reduced-motion support.

## Modular structure

Each page and UI component owns HTML, CSS, and JavaScript files. The shared layout composes a header, page outlet, and footer. The History API router supports internal links, browser back/forward, unknown routes, and deep-link refreshes. Vite dynamically imports page fragments using `?raw` and creates page-specific chunks.

- `src/services/auth.js`: Supabase registration, login, current user, logout.
- `src/services/board-store.js`: RLS-protected Supabase data operations.
- `src/services/rich-text.js`: sanitizes descriptions on reads and writes.
- `src/services/supabase.js`: publishable client configuration.
- `supabase/migrations/`: applied SQL schema, RLS, and transactional operations.
- `supabase/tests/`: rollback-only live database verification.

Project creation atomically creates the three default stages. Task moves and reorders use an invoker-rights database function that keeps RLS active. Projects and tasks support creation, editing, deletion, descriptions, stage movement, and ordering. Project colors are derived display accents rather than additional schema fields.

The previous D1 implementation remains as historical source/data; the app no longer calls it. Its old `/api/board` endpoint returns HTTP 410. No existing D1 records were migrated or deleted.

## Sample data

See `supabase/SEEDING.md`. The seeded users are `steve@gmail.com`, `maria@gmail.com`, and `peter@gmail.com`, each with sample password `pass123`. Login shows only the projects owned by that user. Seed admin credentials belong only in the ignored `.env.seed` file or process environment.

## Validation

```sh
npm test
npm run build
npm run preview
```

Tests cover Auth service behavior, registration-session requirements, expired sessions, logout, rich-text safety, routing, seeds, and the legacy API. SQL tests cover owner-only RLS, default stages, transactional task moves, and completion flags.

## Hosting

Sites configuration is in `.openai/hosting.json`. The Cloudflare Vite plugin builds `dist/client` and `dist/server`. The Site remains private under its existing hosting access policy. The hosting sign-in gate is separate from Task Board's Supabase email/password login. Supabase migrations are applied to Supabase separately from Site deployments; do not put them in the legacy D1 migration folder.

Task attachments use the private Supabase Storage bucket `task-attachments`. Open an existing task to upload screenshots or documents (10 MB per file), download them, or confirm removal. Create new tasks before adding files. Uploads save immediately, independently of task detail edits. Supported formats are PNG, JPEG, GIF, WebP, PDF, TXT, CSV, Markdown, Word, Excel, PowerPoint, and ODT. Storage RLS checks the signed-in user and the owning project/task for every operation; bucket restrictions also enforce MIME types and file size. The app removes stored files before deleting their task or project. Deleting rows directly outside the app requires separate Storage cleanup.

Project membership is managed at `/projects/{id}/users`. Owners can search app users, assign members, and confirm removals. Members share stage/task/attachment access; project editing, deletion and membership changes remain owner-only. RLS uses private, current-user helpers to avoid recursive policy evaluation. Auth directory RPCs require ownership and expose only display names and emails. `node scripts/test-project-members.mjs` runs live owner/member/outsider access checks against an isolated temporary project using the sample users, then cleans up.

Task boards subscribe to a project-filtered Supabase Realtime invalidation channel. Database triggers signal every task insert, update, move, reorder, and delete; event payloads contain only the project ID and revision. RLS restricts signals to current owners/members. Clients re-fetch authorized board data without page navigation, coalesce event bursts, preserve search/scroll and open popup drafts, defer while dragging/saving, and unsubscribe on navigation. Reconnect/focus/visibility events refresh the board, with a 30-second reconciliation check for suspended connections. `node scripts/test-realtime-sync.mjs` verifies live cross-user add/edit/move/delete updates and outsider isolation using a temporary project.

## Admin panel

`/admin` and `/admin/projects` list all projects. `/admin/projects/{id}` provides project details and view/edit/delete controls for its stages and tasks. `/admin/users` searches and manages Auth users (display name, email, optional password, and admin role). Every route checks the live database role; the navigation link is visible only to admins. RLS grants admins access to project assets while preserving ordinary owner/member rules.

Admin assignments live in the non-exposed `private.admin_users` table. User-editable metadata is never used for authorization. User edits/deletions run through the `admin-users` Edge Function, which verifies the caller with Auth and checks `is_admin()` before using server-only Admin API credentials. Self-deletion, self-demotion, and direct deletion of another admin are blocked. Account deletion removes uploaded files, owned project assets, and memberships. Remove another user's admin role before deleting that account.

The initial account is `admin@yahoo.com`. Its generated password is stored only in ignored `.env.admin`; do not commit or deploy that file. To bootstrap another administrator, insert an existing Auth user's ID into `private.admin_users` through a trusted database connection. `node --env-file=.env.admin scripts/test-admin.mjs` verifies admin CRUD and ordinary-user denial with disposable accounts/projects and cleans up afterward.

The Projects table fetches 20 projects per page with database-side title/description search and exact aggregate counts. Task columns load an initial 20 cards per stage, then load more as their own scroll area approaches the bottom; a Load more button remains available. Column totals include unloaded tasks, live refreshes preserve the loaded window, and drag drops at a batch boundary target the next unloaded row instead of jumping to the true column end.

`npm run seed:scale` uses admin credentials from ignored `.env.admin` to insert 104 deterministic sample projects owned by Steve with 120 tasks each (90 / 20 / 10 across the default stages), and fills the original four sample projects to at least 120 tasks. It preserves existing projects/tasks and uses stable IDs to avoid duplicates on reruns. The current dataset has 108 projects and 12,960 tasks. `node --env-file=.env.admin scripts/test-paging.mjs` checks page separation, search, totals and task windows against that dataset.

## Task discussion

Open an existing task to read or post comments. Comments are plain text (up to 4,000 characters), show the author's name and time, and save separately from task details. Authors can edit or confirm deletion of their own comments; admins can moderate all comments. Project owners and members can read and post. RLS and column grants enforce these rules and prevent author spoofing. Deleted accounts leave historical comments attributed to Deleted user; deleting a task removes its comments.

Discussion loads the newest 30 comments first, with an older-comments control. Supabase Realtime invalidation refreshes open discussions while preserving unsent drafts; inline edits defer background refreshes. The applied migration is exported under `supabase/migrations/`. Run `node --env-file=.env.admin scripts/test-comments.mjs` for the isolated live permission, CRUD, Realtime, author deletion, and cascade checks.
