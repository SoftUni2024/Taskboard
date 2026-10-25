-- Application operations run as the caller. RLS remains the authorization boundary.
create function public.create_project_with_stages(p_title text, p_description text default '')
returns uuid language plpgsql security invoker set search_path = '' as $$
declare project_id uuid;
begin
  if (select auth.uid()) is null then raise exception 'Sign in to continue.' using errcode = '42501'; end if;
  insert into public.projects(title,description) values (btrim(p_title),coalesce(p_description,''))
    returning id into project_id;
  insert into public.project_stages(project_id,name,position) values
    (project_id,'Not Started',0),(project_id,'In Progress',1),(project_id,'Done',2);
  return project_id;
end;
$$;

create function public.move_project_task(p_task_id uuid, p_stage_id uuid, p_before_id uuid default null)
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
  perform 1 from public.projects where id=task_project for update;
  if not found then raise exception 'Project access denied.' using errcode = '42501'; end if;
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
revoke all on function public.create_project_with_stages(text,text) from public,anon;
revoke all on function public.move_project_task(uuid,uuid,uuid) from public,anon;
grant execute on function public.create_project_with_stages(text,text) to authenticated;
grant execute on function public.move_project_task(uuid,uuid,uuid) to authenticated;
