create table if not exists staff_account (
  id text primary key,
  username text not null unique,
  password_hash text not null,
  role text not null check (role in ('admin', 'billing')),
  created_at timestamptz not null default now()
);

create table if not exists staff_session (
  token text primary key,
  user_id text not null references staff_account(id) on delete cascade,
  expires_at timestamptz not null
);
