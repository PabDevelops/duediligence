-- Additive and opt-in. No hosted migration is executed by this file.
create table public.financial_override_revisions (
  id bigint generated always as identity primary key,
  ticker text not null check (ticker ~ '^[A-Z0-9][A-Z0-9.\^=-]{0,24}$'),
  target text not null check (length(target) between 1 and 100),
  value double precision check (value is null or (value > '-Infinity'::float8 and value < 'Infinity'::float8 and abs(value) <= 1e18)),
  metadata jsonb not null default '{}' check (jsonb_typeof(metadata) = 'object'),
  active boolean not null,
  actor uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);
create index financial_override_latest on public.financial_override_revisions(ticker,target,id desc);
alter table public.financial_override_revisions enable row level security;
revoke all on public.financial_override_revisions from public,anon,authenticated;
grant select,insert on public.financial_override_revisions to service_role;
grant usage,select on sequence public.financial_override_revisions_id_seq to service_role;

create view public.current_financial_overrides with (security_invoker = true) as
  select distinct on(ticker,target) id,ticker,target,value,metadata,active,created_at
  from public.financial_override_revisions order by ticker,target,id desc;
revoke all on public.current_financial_overrides from public,anon,authenticated;
grant select on public.current_financial_overrides to service_role;

create function public.set_financial_override(p_ticker text,p_target text,p_value double precision,
  p_metadata jsonb,p_active boolean,p_actor uuid,p_expected_id bigint)
returns bigint language plpgsql security invoker set search_path = '' as $$
declare current_id bigint; new_id bigint;
begin
  if p_actor is null or p_expected_id is null then raise exception 'Actor and revision required' using errcode='22023'; end if;
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(p_ticker || ':' || p_target,0));
  select id into current_id from public.financial_override_revisions
    where ticker=p_ticker and target=p_target order by id desc limit 1;
  if coalesce(current_id,0) <> p_expected_id then
    raise exception 'Concurrent correction' using errcode='40001';
  end if;
  insert into public.financial_override_revisions(ticker,target,value,metadata,active,actor)
    values(p_ticker,p_target,p_value,p_metadata,p_active,p_actor) returning id into new_id;
  return new_id;
end;
$$;
revoke all on function public.set_financial_override(text,text,double precision,jsonb,boolean,uuid,bigint) from public,anon,authenticated;
grant execute on function public.set_financial_override(text,text,double precision,jsonb,boolean,uuid,bigint) to service_role;
