-- Create trigger function to automatically assign admin role to allowed emails
CREATE OR REPLACE FUNCTION public.handle_new_user_admin_role()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Check if the new user's email is in allowed_admin_emails
  IF EXISTS (
    SELECT 1 
    FROM public.allowed_admin_emails
    WHERE email = NEW.email 
    AND is_active = true
  ) THEN
    -- Automatically grant admin role
    INSERT INTO public.user_roles (user_id, role)
    VALUES (NEW.id, 'admin'::app_role)
    ON CONFLICT (user_id, role) DO NOTHING;
  END IF;
  
  RETURN NEW;
END;
$$;

-- Create trigger on auth.users to run the function after insert
DROP TRIGGER IF EXISTS on_auth_user_created_assign_admin ON auth.users;
CREATE TRIGGER on_auth_user_created_assign_admin
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user_admin_role();

-- Grant admin role to existing users who are in allowed_admin_emails
INSERT INTO public.user_roles (user_id, role)
SELECT 
  au.id,
  'admin'::app_role
FROM auth.users au
INNER JOIN public.allowed_admin_emails aae ON au.email = aae.email
WHERE aae.is_active = true
ON CONFLICT (user_id, role) DO NOTHING;