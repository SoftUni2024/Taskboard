# Task Board — Project Instructions

## Brief project description
Build a multi-page project management app where users create projects, add members, and manage tasks on a board. Default stages are **Not Started**, **In Progress**, and **Done**. Support project/task creation, editing, deletion, task movement, ordering, and rich-text descriptions.

## Architecture and technology stack
- Use Vite, vanilla JavaScript ES modules, HTML, CSS, and Bootstrap for the frontend. Do not use React or Next.js.
- Generate Vite configuration from scratch in `vite.config.js`. Import Bootstrap through npm.
- Each page and component has separate HTML, CSS, and JavaScript files. Import HTML fragments with Vite's `?raw` and load pages with dynamic imports.
- Compose the layout from header, page-content outlet, and footer components.
- Use a History API router for internal links, back/forward navigation, not-found states, and protected-route redirects.
- Cloudflare Workers runs the backend; D1 (SQLite) stores records. Drizzle defines the schema and generates migrations. Sites manages hosting and ChatGPT sign-in.

## UI guidelines
- Use Bootstrap's responsive grid, buttons, forms, and modals, with readable typography and calm green accents.
- Show loading, empty, success, and error states. Confirm destructive actions.
- Label controls, preserve keyboard navigation, and show visible focus. Use Bootstrap's modal focus management.
- Provide drag-and-drop for task movement and ordering, plus stage selection and move-up/down buttons for keyboard and touch use.
- Support bold, italic, underline, and lists. Sanitize rich text server-side and escape other user content before rendering it.

## Pages and navigation guidelines
- `/`: home page introducing the workspace.
- `/login`: ChatGPT sign-in and first-visit profile registration.
- `/dashboard`: protected, searchable projects and progress overview.
- `/projects/{id}/tasks`: protected project task board, task editor, membership management, and owner settings.
- `/account`: protected profile settings and sign-out.
- Mark internal links with `data-link`; use normal top-level anchors for platform sign-in and sign-out.
- Deep-link refreshes must load the application shell. Unknown routes show a not-found page. Validate login return URLs against known same-origin routes.

## Backend and database guidelines
- Use `/api/board` for reads and validated mutations. Keep handlers in `server/board.js` and Worker routing in `worker/index.js`.
- Store users, projects, members, and tasks. Tasks contain a project reference, title, sanitized description, stage, position, and creation time.
- Use parameterized SQL and batches for ordered moves and dependent deletions.
- Validate field lengths, stages, and membership emails server-side. Return actionable errors.
- Generate migrations with `npm run db:generate`; never change schema during ordinary requests.
- Keep secrets out of source control. Run `npm test` and `npm run build` before committing and pushing.

## Authentication and authorization guidelines
- Use Sites-managed ChatGPT sign-in and automatically register a profile on first authenticated access. Do not store passwords or implement custom OAuth routes.
- Derive identity from trusted platform headers, never from submitted user IDs. Development mock identity must remain loopback-only and absent from production.
- Project owners can edit/delete their projects and add/remove members by account email.
- Owners and members can read projects and create, edit, delete, move, and reorder tasks.
- Enforce permissions server-side on every request. Client route guards improve navigation but do not replace API authorization.
- Hosting access and project membership are separate controls. Private Sites require teammates to have site-sharing access as well.
