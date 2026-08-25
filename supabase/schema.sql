-- FL Projects — private job bidding for invited tradesmen
-- Run this in the Supabase SQL editor on a fresh project.

create extension if not exists "pgcrypto";

-- Invited tradesmen / trade crews (the closed pool FL Projects works with)
create table tradesmen (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  trade text, -- e.g. 'electrical', 'plumbing', 'masonry', 'painting', 'HVAC'
  contact_email text,
  contact_phone text,
  created_at timestamptz not null default now()
);

-- Extends auth.users with a role and, for tradesman users, which tradesman record they are
create table profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  role text not null check (role in ('client','company')),
  tradesman_id uuid references tradesmen(id) on delete set null,
  full_name text,
  created_at timestamptz not null default now()
);

create table jobs (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references auth.users(id) on delete cascade,
  title text not null,
  description text,
  site text, -- the hotel property the work is for, e.g. 'Round Hill Hotel'
  budget_range text,
  timeline text,
  status text not null default 'open' check (status in ('open','awarded','closed')),
  created_at timestamptz not null default now()
);

-- Which tradesmen can see a given job (invite-only visibility)
create table job_invites (
  id uuid primary key default gen_random_uuid(),
  job_id uuid not null references jobs(id) on delete cascade,
  tradesman_id uuid not null references tradesmen(id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (job_id, tradesman_id)
);

create table bids (
  id uuid primary key default gen_random_uuid(),
  job_id uuid not null references jobs(id) on delete cascade,
  tradesman_id uuid not null references tradesmen(id) on delete cascade,
  amount numeric,
  notes text,
  status text not null default 'pending' check (status in ('pending','accepted','rejected')),
  created_at timestamptz not null default now(),
  unique (job_id, tradesman_id) -- one bid per tradesman per job
);

-- ---------- Row Level Security ----------

alter table tradesmen enable row level security;
alter table profiles enable row level security;
alter table jobs enable row level security;
alter table job_invites enable row level security;
alter table bids enable row level security;

-- profiles: a user can read/update only their own profile
create policy "profiles are self-readable"
  on profiles for select
  using (auth.uid() = id);

create policy "profiles are self-updatable"
  on profiles for update
  using (auth.uid() = id);

-- tradesmen: any authenticated user can read the roster
-- (needed so a tradesman user can resolve their own name, and the owner can pick invitees)
create policy "authenticated users can read tradesmen"
  on tradesmen for select
  to authenticated
  using (true);

-- jobs: the owner sees their own jobs; a tradesman sees jobs they've been invited to
create policy "clients read own jobs"
  on jobs for select
  using (auth.uid() = client_id);

create policy "invited tradesmen read jobs"
  on jobs for select
  using (
    exists (
      select 1 from job_invites ji
      join profiles p on p.tradesman_id = ji.tradesman_id
      where ji.job_id = jobs.id and p.id = auth.uid()
    )
  );

create policy "clients insert own jobs"
  on jobs for insert
  with check (auth.uid() = client_id);

create policy "clients update own jobs"
  on jobs for update
  using (auth.uid() = client_id);

-- job_invites: visible to the job's owner, and to the invited tradesman's user
create policy "clients read invites on own jobs"
  on job_invites for select
  using (
    exists (select 1 from jobs j where j.id = job_invites.job_id and j.client_id = auth.uid())
  );

create policy "tradesmen read their own invites"
  on job_invites for select
  using (
    exists (select 1 from profiles p where p.id = auth.uid() and p.tradesman_id = job_invites.tradesman_id)
  );

create policy "clients manage invites on own jobs"
  on job_invites for insert
  with check (
    exists (select 1 from jobs j where j.id = job_invites.job_id and j.client_id = auth.uid())
  );

create policy "clients delete invites on own jobs"
  on job_invites for delete
  using (
    exists (select 1 from jobs j where j.id = job_invites.job_id and j.client_id = auth.uid())
  );

-- bids: the owner on the job and the bidding tradesman can read; only an invited tradesman can insert
create policy "clients read bids on own jobs"
  on bids for select
  using (
    exists (select 1 from jobs j where j.id = bids.job_id and j.client_id = auth.uid())
  );

create policy "tradesmen read own bids"
  on bids for select
  using (
    exists (select 1 from profiles p where p.id = auth.uid() and p.tradesman_id = bids.tradesman_id)
  );

create policy "invited tradesmen insert bids"
  on bids for insert
  with check (
    exists (
      select 1 from profiles p
      join job_invites ji on ji.tradesman_id = p.tradesman_id
      where p.id = auth.uid() and ji.job_id = bids.job_id and p.tradesman_id = bids.tradesman_id
    )
  );

create policy "clients update bids on own jobs"
  on bids for update
  using (
    exists (select 1 from jobs j where j.id = bids.job_id and j.client_id = auth.uid())
  );
