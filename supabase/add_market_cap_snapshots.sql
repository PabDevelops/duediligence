-- One row per ticker per day, tracking which market-cap tier (lib/marketCap.js) it fell
-- into that day. Powers the Small & Micro Cap Radar's "Tier Migration" module: comparing
-- today's row against the nearest one ~30 days back tells us who moved between tiers.
-- Populated by app/api/admin/refresh-small-cap-radar/route.js (daily cron), not by user traffic.
create table if not exists market_cap_snapshots (
  id bigint generated always as identity primary key,
  ticker text not null,
  date date not null,
  market_cap numeric,
  cap_tier text,
  created_at timestamptz not null default now(),
  unique (ticker, date)
);

create index if not exists market_cap_snapshots_ticker_date_idx on market_cap_snapshots (ticker, date);

-- Server-only table (written by the daily cron via the service-role client, which bypasses
-- RLS entirely) — no policies needed, same locked-down-by-default posture as every other
-- table in this schema.
alter table market_cap_snapshots enable row level security;
