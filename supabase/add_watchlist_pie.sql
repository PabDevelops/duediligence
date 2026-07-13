-- Optional grouping label for watchlist entries, same idea as portfolio_holdings.pie —
-- null/empty means "General" (the default, ungrouped list).
alter table watchlists add column if not exists pie text;
