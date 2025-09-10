// app/api/upload-pdf/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { Pinecone } from '@pinecone-database/pinecone';
import { ensureIndexExists } from '@/app/lib/pinecone';
import { google } from '@ai-sdk/google';
import { embed } from 'ai';
import { RecursiveCharacterTextSplitter } from "langchain/text_splitter";
import pdf from 'pdf-parse';

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

    const formData = await req.formData();
    const file = formData.get('file') as File;
    const title = formData.get('title') as string || 'Resume';
    
    if (!file) {
      return NextResponse.json({ error: 'No PDF file provided' }, { status: 400 });
    }

    if (file.type !== 'application/pdf') {
      return NextResponse.json({ error: 'File must be a PDF' }, { status: 400 });
    }

    // Convert file to buffer
    const buffer = Buffer.from(await file.arrayBuffer());
    
    // Parse PDF content
    console.log('📄 Parsing PDF content...');
    const pdfData = await pdf(buffer);
    const pdfText = pdfData.text;

    if (!pdfText || pdfText.trim().length === 0) {
      return NextResponse.json({ error: 'PDF appears to be empty or could not extract text' }, { status: 400 });
    }

    console.log(`📝 Extracted ${pdfText.length} characters from PDF`);

    // Split text into chunks
    const textSplitter = new RecursiveCharacterTextSplitter({
      chunkSize: 500,  // Slightly larger chunks for resume content
      chunkOverlap: 100,
      separators: ['\n\n', '\n', '. ', ', ', ' ', '']
    });

    const textChunks = await textSplitter.splitText(pdfText);
    console.log(`✂️ Split into ${textChunks.length} chunks`);

    // Delete existing vectors for this title/document
    const index = await ensureIndexExists();
    const documentId = `pdf_${title.replace(/[^a-zA-Z0-9]/g, '_')}`;
    
    // Query existing vectors for this document to get their IDs
    const titleFilter = { documentType: 'pdf', title: title };
    const existingVectors = await index.query({
      vector: Array(768).fill(0), // Dummy vector for filtering
      topK: 1000, // Get up to 1000 existing vectors
      filter: titleFilter,
      includeMetadata: false
    });
    
    // Delete existing vectors if any found
    if (existingVectors.matches && existingVectors.matches.length > 0) {
      const idsToDelete = existingVectors.matches.map(match => match.id);
      await index.deleteMany(idsToDelete);
      console.log(`🗑️ Deleted ${idsToDelete.length} existing vectors for document: ${title}`);
    }

    // Create embeddings for each chunk
    const vectors = [];
    console.log('🧠 Creating embeddings...');

    for (let i = 0; i < textChunks.length; i++) {
      const chunk = textChunks[i];
      const chunkId = `${documentId}_chunk_${i}`;

      // Generate proper embeddings using the same model as the chat route
      const { embedding } = await embed({
        model: google.textEmbeddingModel('text-embedding-004'),
        value: chunk,
      });

      vectors.push({
        id: chunkId,
        values: embedding,
        metadata: {
          documentType: 'pdf',
          title: title,
          content: chunk,
          chunkIndex: i,
          totalChunks: textChunks.length,
          hasNext: i < textChunks.length - 1,
          hasPrevious: i > 0,
          timestamp: new Date().toISOString(),
          fileSize: buffer.length,
          originalFileName: file.name
        }
      });
    }

    // Store vectors in Pinecone
    await index.upsert(vectors);
    console.log(`💾 Stored ${vectors.length} vectors in Pinecone`);

    return NextResponse.json({
      success: true,
      data: {
        documentId,
        title,
        originalFileName: file.name,
        fileSize: buffer.length,
        chunksProcessed: textChunks.length,
        deletedVectors: existingVectors.matches?.length || 0,
        textLength: pdfText.length,
        chunks: textChunks.map((chunk, index) => ({
          index,
          content: chunk,
          length: chunk.length,
          preview: chunk.substring(0, 150) + (chunk.length > 150 ? '...' : ''),
          hasNext: index < textChunks.length - 1,
          hasPrevious: index > 0
        }))
      },
      message: 'PDF successfully parsed and stored in vector database. Ready for RAG processing.'
    });
    
  } catch (error) {
    console.error('PDF upload error:', error);
    
    // Provide more specific error messages
    let errorMessage = 'Failed to process PDF';
    
    if (error instanceof Error) {
      if (error.message.includes('PINECONE_')) {
        errorMessage = 'Pinecone configuration error: ' + error.message;
      } else if (error.message.includes('PDF')) {
        errorMessage = 'PDF parsing error: ' + error.message;
      } else if (error.message.includes('embed')) {
        errorMessage = 'Embedding generation error: ' + error.message;
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

export async function GET() {
  return NextResponse.json({
    message: 'PDF Upload API endpoint is running',
    endpoints: {
      POST: 'Upload a PDF file to be parsed and stored in vector database',
    },
    requirements: {
      method: 'POST',
      contentType: 'multipart/form-data',
      fields: {
        file: 'PDF file (required)',
        title: 'Document title (optional, defaults to "Resume")'
      }
    }
  });
}