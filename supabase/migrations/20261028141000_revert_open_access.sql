-- Återställer 20261028140000_open_access: appen använder i stället anonyma
-- Supabase-konton (en per enhet), så att var och en bara ser sina egna projekt
-- och de vanliga RLS-reglerna gäller.

drop policy if exists "open projects read" on public.projects;
drop policy if exists "open projects insert" on public.projects;
drop policy if exists "open projects update" on public.projects;
drop policy if exists "open visits read" on public.visits;
drop policy if exists "open visits insert" on public.visits;
drop policy if exists "open visits update" on public.visits;
drop policy if exists "open photos read" on public.photos;
drop policy if exists "open photos insert" on public.photos;
drop policy if exists "open photos update" on public.photos;
drop policy if exists "open templates read" on public.templates;
drop policy if exists "open templates insert" on public.templates;
drop policy if exists "open templates update" on public.templates;
drop policy if exists "open activity read" on public.activity;
drop policy if exists "open photos storage read" on storage.objects;
drop policy if exists "open photos storage insert" on storage.objects;
drop policy if exists "open photos storage update" on storage.objects;

drop function if exists public.ai_rate_check_open(text, text, int, int);
drop function if exists public.is_shared_project(uuid);
revoke execute on function public.visit_project(uuid) from anon;
revoke execute on function public.try_uuid(text) from anon;

delete from public.organizations where id = '00000000-0000-4000-8000-0000000000aa';

-- Anonyma konton kan skapas fritt, så AI-anrop begränsas även totalt per dygn.
create or replace function public.ai_rate_check(p_kind text, p_limit int, p_window_minutes int)
returns boolean language plpgsql security definer set search_path = public as $$
declare
  v_count int;
  v_total int;
begin
  if auth.uid() is null then return false; end if;
  select count(*) into v_count from ai_usage
  where user_id = auth.uid() and created_at > now() - make_interval(mins => p_window_minutes);
  select count(*) into v_total from ai_usage where created_at > now() - interval '1 day';
  if v_count >= p_limit or v_total >= 500 then return false; end if;
  insert into ai_usage (user_id, kind) values (auth.uid(), p_kind);
  return true;
end;
$$;
