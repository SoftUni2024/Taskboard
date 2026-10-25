create table private.admin_users (
 user_id uuid primary key references auth.users(id) on delete cascade
);
alter table private.admin_users enable row level security;
revoke all on private.admin_users from public,anon,authenticated;
create function private.is_admin() returns boolean language sql stable security definer set search_path='' as $$
 select (select auth.uid()) is not null and exists(select 1 from private.admin_users where user_id=(select auth.uid()));
$$;
revoke all on function private.is_admin() from public,anon;
grant execute on function private.is_admin() to authenticated;
create function public.is_admin() returns boolean language sql stable security invoker set search_path='' as $$select private.is_admin();$$;
revoke all on function public.is_admin() from public,anon;
grant execute on function public.is_admin() to authenticated;
create or replace function private.can_access_project(p_project uuid) returns boolean language sql stable security definer set search_path='' as $$
 select (select auth.uid()) is not null and (private.is_admin() or exists(select 1 from public.projects where id=p_project and owner_id=(select auth.uid())) or exists(select 1 from public.project_members where project_id=p_project and user_id=(select auth.uid())));
$$;
create policy admins_manage_projects on public.projects for all to authenticated using(private.is_admin()) with check(private.is_admin());
create policy admins_manage_members on public.project_members for all to authenticated using(private.is_admin()) with check(private.is_admin());
create function private.admin_directory(p_search text,p_offset integer)
returns table(id uuid,name text,email text,is_admin boolean,created_at timestamptz)
language plpgsql stable security definer set search_path='' as $$
begin
 if not private.is_admin() then raise exception 'Administrator access required.' using errcode='42501'; end if;
 return query select u.id,coalesce(nullif(u.raw_user_meta_data->>'display_name',''),u.email::text,'User'),coalesce(u.email,'')::text,exists(select 1 from private.admin_users a where a.user_id=u.id),u.created_at
 from auth.users u where strpos(lower(coalesce(u.email,'')||' '||coalesce(u.raw_user_meta_data->>'display_name','')),lower(coalesce(p_search,'')))>0
 order by lower(u.email),u.id limit 50 offset greatest(coalesce(p_offset,0),0);
end; $$;
create function public.admin_list_users(p_search text default '',p_offset integer default 0)
returns table(id uuid,name text,email text,is_admin boolean,created_at timestamptz)
language sql stable security invoker set search_path='' as $$select * from private.admin_directory(p_search,p_offset);$$;
create function private.admin_set_role(p_user uuid,p_admin boolean) returns void
language plpgsql security definer set search_path='' as $$
begin
 perform pg_catalog.pg_advisory_xact_lock(942813);
 if not private.is_admin() then raise exception 'Administrator access required.' using errcode='42501';end if;
 if p_user=(select auth.uid()) then raise exception 'You cannot change your own administrator role.';end if;
 if p_admin then insert into private.admin_users(user_id) values(p_user) on conflict do nothing;
 else delete from private.admin_users where user_id=p_user;end if;
end; $$;
create function public.admin_set_role(p_user uuid,p_admin boolean) returns void
language sql security invoker set search_path='' as $$select private.admin_set_role(p_user,p_admin);$$;
create function private.admin_user_files(p_user uuid) returns table(path text)
language plpgsql stable security definer set search_path='' as $$
begin
 if not private.is_admin() then raise exception 'Administrator access required.' using errcode='42501';end if;
 if p_user=(select auth.uid()) or exists(select 1 from private.admin_users where user_id=p_user) then raise exception 'You cannot delete yourself or an administrator. Remove their admin role first.';end if;
 return query select o.name from storage.objects o where o.bucket_id='task-attachments' and (o.owner_id=p_user::text or (storage.foldername(o.name))[1]=p_user::text) order by o.name limit 100;
end; $$;
create function public.admin_user_files(p_user uuid) returns table(path text) language sql stable security invoker set search_path='' as $$select * from private.admin_user_files(p_user);$$;
revoke all on function private.admin_directory(text,integer),private.admin_set_role(uuid,boolean),private.admin_user_files(uuid),public.admin_list_users(text,integer),public.admin_set_role(uuid,boolean),public.admin_user_files(uuid) from public,anon;
grant execute on function private.admin_directory(text,integer),private.admin_set_role(uuid,boolean),private.admin_user_files(uuid),public.admin_list_users(text,integer),public.admin_set_role(uuid,boolean),public.admin_user_files(uuid) to authenticated;
create function public.admin_save_stage(p_stage uuid,p_name text,p_position integer) returns void
language plpgsql security invoker set search_path='' as $$
begin
 if not private.is_admin() then raise exception 'Administrator access required.' using errcode='42501';end if;
 update public.project_stages set name=btrim(p_name),position=p_position where id=p_stage;
 if not found then raise exception 'Stage not found.';end if;
 update public.tasks set done=(btrim(p_name)='Done') where stage_id=p_stage;
end; $$;
revoke all on function public.admin_save_stage(uuid,text,integer) from public,anon;
grant execute on function public.admin_save_stage(uuid,text,integer) to authenticated;
