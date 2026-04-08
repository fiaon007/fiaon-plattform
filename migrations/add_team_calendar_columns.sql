-- ============================================================================
-- SAFE MIGRATION: Add missing columns to team_calendar
-- Run with: psql "$DATABASE_URL" -f migrations/add_team_calendar_columns.sql
-- ============================================================================

BEGIN;

-- 1. Add ends_at column (if not exists) - maps to schema.endsAt
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' AND table_name = 'team_calendar' AND column_name = 'ends_at') 
  THEN
    ALTER TABLE public.team_calendar ADD COLUMN ends_at timestamptz;
    -- Copy data from end_at if it exists
    UPDATE public.team_calendar SET ends_at = end_at WHERE end_at IS NOT NULL;
  END IF;
END $$;

-- 2. Add all_day column
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' AND table_name = 'team_calendar' AND column_name = 'all_day') 
  THEN
    ALTER TABLE public.team_calendar ADD COLUMN all_day boolean DEFAULT false;
  END IF;
END $$;

-- 3. Add color column
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' AND table_name = 'team_calendar' AND column_name = 'color') 
  THEN
    ALTER TABLE public.team_calendar ADD COLUMN color varchar(50) DEFAULT '#FE9100';
  END IF;
END $$;

-- 4. Add event_type column
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' AND table_name = 'team_calendar' AND column_name = 'event_type') 
  THEN
    ALTER TABLE public.team_calendar ADD COLUMN event_type varchar(50) DEFAULT 'INTERN';
  END IF;
END $$;

-- 5. Add is_read_only column
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' AND table_name = 'team_calendar' AND column_name = 'is_read_only') 
  THEN
    ALTER TABLE public.team_calendar ADD COLUMN is_read_only boolean DEFAULT false;
  END IF;
END $$;

-- 6. Add visibility column
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' AND table_name = 'team_calendar' AND column_name = 'visibility') 
  THEN
    ALTER TABLE public.team_calendar ADD COLUMN visibility varchar(20) DEFAULT 'TEAM';
  END IF;
END $$;

-- 7. Add recurrence column (JSONB for recurrence rules)
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' AND table_name = 'team_calendar' AND column_name = 'recurrence') 
  THEN
    ALTER TABLE public.team_calendar ADD COLUMN recurrence jsonb;
  END IF;
END $$;

-- 8. Add internal_notes column
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' AND table_name = 'team_calendar' AND column_name = 'internal_notes') 
  THEN
    ALTER TABLE public.team_calendar ADD COLUMN internal_notes text;
  END IF;
END $$;

-- 9. Add context_tags column (JSONB array)
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' AND table_name = 'team_calendar' AND column_name = 'context_tags') 
  THEN
    ALTER TABLE public.team_calendar ADD COLUMN context_tags jsonb;
  END IF;
END $$;

-- 10. Add created_by_user_id column
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' AND table_name = 'team_calendar' AND column_name = 'created_by_user_id') 
  THEN
    ALTER TABLE public.team_calendar ADD COLUMN created_by_user_id varchar(255);
    -- Copy from created_by if it exists
    UPDATE public.team_calendar SET created_by_user_id = created_by WHERE created_by IS NOT NULL;
  END IF;
END $$;

-- 11. Add updated_by_user_id column
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' AND table_name = 'team_calendar' AND column_name = 'updated_by_user_id') 
  THEN
    ALTER TABLE public.team_calendar ADD COLUMN updated_by_user_id varchar(255);
  END IF;
END $$;

-- 12. Create indexes for performance (IF NOT EXISTS)
CREATE INDEX IF NOT EXISTS team_calendar_starts_at_idx ON public.team_calendar (starts_at);
CREATE INDEX IF NOT EXISTS team_calendar_event_type_idx ON public.team_calendar (event_type);
CREATE INDEX IF NOT EXISTS team_calendar_created_by_user_id_idx ON public.team_calendar (created_by_user_id);

-- 13. Ensure team_calendar_participants table exists with all columns
CREATE TABLE IF NOT EXISTS public.team_calendar_participants (
  id bigserial PRIMARY KEY,
  event_id bigint NOT NULL REFERENCES public.team_calendar(id) ON DELETE CASCADE,
  user_id varchar(255) NOT NULL,
  role_label varchar(100),
  status varchar(20) DEFAULT 'pending',
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Add status column if missing
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' AND table_name = 'team_calendar_participants' AND column_name = 'status') 
  THEN
    ALTER TABLE public.team_calendar_participants ADD COLUMN status varchar(20) DEFAULT 'pending';
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS team_calendar_participants_event_idx ON public.team_calendar_participants (event_id);
CREATE INDEX IF NOT EXISTS team_calendar_participants_user_idx ON public.team_calendar_participants (user_id);

COMMIT;

-- Verify the changes
\echo '=== MIGRATION COMPLETE ==='
\echo 'New team_calendar schema:'
\d public.team_calendar
