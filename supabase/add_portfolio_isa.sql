-- ISA-style cash pot: a separate bucket inside the existing cash ledger that
-- accrues interest at a per-portfolio rate you set yourself, compounding daily.
-- `portfolios` and `portfolio_cash_ledger` predate this repo's migration files
-- (they were created directly in the Supabase dashboard), so these are plain
-- `alter table ... add column if not exists` statements against whatever
-- shape those tables already have. Safe to run more than once.

alter table portfolio_cash_ledger
  add column if not exists bucket text not null default 'main';

alter table portfolio_cash_ledger
  drop constraint if exists portfolio_cash_ledger_bucket_check;

alter table portfolio_cash_ledger
  add constraint portfolio_cash_ledger_bucket_check check (bucket in ('main', 'isa'));

alter table portfolios
  add column if not exists isa_interest_rate numeric;
