-- ============================================================================
-- ADD BUSINESS APPLICATION FIELDS TO FIAON_APPLICATIONS
-- Migration: 013_add_business_application_fields.sql
-- Purpose: Add business-specific fields to support business applications
-- ============================================================================

-- Add business-specific fields to fiaon_applications table
ALTER TABLE fiaon_applications 
ADD COLUMN IF NOT EXISTS company_name VARCHAR,
ADD COLUMN IF NOT EXISTS legal_form VARCHAR,
ADD COLUMN IF NOT EXISTS tax_id VARCHAR,
ADD COLUMN IF NOT EXISTS established_year VARCHAR,
ADD COLUMN IF NOT EXISTS contact_name VARCHAR,
ADD COLUMN IF NOT EXISTS contact_email VARCHAR,
ADD COLUMN IF NOT EXISTS contact_phone VARCHAR,
ADD COLUMN IF NOT EXISTS business_type VARCHAR,
ADD COLUMN IF NOT EXISTS industry VARCHAR,
ADD COLUMN IF NOT EXISTS annual_revenue INTEGER,
ADD COLUMN IF NOT EXISTS employees INTEGER,
ADD COLUMN IF NOT EXISTS monthly_expenses INTEGER,
ADD COLUMN IF NOT EXISTS billing_email VARCHAR;

-- Add index for business applications
CREATE INDEX IF NOT EXISTS fiaon_app_type_idx ON fiaon_applications(type);

-- ============================================================================
-- DONE
-- ============================================================================
