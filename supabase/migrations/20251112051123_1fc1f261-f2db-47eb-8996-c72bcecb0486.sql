-- Drop existing policies
DROP POLICY IF EXISTS "Users can view their own profile" ON public.profiles;
DROP POLICY IF EXISTS "Users can update their own profile" ON public.profiles;

-- Create more restrictive policies that explicitly target authenticated users
CREATE POLICY "Authenticated users can view only their own profile"
ON public.profiles
FOR SELECT
TO authenticated
USING (auth.uid() = id);

CREATE POLICY "Authenticated users can update only their own profile"
ON public.profiles
FOR UPDATE
TO authenticated
USING (auth.uid() = id)
WITH CHECK (auth.uid() = id);

-- Explicitly deny all access to unauthenticated users
CREATE POLICY "Deny all access to anonymous users"
ON public.profiles
FOR ALL
TO anon
USING (false);