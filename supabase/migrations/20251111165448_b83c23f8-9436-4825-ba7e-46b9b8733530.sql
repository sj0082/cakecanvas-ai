-- Drop existing policy that might be too permissive
DROP POLICY IF EXISTS "Only admins can manage admin emails" ON public.allowed_admin_emails;

-- Create explicit SELECT policy for admins only
CREATE POLICY "Only admins can view admin emails"
ON public.allowed_admin_emails
FOR SELECT
TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role));

-- Create explicit INSERT policy for admins only
CREATE POLICY "Only admins can add admin emails"
ON public.allowed_admin_emails
FOR INSERT
TO authenticated
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

-- Create explicit UPDATE policy for admins only
CREATE POLICY "Only admins can update admin emails"
ON public.allowed_admin_emails
FOR UPDATE
TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

-- Create explicit DELETE policy for admins only
CREATE POLICY "Only admins can delete admin emails"
ON public.allowed_admin_emails
FOR DELETE
TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role));