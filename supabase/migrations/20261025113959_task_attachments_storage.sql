-- Private task files, stored at user/project/task/unique-filename.
insert into storage.buckets (id,name,public,file_size_limit,allowed_mime_types)
values ('task-attachments','task-attachments',false,10485760,
array['image/png','image/jpeg','image/gif','image/webp','application/pdf','text/plain','text/csv','text/markdown','application/msword','application/vnd.openxmlformats-officedocument.wordprocessingml.document','application/vnd.ms-excel','application/vnd.openxmlformats-officedocument.spreadsheetml.sheet','application/vnd.ms-powerpoint','application/vnd.openxmlformats-officedocument.presentationml.presentation','application/vnd.oasis.opendocument.text']);

create policy "Task owners upload attachments" on storage.objects for insert to authenticated
with check (
 bucket_id='task-attachments'
 and (storage.foldername(name))[1]=(select auth.uid())::text
 and array_length(storage.foldername(name),1)=3
 and exists(select 1 from public.tasks t join public.projects p on p.id=t.project_id
 where t.id::text=(storage.foldername(name))[3]
 and p.id::text=(storage.foldername(name))[2] and p.owner_id=(select auth.uid()))
);
create policy "Task owners read attachments" on storage.objects for select to authenticated
using (
 bucket_id='task-attachments'
 and (storage.foldername(name))[1]=(select auth.uid())::text
 and exists(select 1 from public.tasks t join public.projects p on p.id=t.project_id
 where t.id::text=(storage.foldername(name))[3]
 and p.id::text=(storage.foldername(name))[2] and p.owner_id=(select auth.uid()))
);
create policy "Task owners remove attachments" on storage.objects for delete to authenticated
using (
 bucket_id='task-attachments'
 and (storage.foldername(name))[1]=(select auth.uid())::text
 and exists(select 1 from public.tasks t join public.projects p on p.id=t.project_id
 where t.id::text=(storage.foldername(name))[3]
 and p.id::text=(storage.foldername(name))[2] and p.owner_id=(select auth.uid()))
);
