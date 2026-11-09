-- A reservation is charged even if its provider request fails or times out.
-- No browser role can allocate, reset or read the shared budget.
create table public.ai_translation_usage (
 id uuid primary key default gen_random_uuid(),
 day date not null default (now() at time zone 'UTC')::date,
 user_id uuid references auth.users(id) on delete set null,
 source_hash text not null check (source_hash ~ '^[0-9a-f]{64}$'),
 status text not null default 'reserved' check (status in ('reserved','completed','failed')),
 input_tokens integer check (input_tokens >= 0),
 output_tokens integer check (output_tokens >= 0),
 created_at timestamptz not null default now(),
 unique(day,source_hash)
);
alter table public.ai_translation_usage enable row level security;
revoke all on public.ai_translation_usage from public,anon,authenticated;
grant select,insert,update on public.ai_translation_usage to service_role;

create function public.reserve_ai_translation(p_user_id uuid,p_source_hash text)
returns uuid language plpgsql security invoker set search_path = '' as $$
declare
 v_day date := (now() at time zone 'UTC')::date;
 v_id uuid;
begin
 if p_user_id is null or p_source_hash is null or p_source_hash !~ '^[0-9a-f]{64}$' then return null; end if;
 if not exists(select 1 from auth.users where id=p_user_id and coalesce(is_anonymous,false)=false and (email_confirmed_at is not null or phone_confirmed_at is not null)) then return null; end if;
 -- Serialize across all instances before counting and reserving. Never an
 -- in-memory counter or a read-then-write race between serverless instances.
 perform pg_catalog.pg_advisory_xact_lock(826104921);
 if (select count(*) from public.ai_translation_usage where day=v_day)>=50 then return null; end if;
 if (select count(*) from public.ai_translation_usage where day=v_day and user_id=p_user_id)>=5 then return null; end if;
 insert into public.ai_translation_usage(day,user_id,source_hash)
 values(v_day,p_user_id,p_source_hash) on conflict(day,source_hash) do nothing returning id into v_id;
 return v_id;
end;
$$;
revoke all on function public.reserve_ai_translation(uuid,text) from public,anon,authenticated;
grant execute on function public.reserve_ai_translation(uuid,text) to service_role;
