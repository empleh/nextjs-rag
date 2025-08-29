// lib/pinecone.ts
import { Pinecone } from '@pinecone-database/pinecone';

const pc = new Pinecone({
  apiKey: process.env.PINECONE_API_KEY!,
});

// Create index if it doesn't exist (run this once)
export async function initializePinecone() {
  const indexName = 'knowledge-base';
   
  try {
    await pc.createIndex({
      name: indexName,
      dimension: 1536, // OpenAI text-embedding-3-small dimension
      metric: 'cosine',
      spec: {
        serverless: {
          cloud: 'aws',
          region: 'us-east-1'
        }
      }
    });
  } catch (error) {
    console.log('Index might already exist:', error);
  }
}

export const index = pc.index('knowledge-base');