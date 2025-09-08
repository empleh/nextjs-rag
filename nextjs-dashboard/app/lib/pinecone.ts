// lib/pinecone.ts
import { Pinecone } from '@pinecone-database/pinecone';

const pc = new Pinecone({
  apiKey: process.env.PINECONE_API_KEY!,
});

export async function ensureIndexExists() {
  const indexName = process.env.PINECONE_INDEX_NAME;
  if (!indexName) {
    throw new Error('PINECONE_INDEX_NAME environment variable is required');
  }

  try {
    // Check if index exists
    const indexList = await pc.listIndexes();
    const indexExists = indexList.indexes?.some(index => index.name === indexName);

    if (!indexExists) {
      console.log(`Creating Pinecone index: ${indexName}`);

      // Create index with 768 dimensions (Google text-embedding-004 size)
      await pc.createIndex({
        name: indexName,
        dimension: 768,
        metric: 'cosine',
        spec: {
          serverless: {
            cloud: 'aws',
            region: 'us-east-1'
          }
        }
      });

      // Wait a moment for index to be ready
      console.log('Waiting for index to be ready...');
      await new Promise(resolve => setTimeout(resolve, 5000));
    }

    return pc.index(indexName);
  } catch (error) {
    console.error('Error ensuring index exists:', error);
    throw error;
  }
}

export interface VectorMetadata {
  text: string;
  url: string;
  title: string;
  chunkIndex: number;
  wordCount: number;
}

export async function queryVectors(
  queryEmbedding: number[],
  topK: number = 5,
  filter?: Record<string, any>
) {
  const index = await ensureIndexExists();

  return await index.query({
    vector: queryEmbedding,
    topK,
    includeMetadata: true,
    filter
  });
}

export async function getContextualChunks(
  queryEmbedding: number[],
  topK: number = 5,
  contextWindow: number = 1
) {
  const index = await ensureIndexExists();

  // First, get the best matching chunks
  const results = await index.query({
    vector: queryEmbedding,
    topK,
    includeMetadata: true
  });

  if (!results.matches) return results;

  // Collect all chunk IDs we need (including context)
  const chunkIdsToRetrieve = new Set<string>();
  const urlToChunkMap = new Map<string, number[]>();

  results.matches.forEach(match => {
    if (match.metadata) {
      const chunkIndex = match.metadata.chunkIndex as number;
      const url = match.metadata.url as string;
      
      if (!urlToChunkMap.has(url)) {
        urlToChunkMap.set(url, []);
      }
      urlToChunkMap.get(url)!.push(chunkIndex);

      // Add the main chunk
      chunkIdsToRetrieve.add(match.id);
      
      // Add context chunks (before and after)
      for (let i = Math.max(0, chunkIndex - contextWindow); i <= chunkIndex + contextWindow; i++) {
        const contextChunkId = `${url.replace(/[^a-zA-Z0-9]/g, '_')}_chunk_${i}`;
        chunkIdsToRetrieve.add(contextChunkId);
      }
    }
  });

  // Retrieve all needed chunks
  const allChunkIds = Array.from(chunkIdsToRetrieve);
  const contextResults = await index.fetch(allChunkIds);

  return { ...results, contextChunks: contextResults };
}