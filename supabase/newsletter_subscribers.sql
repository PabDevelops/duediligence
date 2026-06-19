create table if not exists newsletter_subscribers (
  id bigint generated always as identity primary key,
  email text unique not null,
  source text not null default 'landing',
  created_at timestamptz not null default now()
);
