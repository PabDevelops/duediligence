-- Additive migration. Run after add_watchlist_pie.sql, before releasing the UI.
-- Keep watchlists and its unique (user_id, ticker) key unchanged.
begin;

create table if not exists public.watchlist_baskets (
  user_id text not null,
  name text not null check (name <> ''),
  created_at timestamptz not null default now(),
  primary key (user_id, name)
);

-- Preserve exact legacy names, including a literal "General" category.
insert into public.watchlist_baskets (user_id, name)
select distinct user_id::text, pie from public.watchlists
where pie is not null and pie <> ''
on conflict (user_id, name) do nothing;

alter table public.watchlist_baskets enable row level security;
drop policy if exists watchlist_baskets_read_own on public.watchlist_baskets;
create policy watchlist_baskets_read_own on public.watchlist_baskets
  for select to authenticated using (user_id = (select auth.uid())::text);
revoke all on public.watchlist_baskets from public, anon, authenticated;
grant select on public.watchlist_baskets to authenticated;
grant all on public.watchlist_baskets to service_role;

-- Only the authenticated server API calls this function using the service role.
-- A rename collision rolls back the entire operation instead of merging lists.
create or replace function public.change_watchlist_basket(
  p_user_id text, p_name text, p_new_name text default null
) returns void
language plpgsql security invoker set search_path = ''
as $$
begin
  if not exists (select 1 from public.watchlist_baskets where user_id = p_user_id and name = p_name)
     and not exists (select 1 from public.watchlists where user_id::text = p_user_id and pie = p_name) then
    raise exception 'Basket not found' using errcode = 'P0002';
  end if;

  if p_new_name is not null and p_new_name <> p_name then
    if exists (select 1 from public.watchlist_baskets where user_id = p_user_id and name = p_new_name)
       or exists (select 1 from public.watchlists where user_id::text = p_user_id and pie = p_new_name) then
      raise exception 'Basket already exists' using errcode = '23505';
    end if;
    insert into public.watchlist_baskets (user_id, name) values (p_user_id, p_new_name);
  end if;

  update public.watchlists set pie = p_new_name where user_id::text = p_user_id and pie = p_name;
  if p_new_name is distinct from p_name then
    delete from public.watchlist_baskets where user_id = p_user_id and name = p_name;
  end if;
end;
$$;

revoke all on function public.change_watchlist_basket(text, text, text) from public, anon, authenticated;
grant execute on function public.change_watchlist_basket(text, text, text) to service_role;

commit;
