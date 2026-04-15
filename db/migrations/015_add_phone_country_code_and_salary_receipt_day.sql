-- ============================================================================
-- ADD PHONE COUNTRY CODE AND SALARY RECEIPT DAY TO FIAON_APPLICATIONS
-- Migration: 015_add_phone_country_code_and_salary_receipt_day.sql
-- Purpose: Add phoneCountryCode and salaryReceiptDay fields for complete data storage
-- ============================================================================

-- Add phoneCountryCode field to fiaon_applications table
ALTER TABLE fiaon_applications 
ADD COLUMN IF NOT EXISTS phone_country_code VARCHAR;

-- Add salaryReceiptDay field to fiaon_applications table
ALTER TABLE fiaon_applications 
ADD COLUMN IF NOT EXISTS salary_receipt_day VARCHAR;

-- ============================================================================
-- DONE
-- ============================================================================
