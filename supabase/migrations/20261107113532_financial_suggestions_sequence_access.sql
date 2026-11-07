-- Supabase defaults may grant sequence usage separately from table permissions.
revoke all on sequence public.financial_data_suggestions_id_seq from public,anon,authenticated;
