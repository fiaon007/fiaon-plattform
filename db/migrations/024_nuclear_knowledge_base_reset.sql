-- ============================================================================
-- NUCLEAR RESET: knowledge_base with 384 dimensions
-- ============================================================================
-- This migration DROPS and recreates the knowledge_base table
-- Use this if dimension mismatch persists after ALTER TABLE attempts
-- WARNING: This will DELETE all existing knowledge base data
-- ============================================================================

-- Drop existing table and all dependencies
DROP TABLE IF EXISTS knowledge_base CASCADE;

-- Recreate table with correct 384 dimensions
CREATE TABLE knowledge_base (
  id SERIAL PRIMARY KEY,
  content TEXT NOT NULL,
  embedding vector(384),  -- all-MiniLM-L6-v2 (384 dimensions)
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create index for cosine similarity search
CREATE INDEX knowledge_base_embedding_idx 
  ON knowledge_base 
  USING ivfflat (embedding vector_cosine_ops) 
  WITH (lists = 100);

-- Create updated_at trigger
CREATE OR REPLACE FUNCTION update_knowledge_base_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = CURRENT_TIMESTAMP;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER knowledge_base_updated_at_trigger
  BEFORE UPDATE ON knowledge_base
  FOR EACH ROW
  EXECUTE FUNCTION update_knowledge_base_updated_at();

-- Add helpful comment
COMMENT ON TABLE knowledge_base IS 'JARVIS Brain-Link knowledge storage with 384-dimensional embeddings (all-MiniLM-L6-v2)';
COMMENT ON COLUMN knowledge_base.embedding IS 'Vector embedding using all-MiniLM-L6-v2 (384 dimensions)';
