-- Remove all public RLS policies from requests table
DROP POLICY IF EXISTS "public_view_request_with_token" ON public.requests;
DROP POLICY IF EXISTS "public_update_request_with_token" ON public.requests;
DROP POLICY IF EXISTS "public_create_requests" ON public.requests;

-- Remove all public RLS policies from proposals table  
DROP POLICY IF EXISTS "public_view_proposals_with_request_token" ON public.proposals;
DROP POLICY IF EXISTS "system_update_proposals" ON public.proposals;
DROP POLICY IF EXISTS "system_create_proposals" ON public.proposals;

-- Keep only admin policies for both tables
-- Admin policies for requests already exist:
-- - admin_view_all_requests
-- - admin_update_requests

-- Admin policies for proposals already exist:
-- - admin_view_all_proposals
-- - admin_update_proposals