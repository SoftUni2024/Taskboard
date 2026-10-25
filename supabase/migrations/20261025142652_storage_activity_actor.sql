create function private.append_activity_actor(p_project uuid,p_task uuid,p_title text,p_action text,p_before jsonb,p_after jsonb,p_actor uuid) returns void
language plpgsql security definer set search_path='' as $$
begin
 if not exists(select 1 from public.projects where id=p_project) then return;end if;
 insert into public.task_activity(project_id,task_id,task_title,actor_id,actor_name,action,before_data,after_data)
 values(p_project,p_task,p_title,p_actor,coalesce((select nullif(raw_user_meta_data->>'display_name','') from auth.users where id=p_actor),'System'),p_action,p_before,p_after);
 insert into public.project_task_changes(project_id,revision) values(p_project,gen_random_uuid()) on conflict(project_id) do update set revision=excluded.revision;
end;$$;
revoke all on function private.append_activity_actor(uuid,uuid,text,text,jsonb,jsonb,uuid) from public,anon,authenticated;
create or replace function private.append_task_activity(p_project uuid,p_task uuid,p_title text,p_action text,p_before jsonb,p_after jsonb) returns void
language plpgsql security definer set search_path='' as $$
begin perform private.append_activity_actor(p_project,p_task,p_title,p_action,p_before,p_after,auth.uid());end;$$;
create or replace function private.log_task_file() returns trigger language plpgsql security definer set search_path='' as $$
declare filename text;parts text[];task public.tasks;actor uuid:=auth.uid();
begin
 if coalesce(NEW.bucket_id,OLD.bucket_id)!='task-attachments' then return null;end if;
 filename=coalesce(NEW.name,OLD.name);parts=string_to_array(filename,'/');
 if array_length(parts,1)!=4 or parts[3] !~ '^[0-9a-fA-F-]{36}$' then return null;end if;
 begin select * into task from public.tasks where id=parts[3]::uuid and project_id::text=parts[2];exception when invalid_text_representation then return null;end;
 -- Storage's insert worker may omit auth.uid(); owner_id is set by Storage from its verified JWT.
 -- Do not use the original uploader as the actor for later deletions.
 if TG_OP='INSERT' and actor is null then
 begin actor=coalesce(NEW.owner_id::uuid,NEW.owner);exception when invalid_text_representation then actor=null;end;
 end if;
 if task.id is not null then
 perform private.append_activity_actor(task.project_id,task.id,task.title,'Attachment '||lower(TG_OP),case when TG_OP='DELETE' then jsonb_build_object('file',parts[4]) else null end,case when TG_OP='INSERT' then jsonb_build_object('file',parts[4]) else null end,actor);
 end if;
 return null;
end;$$;
