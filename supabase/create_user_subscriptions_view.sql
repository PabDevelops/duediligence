-- SQL View to easily see registered users, their emails, subscription status, and Pro access in Supabase Studio.
-- Copy and run this in your Supabase SQL Editor.

CREATE OR REPLACE VIEW public.user_subscriptions 
WITH (security_invoker = on) AS
SELECT 
  u.id AS user_id,
  u.email,
  u.created_at AS user_created_at,
  s.status AS subscription_status,
  s.manual_override AS subscription_manual_override,
  (
    COALESCE(s.manual_override, false) = true 
    OR s.status IN ('active', 'trialing')
  ) AS is_pro
FROM auth.users u
LEFT JOIN public.subscriptions s ON u.id::text = s.user_id;

-- Grant select permission to the service role (dashboard editor) and authenticated queries
GRANT SELECT ON public.user_subscriptions TO authenticated;
GRANT SELECT ON public.user_subscriptions TO service_role;
