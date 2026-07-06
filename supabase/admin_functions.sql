-- SQL Functions to quickly grant or revoke PRO access using only the user's email.
-- Copy and run this in your Supabase SQL Editor once to register the functions.

-- 1. Function to make a user PRO: select make_pro('user@email.com');
CREATE OR REPLACE FUNCTION public.make_pro(target_email text)
RETURNS text AS $$
DECLARE
  target_uid uuid;
BEGIN
  -- Find user ID by email
  SELECT id INTO target_uid FROM auth.users WHERE email = LOWER(target_email);
  
  IF target_uid IS NULL THEN
    RETURN 'ERROR: User not found with email: ' || target_email;
  END IF;
  
  -- Insert or update subscriptions
  INSERT INTO public.subscriptions (user_id, status, manual_override, updated_at)
  VALUES (target_uid::text, 'active', true, now())
  ON CONFLICT (user_id) 
  DO UPDATE SET manual_override = true, status = 'active', updated_at = now();
  
  RETURN 'SUCCESS: ' || target_email || ' is now PRO';
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


-- 2. Function to remove PRO access: select remove_pro('user@email.com');
CREATE OR REPLACE FUNCTION public.remove_pro(target_email text)
RETURNS text AS $$
DECLARE
  target_uid uuid;
BEGIN
  -- Find user ID by email
  SELECT id INTO target_uid FROM auth.users WHERE email = LOWER(target_email);
  
  IF target_uid IS NULL THEN
    RETURN 'ERROR: User not found with email: ' || target_email;
  END IF;
  
  -- Update subscriptions table
  UPDATE public.subscriptions 
  SET manual_override = false, status = 'canceled', updated_at = now()
  WHERE user_id = target_uid::text;
  
  RETURN 'SUCCESS: PRO access revoked for ' || target_email;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
