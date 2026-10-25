-- Owners must pass SELECT directly during INSERT ... RETURNING, before helper snapshots see the new row.
alter policy projects_select_own on public.projects using (owner_id=(select auth.uid()) or private.can_access_project(id));
