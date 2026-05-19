-- Add KYC review fields for admin-controlled status management
-- kyc_status: admin sets to 'approved' or 'changes_requested'
-- account_status: admin sets to 'active' when fully reviewed
-- admin_note: message shown to customer (e.g. "Dokument zu unscharf")
-- admin_reviewed_at: timestamp of last admin action

ALTER TABLE fiaon_applications
ADD COLUMN IF NOT EXISTS kyc_status VARCHAR DEFAULT 'pending',
ADD COLUMN IF NOT EXISTS account_status VARCHAR DEFAULT 'pending',
ADD COLUMN IF NOT EXISTS admin_note TEXT,
ADD COLUMN IF NOT EXISTS admin_reviewed_at TIMESTAMP;

CREATE INDEX IF NOT EXISTS idx_fiaon_applications_kyc_status
ON fiaon_applications (kyc_status);

CREATE INDEX IF NOT EXISTS idx_fiaon_applications_account_status
ON fiaon_applications (account_status);
