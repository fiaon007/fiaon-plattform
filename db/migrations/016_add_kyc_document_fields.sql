-- Add KYC document storage fields to fiaon_applications
ALTER TABLE fiaon_applications
ADD COLUMN IF NOT EXISTS bank_statement_pdf bytea,
ADD COLUMN IF NOT EXISTS id_card_pdf bytea,
ADD COLUMN IF NOT EXISTS documents_uploaded_at timestamp;

-- Add index for faster queries on document status
CREATE INDEX IF NOT EXISTS idx_fiaon_applications_documents 
ON fiaon_applications (ref) 
WHERE bank_statement_pdf IS NOT NULL OR id_card_pdf IS NOT NULL;
