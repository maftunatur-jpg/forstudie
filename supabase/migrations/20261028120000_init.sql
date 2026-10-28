-- Fältinventering: grundschema, RLS och storage.
-- Alla id:n skapas på klienten (uuid) så att poster kan skapas offline.

create extension if not exists pgcrypto;

-- ---------------------------------------------------------------- tabeller

create table public.profiles (
  id uuid primary key references auth.users on delete cascade,
  email text,
  display_name text,
  created_at timestamptz not null default now()
);

create table public.organizations (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  created_by uuid references auth.users on delete set null default auth.uid(),
  created_at timestamptz not null default now()
);

create table public.members (
  org_id uuid not null references public.organizations on delete cascade,
  user_id uuid not null references auth.users on delete cascade,
  role text not null check (role in ('owner','editor','viewer')),
  created_at timestamptz not null default now(),
  primary key (org_id, user_id)
);

create table public.projects (
  id uuid primary key,
  org_id uuid not null references public.organizations on delete cascade,
  name text not null,
  property_designation text,
  address text,
  client text,
  study_type text,
  study_date date,
  responsible text,
  level1_name text not null default 'Hus',
  level1_values text[] not null default '{}',
  level2_name text,
  level2_values text[] not null default '{}',
  template_ids uuid[] not null default '{}',
  summary text,
  created_by uuid references auth.users on delete set null default auth.uid(),
  updated_by uuid references auth.users on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

create table public.project_members (
  project_id uuid not null references public.projects on delete cascade,
  user_id uuid not null references auth.users on delete cascade,
  role text not null check (role in ('owner','editor','viewer')),
  created_at timestamptz not null default now(),
  primary key (project_id, user_id)
);

create table public.invitations (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects on delete cascade,
  email text not null,
  role text not null check (role in ('owner','editor','viewer')),
  invited_by uuid references auth.users on delete set null default auth.uid(),
  created_at timestamptz not null default now(),
  accepted_at timestamptz,
  unique (project_id, email)
);

create table public.templates (
  id uuid primary key,
  org_id uuid references public.organizations on delete cascade, -- null = global mall
  name text not null,
  description text,
  sections jsonb not null default '[]',
  based_on uuid,
  created_by uuid references auth.users on delete set null default auth.uid(),
  updated_by uuid references auth.users on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

create table public.visits (
  id uuid primary key,
  project_id uuid not null references public.projects on delete cascade,
  level1 text,
  level2 text,
  kind text not null default 'apartment' check (kind in ('apartment','premises','common')),
  object_number text,
  floor text,
  shaft text,
  visit_date date,
  inspector text,
  answers jsonb not null default '{}',
  ratings jsonb not null default '{}',
  overall_rating text check (overall_rating in ('good','acceptable','deficient','urgent','not_assessed')),
  notes text,
  created_by uuid references auth.users on delete set null default auth.uid(),
  updated_by uuid references auth.users on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

create table public.photos (
  id uuid primary key,
  visit_id uuid not null references public.visits on delete cascade,
  project_id uuid not null references public.projects on delete cascade,
  storage_path text not null,
  category text,
  caption text,
  sort_order integer not null default 0,
  width integer,
  height integer,
  created_by uuid references auth.users on delete set null default auth.uid(),
  updated_by uuid references auth.users on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

-- Logg över ändringar ("vem ändrade vad").
create table public.activity (
  id bigint generated always as identity primary key,
  project_id uuid not null references public.projects on delete cascade,
  table_name text not null,
  row_id uuid not null,
  action text not null,
  changed_fields text[],
  actor uuid references auth.users on delete set null,
  created_at timestamptz not null default now()
);

create table public.ai_usage (
  id bigint generated always as identity primary key,
  user_id uuid not null references auth.users on delete cascade,
  kind text not null,
  created_at timestamptz not null default now()
);

create index on public.members (user_id);
create index on public.projects (org_id);
create index on public.projects (updated_at);
create index on public.project_members (user_id);
create index on public.invitations (lower(email));
create index on public.templates (org_id);
create index on public.templates (updated_at);
create index on public.visits (project_id);
create index on public.visits (updated_at);
create index on public.photos (visit_id);
create index on public.photos (project_id);
create index on public.photos (updated_at);
create index on public.activity (project_id, row_id);
create index on public.ai_usage (user_id, created_at);

-- ---------------------------------------------------------------- hjälpfunktioner

-- Effektiv roll i ett projekt: högsta av org-roll och projektroll.
create or replace function public.project_role(p_project uuid)
returns text language sql stable security definer set search_path = public as $$
  with roles as (
    select m.role from projects p join members m on m.org_id = p.org_id and m.user_id = auth.uid() where p.id = p_project
    union all
    select pm.role from project_members pm where pm.project_id = p_project and pm.user_id = auth.uid()
  )
  select case
    when bool_or(role = 'owner') then 'owner'
    when bool_or(role = 'editor') then 'editor'
    when bool_or(role = 'viewer') then 'viewer'
  end from roles;
$$;

create or replace function public.can_read_project(p_project uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select public.project_role(p_project) is not null;
$$;

create or replace function public.can_edit_project(p_project uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select public.project_role(p_project) in ('owner','editor');
$$;

create or replace function public.is_project_owner(p_project uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select public.project_role(p_project) = 'owner';
$$;

create or replace function public.org_role(p_org uuid)
returns text language sql stable security definer set search_path = public as $$
  select role from members where org_id = p_org and user_id = auth.uid();
$$;

create or replace function public.visit_project(p_visit uuid)
returns uuid language sql stable security definer set search_path = public as $$
  select project_id from visits where id = p_visit;
$$;

-- Delar den inloggade användaren org eller projekt med en annan användare?
create or replace function public.shares_scope(p_user uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select p_user = auth.uid()
    or exists (select 1 from members a join members b on a.org_id = b.org_id where a.user_id = auth.uid() and b.user_id = p_user)
    or exists (
      select 1 from project_members pm
      where pm.user_id = p_user and public.can_read_project(pm.project_id)
    )
    or exists (
      select 1 from project_members pm join projects p on p.id = pm.project_id join members m on m.org_id = p.org_id
      where pm.user_id = auth.uid() and m.user_id = p_user
    );
$$;

-- Säker uuid-tolkning för storage-sökvägar.
create or replace function public.try_uuid(p text)
returns uuid language plpgsql immutable as $$
begin
  return p::uuid;
exception when others then
  return null;
end;
$$;

-- ---------------------------------------------------------------- triggers

create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into profiles (id, email) values (new.id, new.email) on conflict (id) do nothing;
  return new;
end;
$$;

create trigger on_auth_user_created after insert on auth.users
  for each row execute function public.handle_new_user();

-- Servern äger updated_at/updated_by och skyddar skapare/ägarskap.
create or replace function public.touch_row()
returns trigger language plpgsql as $$
begin
  new.updated_at := now();
  new.updated_by := coalesce(auth.uid(), new.updated_by);
  if tg_op = 'UPDATE' then
    new.created_by := old.created_by;
    new.created_at := old.created_at;
  else
    new.created_by := coalesce(auth.uid(), new.created_by);
  end if;
  return new;
end;
$$;

create trigger touch before insert or update on public.projects for each row execute function public.touch_row();
create trigger touch before insert or update on public.visits for each row execute function public.touch_row();
create trigger touch before insert or update on public.photos for each row execute function public.touch_row();
create trigger touch before insert or update on public.templates for each row execute function public.touch_row();

-- Ett projekt får inte flyttas till en annan organisation.
create or replace function public.lock_project_org()
returns trigger language plpgsql as $$
begin
  new.org_id := old.org_id;
  return new;
end;
$$;
create trigger lock_org before update on public.projects for each row execute function public.lock_project_org();

create or replace function public.log_activity()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  v_project uuid;
  v_fields text[];
  v_action text;
begin
  if tg_table_name = 'projects' then v_project := new.id; else v_project := new.project_id; end if;
  if tg_op = 'INSERT' then
    v_action := 'created';
  elsif new.deleted_at is not null and old.deleted_at is null then
    v_action := 'deleted';
  else
    v_action := 'updated';
    select array_agg(n.key) into v_fields
    from jsonb_each(to_jsonb(new)) n join jsonb_each(to_jsonb(old)) o using (key)
    where n.value is distinct from o.value and n.key not in ('updated_at','updated_by');
    if v_fields is null then return new; end if;
  end if;
  insert into activity (project_id, table_name, row_id, action, changed_fields, actor)
  values (v_project, tg_table_name, new.id, v_action, v_fields, auth.uid());
  return new;
end;
$$;

create trigger activity after insert or update on public.projects for each row execute function public.log_activity();
create trigger activity after insert or update on public.visits for each row execute function public.log_activity();
create trigger activity after insert or update on public.photos for each row execute function public.log_activity();

-- Projektets skapare blir ägare av projektet.
create or replace function public.project_creator_owner()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is not null then
    insert into project_members (project_id, user_id, role) values (new.id, auth.uid(), 'owner')
    on conflict do nothing;
  end if;
  return new;
end;
$$;
create trigger creator_owner after insert on public.projects for each row execute function public.project_creator_owner();

-- ---------------------------------------------------------------- RPC

-- Körs vid inloggning: skapar en organisation om användaren saknar en
-- och accepterar väntande inbjudningar till användarens e-post.
create or replace function public.bootstrap()
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_uid uuid := auth.uid();
  v_email text := lower(coalesce(auth.jwt() ->> 'email', ''));
  v_org uuid;
  v_accepted int;
begin
  if v_uid is null then raise exception 'not authenticated'; end if;

  insert into profiles (id, email) values (v_uid, v_email) on conflict (id) do update set email = excluded.email;

  with acc as (
    update invitations set accepted_at = now()
    where lower(email) = v_email and accepted_at is null and v_email <> ''
    returning project_id, role
  ), ins as (
    insert into project_members (project_id, user_id, role)
    select project_id, v_uid, role from acc
    on conflict (project_id, user_id) do update set role = excluded.role
    returning 1
  )
  select count(*) into v_accepted from ins;

  select org_id into v_org from members where user_id = v_uid order by created_at limit 1;
  if v_org is null then
    insert into organizations (name, created_by) values ('Min organisation', v_uid) returning id into v_org;
    insert into members (org_id, user_id, role) values (v_org, v_uid, 'owner');
  end if;

  return jsonb_build_object('org_id', v_org, 'accepted_invitations', v_accepted);
end;
$$;

-- Lägger till en befintlig användare direkt eller skapar en inbjudan.
create or replace function public.invite_to_project(p_project uuid, p_email text, p_role text)
returns text language plpgsql security definer set search_path = public as $$
declare
  v_user uuid;
  v_email text := lower(trim(p_email));
begin
  if not public.is_project_owner(p_project) then raise exception 'Endast ägare kan bjuda in.'; end if;
  if p_role not in ('owner','editor','viewer') then raise exception 'Ogiltig roll.'; end if;
  insert into invitations (project_id, email, role) values (p_project, v_email, p_role)
  on conflict (project_id, email) do update set role = excluded.role, accepted_at = null;
  select id into v_user from profiles where lower(email) = v_email;
  if v_user is not null then
    insert into project_members (project_id, user_id, role) values (p_project, v_user, p_role)
    on conflict (project_id, user_id) do update set role = excluded.role;
    update invitations set accepted_at = now() where project_id = p_project and lower(email) = v_email;
    return 'added';
  end if;
  return 'invited';
end;
$$;

-- Rate limiting för AI-anrop: true om anropet får göras (och registreras).
create or replace function public.ai_rate_check(p_kind text, p_limit int, p_window_minutes int)
returns boolean language plpgsql security definer set search_path = public as $$
declare
  v_count int;
begin
  if auth.uid() is null then return false; end if;
  select count(*) into v_count from ai_usage
  where user_id = auth.uid() and created_at > now() - make_interval(mins => p_window_minutes);
  if v_count >= p_limit then return false; end if;
  insert into ai_usage (user_id, kind) values (auth.uid(), p_kind);
  return true;
end;
$$;

revoke execute on function public.bootstrap() from anon;
revoke execute on function public.invite_to_project(uuid, text, text) from anon;
revoke execute on function public.ai_rate_check(text, int, int) from anon;

-- ---------------------------------------------------------------- RLS

alter table public.profiles enable row level security;
alter table public.organizations enable row level security;
alter table public.members enable row level security;
alter table public.projects enable row level security;
alter table public.project_members enable row level security;
alter table public.invitations enable row level security;
alter table public.templates enable row level security;
alter table public.visits enable row level security;
alter table public.photos enable row level security;
alter table public.activity enable row level security;
alter table public.ai_usage enable row level security;

create policy "profiles read" on public.profiles for select to authenticated using (public.shares_scope(id));
create policy "profiles update own" on public.profiles for update to authenticated using (id = auth.uid()) with check (id = auth.uid());

create policy "orgs read" on public.organizations for select to authenticated using (public.org_role(id) is not null);
create policy "orgs update" on public.organizations for update to authenticated using (public.org_role(id) = 'owner');

create policy "members read" on public.members for select to authenticated using (public.org_role(org_id) is not null);
create policy "members manage" on public.members for all to authenticated
  using (public.org_role(org_id) = 'owner') with check (public.org_role(org_id) = 'owner');

create policy "projects read" on public.projects for select to authenticated using (public.can_read_project(id));
create policy "projects insert" on public.projects for insert to authenticated
  with check (public.org_role(org_id) in ('owner','editor'));
create policy "projects update" on public.projects for update to authenticated
  using (public.can_edit_project(id)) with check (public.can_edit_project(id));
create policy "projects delete" on public.projects for delete to authenticated using (public.is_project_owner(id));

create policy "pm read" on public.project_members for select to authenticated using (public.can_read_project(project_id));
create policy "pm manage" on public.project_members for all to authenticated
  using (public.is_project_owner(project_id)) with check (public.is_project_owner(project_id));

create policy "inv read" on public.invitations for select to authenticated using (public.is_project_owner(project_id));
create policy "inv manage" on public.invitations for all to authenticated
  using (public.is_project_owner(project_id)) with check (public.is_project_owner(project_id));

create policy "templates read" on public.templates for select to authenticated
  using (org_id is null or public.org_role(org_id) is not null);
create policy "templates insert" on public.templates for insert to authenticated
  with check (org_id is not null and public.org_role(org_id) in ('owner','editor'));
create policy "templates update" on public.templates for update to authenticated
  using (org_id is not null and public.org_role(org_id) in ('owner','editor'))
  with check (org_id is not null and public.org_role(org_id) in ('owner','editor'));

create policy "visits read" on public.visits for select to authenticated using (public.can_read_project(project_id));
create policy "visits insert" on public.visits for insert to authenticated with check (public.can_edit_project(project_id));
create policy "visits update" on public.visits for update to authenticated
  using (public.can_edit_project(project_id)) with check (public.can_edit_project(project_id));

create policy "photos read" on public.photos for select to authenticated using (public.can_read_project(project_id));
create policy "photos insert" on public.photos for insert to authenticated
  with check (public.can_edit_project(project_id) and public.visit_project(visit_id) = project_id);
create policy "photos update" on public.photos for update to authenticated
  using (public.can_edit_project(project_id))
  with check (public.can_edit_project(project_id) and public.visit_project(visit_id) = project_id);

create policy "activity read" on public.activity for select to authenticated using (public.can_read_project(project_id));

-- ai_usage: ingen direkt åtkomst, bara via ai_rate_check.

-- ---------------------------------------------------------------- storage

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('photos', 'photos', false, 10485760, array['image/jpeg','image/png','image/webp'])
on conflict (id) do nothing;

-- Sökväg: {project_id}/{visit_id}/{photo_id}.jpg
create policy "photos storage read" on storage.objects for select to authenticated
  using (bucket_id = 'photos' and public.can_read_project(public.try_uuid((storage.foldername(name))[1])));
create policy "photos storage insert" on storage.objects for insert to authenticated
  with check (bucket_id = 'photos' and public.can_edit_project(public.try_uuid((storage.foldername(name))[1])));
create policy "photos storage update" on storage.objects for update to authenticated
  using (bucket_id = 'photos' and public.can_edit_project(public.try_uuid((storage.foldername(name))[1])));
create policy "photos storage delete" on storage.objects for delete to authenticated
  using (bucket_id = 'photos' and public.can_edit_project(public.try_uuid((storage.foldername(name))[1])));
