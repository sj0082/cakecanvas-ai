-- Remove the insecure INSERT policy that allows anyone to create logs
DROP POLICY IF EXISTS "System can create logs" ON public.logs_audit;

-- Add a comment explaining the security measure
COMMENT ON TABLE public.logs_audit IS 'Audit logs table. INSERT operations are restricted to service_role only to prevent tampering. Use database triggers or edge functions with service_role credentials to create audit logs.';