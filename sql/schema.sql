-- ============================================================================
-- TechDream Africa — Client Project Management Portal
-- Supabase PostgreSQL Schema + Row Level Security Policies
-- ============================================================================
-- Run this in Supabase SQL Editor (or via `supabase db push`) on a fresh
-- project. Safe to re-run: guarded with IF NOT EXISTS / DROP POLICY IF EXISTS.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 0. Extensions
-- ----------------------------------------------------------------------------
create extension if not exists "uuid-ossp";
create extension if not exists pgcrypto;

-- ----------------------------------------------------------------------------
-- 1. ENUM TYPES
-- ----------------------------------------------------------------------------
do $$ begin
  create type user_role as enum ('client', 'developer', 'project_manager', 'admin');
exception when duplicate_object then null; end $$;

do $$ begin
  create type project_status as enum (
    'submitted', 'requirement_review', 'approved', 'design',
    'development', 'testing', 'client_review', 'revision',
    'deployment', 'completed', 'on_hold', 'cancelled'
  );
exception when duplicate_object then null; end $$;

do $$ begin
  create type milestone_status as enum ('pending', 'in_progress', 'completed', 'blocked');
exception when duplicate_object then null; end $$;

do $$ begin
  create type task_status as enum ('todo', 'in_progress', 'review', 'done');
exception when duplicate_object then null; end $$;

do $$ begin
  create type task_priority as enum ('low', 'medium', 'high', 'urgent');
exception when duplicate_object then null; end $$;

