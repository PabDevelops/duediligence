-- Session verification happens via auth.getUser() in the trusted server.
-- Keep this RPC service-role-only without granting it access to auth.users.
create or replace function public.reserve_ai_translation(p_user_id uuid,p_source_hash text)
returns uuid language plpgsql security invoker set search_path = '' as $$
declare
 v_day date := (now() at time zone 'UTC')::date;
 v_id uuid;
begin
 if p_user_id is null or p_source_hash is null or p_source_hash !~ '^[0-9a-f]{64}$' then return null; end if;
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
