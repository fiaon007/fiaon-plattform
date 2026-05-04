/**
 * ============================================================================
 * FORCE DATABASE RESET — NUCLEAR OPTION
 * ============================================================================
 * This script FORCES the knowledge_base table to use 384 dimensions.
 * It will DROP the existing table and recreate it from scratch.
 * 
 * WARNING: This deletes all existing knowledge data!
 * 
 * Run this script on server startup to ensure correct dimensions.
 * ============================================================================
 */

import { client } from '../db';
import { logger } from '../logger';

export async function forceKnowledgeBaseDimensionFix(): Promise<void> {
  try {
    logger.info('[DB-RESET] Starting nuclear knowledge_base dimension fix...');

    // Step 1: Check current dimension
    try {
      const checkResult = await client`
        SELECT column_name, data_type, udt_name
        FROM information_schema.columns
        WHERE table_name = 'knowledge_base' AND column_name = 'embedding'
      `;

      if (checkResult.length > 0) {
        const currentType = checkResult[0].udt_name || checkResult[0].data_type;
        logger.info(`[DB-RESET] Current embedding type: ${currentType}`);

        // If it's already vector(384), skip reset
        if (currentType.includes('384')) {
          logger.info('[DB-RESET] ✅ Knowledge Base dimension is already 384. Skipping reset.');
          return;
        }

        logger.warn(`[DB-RESET] ⚠️ Wrong dimension detected: ${currentType}. Proceeding with nuclear reset...`);
      }
    } catch (checkErr) {
      logger.warn('[DB-RESET] Could not check current dimension, proceeding with reset...');
    }

    // Step 2: DROP existing table
    logger.info('[DB-RESET] Dropping existing knowledge_base table...');
    await client`DROP TABLE IF EXISTS knowledge_base CASCADE`;
    logger.info('[DB-RESET] ✅ Table dropped successfully');

    // Step 3: CREATE new table with 384 dimensions
    logger.info('[DB-RESET] Creating new knowledge_base table with vector(384)...');
    await client`
      CREATE TABLE knowledge_base (
        id SERIAL PRIMARY KEY,
        content TEXT NOT NULL,
        embedding vector(384),
        metadata JSONB DEFAULT '{}',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `;
    logger.info('[DB-RESET] ✅ Table created with vector(384)');

    // Step 4: CREATE index for cosine similarity
    logger.info('[DB-RESET] Creating ivfflat index for vector search...');
    await client`
      CREATE INDEX knowledge_base_embedding_idx 
        ON knowledge_base 
        USING ivfflat (embedding vector_cosine_ops) 
        WITH (lists = 100)
    `;
    logger.info('[DB-RESET] ✅ Index created successfully');

    // Step 5: CREATE updated_at trigger
    logger.info('[DB-RESET] Creating updated_at trigger...');
    await client`
      CREATE OR REPLACE FUNCTION update_knowledge_base_updated_at()
      RETURNS TRIGGER AS $$
      BEGIN
        NEW.updated_at = CURRENT_TIMESTAMP;
        RETURN NEW;
      END;
      $$ LANGUAGE plpgsql
    `;

    await client`
      CREATE TRIGGER knowledge_base_updated_at_trigger
        BEFORE UPDATE ON knowledge_base
        FOR EACH ROW
        EXECUTE FUNCTION update_knowledge_base_updated_at()
    `;
    logger.info('[DB-RESET] ✅ Trigger created successfully');

    // Step 6: Add helpful comments
    await client`
      COMMENT ON TABLE knowledge_base IS 'JARVIS Brain-Link knowledge storage with 384-dimensional embeddings (all-MiniLM-L6-v2)'
    `;
    await client`
      COMMENT ON COLUMN knowledge_base.embedding IS 'Vector embedding using all-MiniLM-L6-v2 (384 dimensions)'
    `;

    // Step 7: Verify final dimension
    const verifyResult = await client`
      SELECT column_name, data_type, udt_name
      FROM information_schema.columns
      WHERE table_name = 'knowledge_base' AND column_name = 'embedding'
    `;

    if (verifyResult.length > 0) {
      const finalType = verifyResult[0].udt_name || verifyResult[0].data_type;
      logger.info(`[DB-RESET] ✅ Final verification: embedding type is ${finalType}`);
      
      if (finalType.includes('384')) {
        logger.info('[DB-RESET] ✅✅✅ SUCCESS! Knowledge Base dimension is now 384');
      } else {
        logger.error(`[DB-RESET] ❌ FAILED! Dimension is still ${finalType}`);
      }
    }

    logger.info('[DB-RESET] Nuclear reset completed successfully');
  } catch (error: any) {
    logger.error(`[DB-RESET] ❌ Nuclear reset failed: ${error?.message || error}`);
    throw error;
  }
}

/**
 * Verify knowledge base dimension without resetting
 */
export async function verifyKnowledgeBaseDimension(): Promise<void> {
  try {
    const result = await client`
      SELECT column_name, data_type, udt_name
      FROM information_schema.columns
      WHERE table_name = 'knowledge_base' AND column_name = 'embedding'
    `;

    if (result.length > 0) {
      const dimensionType = result[0].udt_name || result[0].data_type;
      
      if (dimensionType.includes('384')) {
        logger.info('[DB-CHECK] ✅ Knowledge Base dimension is 384');
      } else {
        logger.error(`[DB-CHECK] ❌ Wrong dimension: ${dimensionType} (expected vector(384))`);
        logger.error('[DB-CHECK] Run force-db-reset to fix this issue');
      }
    } else {
      logger.warn('[DB-CHECK] ⚠️ knowledge_base table does not exist');
    }
  } catch (error: any) {
    logger.error(`[DB-CHECK] Error verifying dimension: ${error?.message || error}`);
  }
}
