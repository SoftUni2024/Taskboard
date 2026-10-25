create table public.project_members (
 project_id uuid not null references public.projects(id) on delete cascade,
 user_id uuid not null references auth.users(id) on delete cascade,
 primary key(project_id,user_id)
);
create index project_members_user_project_idx on public.project_members(user_id,project_id);
alter table public.project_members enable row level security;
revoke all on public.project_members from public,anon,authenticated;
grant select,insert,delete on public.project_members to authenticated;

create schema if not exists private;
revoke all on schema private from public,anon;
grant usage on schema private to authenticated;
-- These helpers only check the current caller; private, definer rights avoid RLS recursion.
create function private.owns_project(p_project uuid) returns boolean
language sql stable security definer set search_path='' as $$
 select (select auth.uid()) is not null and exists(select 1 from public.projects p where p.id=p_project and p.owner_id=(select auth.uid()));
$$;
create function private.can_access_project(p_project uuid) returns boolean
language sql stable security definer set search_path='' as $$
 select (select auth.uid()) is not null and (
 exists(select 1 from public.projects p where p.id=p_project and p.owner_id=(select auth.uid()))
 or exists(select 1 from public.project_members m where m.project_id=p_project and m.user_id=(select auth.uid())));
$$;
revoke all on function private.owns_project(uuid),private.can_access_project(uuid) from public,anon;
grant execute on function private.owns_project(uuid),private.can_access_project(uuid) to authenticated;
create policy members_read on public.project_members for select to authenticated using(private.can_access_project(project_id));
create policy members_add on public.project_members for insert to authenticated with check(private.owns_project(project_id) and user_id<>(select auth.uid()));
create policy members_remove on public.project_members for delete to authenticated using(private.owns_project(project_id));

alter policy projects_select_own on public.projects using(private.can_access_project(id));
alter policy project_stages_select_own on public.project_stages using (private.can_access_project(project_id));
alter policy project_stages_insert_own on public.project_stages with check (private.can_access_project(project_id));
alter policy project_stages_update_own on public.project_stages using (private.can_access_project(project_id)) with check (private.can_access_project(project_id));
alter policy project_stages_delete_own on public.project_stages using (private.can_access_project(project_id));
alter policy tasks_select_own on public.tasks using (private.can_access_project(project_id));
alter policy tasks_insert_own on public.tasks with check (private.can_access_project(project_id));
alter policy tasks_update_own on public.tasks using (private.can_access_project(project_id)) with check (private.can_access_project(project_id));
alter policy tasks_delete_own on public.tasks using (private.can_access_project(project_id));

-- Auth directory reads are scoped to a project owner and expose no Auth secrets.
create function private.project_user_directory(p_project uuid,p_search text,p_offset integer)
returns table(id uuid,name text,email text,is_assigned boolean)
language plpgsql stable security definer set search_path='' as $$
begin
 if not private.owns_project(p_project) then raise exception 'Only the project owner can assign users.' using errcode='42501'; end if;
 return query select u.id,coalesce(nullif(u.raw_user_meta_data->>'display_name',''),u.email,'User'),coalesce(u.email,''),
 (u.id=(select p.owner_id from public.projects p where p.id=p_project) or exists(select 1 from public.project_members m where m.project_id=p_project and m.user_id=u.id))
 from auth.users u where strpos(lower(coalesce(u.email,'')||' '||coalesce(u.raw_user_meta_data->>'display_name','')),lower(coalesce(p_search,'')))>0
 order by lower(coalesce(u.email,'')),u.id limit 50 offset greatest(coalesce(p_offset,0),0);
end; $$;
create function private.project_people(p_project uuid)
returns table(id uuid,name text,email text,role text)
language plpgsql stable security definer set search_path='' as $$
begin
 if not private.can_access_project(p_project) then raise exception 'Project access denied.' using errcode='42501'; end if;
 return query select u.id,coalesce(nullif(u.raw_user_meta_data->>'display_name',''),u.email,'User'),coalesce(u.email,''),
 case when u.id=p.owner_id then 'Owner' else 'Member' end
 from public.projects p join auth.users u on u.id=p.owner_id or exists(select 1 from public.project_members m where m.project_id=p.id and m.user_id=u.id)
 where p.id=p_project order by (u.id=p.owner_id) desc,lower(coalesce(u.email,'')),u.id;
