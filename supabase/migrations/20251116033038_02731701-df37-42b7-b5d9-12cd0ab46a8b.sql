-- Migration: Add QuickBooks and contact fields to requests table

-- Add new columns to requests table
ALTER TABLE requests 
ADD COLUMN IF NOT EXISTS contact_name TEXT,
ADD COLUMN IF NOT EXISTS customer_notes TEXT,
ADD COLUMN IF NOT EXISTS selected_proposal_id UUID REFERENCES proposals(id),
ADD COLUMN IF NOT EXISTS qbo_estimate_id TEXT,
ADD COLUMN IF NOT EXISTS qbo_estimate_url TEXT,
ADD COLUMN IF NOT EXISTS qbo_sync_status TEXT DEFAULT 'pending';

-- Add indexes for faster lookups
CREATE INDEX IF NOT EXISTS idx_requests_selected_proposal ON requests(selected_proposal_id);
CREATE INDEX IF NOT EXISTS idx_requests_qbo_status ON requests(qbo_sync_status);

-- Add comments for documentation
COMMENT ON COLUMN requests.contact_name IS 'Customer full name for QuickBooks';
COMMENT ON COLUMN requests.customer_notes IS 'Additional customer notes/special requests';
COMMENT ON COLUMN requests.selected_proposal_id IS 'Selected proposal for QuickBooks estimate';
COMMENT ON COLUMN requests.qbo_estimate_id IS 'QuickBooks Estimate ID';
COMMENT ON COLUMN requests.qbo_estimate_url IS 'QuickBooks Estimate URL';
COMMENT ON COLUMN requests.qbo_sync_status IS 'Status: pending, synced, failed';