// app/api/scrape/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { Pinecone } from '@pinecone-database/pinecone';

const pc = new Pinecone({
  apiKey: process.env.PINECONE_API_KEY!,
});

// Initialize index inside the handler to ensure env vars are loaded
async function ensureIndexExists() {
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
      
      // Create index with 1536 dimensions (OpenAI embedding size)
      await pc.createIndex({
        name: indexName,
        dimension: 1536,
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

export async function POST(req: NextRequest) {
  try {
    // Validate environment variables
    if (!process.env.PINECONE_API_KEY) {
      return NextResponse.json({ error: 'PINECONE_API_KEY is not configured' }, { status: 500 });
    }
    
    if (!process.env.PINECONE_INDEX_NAME) {
      return NextResponse.json({ error: 'PINECONE_INDEX_NAME is not configured' }, { status: 500 });
    }

    const { url } = await req.json();
    
    if (!url) {
      return NextResponse.json({ error: 'URL is required' }, { status: 400 });
    }

    // Simple scraping with fetch (we'll enhance this later)
    const response = await fetch(url);
    const html = await response.text();
    
    // Basic content extraction (you'll improve this with Cheerio)
    const title = html.match(/<title>(.*?)<\/title>/)?.[1] || 'Untitled';
    const textContent = html.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
    
    // Create embeddings for the content (using a simple approach for now)
    // In production, you'd use OpenAI embeddings or similar
    const chunks = textContent.match(/.{1,1000}/g) || [textContent];
    const vectors = [];
    
    for (let i = 0; i < chunks.length; i++) {
      const chunkId = `${url.replace(/[^a-zA-Z0-9]/g, '_')}_chunk_${i}`;
      
      // For now, creating dummy embeddings - replace with actual embedding service
      const embedding = Array(1536).fill(0).map(() => Math.random() * 2 - 1);
      
      vectors.push({
        id: chunkId,
        values: embedding,
        metadata: {
          url,
          title,
          content: chunks[i],
          chunkIndex: i,
          timestamp: new Date().toISOString()
        }
      });
    }

    // Store in Pinecone
    const index = await ensureIndexExists();
    await index.upsert(vectors);

    return NextResponse.json({ 
      success: true, 
      data: {
        id: `${url.replace(/[^a-zA-Z0-9]/g, '_')}`,
        url,
        title,
        chunksProcessed: chunks.length
      },
      message: 'Content scraped and stored in Pinecone. Ready for RAG processing.' 
    });
    
  } catch (error) {
    console.error('Scraping error:', error);
    
    // Provide more specific error messages
    let errorMessage = 'Failed to scrape URL';
    
    if (error instanceof Error) {
      if (error.message.includes('PINECONE_')) {
        errorMessage = 'Pinecone configuration error: ' + error.message;
      } else if (error.message.includes('fetch')) {
        errorMessage = 'Failed to fetch URL content';
      } else if (error.message.includes('index')) {
        errorMessage = 'Pinecone index error: ' + error.message;
      }
    }
    
    return NextResponse.json(
      { 
        error: errorMessage,
        details: error instanceof Error ? error.message : 'Unknown error'
      }, 
      { status: 500 }
    );
  }
}