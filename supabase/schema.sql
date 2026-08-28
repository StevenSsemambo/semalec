-- ============================================================
-- SEMAI — Supabase schema
-- Run this once in your Supabase project's SQL Editor
-- (Project → SQL Editor → New query → paste → Run)
-- ============================================================

create extension if not exists "pgcrypto";

-- ── Lecturer profiles ──────────────────────────────────────────────────────
-- One row per Supabase Auth user. Created automatically on sign-up (see trigger below).
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  name text not null,
  institution text,
  created_at timestamptz default now()
);

create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.profiles (id, name, institution)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'name', new.email),
    new.raw_user_meta_data->>'institution'
  );
  return new;
end;
$$ language plpgsql security definer;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- ── Courses ────────────────────────────────────────────────────────────────
create table if not exists public.courses (
  id text primary key,                 -- slugified title, e.g. "bus-220-principles-of-marketing"
  title text not null,
  description text default '',
  subject text default '',             -- e.g. "Marketing", "Java Programming", "World History"
  outline text default '',             -- raw source text the lecturer pasted / uploaded
  lecturer_id uuid references auth.users(id) on delete set null,
  lecturer_name text default '',
  institution text default '',
  created_at timestamptz default now()
);

-- ── Modules ────────────────────────────────────────────────────────────────
create table if not exists public.modules (
  id uuid primary key default gen_random_uuid(),
  course_id text references public.courses(id) on delete cascade,
  position int not null default 0,
  icon text default '',
  title text not null,
  practical_type text default 'none',      -- 'code' | 'example' | 'none'
  practical_language text default '',      -- e.g. 'java', 'python' — only when practical_type = 'code'
  practical text default '',               -- code OR worked-example text
  practical_note text default ''           -- caption explaining the practical section
);

-- ── Slides ─────────────────────────────────────────────────────────────────
create table if not exists public.slides (
  id uuid primary key default gen_random_uuid(),
  module_id uuid references public.modules(id) on delete cascade,
  position int not null default 0,
  title text not null,
  bullets jsonb not null default '[]'::jsonb
);

-- ── Student progress (students are name-only, no account required) ────────
create table if not exists public.progress (
  id uuid primary key default gen_random_uuid(),
  student_name text not null,
  course_id text references public.courses(id) on delete cascade,
  module_id uuid references public.modules(id) on delete set null,
  slide_index int default 0,
  completed boolean default false,
  updated_at timestamptz default now()
);

create index if not exists modules_course_id_idx on public.modules(course_id);
create index if not exists slides_module_id_idx on public.slides(module_id);
create index if not exists progress_course_student_idx on public.progress(course_id, student_name);

-- ── Row Level Security ──────────────────────────────────────────────────────
alter table public.profiles enable row level security;
alter table public.courses  enable row level security;
alter table public.modules  enable row level security;
alter table public.slides   enable row level security;
alter table public.progress enable row level security;

-- Everyone (including anonymous students) can read course content — needed for the Join screen.
create policy "profiles readable by anyone" on public.profiles for select using (true);
create policy "courses readable by anyone"  on public.courses  for select using (true);
create policy "modules readable by anyone"  on public.modules  for select using (true);
create policy "slides readable by anyone"   on public.slides   for select using (true);

-- Lecturers can update their own profile.
create policy "users manage own profile" on public.profiles for update using (auth.uid() = id);

-- Course/module/slide writes are NOT exposed via public policy — they only happen through the
-- Flask backend using the service-role key, which itself checks the requesting lecturer's identity
-- (see backend/routes/curriculum.py) before writing. This keeps ownership enforcement server-side.

-- Students aren't authenticated, so progress is open for insert/update/select.
-- (Fine for a lightweight classroom tool; tighten later if you add real student accounts.)
create policy "progress insert by anyone" on public.progress for insert with check (true);
create policy "progress select by anyone" on public.progress for select using (true);
create policy "progress update by anyone" on public.progress for update using (true);

-- ── Institutions (multi-tenancy) — added after initial schema ──────────────
create table if not exists public.institutions (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  created_at timestamptz default now()
);

alter table public.institutions enable row level security;
create policy "institutions readable by anyone" on public.institutions for select using (true);
create policy "institutions insertable by anyone" on public.institutions for insert with check (true);

alter table public.profiles add column if not exists institution_id uuid references public.institutions(id);
alter table public.courses  add column if not exists institution_id uuid references public.institutions(id);

create index if not exists profiles_institution_idx on public.profiles(institution_id);
create index if not exists courses_institution_idx  on public.courses(institution_id);

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, name, institution, institution_id)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'name', new.email),
    new.raw_user_meta_data->>'institution',
    nullif(new.raw_user_meta_data->>'institution_id', '')::uuid
  );
  return new;
end;
$$;

revoke execute on function public.handle_new_user() from public, anon, authenticated;

