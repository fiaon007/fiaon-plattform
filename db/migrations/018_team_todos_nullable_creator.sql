-- ============================================================================
-- TEAM TODOS: created_by_user_id nullable machen
-- Migration: 018_team_todos_nullable_creator.sql
-- Purpose: Erlaubt System-/Admin-/n8n-erstellte Todos ohne eingeloggten User.
-- ============================================================================

ALTER TABLE team_todos
  ALTER COLUMN created_by_user_id DROP NOT NULL;

-- Optional: also drop NOT NULL on title (some system todos only have client_name)
-- ALTER TABLE team_todos ALTER COLUMN title DROP NOT NULL;
