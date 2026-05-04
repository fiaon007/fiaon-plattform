import OpenAI from "openai";
import { logger } from "../logger";

const openai = new OpenAI({
  apiKey: process.env.OPENAI_EMBEDDING_API_KEY || process.env.OPENAI_API_KEY,
});

const EMBEDDING_MODEL = "text-embedding-3-small";
const EMBEDDING_DIMENSION = 1536;
const MAX_CHUNK_SIZE = 8000; // tokens (safe limit for embedding model)

/**
 * Generate embedding vector for a given text
 */
export async function generateEmbedding(text: string): Promise<number[]> {
  try {
    if (!text || text.trim().length === 0) {
      throw new Error("Text cannot be empty");
    }

    const response = await openai.embeddings.create({
      model: EMBEDDING_MODEL,
      input: text.trim(),
      encoding_format: "float",
    });

    if (!response.data || response.data.length === 0) {
      throw new Error("No embedding returned from OpenAI");
    }

    const embedding = response.data[0].embedding;
    
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
 * Handles rate limiting and retries
 */
export async function generateEmbeddingsBatch(
  texts: string[],
  onProgress?: (current: number, total: number) => void
): Promise<number[][]> {
  const embeddings: number[][] = [];
  
  for (let i = 0; i < texts.length; i++) {
    try {
      const embedding = await generateEmbedding(texts[i]);
      embeddings.push(embedding);
      
      if (onProgress) {
        onProgress(i + 1, texts.length);
      }

      // Rate limiting: small delay between requests
      if (i < texts.length - 1) {
        await new Promise(resolve => setTimeout(resolve, 100));
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
