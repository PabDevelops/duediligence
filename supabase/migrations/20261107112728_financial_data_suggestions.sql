-- Server-mediated suggestions. No client grants or public row policies.
create table public.financial_data_suggestions (
 id bigint generated always as identity primary key,
 reporter uuid references auth.users(id) on delete set null,
 ticker text not null check(ticker ~ '^[A-Z0-9][A-Z0-9.\^=-]{0,24}$'),
 target text not null check(length(target) between 1 and 100),
 label text not null check(length(label) between 1 and 180),
 observed_value double precision check(observed_value is null or (observed_value > '-Infinity'::float8 and observed_value < 'Infinity'::float8 and abs(observed_value)<=1e18)),
 observed_metadata jsonb not null check(jsonb_typeof(observed_metadata)='object' and octet_length(observed_metadata::text)<=8192),
 proposed_value double precision check(proposed_value is null or (proposed_value > '-Infinity'::float8 and proposed_value < 'Infinity'::float8 and abs(proposed_value)<=1e18)),
 proposed_metadata jsonb not null check(jsonb_typeof(proposed_metadata)='object' and octet_length(proposed_metadata::text)<=8192),
 reason text not null check(length(reason) between 8 and 1000),
 status text not null default 'pending' check(status in ('pending','accepted','rejected')),
 created_at timestamptz not null default now(),
 reviewed_by uuid references auth.users(id) on delete set null,
 reviewed_at timestamptz,
 review_note text check(length(review_note)<=1000),
 applied_target text,
 reviewed_value double precision,
 reviewed_metadata jsonb,
 override_revision_id bigint references public.financial_override_revisions(id)
);
create index financial_suggestions_queue on public.financial_data_suggestions(status,id desc);
create index financial_suggestions_reporter on public.financial_data_suggestions(reporter,created_at desc);
create unique index financial_suggestions_pending_unique on public.financial_data_suggestions(reporter,ticker,target) where status='pending';
alter table public.financial_data_suggestions enable row level security;
revoke all on public.financial_data_suggestions from public,anon,authenticated;
grant select,insert,update on public.financial_data_suggestions to service_role;
grant usage,select on sequence public.financial_data_suggestions_id_seq to service_role;

create function public.submit_financial_suggestion(p_reporter uuid,p_ticker text,p_target text,p_label text,
 p_observed_value double precision,p_observed_metadata jsonb,p_proposed_value double precision,p_proposed_metadata jsonb,p_reason text)
returns bigint language plpgsql security invoker set search_path='' as $$
declare new_id bigint;
begin
 if p_reporter is null then raise exception 'Reporter required' using errcode='22023'; end if;
 perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('financial-suggestion:'||p_reporter::text,0));
 if (select count(*) from public.financial_data_suggestions where reporter=p_reporter and created_at>now()-interval '24 hours')>=10 then
  raise exception 'suggestion_rate_limit' using errcode='P0001';
 end if;
 insert into public.financial_data_suggestions(reporter,ticker,target,label,observed_value,observed_metadata,proposed_value,proposed_metadata,reason)
 values(p_reporter,p_ticker,p_target,p_label,p_observed_value,p_observed_metadata,p_proposed_value,p_proposed_metadata,p_reason) returning id into new_id;
 return new_id;
end;
$$;
revoke all on function public.submit_financial_suggestion(uuid,text,text,text,double precision,jsonb,double precision,jsonb,text) from public,anon,authenticated;
grant execute on function public.submit_financial_suggestion(uuid,text,text,text,double precision,jsonb,double precision,jsonb,text) to service_role;

create function public.review_financial_suggestion(p_id bigint,p_actor uuid,p_action text,p_note text,
 p_target text,p_value double precision,p_metadata jsonb,p_expected_id bigint)
returns bigint language plpgsql security invoker set search_path='' as $$
declare suggestion public.financial_data_suggestions%rowtype; revision_id bigint;
begin
 if p_actor is null then raise exception 'Reviewer required' using errcode='22023'; end if;
 if p_action is null or p_action not in ('accepted','rejected') then raise exception 'Invalid action' using errcode='22023'; end if;
 select * into suggestion from public.financial_data_suggestions where id=p_id for update;
 if not found then raise exception 'Suggestion not found' using errcode='P0002'; end if;
 if suggestion.status<>'pending' then raise exception 'Already reviewed' using errcode='40001'; end if;
 if p_action='accepted' then
  revision_id:=public.set_financial_override(suggestion.ticker,p_target,p_value,p_metadata,true,p_actor,p_expected_id);
 end if;
 update public.financial_data_suggestions set status=p_action,reviewed_by=p_actor,reviewed_at=now(),review_note=p_note,
  applied_target=case when p_action='accepted' then p_target end,
  reviewed_value=case when p_action='accepted' then p_value end,
  reviewed_metadata=case when p_action='accepted' then p_metadata end,
  override_revision_id=revision_id where id=p_id;
 return revision_id;
end;
$$;
revoke all on function public.review_financial_suggestion(bigint,uuid,text,text,text,double precision,jsonb,bigint) from public,anon,authenticated;
grant execute on function public.review_financial_suggestion(bigint,uuid,text,text,text,double precision,jsonb,bigint) to service_role;
