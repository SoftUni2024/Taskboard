-- Durable per-project invalidation signals cover INSERT, UPDATE and DELETE under RLS.
-- No task content or deleted-row data is sent through Realtime.
create table public.project_task_changes (
 project_id uuid primary key references public.projects(id) on delete cascade,
 revision uuid not null default gen_random_uuid()
);
alter table public.project_task_changes enable row level security;
revoke all on public.project_task_changes from public,anon,authenticated;
grant select on public.project_task_changes to authenticated;
create policy participants_read_task_changes on public.project_task_changes for select to authenticated
using(private.can_access_project(project_id));

-- Internal trigger only: callers cannot write invalidation signals directly.
create function private.signal_task_change() returns trigger
language plpgsql security definer set search_path='' as $$
declare affected_project uuid;
begin
 for affected_project in
 select distinct v.id from (values
 (case when TG_OP<>'DELETE' then NEW.project_id else null end),
 (case when TG_OP<>'INSERT' then OLD.project_id else null end)) v(id)
 join public.projects p on p.id=v.id
 loop
  insert into public.project_task_changes(project_id,revision)
   values(affected_project,gen_random_uuid())
   on conflict(project_id) do update set revision=excluded.revision;
 end loop;
 return null;
end; $$;
revoke all on function private.signal_task_change() from public,anon,authenticated;
create trigger task_realtime_change after insert or update or delete on public.tasks
for each row execute function private.signal_task_change();
alter publication supabase_realtime add table public.project_task_changes;