-- ----------------------------------------------------------------------------
-- 2. USERS (profile table — extends auth.users)
-- ----------------------------------------------------------------------------
create table if not exists public.users (
  id uuid primary key references auth.users(id) on delete cascade,
  role user_role not null default 'client',
  fullname text not null,
  email text not null unique,
  phone text,
  avatar text,
  company text,
  country text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Auto-create a public.users row whenever a new auth.users row is created.
-- Role defaults to 'client'; promote via admin dashboard afterwards.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.users (id, fullname, email, role)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'fullname', split_part(new.email, '@', 1)),
    new.email,
    coalesce((new.raw_user_meta_data->>'role')::user_role, 'client')
  );
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- ----------------------------------------------------------------------------
-- 3. PROJECTS
-- ----------------------------------------------------------------------------
create table if not exists public.projects (
  id uuid primary key default uuid_generate_v4(),
  client_id uuid not null references public.users(id) on delete cascade,
  title text not null,
  industry text,
  description text,
  business_goals text,
  target_audience text,
  budget numeric(12,2),
  deadline date,
  preferred_technology text,
  features jsonb default '[]'::jsonb,
  custom_features text,
  communication_preference text,
  meeting_availability text,
  nda_required boolean default false,
  additional_notes text,
  status project_status not null default 'submitted',
  progress int not null default 0 check (progress between 0 and 100),
  assigned_manager uuid references public.users(id),
  assigned_developer uuid references public.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_projects_client on public.projects(client_id);
create index if not exists idx_projects_manager on public.projects(assigned_manager);
create index if not exists idx_projects_developer on public.projects(assigned_developer);
create index if not exists idx_projects_status on public.projects(status);

-- ----------------------------------------------------------------------------
-- 4. MILESTONES
-- ----------------------------------------------------------------------------
create table if not exists public.milestones (
  id uuid primary key default uuid_generate_v4(),
  project_id uuid not null references public.projects(id) on delete cascade,
  title text not null,
  status milestone_status not null default 'pending',
  completion int not null default 0 check (completion between 0 and 100),
  assigned_developer uuid references public.users(id),
  notes text,
  due_date date,
  created_at timestamptz not null default now()
);

create index if not exists idx_milestones_project on public.milestones(project_id);

-- ----------------------------------------------------------------------------
-- 5. TASKS (Kanban)
-- ----------------------------------------------------------------------------
create table if not exists public.tasks (
  id uuid primary key default uuid_generate_v4(),
  project_id uuid not null references public.projects(id) on delete cascade,
  milestone_id uuid references public.milestones(id) on delete set null,
  developer_id uuid references public.users(id),
  title text not null,
  description text,
  status task_status not null default 'todo',
  priority task_priority not null default 'medium',
  position int default 0,
  created_at timestamptz not null default now()
);

create index if not exists idx_tasks_project on public.tasks(project_id);
create index if not exists idx_tasks_developer on public.tasks(developer_id);

-- ----------------------------------------------------------------------------
-- 6. MESSAGES (realtime chat)
-- ----------------------------------------------------------------------------
create table if not exists public.messages (
  id uuid primary key default uuid_generate_v4(),
  sender uuid not null references public.users(id),
  receiver uuid references public.users(id),
  project_id uuid not null references public.projects(id) on delete cascade,
  message text not null,
  read boolean default false,
  created_at timestamptz not null default now()
);

create index if not exists idx_messages_project on public.messages(project_id);
create index if not exists idx_messages_sender on public.messages(sender);

-- ----------------------------------------------------------------------------
-- 7. PROJECT FILES
-- ----------------------------------------------------------------------------
create table if not exists public.project_files (
  id uuid primary key default uuid_generate_v4(),
  project_id uuid not null references public.projects(id) on delete cascade,
  folder text not null default 'documents',
  filename text not null,
  storage_path text not null,
  size_bytes bigint,
  mime_type text,
  uploaded_by uuid not null references public.users(id),
  uploaded_at timestamptz not null default now()
);

create index if not exists idx_files_project on public.project_files(project_id);

-- ----------------------------------------------------------------------------
-- 8. NOTIFICATIONS
-- ----------------------------------------------------------------------------
create table if not exists public.notifications (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid not null references public.users(id) on delete cascade,
  title text not null,
  message text,
  type text default 'general',
  link text,
  read boolean default false,
  created_at timestamptz not null default now()
);

create index if not exists idx_notifications_user on public.notifications(user_id);

-- ----------------------------------------------------------------------------
-- 9. COMMENTS
-- ----------------------------------------------------------------------------
create table if not exists public.comments (
  id uuid primary key default uuid_generate_v4(),
  project_id uuid not null references public.projects(id) on delete cascade,
  user_id uuid not null references public.users(id),
  comment text not null,
  created_at timestamptz not null default now()
);

create index if not exists idx_comments_project on public.comments(project_id);

-- ============================================================================
-- ROW LEVEL SECURITY
-- ============================================================================
alter table public.users enable row level security;
alter table public.projects enable row level security;
alter table public.milestones enable row level security;
alter table public.tasks enable row level security;
alter table public.messages enable row level security;
alter table public.project_files enable row level security;
alter table public.notifications enable row level security;
alter table public.comments enable row level security;

-- Helper: current user's role, without recursive RLS lookups
create or replace function public.current_role()
returns user_role
language sql stable security definer set search_path = public
as $$
  select role from public.users where id = auth.uid();
$$;

-- Helper: is the current user staff (dev/pm/admin)?
create or replace function public.is_staff()
returns boolean
language sql stable security definer set search_path = public
as $$
  select coalesce((select role in ('developer','project_manager','admin')
                    from public.users where id = auth.uid()), false);
$$;

-- Helper: is the current user assigned to / owner of a given project?
create or replace function public.can_access_project(p_project_id uuid)
returns boolean
language sql stable security definer set search_path = public
as $$
  select exists (
    select 1 from public.projects p
    where p.id = p_project_id
      and (
        p.client_id = auth.uid()
        or p.assigned_manager = auth.uid()
        or p.assigned_developer = auth.uid()
        or public.current_role() = 'admin'
      )
  );
$$;

-- ---------- users ----------
drop policy if exists "users_select_own_or_staff" on public.users;
create policy "users_select_own_or_staff" on public.users
  for select using (id = auth.uid() or public.is_staff());

drop policy if exists "users_update_own" on public.users;
create policy "users_update_own" on public.users
  for update using (id = auth.uid());

drop policy if exists "users_admin_update_any" on public.users;
create policy "users_admin_update_any" on public.users
  for update using (public.current_role() = 'admin');

drop policy if exists "users_insert_self" on public.users;
create policy "users_insert_self" on public.users
  for insert with check (id = auth.uid());

-- ---------- projects ----------
drop policy if exists "projects_select" on public.projects;
create policy "projects_select" on public.projects
  for select using (
    client_id = auth.uid()
    or assigned_manager = auth.uid()
    or assigned_developer = auth.uid()
    or public.current_role() in ('admin','project_manager')
  );

drop policy if exists "projects_insert_client" on public.projects;
create policy "projects_insert_client" on public.projects
  for insert with check (client_id = auth.uid());

drop policy if exists "projects_update" on public.projects;
create policy "projects_update" on public.projects
  for update using (
    client_id = auth.uid()
    or assigned_manager = auth.uid()
    or assigned_developer = auth.uid()
    or public.current_role() in ('admin','project_manager')
  );

-- ---------- milestones ----------
drop policy if exists "milestones_select" on public.milestones;
create policy "milestones_select" on public.milestones
  for select using (public.can_access_project(project_id));

drop policy if exists "milestones_write" on public.milestones;
create policy "milestones_write" on public.milestones
  for all using (public.current_role() in ('admin','project_manager','developer'))
  with check (public.current_role() in ('admin','project_manager','developer'));

-- ---------- tasks ----------
drop policy if exists "tasks_select" on public.tasks;
create policy "tasks_select" on public.tasks
  for select using (public.can_access_project(project_id));

drop policy if exists "tasks_write" on public.tasks;
create policy "tasks_write" on public.tasks
  for all using (public.current_role() in ('admin','project_manager','developer'))
  with check (public.current_role() in ('admin','project_manager','developer'));

-- ---------- messages ----------
drop policy if exists "messages_select" on public.messages;
create policy "messages_select" on public.messages
  for select using (
    sender = auth.uid() or receiver = auth.uid() or public.can_access_project(project_id)
  );

drop policy if exists "messages_insert" on public.messages;
create policy "messages_insert" on public.messages
  for insert with check (sender = auth.uid() and public.can_access_project(project_id));

drop policy if exists "messages_update_own" on public.messages;
create policy "messages_update_own" on public.messages
  for update using (receiver = auth.uid()); -- for marking read

-- ---------- project_files ----------
drop policy if exists "files_select" on public.project_files;
create policy "files_select" on public.project_files
  for select using (public.can_access_project(project_id));

drop policy if exists "files_insert" on public.project_files;
create policy "files_insert" on public.project_files
  for insert with check (public.can_access_project(project_id) and uploaded_by = auth.uid());

drop policy if exists "files_delete" on public.project_files;
create policy "files_delete" on public.project_files
  for delete using (uploaded_by = auth.uid() or public.current_role() = 'admin');

-- ---------- notifications ----------
drop policy if exists "notifications_select_own" on public.notifications;
create policy "notifications_select_own" on public.notifications
  for select using (user_id = auth.uid());

drop policy if exists "notifications_update_own" on public.notifications;
create policy "notifications_update_own" on public.notifications
  for update using (user_id = auth.uid());

drop policy if exists "notifications_insert_staff" on public.notifications;
create policy "notifications_insert_staff" on public.notifications
  for insert with check (true); -- inserted by triggers/edge functions (security definer)

-- ---------- comments ----------
drop policy if exists "comments_select" on public.comments;
create policy "comments_select" on public.comments
  for select using (public.can_access_project(project_id));

drop policy if exists "comments_insert" on public.comments;
create policy "comments_insert" on public.comments
  for insert with check (user_id = auth.uid() and public.can_access_project(project_id));

-- ============================================================================
-- TRIGGERS: notify project manager on new project, create first milestone
-- ============================================================================
create or replace function public.handle_new_project()
returns trigger
language plpgsql security definer set search_path = public
as $$
declare
  v_manager uuid;
begin
  -- Create the first milestone automatically
  insert into public.milestones (project_id, title, status, due_date)
  values (new.id, 'Requirement Review', 'pending', now() + interval '5 days');

  -- Notify all project managers + admins of the new request
  insert into public.notifications (user_id, title, message, type, link)
  select id, 'New Project Request', new.title || ' was submitted by a client.', 'project_submitted', '/project.html?id=' || new.id
  from public.users where role in ('project_manager','admin');

  return new;
end;
$$;

drop trigger if exists on_project_created on public.projects;
create trigger on_project_created
  after insert on public.projects
  for each row execute procedure public.handle_new_project();

-- Keep updated_at fresh
create or replace function public.touch_updated_at()
returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end;
$$;

drop trigger if exists touch_projects on public.projects;
create trigger touch_projects before update on public.projects
  for each row execute procedure public.touch_updated_at();

drop trigger if exists touch_users on public.users;
create trigger touch_users before update on public.users
  for each row execute procedure public.touch_updated_at();

-- ============================================================================
-- STORAGE BUCKETS
-- ============================================================================
insert into storage.buckets (id, name, public)
values ('project-files', 'project-files', false)
on conflict (id) do nothing;

insert into storage.buckets (id, name, public)
values ('avatars', 'avatars', true)
on conflict (id) do nothing;

-- Storage policies: files live at project-files/{project_id}/{folder}/{filename}
drop policy if exists "storage_project_files_select" on storage.objects;
create policy "storage_project_files_select" on storage.objects
  for select using (
    bucket_id = 'project-files'
    and public.can_access_project((storage.foldername(name))[1]::uuid)
  );

drop policy if exists "storage_project_files_insert" on storage.objects;
create policy "storage_project_files_insert" on storage.objects
  for insert with check (
    bucket_id = 'project-files'
    and public.can_access_project((storage.foldername(name))[1]::uuid)
  );

drop policy if exists "storage_project_files_delete" on storage.objects;
create policy "storage_project_files_delete" on storage.objects
  for delete using (
    bucket_id = 'project-files'
    and public.can_access_project((storage.foldername(name))[1]::uuid)
  );

drop policy if exists "storage_avatars_public_read" on storage.objects;
create policy "storage_avatars_public_read" on storage.objects
  for select using (bucket_id = 'avatars');

drop policy if exists "storage_avatars_own_write" on storage.objects;
create policy "storage_avatars_own_write" on storage.objects
  for insert with check (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);

-- ============================================================================
-- REALTIME
-- ============================================================================
alter publication supabase_realtime add table public.messages;
alter publication supabase_realtime add table public.notifications;
alter publication supabase_realtime add table public.tasks;
alter publication supabase_realtime add table public.projects;

-- ============================================================================
-- Done. Next: set your Project URL + anon key in js/supabase.js
-- ============================================================================
