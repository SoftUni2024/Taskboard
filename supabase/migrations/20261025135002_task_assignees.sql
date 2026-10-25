alter table public.tasks add column assignee_id uuid references auth.users(id) on delete set null;
create index tasks_assignee_id_idx on public.tasks(assignee_id) where assignee_id is not null;
-- RLS already restricts task mutations to project collaborators and admins.
-- This additional invariant applies even to direct API writes.
create function private.validate_task_assignee() returns trigger
language plpgsql security definer set search_path='' as $$
begin
 if NEW.assignee_id is null then return NEW;end if;
 perform 1 from public.projects p where p.id=NEW.project_id for update;
 if not exists(select 1 from public.projects p where p.id=NEW.project_id and p.owner_id=NEW.assignee_id)
 and not exists(select 1 from public.project_members m where m.project_id=NEW.project_id and m.user_id=NEW.assignee_id) then
 raise exception 'Choose the project owner or a current project member as assignee.' using errcode='23514';
 end if;
 return NEW;
end;$$;
revoke all on function private.validate_task_assignee() from public,anon,authenticated;
create trigger validate_task_assignee before insert or update of assignee_id,project_id on public.tasks for each row execute function private.validate_task_assignee();
-- Removing membership also removes responsibility for that project's tasks.
create function private.clear_member_assignments() returns trigger
language plpgsql security definer set search_path='' as $$
begin
 perform 1 from public.projects p where p.id=OLD.project_id for update;
 update public.tasks set assignee_id=null where project_id=OLD.project_id and assignee_id=OLD.user_id
 and not exists(select 1 from public.projects p where p.id=OLD.project_id and p.owner_id=OLD.user_id);
 return OLD;
end;$$;
revoke all on function private.clear_member_assignments() from public,anon,authenticated;
create trigger clear_member_assignments before delete on public.project_members for each row execute function private.clear_member_assignments();
create function private.task_assignees(p_project uuid) returns table(id uuid,name text)
language plpgsql stable security definer set search_path='' as $$
begin
 if not private.can_access_project(p_project) then raise exception 'Project access denied.' using errcode='42501';end if;
 return query select u.id,coalesce(nullif(u.raw_user_meta_data->>'display_name',''),'User '||left(u.id::text,8))
 from auth.users u where u.id in (
 select p.owner_id from public.projects p where p.id=p_project
 union select m.user_id from public.project_members m where m.project_id=p_project)
 order by 2,1;
end;$$;
create function public.task_assignees(p_project uuid) returns table(id uuid,name text)
language sql stable security invoker set search_path='' as $$select * from private.task_assignees(p_project);$$;
revoke all on function private.task_assignees(uuid),public.task_assignees(uuid) from public,anon;
grant execute on function private.task_assignees(uuid),public.task_assignees(uuid) to authenticated;
