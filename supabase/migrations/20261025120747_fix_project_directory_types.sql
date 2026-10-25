create or replace function private.project_user_directory(p_project uuid,p_search text,p_offset integer)
returns table(id uuid,name text,email text,is_assigned boolean)
language plpgsql stable security definer set search_path='' as $$
begin
 if not private.owns_project(p_project) then raise exception 'Only the project owner can assign users.' using errcode='42501'; end if;
 return query select u.id,coalesce(nullif(u.raw_user_meta_data->>'display_name',''),u.email,'User'),(coalesce(u.email,'')::text),
 (u.id=(select p.owner_id from public.projects p where p.id=p_project) or exists(select 1 from public.project_members m where m.project_id=p_project and m.user_id=u.id))
 from auth.users u where strpos(lower((coalesce(u.email,'')::text)||' '||coalesce(u.raw_user_meta_data->>'display_name','')),lower(coalesce(p_search,'')))>0
 order by lower((coalesce(u.email,'')::text)),u.id limit 50 offset greatest(coalesce(p_offset,0),0);
end; $$;
create or replace function private.project_people(p_project uuid)
returns table(id uuid,name text,email text,role text)
language plpgsql stable security definer set search_path='' as $$
begin
 if not private.can_access_project(p_project) then raise exception 'Project access denied.' using errcode='42501'; end if;
 return query select u.id,coalesce(nullif(u.raw_user_meta_data->>'display_name',''),u.email,'User'),(coalesce(u.email,'')::text),
 case when u.id=p.owner_id then 'Owner' else 'Member' end
 from public.projects p join auth.users u on u.id=p.owner_id or exists(select 1 from public.project_members m where m.project_id=p.id and m.user_id=u.id)
 where p.id=p_project order by (u.id=p.owner_id) desc,lower((coalesce(u.email,'')::text)),u.id;
end; $$;
