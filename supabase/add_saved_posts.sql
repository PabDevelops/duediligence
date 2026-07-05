create table if not exists saved_posts (
  id bigint generated always as identity primary key,
  user_id uuid not null,
  slug text not null,
  created_at timestamptz not null default now(),
  unique (user_id, slug)
);
