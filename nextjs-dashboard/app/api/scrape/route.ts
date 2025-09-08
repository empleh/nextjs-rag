// app/api/scrape/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { Pinecone } from '@pinecone-database/pinecone';
import { ensureIndexExists } from '@/app/lib/pinecone';
import { google } from '@ai-sdk/google';
import { embed } from 'ai';

const pc = new Pinecone({
  apiKey: process.env.PINECONE_API_KEY!,
});

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
    
    // Delete existing vectors for this URL before re-indexing
    const index = await ensureIndexExists();
    
    // Query existing vectors for this URL to get their IDs
    const urlFilter = { url: { $eq: url } };
    const existingVectors = await index.query({
      vector: Array(768).fill(0), // Dummy vector for filtering
      topK: 1000, // Get up to 1000 existing vectors
      filter: urlFilter,
      includeMetadata: false
    });
    
    // Delete existing vectors if any found
    if (existingVectors.matches && existingVectors.matches.length > 0) {
      const idsToDelete = existingVectors.matches.map(match => match.id);
      await index.deleteMany(idsToDelete);
      console.log(`Deleted ${idsToDelete.length} existing vectors for URL: ${url}`);
    }

    // Create proper embeddings using Google's text embedding model
    const chunks = textContent.match(/.{1,1000}/g) || [textContent];
    const vectors = [];
    
    for (let i = 0; i < chunks.length; i++) {
      const chunkId = `${url.replace(/[^a-zA-Z0-9]/g, '_')}_chunk_${i}`;
      
      // Generate proper embeddings using the same model as the chat route
      const { embedding } = await embed({
        model: google.textEmbeddingModel('text-embedding-004'),
        value: chunks[i],
      });
      
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

    // Store new vectors in Pinecone
    await index.upsert(vectors);

    return NextResponse.json({ 
      success: true, 
      data: {
        id: `${url.replace(/[^a-zA-Z0-9]/g, '_')}`,
        url,
        title,
        chunksProcessed: chunks.length,
        deletedVectors: existingVectors.matches?.length || 0
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