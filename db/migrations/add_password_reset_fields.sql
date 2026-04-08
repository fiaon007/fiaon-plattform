-- Migration: Add password reset fields to users table
-- Created: 2025-01-XX

-- Add password reset token field
ALTER TABLE users ADD COLUMN IF NOT EXISTS password_reset_token VARCHAR(255);

-- Add password reset expiration field
ALTER TABLE users ADD COLUMN IF NOT EXISTS password_reset_expires TIMESTAMP;

-- Create index for faster token lookups
CREATE INDEX IF NOT EXISTS idx_users_password_reset_token ON users(password_reset_token);
