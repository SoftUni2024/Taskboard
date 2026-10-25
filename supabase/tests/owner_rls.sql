-- Run against Supabase as an administrative database role. All test rows roll back.
begin;
select set_config('test.user_a',gen_random_uuid()::text,true);
select set_config('test.user_b',gen_random_uuid()::text,true);
select set_config('test.project_a',gen_random_uuid()::text,true);
select set_config('test.project_b',gen_random_uuid()::text,true);
select set_config('test.stage_a',gen_random_uuid()::text,true);
select set_config('test.stage_b',gen_random_uuid()::text,true);
select set_config('test.task_a',gen_random_uuid()::text,true);
select set_config('test.task_b',gen_random_uuid()::text,true);
insert into auth.users(id,email) values
(current_setting('test.user_a')::uuid,'rls-a-'||current_setting('test.user_a')||'@example.invalid'),
(current_setting('test.user_b')::uuid,'rls-b-'||current_setting('test.user_b')||'@example.invalid');

set local role authenticated;
select set_config('request.jwt.claim.sub',current_setting('test.user_a'),true);
insert into public.projects(id,title) values (current_setting('test.project_a')::uuid,'Owner A project');
insert into public.project_stages(id,project_id,name) values
(current_setting('test.stage_a')::uuid,current_setting('test.project_a')::uuid,'Not Started');
insert into public.tasks(id,project_id,stage_id,title) values
(current_setting('test.task_a')::uuid,current_setting('test.project_a')::uuid,current_setting('test.stage_a')::uuid,'Owner A task');

select set_config('request.jwt.claim.sub',current_setting('test.user_b'),true);
insert into public.projects(id,title) values (current_setting('test.project_b')::uuid,'Owner B project');
insert into public.project_stages(id,project_id,name) values
(current_setting('test.stage_b')::uuid,current_setting('test.project_b')::uuid,'Done');
insert into public.tasks(id,project_id,stage_id,title) values
(current_setting('test.task_b')::uuid,current_setting('test.project_b')::uuid,current_setting('test.stage_b')::uuid,'Owner B task');

select set_config('request.jwt.claim.sub',current_setting('test.user_a'),true);
do $test$
declare affected integer;
begin
  if (select count(*) from public.projects where id in (current_setting('test.project_a')::uuid,current_setting('test.project_b')::uuid)) <> 1 then raise exception 'FAIL: project isolation'; end if;
  if (select count(*) from public.project_stages where id in (current_setting('test.stage_a')::uuid,current_setting('test.stage_b')::uuid)) <> 1 then raise exception 'FAIL: stage isolation'; end if;
  if (select count(*) from public.tasks where id in (current_setting('test.task_a')::uuid,current_setting('test.task_b')::uuid)) <> 1 then raise exception 'FAIL: task isolation'; end if;
  -- project ownership cannot be reassigned
  begin
    update public.projects set owner_id=current_setting('test.user_b')::uuid where id=current_setting('test.project_a')::uuid;
    raise exception 'FAIL: project ownership cannot be reassigned';
  exception when insufficient_privilege then null;
  end;
  -- cannot create another user's project
  begin
    insert into public.projects(title,owner_id) values ('Forbidden',current_setting('test.user_b')::uuid);
    raise exception 'FAIL: cannot create another user-owned project';
  exception when insufficient_privilege then null;
  end;
  -- cannot insert stages into another user's project
  begin
    insert into public.project_stages(project_id,name) values (current_setting('test.project_b')::uuid,'Forbidden');
    raise exception 'FAIL: cannot insert stages into another user-owned project';
  exception when insufficient_privilege then null;
  end;
  -- cannot move a stage into another user's project
  begin
    update public.project_stages set project_id=current_setting('test.project_b')::uuid where id=current_setting('test.stage_a')::uuid;
    raise exception 'FAIL: cannot move a stage into another user-owned project';
  exception when insufficient_privilege then null;
  end;
  -- cannot insert tasks into another user's project
  begin
    insert into public.tasks(project_id,stage_id,title) values (current_setting('test.project_b')::uuid,current_setting('test.stage_b')::uuid,'Forbidden');
    raise exception 'FAIL: cannot insert tasks into another user-owned project';
  exception when insufficient_privilege then null;
  end;
  -- cannot move task into another user's project
  begin
    update public.tasks set project_id=current_setting('test.project_b')::uuid,stage_id=current_setting('test.stage_b')::uuid where id=current_setting('test.task_a')::uuid;
    raise exception 'FAIL: cannot move task into another user-owned project';
  exception when insufficient_privilege then null;
  end;
  -- task stage must belong to the task project
  begin
    insert into public.tasks(project_id,stage_id,title) values (current_setting('test.project_a')::uuid,current_setting('test.stage_b')::uuid,'Mismatched stage');
    raise exception 'FAIL: task stage must belong to the task project';
  exception when foreign_key_violation then null;
  end;
  update public.projects set title='Updated by owner' where id=current_setting('test.project_a')::uuid;
  get diagnostics affected = row_count;
  if affected <> 1 then raise exception 'FAIL: owner update projects'; end if;
  update public.projects set title='Forbidden update' where id=current_setting('test.project_b')::uuid;
  get diagnostics affected = row_count;
  if affected <> 0 then raise exception 'FAIL: foreign update projects'; end if;
  delete from public.projects where id=current_setting('test.project_b')::uuid;
  get diagnostics affected = row_count;
  if affected <> 0 then raise exception 'FAIL: foreign delete projects'; end if;
  update public.project_stages set name='Updated by owner' where id=current_setting('test.stage_a')::uuid;
  get diagnostics affected = row_count;
  if affected <> 1 then raise exception 'FAIL: owner update project_stages'; end if;
  update public.project_stages set name='Forbidden update' where id=current_setting('test.stage_b')::uuid;
  get diagnostics affected = row_count;
  if affected <> 0 then raise exception 'FAIL: foreign update project_stages'; end if;
  delete from public.project_stages where id=current_setting('test.stage_b')::uuid;
  get diagnostics affected = row_count;
  if affected <> 0 then raise exception 'FAIL: foreign delete project_stages'; end if;
  update public.tasks set title='Updated by owner' where id=current_setting('test.task_a')::uuid;
  get diagnostics affected = row_count;
  if affected <> 1 then raise exception 'FAIL: owner update tasks'; end if;
  update public.tasks set title='Forbidden update' where id=current_setting('test.task_b')::uuid;
  get diagnostics affected = row_count;
  if affected <> 0 then raise exception 'FAIL: foreign update tasks'; end if;
  delete from public.tasks where id=current_setting('test.task_b')::uuid;
  get diagnostics affected = row_count;
  if affected <> 0 then raise exception 'FAIL: foreign delete tasks'; end if;
  update public.tasks set done=true,position=2 where id=current_setting('test.task_a')::uuid;
  if not (select done from public.tasks where id=current_setting('test.task_a')::uuid) then raise exception 'FAIL: done update'; end if;
  delete from public.tasks where id=current_setting('test.task_a')::uuid;
  get diagnostics affected = row_count;
  if affected <> 1 then raise exception 'FAIL: owner task delete'; end if;
  delete from public.project_stages where id=current_setting('test.stage_a')::uuid;
  get diagnostics affected = row_count;
  if affected <> 1 then raise exception 'FAIL: owner stage delete'; end if;
  delete from public.projects where id=current_setting('test.project_a')::uuid;
  get diagnostics affected = row_count;
  if affected <> 1 then raise exception 'FAIL: owner project delete'; end if;
