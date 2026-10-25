# Task Board — Project Instructions

## Brief project description
Build a multi-page project management app where users create projects, add members, and manage tasks on a board. Default stages are **Not Started**, **In Progress**, and **Done**. Support project/task creation, editing, deletion, task movement, ordering, and rich-text descriptions.

## Architecture and technology stack
- JavaScript and React for the UI; Vinext supplies Next.js-style page and API routing.
- Cloudflare Workers runs the backend; Cloudflare D1 (SQLite) persists records. Drizzle defines the schema and generates migrations.
- Sites hosts the app and manages ChatGPT sign-in. Keep deployment settings in `taskboard-app/.openai/hosting.json`.
- Keep UI, API handlers, and database schema separate. Browser storage must not be the source of truth for projects or tasks.

## UI guidelines
- Use a calm, responsive interface with readable typography, muted green accents, clear buttons, and consistent spacing.
- Show loading, empty, success, and error states. Confirm destructive actions.
- Label inputs and icon buttons; support keyboard navigation, visible focus, and accessible dialogs.
- Provide drag-and-drop for task movement and ordering, plus stage selection and move-up/down buttons for keyboard and touch use.
- Support bold, italic, underline, and lists in rich-text descriptions. Sanitize stored markup on the server.

## Pages and navigation guidelines
- `/`: workspace overview with project and task counts; sign-in screen for visitors.
- `/projects`: searchable project collection and project creation.
- `/projects/[id]`: project task board, task editor, membership management, and owner settings.
- `/account`: display name and account information.
- Keep shared workspace navigation and a clear route from a board back to all projects.

## Backend and database guidelines
- Use `/api/board` for reads and validated mutations.
- Store users, projects, project members, and tasks. Tasks contain a project reference, title, sanitized description, stage, position, and creation time.
- Use parameterized SQL and database batches for ordered moves and dependent deletions.
- Validate field lengths, stage values, and membership emails on the server. Return actionable errors.
- Generate schema migrations with `npm run db:generate`; never change schema during ordinary requests.
- Keep secrets out of source control. Apply migrations before deployment and test persistent CRUD and authorization.

## Authentication and authorization guidelines
- Use Sites-managed ChatGPT sign-in; automatically create the app profile on first authenticated access. Do not store passwords or implement custom OAuth routes.
- Derive identity from trusted platform headers, never from submitted user IDs.
- Project owners can edit/delete their projects and add/remove members by account email.
- Owners and members can read a project and create, edit, delete, move, and reorder its tasks.
- Enforce permissions server-side for every request. Members must sign in with the email added by the owner.
- Hosting access and project membership are separate controls. New Sites are owner-private by default; collaboration requires a hosting audience that admits teammates.

## Optional later features
Real-time updates, attachments, comments, task assignees, labels, deadlines, checklists, activity logs, administration, and pagination are later enhancements.
