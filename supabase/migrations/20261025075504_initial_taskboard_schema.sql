-- Users are managed exclusively by Supabase Auth (auth.users).
-- No public users table or project membership table is needed.
create table public.projects (
  id uuid primary key default gen_random_uuid(),
  title text not null check (char_length(btrim(title)) between 1 and 120),
  description text not null default '' check (char_length(description) <= 2000),
  owner_id uuid not null default auth.uid() references auth.users(id) on delete cascade
);

create table public.project_stages (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  name text not null check (char_length(btrim(name)) between 1 and 80),
  position integer not null default 0 check (position >= 0),
  constraint project_stages_project_id_id_key unique (project_id, id)
);

create table public.tasks (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  stage_id uuid not null,
  title text not null check (char_length(btrim(title)) between 1 and 180),
  description text not null default '' check (char_length(description) <= 40000),
  position integer not null default 0 check (position >= 0),
  done boolean not null default false,
  constraint tasks_project_stage_fkey foreign key (project_id, stage_id)
    references public.project_stages(project_id, id) on delete cascade
);

-- Index ownership lookups, foreign keys, and ordered board queries.
create index projects_owner_id_idx on public.projects (owner_id);
create index project_stages_project_position_idx on public.project_stages (project_id, position, id);
create index tasks_project_stage_position_idx on public.tasks (project_id, stage_id, position, id);

alter table public.projects enable row level security;
alter table public.project_stages enable row level security;
alter table public.tasks enable row level security;

revoke all on table public.projects, public.project_stages, public.tasks
  from public, anon, authenticated;
grant select, insert, update, delete on table public.projects, public.project_stages, public.tasks
  to authenticated;

create policy projects_select_own on public.projects for select to authenticated
  using (owner_id = (select auth.uid()));
create policy projects_insert_own on public.projects for insert to authenticated
  with check (owner_id = (select auth.uid()));
create policy projects_update_own on public.projects for update to authenticated
  using (owner_id = (select auth.uid()))
  with check (owner_id = (select auth.uid()));
create policy projects_delete_own on public.projects for delete to authenticated
  using (owner_id = (select auth.uid()));

create policy project_stages_select_own on public.project_stages for select to authenticated
  using (exists (select 1 from public.projects p
    where p.id = project_stages.project_id and p.owner_id = (select auth.uid())));
create policy project_stages_insert_own on public.project_stages for insert to authenticated
  with check (exists (select 1 from public.projects p
    where p.id = project_stages.project_id and p.owner_id = (select auth.uid())));
create policy project_stages_update_own on public.project_stages for update to authenticated
  using (exists (select 1 from public.projects p
    where p.id = project_stages.project_id and p.owner_id = (select auth.uid())))
  with check (exists (select 1 from public.projects p
    where p.id = project_stages.project_id and p.owner_id = (select auth.uid())));
create policy project_stages_delete_own on public.project_stages for delete to authenticated
  using (exists (select 1 from public.projects p
    where p.id = project_stages.project_id and p.owner_id = (select auth.uid())));

create policy tasks_select_own on public.tasks for select to authenticated
  using (exists (select 1 from public.projects p
    where p.id = tasks.project_id and p.owner_id = (select auth.uid())));
create policy tasks_insert_own on public.tasks for insert to authenticated
  with check (exists (select 1 from public.projects p
    where p.id = tasks.project_id and p.owner_id = (select auth.uid())));
create policy tasks_update_own on public.tasks for update to authenticated
  using (exists (select 1 from public.projects p
    where p.id = tasks.project_id and p.owner_id = (select auth.uid())))
  with check (exists (select 1 from public.projects p
    where p.id = tasks.project_id and p.owner_id = (select auth.uid())));
create policy tasks_delete_own on public.tasks for delete to authenticated
  using (exists (select 1 from public.projects p
    where p.id = tasks.project_id and p.owner_id = (select auth.uid())));

comment on table public.projects is 'Projects privately owned by a Supabase Auth user.';
comment on table public.project_stages is 'Ordered task board columns belonging to a project.';
comment on table public.tasks is 'Ordered project tasks. The composite foreign key enforces stage/project consistency.';
comment on column public.tasks.done is 'Explicit completion flag; the application updates this when moving tasks to/from a completed stage.';
