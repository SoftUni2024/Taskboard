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
| `/project/{id}/tasks` | Current user's project board |
| `/account` | Display-name settings and logout |

Registration accepts a display name, email, password, and matching password confirmation. Supabase email confirmations are disabled for this project, so registration establishes a session immediately. Successful registration/login redirects to `/dashboard`. Logout clears the current app session and returns to `/`. Sessions persist across refreshes and refresh automatically; logout is synchronized across tabs.

Protected pages redirect signed-out visitors to `/login`. Supabase RLS independently enforces access to each user's own projects, stages, and tasks. No project-members table or member management is used.

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
