-- Enable RLS on requests table without adding any policies
-- This blocks all direct access via anon key
-- Only service role (used by Edge Functions) can access
ALTER TABLE public.requests ENABLE ROW LEVEL SECURITY;

-- Enable RLS on proposals table as well
ALTER TABLE public.proposals ENABLE ROW LEVEL SECURITY;

-- Keep only admin policies that use proper authentication
-- These are already in place:
-- - admin_view_all_requests (for admins only)
-- - admin_update_requests (for admins only)
-- - admin_view_all_proposals (for admins only)
-- - admin_update_proposals (for admins only)

-- No public policies = complete lockdown for anon key
-- Edge Functions bypass RLS using service role key