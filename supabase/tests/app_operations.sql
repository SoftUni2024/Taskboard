begin;
select set_config('test.user',gen_random_uuid()::text,true);
select set_config('test.other',gen_random_uuid()::text,true);
select set_config('test.task1',gen_random_uuid()::text,true);
select set_config('test.task2',gen_random_uuid()::text,true);
insert into auth.users(id) values(current_setting('test.user')::uuid),(current_setting('test.other')::uuid);
set local role authenticated;
select set_config('request.jwt.claim.sub',current_setting('test.user'),true);
select set_config('test.project',public.create_project_with_stages('RPC test','Temporary test data')::text,true);
insert into public.tasks(id,project_id,stage_id,title,position)
select current_setting('test.task1')::uuid,project_id,id,'First task',0 from public.project_stages where project_id=current_setting('test.project')::uuid and name='Not Started';
insert into public.tasks(id,project_id,stage_id,title,position)
select current_setting('test.task2')::uuid,project_id,id,'Second task',1 from public.project_stages where project_id=current_setting('test.project')::uuid and name='Not Started';
do $test$
declare initial_stage uuid; completed_stage uuid;
begin
  if (select count(*) from public.project_stages where project_id=current_setting('test.project')::uuid)<>3 then raise exception 'FAIL: default stages'; end if;
  select id into initial_stage from public.project_stages where project_id=current_setting('test.project')::uuid and name='Not Started';
  select id into completed_stage from public.project_stages where project_id=current_setting('test.project')::uuid and name='Done';
  perform public.move_project_task(current_setting('test.task2')::uuid,initial_stage,current_setting('test.task1')::uuid);
  if (select position from public.tasks where id=current_setting('test.task2')::uuid)<>0 then raise exception 'FAIL: reorder'; end if;
  perform public.move_project_task(current_setting('test.task1')::uuid,completed_stage,null);
  if not (select done from public.tasks where id=current_setting('test.task1')::uuid) then raise exception 'FAIL: done flag'; end if;
  perform public.move_project_task(current_setting('test.task1')::uuid,initial_stage,null);
  if (select done from public.tasks where id=current_setting('test.task1')::uuid) then raise exception 'FAIL: reset done flag'; end if;
end $test$;
select set_config('request.jwt.claim.sub',current_setting('test.other'),true);
do $test$ begin
  begin
    perform public.move_project_task(current_setting('test.task1')::uuid,gen_random_uuid(),null);
    raise exception 'FAIL: another user moved a task';
  exception when insufficient_privilege then null;
  end;
end $test$;
reset role;
set local role anon;
do $test$ begin
  begin
    perform public.create_project_with_stages('Unauthorized','');
    raise exception 'FAIL: anonymous project creation';
  exception when insufficient_privilege then null;
  end;
end $test$;
reset role;
rollback;
select 'PASS: atomic project creation, default stages, task reorder, stage moves, completion flags, and RLS denial. Test data rolled back.' as result;
