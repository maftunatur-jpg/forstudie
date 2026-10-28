-- Öppet läge: appen används utan inloggning. Allt i den delade organisationen
-- kan läsas och ändras av alla (rollen anon). Inloggat läge fungerar som förut.

insert into public.organizations (id, name, created_by)
values ('00000000-0000-4000-8000-0000000000aa', 'Delad (öppen)', null)
on conflict (id) do nothing;

create or replace function public.is_shared_project(p_project uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from projects where id = p_project and org_id = '00000000-0000-4000-8000-0000000000aa');
$$;
revoke execute on function public.is_shared_project(uuid) from public;
grant execute on function public.is_shared_project(uuid) to anon, authenticated;

-- Hjälpfunktioner som RLS-policyerna anropar måste vara körbara för anon.
grant execute on function public.visit_project(uuid) to anon;

create policy "open projects read" on public.projects for select to anon
  using (org_id = '00000000-0000-4000-8000-0000000000aa');
create policy "open projects insert" on public.projects for insert to anon
  with check (org_id = '00000000-0000-4000-8000-0000000000aa');
create policy "open projects update" on public.projects for update to anon
  using (org_id = '00000000-0000-4000-8000-0000000000aa')
  with check (org_id = '00000000-0000-4000-8000-0000000000aa');

create policy "open visits read" on public.visits for select to anon using (public.is_shared_project(project_id));
create policy "open visits insert" on public.visits for insert to anon with check (public.is_shared_project(project_id));
create policy "open visits update" on public.visits for update to anon
  using (public.is_shared_project(project_id)) with check (public.is_shared_project(project_id));

create policy "open photos read" on public.photos for select to anon using (public.is_shared_project(project_id));
create policy "open photos insert" on public.photos for insert to anon
  with check (public.is_shared_project(project_id) and public.visit_project(visit_id) = project_id);
create policy "open photos update" on public.photos for update to anon
  using (public.is_shared_project(project_id))
  with check (public.is_shared_project(project_id) and public.visit_project(visit_id) = project_id);

create policy "open templates read" on public.templates for select to anon
  using (org_id is null or org_id = '00000000-0000-4000-8000-0000000000aa');
create policy "open templates insert" on public.templates for insert to anon
  with check (org_id = '00000000-0000-4000-8000-0000000000aa');
create policy "open templates update" on public.templates for update to anon
  using (org_id = '00000000-0000-4000-8000-0000000000aa')
  with check (org_id = '00000000-0000-4000-8000-0000000000aa');

create policy "open activity read" on public.activity for select to anon using (public.is_shared_project(project_id));

create policy "open photos storage read" on storage.objects for select to anon
  using (bucket_id = 'photos' and public.is_shared_project(public.try_uuid((storage.foldername(name))[1])));
create policy "open photos storage insert" on storage.objects for insert to anon
  with check (bucket_id = 'photos' and public.is_shared_project(public.try_uuid((storage.foldername(name))[1])));
create policy "open photos storage update" on storage.objects for update to anon
  using (bucket_id = 'photos' and public.is_shared_project(public.try_uuid((storage.foldername(name))[1])));
grant execute on function public.try_uuid(text) to anon;

-- AI-gräns utan inloggning: per klientnyckel (IP) och totalt per dygn.
alter table public.ai_usage alter column user_id drop not null;
alter table public.ai_usage add column if not exists client_key text;
create index if not exists ai_usage_client_key_idx on public.ai_usage (client_key, created_at);

create or replace function public.ai_rate_check_open(p_kind text, p_client text, p_limit int, p_daily_total int)
returns boolean language plpgsql security definer set search_path = public as $$
declare
  v_client int;
  v_total int;
begin
  select count(*) into v_client from ai_usage where client_key = p_client and created_at > now() - interval '1 hour';
  select count(*) into v_total from ai_usage where created_at > now() - interval '1 day';
  if v_client >= p_limit or v_total >= p_daily_total then return false; end if;
  insert into ai_usage (user_id, client_key, kind) values (auth.uid(), p_client, p_kind);
  return true;
end;
$$;
revoke execute on function public.ai_rate_check_open(text, text, int, int) from public;
grant execute on function public.ai_rate_check_open(text, text, int, int) to anon, authenticated;
