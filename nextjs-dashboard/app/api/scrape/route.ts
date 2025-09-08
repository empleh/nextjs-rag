// app/api/scrape/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { Pinecone } from '@pinecone-database/pinecone';
import { ensureIndexExists } from '@/app/lib/pinecone';
import { google } from '@ai-sdk/google';
import { embed } from 'ai';
import { RecursiveCharacterTextSplitter } from "langchain/text_splitter";
import { HTMLWebBaseLoader } from "@langchain/community/document_loaders/web/html";
import { MozillaReadabilityTransformer } from "@langchain/community/document_transformers/mozilla_readability";


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

    const loader = new HTMLWebBaseLoader(
      url
    );
    const transformer = new MozillaReadabilityTransformer();
    const splitter = RecursiveCharacterTextSplitter.fromLanguage("html", {
      chunkSize: 400,  // Smaller chunks for more granular retrieval
      chunkOverlap: 100  // Minimal overlap since we'll grab context dynamically
    });

    const docs = await loader.load();

    const sequence = transformer.pipe(splitter);
    const vectorizedDocs = await sequence.invoke(docs);

     console.log('textChunks', vectorizedDocs.length);
    
    // Smart content extraction that respects page structure
    //const title = transformer.title
    //const chunks = extractSemanticChunks(html);
    
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

    // Create proper embeddings for each semantic chunk with sequence info
    console.log('vectorizedDocs', vectorizedDocs.length);
    const vectors = [];

    for (let i = 0; i < vectorizedDocs.length; i++) {
      const doc = vectorizedDocs[i];
      const chunkId = `${url.replace(/[^a-zA-Z0-9]/g, '_')}_chunk_${i}`;

      // Generate proper embeddings using the same model as the chat route
      const { embedding } = await embed({
        model: google.textEmbeddingModel('text-embedding-004'),
        value: doc.pageContent,
      });

      vectors.push({
        id: chunkId,
        values: embedding,
        metadata: {
          url,
          title: docs[0]?.metadata?.title || 'Untitled',
          content: doc.pageContent,
          chunkIndex: i,
          totalChunks: vectorizedDocs.length,
          hasNext: i < vectorizedDocs.length - 1,
          hasPrevious: i > 0,
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
        title: docs[0]?.metadata?.title || 'Untitled',
        chunksProcessed: vectorizedDocs.length,
        deletedVectors: existingVectors.matches?.length || 0,
        chunks: vectorizedDocs.map((doc, index) => ({
          index,
          content: doc.pageContent,
          length: doc.pageContent.length,
          preview: doc.pageContent.substring(0, 150) + (doc.pageContent.length > 150 ? '...' : ''),
          hasNext: index < vectorizedDocs.length - 1,
          hasPrevious: index > 0
        }))
      },
      message: 'Content scraped and stored in Pinecone with sequential context. Ready for RAG processing.'
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

function CleanTextContent(text: string): string {
  const cleaned = text
    // First, normalize line breaks and preserve paragraph structure
    .replace(/\r\n/g, '\n') // Normalize Windows line endings
    .replace(/\r/g, '\n')   // Normalize Mac line endings
    // Preserve double line breaks (paragraph separators)
    .replace(/\n\s*\n/g, '\n\n')
    // Clean up excessive whitespace within lines (but keep line breaks)
    .replace(/[ \t]+/g, ' ')
    // Clean up excessive line breaks (max 2 consecutive)
    .replace(/\n{3,}/g, '\n\n')
    // Remove leading/trailing whitespace
    .trim();

  console.log('Cleaned text length:', cleaned.length);
  console.log('First 500 chars:', cleaned.substring(0, 500));

  return cleaned;
}