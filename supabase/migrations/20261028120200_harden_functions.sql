-- Begränsa vem som kan anropa funktioner via API:t.
alter function public.try_uuid(text) set search_path = public;
alter function public.touch_row() set search_path = public;
alter function public.lock_project_org() set search_path = public;

-- Triggerfunktioner ska aldrig anropas direkt.
revoke execute on function public.handle_new_user() from public, anon, authenticated;
revoke execute on function public.log_activity() from public, anon, authenticated;
revoke execute on function public.project_creator_owner() from public, anon, authenticated;
revoke execute on function public.touch_row() from public, anon, authenticated;
revoke execute on function public.lock_project_org() from public, anon, authenticated;

-- Hjälpfunktioner och RPC: bara inloggade.
do $$
declare f text;
begin
  foreach f in array array[
    'public.project_role(uuid)', 'public.can_read_project(uuid)', 'public.can_edit_project(uuid)',
    'public.is_project_owner(uuid)', 'public.org_role(uuid)', 'public.visit_project(uuid)',
    'public.shares_scope(uuid)', 'public.bootstrap()', 'public.invite_to_project(uuid, text, text)',
    'public.ai_rate_check(text, int, int)'
  ] loop
    execute format('revoke execute on function %s from public, anon', f);
    execute format('grant execute on function %s to authenticated', f);
  end loop;
end $$;