-- ── Student accounts + real progress tracking — added after multi-tenancy pass ─
alter table public.profiles add column if not exists role text not null default 'lecturer' check (role in ('lecturer','student'));

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, name, institution, institution_id, role)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'name', new.email),
    new.raw_user_meta_data->>'institution',
    nullif(new.raw_user_meta_data->>'institution_id', '')::uuid,
    coalesce(new.raw_user_meta_data->>'role', 'lecturer')
  );
  return new;
end;
$$;

revoke execute on function public.handle_new_user() from public, anon, authenticated;

alter table public.progress add column if not exists student_id uuid references auth.users(id) on delete cascade;

create unique index if not exists progress_student_module_uniq
  on public.progress(student_id, course_id, module_id) where student_id is not null;

drop policy if exists "progress insert by anyone" on public.progress;
drop policy if exists "progress select by anyone" on public.progress;
drop policy if exists "progress update by anyone" on public.progress;

create policy "students manage own progress" on public.progress
  for all using (auth.uid() = student_id) with check (auth.uid() = student_id);

create policy "lecturers view their course progress" on public.progress
  for select using (
    exists (
      select 1 from public.courses c
      where c.id = progress.course_id and c.lecturer_id = auth.uid()
    )
  );

-- ── Security hardening pass ─────────────────────────────────────────────────
-- Tighten courses/modules/slides/profiles from "readable by anyone" to real per-row
-- institution isolation, now that every real read path is authenticated.
drop policy if exists "courses readable by anyone" on public.courses;
create policy "courses readable within own institution" on public.courses
  for select using (
    exists (select 1 from public.profiles p where p.id = auth.uid() and p.institution_id = courses.institution_id)
  );

drop policy if exists "modules readable by anyone" on public.modules;
create policy "modules readable within own institution" on public.modules
  for select using (
    exists (
      select 1 from public.courses c join public.profiles p on p.institution_id = c.institution_id
      where c.id = modules.course_id and p.id = auth.uid()
    )
  );

drop policy if exists "slides readable by anyone" on public.slides;
create policy "slides readable within own institution" on public.slides
  for select using (
    exists (
      select 1 from public.modules m
      join public.courses c on c.id = m.course_id
      join public.profiles p on p.institution_id = c.institution_id
      where m.id = slides.module_id and p.id = auth.uid()
    )
  );

drop policy if exists "profiles readable by anyone" on public.profiles;
create policy "profiles readable within own institution" on public.profiles
  for select using (
    id = auth.uid()
    or exists (select 1 from public.profiles me where me.id = auth.uid() and me.institution_id = profiles.institution_id)
  );

-- Rate limiting substrate for the Gemini-calling Edge Functions — only ever touched via
-- the service-role key; RLS enabled with zero policies blocks all direct client access.
create table if not exists public.rate_limits (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  fn text not null,
  window_start timestamptz not null,
  count int not null default 1
);
create unique index if not exists rate_limits_user_fn_window_uniq on public.rate_limits(user_id, fn, window_start);
alter table public.rate_limits enable row level security;

-- ── Institution admin dashboard ──────────────────────────────────────────────
alter table public.profiles add column if not exists is_admin boolean not null default false;

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, name, institution, institution_id, role, is_admin)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'name', new.email),
    new.raw_user_meta_data->>'institution',
    nullif(new.raw_user_meta_data->>'institution_id', '')::uuid,
    coalesce(new.raw_user_meta_data->>'role', 'lecturer'),
    coalesce((new.raw_user_meta_data->>'is_admin')::boolean, false)
  );
  return new;
end;
$$;

revoke execute on function public.handle_new_user() from public, anon, authenticated;

create policy "admins manage institution profiles" on public.profiles
  for update using (
    exists (
      select 1 from public.profiles admin
      where admin.id = auth.uid() and admin.is_admin = true and admin.institution_id = profiles.institution_id
    )
  );

create policy "admins view institution progress" on public.progress
  for select using (
    exists (
      select 1 from public.profiles admin
      join public.courses c on c.institution_id = admin.institution_id
      where admin.id = auth.uid() and admin.is_admin = true and c.id = progress.course_id
    )
  );

create policy "admins view institution rate limits" on public.rate_limits
  for select using (
    exists (
      select 1 from public.profiles admin
      join public.profiles u on u.institution_id = admin.institution_id
      where admin.id = auth.uid() and admin.is_admin = true and u.id = rate_limits.user_id
    )
  );

-- ── Username-based auth (replaces email/password) ───────────────────────────
alter table public.profiles add column if not exists username text unique;

update public.profiles set username = lower(regexp_replace(name, '[^a-zA-Z0-9]+', '', 'g'))
  where username is null;

alter table public.profiles alter column username set not null;

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, name, institution, institution_id, role, is_admin, username)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'name', new.email),
    new.raw_user_meta_data->>'institution',
    nullif(new.raw_user_meta_data->>'institution_id', '')::uuid,
    coalesce(new.raw_user_meta_data->>'role', 'lecturer'),
    coalesce((new.raw_user_meta_data->>'is_admin')::boolean, false),
    new.raw_user_meta_data->>'username'
  );
  return new;
end;
$$;

revoke execute on function public.handle_new_user() from public, anon, authenticated;
