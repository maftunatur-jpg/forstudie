-- Upsert (INSERT … ON CONFLICT DO UPDATE) kräver att den nya raden även klarar
-- SELECT-policyn. can_read_project(id) slår upp projektet i tabellen, där det
-- ännu inte finns, så nya projekt nekades. Läsrätt ges därför också direkt via
-- organisationen på raden.
drop policy if exists "projects read" on public.projects;
create policy "projects read" on public.projects for select to authenticated
  using (public.org_role(org_id) is not null or public.can_read_project(id));
