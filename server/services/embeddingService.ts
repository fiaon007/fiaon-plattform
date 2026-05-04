import { pipeline, env } from '@xenova/transformers';
import { logger } from "../logger";

// Configure Xenova to use local cache and disable remote models in production
env.allowLocalModels = true;
env.allowRemoteModels = true;

// Use all-MiniLM-L6-v2 model (384 dimensions, fast, good quality)
const EMBEDDING_MODEL = "Xenova/all-MiniLM-L6-v2";
const EMBEDDING_DIMENSION = 384;
const MAX_CHUNK_SIZE = 512; // tokens (safe limit for transformer model)

// Lazy-load the embedding pipeline
let embeddingPipeline: any = null;

async function getEmbeddingPipeline() {
  if (!embeddingPipeline) {
    logger.info('[EMBEDDING] Loading open-source embedding model (all-MiniLM-L6-v2)...');
    embeddingPipeline = await pipeline('feature-extraction', EMBEDDING_MODEL);
    logger.info('[EMBEDDING] Model loaded successfully');
  }
  return embeddingPipeline;
}

/**
 * Generate embedding vector for a given text using open-source transformer model
 * Model: all-MiniLM-L6-v2 (384 dimensions)
 * 100% local, no API keys required
 */
export async function generateEmbedding(text: string): Promise<number[]> {
  try {
    if (!text || text.trim().length === 0) {
      throw new Error("Text cannot be empty");
    }

    const extractor = await getEmbeddingPipeline();
    
    // Generate embedding
    const output = await extractor(text.trim(), {
      pooling: 'mean',
      normalize: true,
    });

    // Extract the embedding array from the output tensor
    const embedding = Array.from(output.data) as number[];
    
    if (embedding.length !== EMBEDDING_DIMENSION) {
      throw new Error(`Expected ${EMBEDDING_DIMENSION} dimensions, got ${embedding.length}`);
    }

    return embedding;
  } catch (error: any) {
    logger.error("[EMBEDDING] Error generating embedding:", error?.message || error);
    throw new Error(`Failed to generate embedding: ${error?.message || "Unknown error"}`);
  }
}

/**
 * Split text into chunks for embedding
 * Uses simple character-based chunking with overlap
 */
export function chunkText(text: string, chunkSize: number = 2000, overlap: number = 200): string[] {
  if (!text || text.trim().length === 0) {
    return [];
  }

  const chunks: string[] = [];
  let start = 0;

  while (start < text.length) {
    const end = Math.min(start + chunkSize, text.length);
    const chunk = text.slice(start, end).trim();
    
    if (chunk.length > 0) {
      chunks.push(chunk);
    }

    // Move forward, but overlap with previous chunk
    start += chunkSize - overlap;
    
    // Prevent infinite loop
    if (start >= text.length) break;
  }

  return chunks;
}

/**
 * Generate embeddings for multiple texts in batch
 * Local processing, no rate limits needed
 */
export async function generateEmbeddingsBatch(
  texts: string[],
  onProgress?: (current: number, total: number) => void
): Promise<number[][]> {
  const embeddings: number[][] = [];
  
  // Pre-load the model once for all texts
  await getEmbeddingPipeline();
  
  for (let i = 0; i < texts.length; i++) {
    try {
      const embedding = await generateEmbedding(texts[i]);
      embeddings.push(embedding);
      
      if (onProgress) {
        onProgress(i + 1, texts.length);
      }
    } catch (error: any) {
      logger.error(`[EMBEDDING] Failed to generate embedding for chunk ${i + 1}:`, error?.message);
      // Continue with other chunks, but log the error
      embeddings.push(new Array(EMBEDDING_DIMENSION).fill(0)); // placeholder
    }
  }

  return embeddings;
}

/**
 * Perform semantic search using cosine similarity
 * Returns the query embedding for database search
 */
export async function searchEmbedding(query: string): Promise<number[]> {
  return generateEmbedding(query);
}
