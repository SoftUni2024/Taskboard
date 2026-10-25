create table public.project_labels(
 id uuid primary key default gen_random_uuid(),
 project_id uuid not null references public.projects(id) on delete cascade,
 name text not null check(char_length(btrim(name)) between 1 and 40),
 color text not null default '#78935f' check(color ~ '^#[0-9A-Fa-f]{6}$'),
 unique(project_id,id)
);
create unique index project_labels_name_idx on public.project_labels(project_id,lower(btrim(name)));
alter table public.tasks add constraint tasks_project_id_id_key unique(project_id,id);
create table public.task_labels(
 project_id uuid not null,
 task_id uuid not null,
 label_id uuid not null,
 primary key(task_id,label_id),
 foreign key(project_id,task_id) references public.tasks(project_id,id) on delete cascade,
 foreign key(project_id,label_id) references public.project_labels(project_id,id) on delete cascade
);
create index task_labels_label_idx on public.task_labels(label_id,task_id);
create index task_labels_project_idx on public.task_labels(project_id);
alter table public.project_labels enable row level security;
alter table public.task_labels enable row level security;
revoke all on public.project_labels,public.task_labels from public,anon,authenticated;
grant select,delete on public.project_labels,public.task_labels to authenticated;
grant insert(project_id,name,color),update(name,color) on public.project_labels to authenticated;
grant insert(project_id,task_id,label_id) on public.task_labels to authenticated;
create policy labels_read on public.project_labels for select to authenticated using(private.can_access_project(project_id));
create policy labels_add on public.project_labels for insert to authenticated with check(private.can_access_project(project_id));
create policy labels_edit on public.project_labels for update to authenticated using(private.can_access_project(project_id)) with check(private.can_access_project(project_id));
create policy labels_delete on public.project_labels for delete to authenticated using(private.can_access_project(project_id));
create policy task_labels_read on public.task_labels for select to authenticated using(private.can_access_project(project_id));
create policy task_labels_add on public.task_labels for insert to authenticated with check(private.can_access_project(project_id));
create policy task_labels_delete on public.task_labels for delete to authenticated using(private.can_access_project(project_id));
create function private.signal_label_change() returns trigger language plpgsql security definer set search_path='' as $$
declare project uuid:=coalesce(NEW.project_id,OLD.project_id);
begin
 if exists(select 1 from public.projects where id=project) then
 insert into public.project_task_changes(project_id,revision) values(project,gen_random_uuid())
 on conflict(project_id) do update set revision=excluded.revision;
 end if;
 return null;
end;$$;
revoke all on function private.signal_label_change() from public,anon,authenticated;
create trigger labels_realtime_change after insert or update or delete on public.project_labels for each row execute function private.signal_label_change();
create trigger task_labels_realtime_change after insert or delete on public.task_labels for each row execute function private.signal_label_change();