end; $$;
revoke all on function private.project_user_directory(uuid,text,integer),private.project_people(uuid) from public,anon;
grant execute on function private.project_user_directory(uuid,text,integer),private.project_people(uuid) to authenticated;
create function public.list_project_users(p_project uuid,p_search text default '',p_offset integer default 0)
returns table(id uuid,name text,email text,is_assigned boolean)
language sql stable security invoker set search_path='' as $$ select * from private.project_user_directory(p_project,p_search,p_offset); $$;
create function public.list_project_people(p_project uuid)
returns table(id uuid,name text,email text,role text)
language sql stable security invoker set search_path='' as $$ select * from private.project_people(p_project); $$;
revoke all on function public.list_project_users(uuid,text,integer),public.list_project_people(uuid) from public,anon;
grant execute on function public.list_project_users(uuid,text,integer),public.list_project_people(uuid) to authenticated;

-- Shared attachments retain the project's owner prefix for compatibility with existing objects.
drop policy "Task owners upload attachments" on storage.objects;
drop policy "Task owners read attachments" on storage.objects;
drop policy "Task owners remove attachments" on storage.objects;
create policy "Project participants insert attachments" on storage.objects for insert to authenticated with check (
 bucket_id='task-attachments' and array_length(storage.foldername(name),1)=3
 and exists(select 1 from public.tasks t join public.projects p on p.id=t.project_id
 where t.id::text=(storage.foldername(name))[3] and p.id::text=(storage.foldername(name))[2]
 and p.owner_id::text=(storage.foldername(name))[1] and private.can_access_project(p.id))
);
create policy "Project participants select attachments" on storage.objects for select to authenticated using (
 bucket_id='task-attachments' and array_length(storage.foldername(name),1)=3
 and exists(select 1 from public.tasks t join public.projects p on p.id=t.project_id
 where t.id::text=(storage.foldername(name))[3] and p.id::text=(storage.foldername(name))[2]
 and p.owner_id::text=(storage.foldername(name))[1] and private.can_access_project(p.id))
);
create policy "Project participants delete attachments" on storage.objects for delete to authenticated using (
 bucket_id='task-attachments' and array_length(storage.foldername(name),1)=3
 and exists(select 1 from public.tasks t join public.projects p on p.id=t.project_id
 where t.id::text=(storage.foldername(name))[3] and p.id::text=(storage.foldername(name))[2]
 and p.owner_id::text=(storage.foldername(name))[1] and private.can_access_project(p.id))
);

create or replace function public.move_project_task(p_task_id uuid, p_stage_id uuid, p_before_id uuid default null)
returns void language plpgsql security invoker set search_path = '' as $$
declare
  task_project uuid;
  old_stage uuid;
  target_name text;
  ordered_ids uuid[];
  before_position integer;
  item uuid;
  current_position integer := 0;
begin
  if (select auth.uid()) is null then raise exception 'Sign in to continue.' using errcode = '42501'; end if;
  select project_id,stage_id into task_project,old_stage from public.tasks where id=p_task_id;
  if not found then raise exception 'Task not found or access denied.' using errcode = '42501'; end if;
  -- Serialize moves within a project so positions are updated as one transaction.
  if not private.can_access_project(task_project) then raise exception 'Project access denied.' using errcode='42501'; end if;
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(task_project::text,0));
  select name into target_name from public.project_stages where id=p_stage_id and project_id=task_project;
  if not found then raise exception 'Stage does not belong to this project.' using errcode = '22023'; end if;
  if p_task_id=p_before_id then return; end if;
  select coalesce(array_agg(id order by position,id),array[]::uuid[]) into ordered_ids
    from public.tasks where project_id=task_project and stage_id=p_stage_id and id<>p_task_id;
  if p_before_id is null then
    ordered_ids := array_append(ordered_ids,p_task_id);
  else
    before_position := array_position(ordered_ids,p_before_id);
    if before_position is null then raise exception 'Target task is not in this stage.' using errcode = '22023'; end if;
    ordered_ids := coalesce(ordered_ids[1:before_position-1],array[]::uuid[])
      || array[p_task_id] || coalesce(ordered_ids[before_position:cardinality(ordered_ids)],array[]::uuid[]);
  end if;
  update public.tasks set stage_id=p_stage_id,done=(target_name='Done') where id=p_task_id and project_id=task_project;
  foreach item in array ordered_ids loop
    update public.tasks set position=current_position where id=item and project_id=task_project;
    current_position := current_position+1;
  end loop;
  if old_stage<>p_stage_id then
    current_position := 0;
    for item in select id from public.tasks where project_id=task_project and stage_id=old_stage order by position,id loop
      update public.tasks set position=current_position where id=item;
      current_position := current_position+1;
    end loop;
  end if;
end;
$$;
