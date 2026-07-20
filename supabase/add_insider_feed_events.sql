-- Cross-ticker feed of SEC Form 4 insider transactions for small/micro cap names, powering
-- the Small & Micro Cap Radar's "Insider Activity Feed" module (cluster-buy detection etc.).
-- Populated two ways: (1) app/api/stock/route.js writes rows as a fire-and-forget side effect
-- whenever it does a full SEC refresh for a small/micro cap ticker (organic, traffic-driven);
-- (2) app/api/admin/refresh-small-cap-radar/route.js sweeps a rotating batch of already-known
-- small/micro tickers daily so the feed doesn't go stale for names nobody happens to view.
--
-- The unique key is the closest natural key lib/secInsiders.js's Form 4 parser gives us (SEC's
-- XML doesn't expose a stable per-transaction ID at this parsing level) — a same-day amendment
-- with identical shares silently no-ops on upsert rather than duplicating, which is acceptable.
create table if not exists insider_feed_events (
  id bigint generated always as identity primary key,
  ticker text not null,
  insider text not null,
  type text not null,
  shares numeric,
  price numeric,
  value numeric,
  date date not null,
  cap_tier text,
  is_officer boolean,
  is_director boolean,
  is_ten_percent_owner boolean,
  created_at timestamptz not null default now(),
  unique (ticker, insider, date, type, shares)
);

create index if not exists insider_feed_events_date_idx on insider_feed_events (date desc);
create index if not exists insider_feed_events_ticker_idx on insider_feed_events (ticker);

-- Server-only table (written by app/api/stock/route.js and the daily cron, both via the
-- service-role client, which bypasses RLS entirely) — no policies needed, same locked-down-
-- by-default posture as every other table in this schema.
alter table insider_feed_events enable row level security;
