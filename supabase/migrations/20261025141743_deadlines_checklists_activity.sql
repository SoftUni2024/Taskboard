alter table public.tasks add column due_on date;
create index tasks_deadline_idx on public.tasks(project_id,due_on,id);
create table public.task_checklist(
 id uuid primary key default gen_random_uuid(),
 task_id uuid not null references public.tasks(id) on delete cascade,
 title text not null check(char_length(btrim(title)) between 1 and 200),
 done boolean not null default false,
 position integer not null check(position>=0)
);
create index task_checklist_order_idx on public.task_checklist(task_id,position,id);
alter table public.task_checklist enable row level security;
revoke all on public.task_checklist from public,anon,authenticated;
grant select on public.task_checklist to authenticated;
create policy checklist_read on public.task_checklist for select to authenticated using(exists(select 1 from public.tasks t where t.id=task_id and private.can_access_project(t.project_id)));
create function private.checklist_change(p_task uuid,p_action text,p_item uuid,p_title text,p_done boolean,p_direction integer) returns void
language plpgsql security definer set search_path='' as $$
declare item public.task_checklist; neighbor public.task_checklist; project uuid;
begin
 select t.project_id into project from public.tasks t where t.id=p_task for update;
 if project is null or not private.can_access_project(project) then raise exception 'Task access denied.' using errcode='42501';end if;
 if p_action='add' then
 if (select count(*) from public.task_checklist where task_id=p_task)>=200 then raise exception 'A checklist can contain up to 200 items.';end if;
 insert into public.task_checklist(task_id,title,position) select p_task,btrim(p_title),coalesce(max(position),-1)+1 from public.task_checklist where task_id=p_task;
 return;
 end if;
 select * into item from public.task_checklist where task_id=p_task and id=p_item;
 if item.id is null then raise exception 'Checklist item no longer exists.';end if;
 if p_action='edit' then
 update public.task_checklist set title=coalesce(btrim(p_title),title),done=coalesce(p_done,done) where id=p_item;
 elsif p_action='delete' then delete from public.task_checklist where id=p_item;
 elsif p_action='move' and p_direction in (-1,1) then
 if p_direction=-1 then select * into neighbor from public.task_checklist where task_id=p_task and position<item.position order by position desc,id desc limit 1;
 else select * into neighbor from public.task_checklist where task_id=p_task and position>item.position order by position,id limit 1;end if;
 if neighbor.id is not null then
 update public.task_checklist set position=neighbor.position where id=item.id;
 update public.task_checklist set position=item.position where id=neighbor.id;
 end if;
 else raise exception 'Invalid checklist action.';end if;
end;$$;
create function public.checklist_change(p_task uuid,p_action text,p_item uuid default null,p_title text default null,p_done boolean default null,p_direction integer default null) returns void
language sql security invoker set search_path='' as $$select private.checklist_change(p_task,p_action,p_item,p_title,p_done,p_direction);$$;
revoke all on function private.checklist_change(uuid,text,uuid,text,boolean,integer),public.checklist_change(uuid,text,uuid,text,boolean,integer) from public,anon;
grant execute on function private.checklist_change(uuid,text,uuid,text,boolean,integer),public.checklist_change(uuid,text,uuid,text,boolean,integer) to authenticated;

create table public.task_activity(
 id bigint generated always as identity primary key,
 project_id uuid not null references public.projects(id) on delete cascade,
 task_id uuid not null,
 task_title text not null,
 actor_id uuid,
 actor_name text not null,
 action text not null,
 before_data jsonb,
 after_data jsonb,
 created_at timestamptz not null default now()
);
create index task_activity_project_idx on public.task_activity(project_id,id desc);
create index task_activity_task_idx on public.task_activity(task_id,id desc);
alter table public.task_activity enable row level security;
revoke all on public.task_activity from public,anon,authenticated;
grant select on public.task_activity to authenticated;
create policy activity_read on public.task_activity for select to authenticated using(private.can_access_project(project_id));
create function private.append_task_activity(p_project uuid,p_task uuid,p_title text,p_action text,p_before jsonb,p_after jsonb) returns void
language plpgsql security definer set search_path='' as $$
begin
 if not exists(select 1 from public.projects where id=p_project) then return;end if;
 insert into public.task_activity(project_id,task_id,task_title,actor_id,actor_name,action,before_data,after_data)
 values(p_project,p_task,p_title,auth.uid(),coalesce((select nullif(raw_user_meta_data->>'display_name','') from auth.users where id=auth.uid()),'System'),p_action,p_before,p_after);
 insert into public.project_task_changes(project_id,revision) values(p_project,gen_random_uuid()) on conflict(project_id) do update set revision=excluded.revision;
