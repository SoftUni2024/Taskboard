# Task Board — Project Instructions

## Project description
Build a multi-page project manager for private, user-owned projects. Each project has Not Started, In Progress, and Done stages. Tasks have titles, rich-text descriptions, positions, and completion flags.

## Architecture and technology stack
Use Vite, vanilla JavaScript ES modules, HTML, CSS, and Bootstrap. Keep each page/component in separate HTML, CSS, and JS files. Compose the header, page outlet, and footer using the History API router. Use Supabase Auth and Postgres for authentication and persistent data. The browser uses only the publishable key; RLS enforces ownership. Cloudflare/Sites serves the application shell and assets.

## UI guidelines
Keep the responsive, calm green visual style. Label inputs and icon controls; support keyboard focus and accessible Bootstrap dialogs. Show loading, empty, error, and success states. Confirm destructive actions. Provide drag-and-drop and keyboard/touch alternatives for ordering. Sanitize rich text on database reads and writes.

## Pages and navigation
- `/`: visitor landing page with register/login links.
- `/login`: login/register forms; `?mode=register` selects registration.
- `/dashboard`: current user's projects and progress.
- `/projects/{id}/tasks`: owner-only task board and project settings.
- `/account`: display name and logout.
Successful login/registration goes to `/dashboard`; logout goes to `/`. Signed-out users cannot open protected pages. Handle back/forward navigation and deep-link refreshes.

## Backend and database
Use `auth.users`, `projects`, `project_stages`, and `tasks` in Supabase. Do not add project members. Create schema changes as migrations and keep local SQL synchronized with remote migration history. Project creation and task moves use SECURITY INVOKER database operations with RLS. Validate input and show database errors clearly. Keep administrative credentials out of source control and browser bundles.

## Authentication and authorization
Use email/password Supabase registration, login, and logout. Keep email confirmations disabled for the requested immediate-registration flow; local configuration uses `auth.email.enable_confirmations = false`. Persist/refresh sessions through the official SDK. Both header and account logout return to Index. Client route guards improve navigation; owner-only RLS is the security boundary for every database operation. Keep the existing hosting access policy separate from the application session.

Run `npm test` and `npm run build` before publication. Verify real login/logout and owner isolation using the seeded accounts.
