-- ============================================================================
-- AI TASKS - Enhanced Task Management for Admin Dashboard
-- ============================================================================
-- Adds AI-powered task management fields to team_todos table
-- ============================================================================

-- Add new columns to team_todos for AI Task Matrix
ALTER TABLE team_todos 
  ADD COLUMN IF NOT EXISTS client_name VARCHAR,
  ADD COLUMN IF NOT EXISTS client_package VARCHAR CHECK (client_package IN ('Starter', 'Pro', 'Ultra', 'High End')),
  ADD COLUMN IF NOT EXISTS task_type VARCHAR CHECK (task_type IN ('Limit-Erhöhung', 'Schufa-Klärung', 'Strategie-Call', 'System')),
  ADD COLUMN IF NOT EXISTS urgency_score INTEGER DEFAULT 50 CHECK (urgency_score >= 0 AND urgency_score <= 100),
  ADD COLUMN IF NOT EXISTS assigned_director_id VARCHAR REFERENCES users(id) ON DELETE SET NULL;

-- Update status check constraint to include new statuses
ALTER TABLE team_todos 
  DROP CONSTRAINT IF EXISTS team_todos_status_check;

ALTER TABLE team_todos 
  ADD CONSTRAINT team_todos_status_check 
  CHECK (status IN ('pending', 'in_progress', 'done', 'cancelled', 'open', 'waiting_for_client', 'resolved'));

-- Add index for urgency_score sorting
CREATE INDEX IF NOT EXISTS team_todos_urgency_idx ON team_todos(urgency_score DESC);

-- Add index for client_package filtering
CREATE INDEX IF NOT EXISTS team_todos_client_package_idx ON team_todos(client_package);

-- Add index for task_type filtering
CREATE INDEX IF NOT EXISTS team_todos_task_type_idx ON team_todos(task_type);

-- ============================================================================
-- MIGRATION COMPLETE
-- ============================================================================
