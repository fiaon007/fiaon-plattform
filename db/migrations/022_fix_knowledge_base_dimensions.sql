-- Migration: Fix knowledge_base vector dimensions
-- Description: Change from 1536 (OpenAI) to 384 (all-MiniLM-L6-v2)
-- This fixes the "expected 1536 dimensions" error

-- Drop existing index (will be recreated)
DROP INDEX IF EXISTS knowledge_base_embedding_idx;

-- Alter column type to 384 dimensions
ALTER TABLE knowledge_base 
  ALTER COLUMN embedding TYPE vector(384);

-- Recreate index with new dimensions
CREATE INDEX IF NOT EXISTS knowledge_base_embedding_idx 
  ON knowledge_base 
  USING ivfflat (embedding vector_cosine_ops) 
  WITH (lists = 100);

-- Add comment for documentation
COMMENT ON COLUMN knowledge_base.embedding IS 'Vector embedding using all-MiniLM-L6-v2 (384 dimensions)';
