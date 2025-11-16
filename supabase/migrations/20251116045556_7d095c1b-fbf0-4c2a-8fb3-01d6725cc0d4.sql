-- Add Stripe-related columns to requests table
ALTER TABLE requests
ADD COLUMN IF NOT EXISTS stripe_checkout_session_id TEXT,
ADD COLUMN IF NOT EXISTS stripe_payment_status TEXT DEFAULT 'pending',
ADD COLUMN IF NOT EXISTS stripe_payment_intent_id TEXT,
ADD COLUMN IF NOT EXISTS payment_amount INTEGER DEFAULT 3000; -- $30.00 in cents

-- Add index for faster lookups
CREATE INDEX IF NOT EXISTS idx_requests_stripe_session_id ON requests(stripe_checkout_session_id);
CREATE INDEX IF NOT EXISTS idx_requests_stripe_payment_status ON requests(stripe_payment_status);