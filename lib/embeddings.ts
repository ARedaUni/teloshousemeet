import fetch from 'node-fetch';

const JINA_API_KEY = process.env.JINA_API_KEY;
const JINA_API_URL = 'https://api.jina.ai/v1/embeddings';

interface JinaResponse {
  data: {
    embedding: number[];
  }[];
}

// Cache for embeddings to reduce API calls
const embeddingsCache = new Map<string, number[]>();

export async function getEmbeddings(text: string): Promise<number[]> {
  // Check cache first
  const cachedEmbedding = embeddingsCache.get(text);
  if (cachedEmbedding) {
    return cachedEmbedding;
  }

  try {
    const response = await fetch(JINA_API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${JINA_API_KEY}`
      },
      body: JSON.stringify({
        model: "jina-embeddings-v3",
        task: "text-matching",
        late_chunking: true,
        dimensions: 1024,
        embedding_type: "float",
        input: [text]
      })
    });

    const data = await response.json() as JinaResponse;
    const embedding = data.data[0].embedding;
    
    // Store in cache
    embeddingsCache.set(text, embedding);
    return embedding;
  } catch (error) {
    console.error('Error generating embeddings:', error);
    throw error;
  }
}

export function cosineSimilarity(vecA: number[], vecB: number[]): number {
  let dotProduct = 0;
  let magnitudeA = 0;
  let magnitudeB = 0;

  for (let i = 0; i < vecA.length; i++) {
    dotProduct += vecA[i] * vecB[i];
    magnitudeA += vecA[i] * vecA[i];
    magnitudeB += vecB[i] * vecB[i];
  }

  magnitudeA = Math.sqrt(magnitudeA);
  magnitudeB = Math.sqrt(magnitudeB);

  if (magnitudeA === 0 || magnitudeB === 0) {
    return 0;
  }

  return dotProduct / (magnitudeA * magnitudeB);
} 