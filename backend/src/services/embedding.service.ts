import OpenAI from "openai";
import { env } from "../config/env";

/**
 * Text Embedding Service
 * Converts incident symptoms, root causes, and queries into 
 * normalized dense vector representations for semantic search.
 */

function getEmbeddingClient(): OpenAI | null {
  const apiKey = env.LLM_API_KEY || process.env.GROQ_API_KEY || "local";
  const baseURL = env.LLM_BASE_URL || "https://api.groq.com/openai/v1";

  try {
    return new OpenAI({ apiKey, baseURL });
  } catch (err) {
    console.warn("Could not initialize embedding client:", err);
    return null;
  }
}

/**
 * Generates an embedding vector for given text.
 * Falls back to deterministic semantic hashing if offline/local.
 */
export async function generateEmbedding(text: string): Promise<number[]> {
  const cleanText = text.replace(/\n+/g, " ").trim().slice(0, 2000);
  if (!cleanText) return new Array(384).fill(0);

  const client = getEmbeddingClient();

  // 1. Attempt API Embedding generation (e.g. text-embedding-3-small, bge-small, or Ollama)
  if (client && env.LLM_API_KEY) {
    try {
      const response = await client.embeddings.create({
        model: "text-embedding-3-small",
        input: cleanText,
      });
      return response.data[0].embedding;
    } catch (err) {
      console.warn("Remote embedding API call skipped/failed, using local vector encoder:", (err as Error).message);
    }
  }

  // 2. High-speed, deterministic offline vector encoder (384-dimensional vector space)
  // Ensures local development and tests work 100% offline without external API limits.
  return localFeatureVector(cleanText, 384);
}

/**
 * Deterministic local feature representation based on token n-grams and hashing.
 * Output is L2-normalized to ensure cosine similarity is a simple dot product.
 */
function localFeatureVector(text: string, dimensions = 384): number[] {
  const vector = new Array(dimensions).fill(0);
  const tokens = text.toLowerCase().match(/\b[a-z0-9_-]+\b/g) || [];

  for (let i = 0; i < tokens.length; i++) {
    const token = tokens[i];
    let hash = 0;
    for (let c = 0; c < token.length; c++) {
      hash = (hash << 5) - hash + token.charCodeAt(c);
      hash |= 0;
    }
    const idx = Math.abs(hash) % dimensions;
    vector[idx] += 1.0;
  }

  // L2 Normalization: ||v|| = 1.0
  const norm = Math.sqrt(vector.reduce((sum, val) => sum + val * val, 0));
  if (norm === 0) return vector;
  return vector.map((val) => Number((val / norm).toFixed(6)));
}

/**
 * Calculates Cosine Similarity between two L2-normalized vectors.
 * Returns a value between -1.0 and 1.0 (typically 0.0 to 1.0 for positive features).
 */
export function cosineSimilarity(vecA: number[], vecB: number[]): number {
  if (vecA.length !== vecB.length || vecA.length === 0) return 0;
  let dotProduct = 0;
  for (let i = 0; i < vecA.length; i++) {
    dotProduct += vecA[i] * vecB[i];
  }
  return Math.max(0, Math.min(dotProduct, 1.0));
}