create table public.task_comments (
 id uuid primary key default gen_random_uuid(),
 task_id uuid not null references public.tasks(id) on delete cascade,
 author_id uuid default auth.uid() references auth.users(id) on delete set null,
 body text not null check(char_length(btrim(body)) between 1 and 4000),
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now()
);
create index task_comments_task_created_idx on public.task_comments(task_id,created_at desc,id desc);
create index task_comments_author_idx on public.task_comments(author_id);
alter table public.task_comments enable row level security;
revoke all on public.task_comments from public,anon,authenticated;
grant select,delete on public.task_comments to authenticated;
grant insert(task_id,body),update(body) on public.task_comments to authenticated;
create policy comments_read on public.task_comments for select to authenticated using(
 exists(select 1 from public.tasks t where t.id=task_id and private.can_access_project(t.project_id)));
create policy comments_add on public.task_comments for insert to authenticated with check(
 author_id=(select auth.uid()) and exists(select 1 from public.tasks t where t.id=task_id and private.can_access_project(t.project_id)));
create policy comments_edit on public.task_comments for update to authenticated using(
 (author_id=(select auth.uid()) or private.is_admin()) and exists(select 1 from public.tasks t where t.id=task_id and private.can_access_project(t.project_id)))
 with check((author_id=(select auth.uid()) or private.is_admin()) and exists(select 1 from public.tasks t where t.id=task_id and private.can_access_project(t.project_id)));
create policy comments_remove on public.task_comments for delete to authenticated using(
 (author_id=(select auth.uid()) or private.is_admin()) and exists(select 1 from public.tasks t where t.id=task_id and private.can_access_project(t.project_id)));
create function private.comment_timestamp() returns trigger language plpgsql set search_path='' as $$
begin NEW.updated_at=now();return NEW;end;$$;
revoke all on function private.comment_timestamp() from public,anon,authenticated;
create trigger comment_timestamp before update of body on public.task_comments for each row execute function private.comment_timestamp();
create function private.list_task_comments(p_task uuid,p_offset integer)
returns table(id uuid,author_id uuid,author_name text,body text,created_at timestamptz,updated_at timestamptz,can_edit boolean)
language plpgsql stable security definer set search_path='' as $$
begin
 if not exists(select 1 from public.tasks t where t.id=p_task and private.can_access_project(t.project_id)) then raise exception 'Task access denied.' using errcode='42501';end if;
 return query select c.id,c.author_id,case when c.author_id is null then 'Deleted user' else coalesce(nullif(u.raw_user_meta_data->>'display_name',''),'Project member') end,c.body,c.created_at,c.updated_at,(c.author_id=(select auth.uid()) or private.is_admin())
 from public.task_comments c left join auth.users u on u.id=c.author_id
 where c.task_id=p_task order by c.created_at desc,c.id desc limit 30 offset greatest(coalesce(p_offset,0),0);
end;$$;
create function public.list_task_comments(p_task uuid,p_offset integer default 0)
returns table(id uuid,author_id uuid,author_name text,body text,created_at timestamptz,updated_at timestamptz,can_edit boolean)
language sql stable security invoker set search_path='' as $$select * from private.list_task_comments(p_task,p_offset);$$;
revoke all on function private.list_task_comments(uuid,integer),public.list_task_comments(uuid,integer) from public,anon;
grant execute on function private.list_task_comments(uuid,integer),public.list_task_comments(uuid,integer) to authenticated;
-- Reuse the RLS-protected project invalidation stream without broadcasting comment content.
create function private.signal_comment_change() returns trigger language plpgsql security definer set search_path='' as $$
declare project uuid;
begin
 select t.project_id into project from public.tasks t where t.id=coalesce(NEW.task_id,OLD.task_id);
 if project is not null then
 insert into public.project_task_changes(project_id,revision) values(project,gen_random_uuid())
 on conflict(project_id) do update set revision=excluded.revision;
 end if;return null;
end;$$;
revoke all on function private.signal_comment_change() from public,anon,authenticated;
create trigger comment_realtime_change after insert or update or delete on public.task_comments for each row execute function private.signal_comment_change();
