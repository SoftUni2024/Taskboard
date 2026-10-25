-- This function is an internal DDL event trigger, not an application RPC.
-- Keep automatic RLS enforcement but remove direct API execution privileges.
revoke execute on function public.rls_auto_enable() from public, anon, authenticated;
