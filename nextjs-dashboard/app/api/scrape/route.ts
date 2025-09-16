// app/api/scrape/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { clearExistingVectors, storeVectors, VectorDetail } from '@/app/lib/pinecone';
import { google } from '@ai-sdk/google';
import { embed } from 'ai';
import { RecursiveCharacterTextSplitter } from 'langchain/text_splitter';
import { HTMLWebBaseLoader } from '@langchain/community/document_loaders/web/html';
import { MozillaReadabilityTransformer } from '@langchain/community/document_transformers/mozilla_readability';
import { QueryResponse, RecordMetadata } from '@pinecone-database/pinecone';

export async function POST(req: NextRequest) {
  try {
    // Disable scrape endpoint in production
    if (process.env.NODE_ENV === 'production') {
      return NextResponse.json(
        {
          error: 'Scraping is disabled in production for security',
        },
        { status: 403 }
      );
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

    let content;
    let title;
    switch (url){
      case 'https://christianpeters.dev/one-idea/':
        ({title, content} = await scrapeOneIdeaPage(url));
        break;
      default:
        ({title, content} = await defaultPageScraping(url));
    }

    const delectedVectors = await clearExistingVectors({ url });

    const newVectors = await buildVectors(url, title, content);
    await storeVectors(newVectors);

    return scrapedResults(url, title, content, delectedVectors);
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
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}

async function defaultPageScraping(url: string){
  const loader = new HTMLWebBaseLoader(url);
  const transformer = new MozillaReadabilityTransformer();
  const splitter = RecursiveCharacterTextSplitter.fromLanguage('html', {
    chunkSize: 400, // Smaller chunks for more granular retrieval
    chunkOverlap: 100, // Minimal overlap since we'll grab context dynamically
  });

  const docs = await loader.load();

  const sequence = transformer.pipe(splitter);
  const vectorizedDocs = await sequence.invoke(docs);

  return {title: docs[0]?.metadata?.title || 'Untitled', content: vectorizedDocs};
}

function scrapedResults(url: string, title: string, vectorizedDocs: any[], delectedVectors: QueryResponse<RecordMetadata>) {
  return NextResponse.json({
    success: true,
    data: {
      id: `${url.replace(/[^a-zA-Z0-9]/g, '_')}`,
      url,
      title,
      chunksProcessed: vectorizedDocs.length,
      deletedVectors: delectedVectors.matches?.length || 0,
      chunks: vectorizedDocs.map((doc, index) => ({
        index,
        content: doc.pageContent,
        length: doc.pageContent.length,
        preview: doc.pageContent.substring(0, 150) + (doc.pageContent.length > 150 ? '...' : ''),
        hasNext: index < vectorizedDocs.length - 1,
        hasPrevious: index > 0,
      })),
    },
    message: 'Content scraped and stored in Pinecone with sequential context. Ready for RAG processing.',
  });
}

async function buildVectors(url: string, title: string, vectorizedDocs: any[]){
  console.log('vectorizedDocs', vectorizedDocs.length);
  const vectors: VectorDetail[] = [];

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
        title,
        content: doc.pageContent,
        chunkIndex: i,
        totalChunks: vectorizedDocs.length,
        hasNext: i < vectorizedDocs.length - 1,
        hasPrevious: i > 0,
        timestamp: new Date().toISOString()
      }
    });
  }

  return vectors;
}

async function scrapeOneIdeaPage(url: string) {
    const response = await fetch(url);
    const html = await response.text();

    // Extract page summary from the intro card
    const summaryRegex = /<div class="card">\s*<h2>One Idea<\/h2>\s*<p>([\s\S]*?)<\/p>\s*<\/div>/;
    const summaryMatch = summaryRegex.exec(html);
    const pageSummary = summaryMatch
      ? summaryMatch[1]
          .replace(/<br\s*\/?>/g, '\n')
          .replace(/\s+/g, ' ')
          .replace(/\n\s*\n/g, '\n\n')
          .trim()
      : null;

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
        index,
      };
    });

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
          type: 'page_summary',
        },
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
          type: 'book_card',
        },
      });
    }

    return {title: 'One Idea - Book Collection', content: vectors};
}