end;$$;
revoke all on function private.append_task_activity(uuid,uuid,text,text,jsonb,jsonb) from public,anon,authenticated;
create function private.log_task_change() returns trigger language plpgsql security definer set search_path='' as $$
declare old_data jsonb;new_data jsonb;task public.tasks;item uuid;action_name text;
begin
 if TG_OP!='INSERT' then old_data=to_jsonb(OLD);end if;
 if TG_OP!='DELETE' then new_data=to_jsonb(NEW);end if;
 if old_data is not distinct from new_data then return null;end if;
 if TG_TABLE_NAME='tasks' then
 if TG_OP='DELETE' then task=OLD;else task=NEW;end if;
 action_name='Task '||lower(TG_OP);
 else
 item=coalesce((new_data->>'task_id')::uuid,(old_data->>'task_id')::uuid);
 select * into task from public.tasks where id=item;
 if task.id is null then return null;end if;
 action_name=case TG_TABLE_NAME when 'task_checklist' then 'Checklist item ' when 'task_comments' then 'Comment ' else 'Label link ' end||lower(TG_OP);
 if TG_TABLE_NAME='task_labels' then
 new_data=new_data||jsonb_build_object('label_name',(select name from public.project_labels where id=(new_data->>'label_id')::uuid));
 old_data=old_data||jsonb_build_object('label_name',(select name from public.project_labels where id=(old_data->>'label_id')::uuid));
 end if;
 end if;
 perform private.append_task_activity(task.project_id,task.id,task.title,action_name,old_data,new_data);
 return null;
end;$$;
revoke all on function private.log_task_change() from public,anon,authenticated;
create trigger task_activity_change after insert or update or delete on public.tasks for each row execute function private.log_task_change();
create trigger checklist_activity_change after insert or update or delete on public.task_checklist for each row execute function private.log_task_change();
create trigger comment_activity_change after insert or update or delete on public.task_comments for each row execute function private.log_task_change();
create trigger label_link_activity_change after insert or delete on public.task_labels for each row execute function private.log_task_change();
create function private.log_label_details() returns trigger language plpgsql security definer set search_path='' as $$
declare task public.tasks;
begin
 if TG_OP='UPDATE' and OLD.name=NEW.name and OLD.color=NEW.color then return NEW;end if;
 for task in select t.* from public.tasks t join public.task_labels l on l.task_id=t.id where l.label_id=OLD.id loop
 perform private.append_task_activity(task.project_id,task.id,task.title,'Label '||lower(TG_OP),to_jsonb(OLD),case when TG_OP='UPDATE' then to_jsonb(NEW) else null end);
 end loop;
 if TG_OP='DELETE' then return OLD;else return NEW;end if;
end;$$;
revoke all on function private.log_label_details() from public,anon,authenticated;
create trigger label_details_activity before update or delete on public.project_labels for each row execute function private.log_label_details();
create function private.log_task_file() returns trigger language plpgsql security definer set search_path='' as $$
declare filename text;parts text[];task public.tasks;
begin
 if coalesce(NEW.bucket_id,OLD.bucket_id)!='task-attachments' then return null;end if;
 filename=coalesce(NEW.name,OLD.name);parts=string_to_array(filename,'/');
 if array_length(parts,1)!=4 or parts[3] !~ '^[0-9a-fA-F-]{36}$' then return null;end if;
 begin select * into task from public.tasks where id=parts[3]::uuid and project_id::text=parts[2];exception when invalid_text_representation then return null;end;
 if task.id is not null then
 perform private.append_task_activity(task.project_id,task.id,task.title,'Attachment '||lower(TG_OP),case when TG_OP='DELETE' then jsonb_build_object('file',parts[4]) else null end,case when TG_OP='INSERT' then jsonb_build_object('file',parts[4]) else null end);
 end if;
 return null;
end;$$;
revoke all on function private.log_task_file() from public,anon,authenticated;
create trigger task_attachment_activity after insert or delete on storage.objects for each row execute function private.log_task_file();