end
$test$;

-- Owner B can delete the entire project and dependent rows.
select set_config('request.jwt.claim.sub',current_setting('test.user_b'),true);
delete from public.projects where id=current_setting('test.project_b')::uuid;
do $test$ begin
  if exists (select 1 from public.project_stages where id=current_setting('test.stage_b')::uuid)
    or exists (select 1 from public.tasks where id=current_setting('test.task_b')::uuid)
  then raise exception 'FAIL: project cascade'; end if;
end $test$;
reset role;
set local role anon;
select set_config('request.jwt.claim.sub','',true);
do $test$ begin
  begin
    perform 1 from public.projects;
    raise exception 'FAIL: anonymous select projects';
  exception when insufficient_privilege then null;
  end;
  begin
    insert into public.projects default values;
    raise exception 'FAIL: anonymous insert projects';
  exception when insufficient_privilege then null;
  end;
  begin
    update public.projects set id=id;
    raise exception 'FAIL: anonymous update projects';
  exception when insufficient_privilege then null;
  end;
  begin
    delete from public.projects;
    raise exception 'FAIL: anonymous delete projects';
  exception when insufficient_privilege then null;
  end;
  begin
    perform 1 from public.project_stages;
    raise exception 'FAIL: anonymous select project_stages';
  exception when insufficient_privilege then null;
  end;
  begin
    insert into public.project_stages default values;
    raise exception 'FAIL: anonymous insert project_stages';
  exception when insufficient_privilege then null;
  end;
  begin
    update public.project_stages set id=id;
    raise exception 'FAIL: anonymous update project_stages';
  exception when insufficient_privilege then null;
  end;
  begin
    delete from public.project_stages;
    raise exception 'FAIL: anonymous delete project_stages';
  exception when insufficient_privilege then null;
  end;
  begin
    perform 1 from public.tasks;
    raise exception 'FAIL: anonymous select tasks';
  exception when insufficient_privilege then null;
  end;
  begin
    insert into public.tasks default values;
    raise exception 'FAIL: anonymous insert tasks';
  exception when insufficient_privilege then null;
  end;
  begin
    update public.tasks set id=id;
    raise exception 'FAIL: anonymous update tasks';
  exception when insufficient_privilege then null;
  end;
  begin
    delete from public.tasks;
    raise exception 'FAIL: anonymous delete tasks';
  exception when insufficient_privilege then null;
  end;
end $test$;
reset role;
rollback;
select 'PASS: owner CRUD; cross-user SELECT/INSERT/UPDATE/DELETE isolation; immutable ownership; project/stage consistency; anonymous denial; cascade cleanup. All test data rolled back.' as result;
