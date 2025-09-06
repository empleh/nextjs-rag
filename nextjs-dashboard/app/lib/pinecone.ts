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