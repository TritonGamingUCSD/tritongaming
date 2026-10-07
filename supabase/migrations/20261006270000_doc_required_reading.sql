-- Required reading: a doc can be required for some roles; opening it counts as read, and editors see who has and has not.
create table public.doc_required_roles (
  doc_id uuid not null references public.docs(id) on delete cascade,
  role text not null check (role in ('officer', 'lead', 'division', 'exec')),
  primary key (doc_id, role)
);
create table public.doc_reads (
  doc_id uuid not null references public.docs(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  read_at timestamptz not null default now(),
  primary key (doc_id, user_id)
);
create index doc_reads_user_idx on public.doc_reads (user_id);
alter table public.doc_required_roles enable row level security;
alter table public.doc_reads enable row level security;   -- the routes use the service role; nobody reads these directly
