-- Remove the insecure INSERT policy that allows anyone to create logs
DROP POLICY IF EXISTS "System can create logs" ON public.logs_audit;

-- Create a more secure INSERT policy that only allows service role
-- Regular users and anonymous users cannot insert audit logs
CREATE POLICY "Only service role can create logs"
ON public.logs_audit
FOR INSERT
TO service_role
WITH CHECK (true);

-- Ensure the table still has proper SELECT policy for admins
-- (This already exists but we're being explicit)
DROP POLICY IF EXISTS "Admins can view logs" ON public.logs_audit;

CREATE POLICY "Admins can view logs"
ON public.logs_audit
FOR SELECT
USING (has_role(auth.uid(), 'admin'));

-- Add a comment explaining the security measure
COMMENT ON TABLE public.logs_audit IS 'Audit logs table. INSERT operations are restricted to service_role only to prevent tampering. Use database triggers or edge functions with service_role credentials to create audit logs.';