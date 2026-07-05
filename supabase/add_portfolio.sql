create table if not exists portfolio_holdings (
  id bigint generated always as identity primary key,
  user_id uuid not null,
  ticker text not null,
  shares numeric not null check (shares > 0),
  cost_basis numeric not null check (cost_basis >= 0),
  purchase_date date not null default current_date,
  pie text,
  cost_basis_currency text not null default 'USD',
  created_at timestamptz not null default now()
);

create index if not exists portfolio_holdings_user_id_idx on portfolio_holdings (user_id);

-- Run this if the table already existed before the `pie` column was added:
-- alter table portfolio_holdings add column if not exists pie text;

-- Run this if the table already existed before the `cost_basis_currency` column was added:
-- alter table portfolio_holdings add column if not exists cost_basis_currency text not null default 'USD';

create table if not exists portfolio_snapshots (
  id bigint generated always as identity primary key,
  user_id uuid not null,
  date date not null,
  value numeric not null,
  cost numeric not null,
  created_at timestamptz not null default now(),
  unique (user_id, date)
);

create index if not exists portfolio_snapshots_user_id_idx on portfolio_snapshots (user_id, date);
