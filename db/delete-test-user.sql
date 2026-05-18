-- Delete test user Max Mustermann (test@fiaon.com)
-- Run this in your database to remove the test data

DELETE FROM fiaon_applications 
WHERE email = 'test@fiaon.com';

-- Verify deletion
SELECT COUNT(*) as deleted_rows FROM fiaon_applications WHERE email = 'test@fiaon.com';
