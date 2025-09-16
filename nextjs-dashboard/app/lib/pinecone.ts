// lib/pinecone.ts
import { Pinecone } from '@pinecone-database/pinecone';

const pc = new Pinecone({
  apiKey: process.env.PINECONE_API_KEY!,
});

export type VectorDetail = {
  id: string;
  values: any;
  metadata: {
    url: string;
    title: string;
    content: string;
    chunkIndex: number;
    totalChunks: number;
    hasNext: boolean;
    hasPrevious: boolean;
    timestamp: string;
  };
};
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

export async function queryVectors(queryEmbedding: number[], topK: number = 5, filter?: Record<string, any>) {
  const index = await ensureIndexExists();

  return await index.query({
    vector: queryEmbedding,
    topK,
    includeMetadata: true,
    filter,
  });
}

export async function clearExistingVectors(key: {url?: string}){
  const index = await ensureIndexExists();

  // TODO: add other filter options
  const filter = { url: { $eq: key.url } };
  const existingVectors = await index.query({
    vector: Array(768).fill(0), // Dummy vector for filtering
    topK: 1000, // Get up to 1000 existing vectors
    filter: filter,
    includeMetadata: false
  });

  // Delete existing vectors if any found
  if (existingVectors.matches && existingVectors.matches.length > 0) {
    const idsToDelete = existingVectors.matches.map(match => match.id);
    await index.deleteMany(idsToDelete);
    console.log(`Deleted ${idsToDelete.length} existing vectors for URL: ${filter.url}`);
  }

  return existingVectors;
}

export async function storeVectors(vectors: VectorDetail[]){
  const index = await ensureIndexExists();

  // Store new vectors in Pinecone
  await index.upsert(vectors);
}