-- Add Stripe subscription fields to fiaon_applications
ALTER TABLE fiaon_applications
ADD COLUMN IF NOT EXISTS stripe_customer_id varchar,
ADD COLUMN IF NOT EXISTS stripe_subscription_id varchar,
ADD COLUMN IF NOT EXISTS stripe_payment_method_id varchar;

-- Add indexes for faster Stripe lookups
CREATE INDEX IF NOT EXISTS idx_fiaon_applications_stripe_customer 
ON fiaon_applications (stripe_customer_id);

CREATE INDEX IF NOT EXISTS idx_fiaon_applications_stripe_subscription 
ON fiaon_applications (stripe_subscription_id);
