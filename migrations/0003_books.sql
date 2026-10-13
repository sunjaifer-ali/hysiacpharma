create table if not exists shop_books (
  id text primary key,
  data jsonb not null,
  updated_at timestamptz not null default now(),
  updated_by text not null default ''
);
