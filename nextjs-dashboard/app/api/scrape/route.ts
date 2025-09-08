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
    // Disable scrape endpoint in production
    if (process.env.NODE_ENV === 'production') {
      return NextResponse.json({ 
        error: 'Scraping is disabled in production for security' 
      }, { status: 403 });
    }

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

    if(url === 'https://christianpeters.dev/one-idea/'){
      return scrapeOneIdeaPage(url);
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

async function scrapeOneIdeaPage(url: string) {
  try {
    // Fetch the HTML
    const response = await fetch(url);
    const html = await response.text();
    
    // Extract page summary from the intro card
    const summaryRegex = /<div class="card">\s*<h2>One Idea<\/h2>\s*<p>([\s\S]*?)<\/p>\s*<\/div>/;
    const summaryMatch = summaryRegex.exec(html);
    const pageSummary = summaryMatch ? summaryMatch[1]
      .replace(/<br\s*\/?>/g, '\n')
      .replace(/\s+/g, ' ')
      .replace(/\n\s*\n/g, '\n\n')
      .trim() : null;

    // Extract book cards using regex
    const bookCardRegex = /<div class="book-card">([\s\S]*?)<\/div>\s*<\/div>/g;
    const bookCards = [];
    let match;
    
    while ((match = bookCardRegex.exec(html)) !== null) {
      bookCards.push(match[0]);
    }
    
    console.log(`Found ${bookCards.length} book cards`);
    console.log(`Found page summary: ${pageSummary ? 'Yes' : 'No'}`);
    
    // Process each book card
    const chunks = bookCards.map((cardHtml, index) => {
      // Extract title and parse author
      const titleMatch = cardHtml.match(/<h3>(.*?)<\/h3>/);
      const fullTitle = titleMatch ? titleMatch[1].replace(/<[^>]*>/g, '').trim() : `Book ${index + 1}`;
      
      // Parse title and author from format "Title by Author"
      const titleAuthorMatch = fullTitle.match(/^(.+?)\s+by\s+(.+)$/);
      const bookTitle = titleAuthorMatch ? titleAuthorMatch[1].trim() : fullTitle;
      const author = titleAuthorMatch ? titleAuthorMatch[2].trim() : 'Unknown Author';
      
      // Extract and clean content
      const cleanContent = cardHtml
        // Remove image and link elements
        .replace(/<img[^>]*>/g, '')
        .replace(/<div class="book-links">[\s\S]*?<\/div>/g, '')
        // Convert HTML to text
        .replace(/<h3>/g, '\n')
        .replace(/<\/h3>/g, '\n')
        .replace(/<p>/g, '\n')
        .replace(/<\/p>/g, '\n')
        .replace(/<br\s*\/?>/g, '\n')
        .replace(/<strong>/g, '')
        .replace(/<\/strong>/g, '')
        .replace(/<[^>]*>/g, ' ')
        // Clean up whitespace
        .replace(/&nbsp;/g, ' ')
        .replace(/\s+/g, ' ')
        .replace(/\n\s*\n/g, '\n\n')
        .trim();
      
      return {
        fullTitle,
        bookTitle,
        author,
        content: cleanContent,
        index
      };
    });
    
    // Delete existing vectors for this URL
    const index = await ensureIndexExists();
    const urlFilter = { url: { $eq: url } };
    const existingVectors = await index.query({
      vector: Array(768).fill(0),
      topK: 1000,
      filter: urlFilter,
      includeMetadata: false
    });
    
    if (existingVectors.matches && existingVectors.matches.length > 0) {
      const idsToDelete = existingVectors.matches.map(match => match.id);
      await index.deleteMany(idsToDelete);
      console.log(`Deleted ${idsToDelete.length} existing vectors for URL: ${url}`);
    }
    
    // Create embeddings for page summary first (if exists)
    const vectors = [];
    let vectorIndex = 0;
    
    if (pageSummary) {
      const summaryId = `${url.replace(/[^a-zA-Z0-9]/g, '_')}_summary`;
      
      // Generate embedding for page summary
      const { embedding: summaryEmbedding } = await embed({
        model: google.textEmbeddingModel('text-embedding-004'),
        value: `One Idea Philosophy: ${pageSummary}`,
      });
      
      vectors.push({
        id: summaryId,
        values: summaryEmbedding,
        metadata: {
          url,
          title: 'One Idea - Reading Philosophy',
          bookTitle: 'One Idea',
          author: 'Christian Peters',
          content: `One Idea Philosophy: ${pageSummary}`,
          chunkIndex: vectorIndex++,
          totalChunks: chunks.length + 1, // +1 for summary
          hasNext: chunks.length > 0,
          hasPrevious: false,
          timestamp: new Date().toISOString(),
          type: 'page_summary'
        }
      });
    }

    // Create embeddings for each book card
    for (let i = 0; i < chunks.length; i++) {
      const chunk = chunks[i];
      const chunkId = `${url.replace(/[^a-zA-Z0-9]/g, '_')}_book_${i}`;
      
      // Generate embeddings
      const { embedding } = await embed({
        model: google.textEmbeddingModel('text-embedding-004'),
        value: chunk.content,
      });
      
      vectors.push({
        id: chunkId,
        values: embedding,
        metadata: {
          url,
          title: chunk.fullTitle,
          bookTitle: chunk.bookTitle,
          author: chunk.author,
          content: chunk.content,
          chunkIndex: vectorIndex++,
          totalChunks: chunks.length + (pageSummary ? 1 : 0),
          hasNext: vectorIndex < chunks.length + (pageSummary ? 1 : 0),
          hasPrevious: vectorIndex > 1,
          timestamp: new Date().toISOString(),
          type: 'book_card'
        }
      });
    }
    
    // Store vectors
    await index.upsert(vectors);
    
    return NextResponse.json({
      success: true,
      data: {
        id: `${url.replace(/[^a-zA-Z0-9]/g, '_')}`,
        url,
        title: 'One Idea - Book Collection',
        chunksProcessed: chunks.length + (pageSummary ? 1 : 0),
        deletedVectors: existingVectors.matches?.length || 0,
        pageSummary: pageSummary ? {
          content: `One Idea Philosophy: ${pageSummary}`,
          length: pageSummary.length,
          preview: pageSummary.substring(0, 150) + (pageSummary.length > 150 ? '...' : ''),
          type: 'page_summary'
        } : null,
        chunks: chunks.map((chunk, index) => ({
          index: index + (pageSummary ? 1 : 0), // Offset by summary if it exists
          fullTitle: chunk.fullTitle,
          bookTitle: chunk.bookTitle,
          author: chunk.author,
          content: chunk.content,
          length: chunk.content.length,
          preview: chunk.content.substring(0, 150) + (chunk.content.length > 150 ? '...' : ''),
          type: 'book_card'
        }))
      },
      message: 'One Idea page scraped with book-card structure preserved. Ready for RAG processing.'
    });
    
  } catch (error) {
    console.error('Error scraping One Idea page:', error);
    return NextResponse.json(
      { 
        error: 'Failed to scrape One Idea page',
        details: error instanceof Error ? error.message : 'Unknown error'
      }, 
      { status: 500 }
    );
  }
}