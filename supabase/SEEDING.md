# Sample Auth users

`scripts/seed-users.mjs` creates the following Supabase Auth accounts:

| Email | Password |
| --- | --- |
| steve@gmail.com | pass123 |
| maria@gmail.com | pass123 |
| peter@gmail.com | pass123 |

The script uses the official Supabase JavaScript SDK and the server-side Auth Admin API. It creates email/password users with email confirmation enabled, so no verification emails are sent. It checks the saved accounts after creation. Existing accounts are skipped without changing their passwords, confirmation status, or metadata. Rerunning after a partial failure is safe.

## Setup and run

From the app directory, copy `.env.seed.example` to `.env.seed`. Set `SUPABASE_SECRET_KEY` to a secret key from the connected Taskboard project's API keys settings. A legacy `SUPABASE_SERVICE_ROLE_KEY` also works. The example already contains the project's URL.

Keep the admin key in `.env.seed` or the process environment. `.env.seed` is ignored by Git. Never use a `VITE_` prefix for an admin key or import this script into browser code. Publishable/anon keys cannot create confirmed users through the Admin API.

```sh
npm ci
npm run seed:users -- --dry-run
npm run seed:users
```

The dry run makes no network requests and does not require an admin key. The normal run loads `.env.seed` if present and reports created/existing counts without printing passwords or keys. To inspect the command:

```sh
npm run seed:users -- --help
```

`seed:users` only creates the three requested Auth users. No membership records are created.

## Sample projects and tasks

```sh
npm run seed:projects -- --dry-run
npm run seed:projects
```

This command first ensures the sample users exist, then creates four projects, twelve stages, and forty-four tasks:

| Project | Owner | Tasks |
| --- | --- | --- |
| Company Website Redesign | steve@gmail.com | 12 |
| Mobile App MVP | maria@gmail.com | 11 |
| Autumn Marketing Campaign | peter@gmail.com | 10 |
| Home Office Setup | steve@gmail.com | 11 |

Every project has `Not Started`, `In Progress`, and `Done` stages at positions 0, 1, and 2. Tasks occupy all three stages with ordered positions within each column. Tasks in `Done` have `done = true`; other sample tasks have `done = false`.

Sample content is defined in `scripts/sample-projects.mjs`. Stable UUIDs and insert-only upserts make repeat runs safe without duplicating rows or overwriting later edits. Deleted sample rows are recreated when the seed runs again. Run a single seed process at a time. Existing unrelated records are left unchanged. These records are stored in Supabase; the deployed D1-backed app will display them after its separate Supabase integration.

## Tests

```sh
node --test scripts/seed-users.test.mjs
```

The tests cover exact sample accounts/passwords, confirmed creation, repeat runs, pagination, email casing, concurrent creation, Auth errors, and saved-account verification. They use a mocked Auth API and create no real users.
