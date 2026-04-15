-- ============================================================================
-- ADD PASSWORD FIELD TO FIAON_APPLICATIONS
-- Migration: 014_add_password_field.sql
-- Purpose: Add password field for user login after application completion
-- ============================================================================

-- Add password field to fiaon_applications table
ALTER TABLE fiaon_applications 
ADD COLUMN IF NOT EXISTS password VARCHAR;

-- ============================================================================
-- DONE
-- ============================================================================
