-- Admin can specify which documents need re-upload
-- reupload_bank_statement: admin requests new bank statement
-- reupload_id_card: admin requests new ID card

ALTER TABLE fiaon_applications
ADD COLUMN IF NOT EXISTS reupload_bank_statement BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS reupload_id_card BOOLEAN DEFAULT false;
