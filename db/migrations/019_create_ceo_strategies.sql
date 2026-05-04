-- ============================================================================
-- CEO MIND-OS — Strategische Gedanken + KI-Analysen + Magic-Templates
-- Migration: 019_create_ceo_strategies.sql
-- Purpose:
--   Speichert alle "Brain-Dumps" aus dem Admin-Dashboard:
--     - Die rohe Idee (user_thought)
--     - Die KI-Analyse (Rückfrage, ROI-Check, Kategorie, Template)
--     - Den Status (active/done/failed/archived)
--     - Den Grund, falls die Idee verworfen/nicht umgesetzt wurde
--     - Verlinkte Ressourcen (Stellenportale, Vorlagen, externe Links)
-- ============================================================================

CREATE TABLE IF NOT EXISTS ceo_strategies (
  id              VARCHAR PRIMARY KEY,
  user_id         VARCHAR REFERENCES users(id) ON DELETE SET NULL,
  user_thought    TEXT NOT NULL,
  ai_analysis     JSONB,
  category        VARCHAR,
  status          VARCHAR NOT NULL DEFAULT 'active'
                    CHECK (status IN ('active','done','failed','archived')),
  failure_reason  TEXT,
  resources       JSONB,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS ceo_strategies_status_idx      ON ceo_strategies(status);
CREATE INDEX IF NOT EXISTS ceo_strategies_category_idx    ON ceo_strategies(category);
CREATE INDEX IF NOT EXISTS ceo_strategies_created_at_idx  ON ceo_strategies(created_at DESC);
CREATE INDEX IF NOT EXISTS ceo_strategies_user_id_idx     ON ceo_strategies(user_id);
