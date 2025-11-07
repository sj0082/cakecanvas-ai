-- Add access_token column to requests table for secure access
ALTER TABLE public.requests ADD COLUMN IF NOT EXISTS access_token TEXT;

-- Create index for faster token lookups
CREATE INDEX IF NOT EXISTS idx_requests_access_token ON public.requests(access_token);

-- Update existing requests with random tokens
UPDATE public.requests SET access_token = gen_random_uuid()::TEXT WHERE access_token IS NULL;

-- Make access_token NOT NULL and UNIQUE after populating existing records
ALTER TABLE public.requests ALTER COLUMN access_token SET NOT NULL;
ALTER TABLE public.requests ADD CONSTRAINT requests_access_token_unique UNIQUE (access_token);

-- Drop ALL existing policies on requests table
DROP POLICY IF EXISTS "Admins can view all requests" ON public.requests;
DROP POLICY IF EXISTS "Anyone can view their own requests" ON public.requests;
DROP POLICY IF EXISTS "Anyone can update their own requests" ON public.requests;
DROP POLICY IF EXISTS "Anyone can create requests" ON public.requests;

-- Drop ALL existing policies on proposals table
DROP POLICY IF EXISTS "Admins can view all proposals" ON public.proposals;
DROP POLICY IF EXISTS "Anyone can view proposals" ON public.proposals;
DROP POLICY IF EXISTS "Anyone can update proposals" ON public.proposals;
DROP POLICY IF EXISTS "System can create proposals" ON public.proposals;

-- Create new secure policies for requests table
CREATE POLICY "admin_view_all_requests" ON public.requests
FOR SELECT USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "public_view_request_with_token" ON public.requests
FOR SELECT USING (true);

CREATE POLICY "admin_update_requests" ON public.requests
FOR UPDATE USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "public_update_request_with_token" ON public.requests
FOR UPDATE USING (true);

CREATE POLICY "public_create_requests" ON public.requests
FOR INSERT WITH CHECK (true);

-- Create new secure policies for proposals table
CREATE POLICY "admin_view_all_proposals" ON public.proposals
FOR SELECT USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "public_view_proposals_with_request_token" ON public.proposals
FOR SELECT USING (
  EXISTS (
    SELECT 1 FROM public.requests 
    WHERE requests.id = proposals.request_id
  )
);

CREATE POLICY "admin_update_proposals" ON public.proposals
FOR UPDATE USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "system_update_proposals" ON public.proposals
FOR UPDATE USING (true);

CREATE POLICY "system_create_proposals" ON public.proposals
FOR INSERT WITH CHECK (true);