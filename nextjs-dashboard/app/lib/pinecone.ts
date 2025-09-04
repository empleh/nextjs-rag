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

export interface VectorMetadata {
  text: string;
  url: string;
  title: string;
  chunkIndex: number;
  wordCount: number;
}

// export async function upsertVectors(vectors: Array<{
//   id: string;
//   values: number[];
//   metadata: VectorMetadata;
// }>) {
//   // Pinecone has batch limits, so process in chunks of 100
//   const batchSize = 100;
//
//   for (let i = 0; i < vectors.length; i += batchSize) {
//     const batch = vectors.slice(i, i + batchSize);
//     await index.upsert(batch);
//   }
//
//   console.log(`Upserted ${vectors.length} vectors to Pinecone`);
// }
//
// export async function queryVectors(
//   queryEmbedding: number[],
//   topK: number = 5,
//   filter?: Record<string, any>
// ) {
//   return await index.query({
//     vector: queryEmbedding,
//     topK,
//     includeMetadata: true,
//     filter
//   });
// }

// app/api/process/route.ts
// import { NextRequest, NextResponse } from 'next/server';
// import { neon } from '@neondatabase/serverless';
// import { createSemanticChunks } from '@/lib/chunking';
// import { generateEmbedding } from '@/lib/embeddings';
// import { upsertVectors } from '@/lib/pinecone';
//
// const sql = neon(process.env.DATABASE_URL!);

// export async function POST(req: NextRequest) {
//   try {
//     const { contentId } = await req.json();
//
//     if (!contentId) {
//       return NextResponse.json({ error: 'Content ID required' }, { status: 400 });
//     }
//
//     // Get the scraped content from your database
//     const content = await sql`
//       SELECT id, url, title, content
//       FROM scraped_content
//       WHERE id = ${contentId} AND status = 'scraped'
//     `;
//
//     if (content.length === 0) {
//       return NextResponse.json({ error: 'Content not found or already processed' }, { status: 404 });
//     }
//
//     const { id, url, title, content: rawContent } = content[0];
//
//     console.log(`Processing content: ${title} (${rawContent.length} chars)`);
//
//     // Step 1: Create semantic chunks
//     const chunks = createSemanticChunks(rawContent, 400, 50);
//     console.log(`Created ${chunks.length} chunks`);
//
//     // Step 2: Generate embeddings and prepare vectors
//     const vectors = [];
//
//     for (const chunk of chunks) {
//       try {
//         const embedding = await generateEmbedding(chunk.text);
//         const vectorId = `${id}_chunk_${chunk.index}`;
//
//         vectors.push({
//           id: vectorId,
//           values: embedding,
//           metadata: {
//             text: chunk.text,
//             url,
//             title,
//             chunkIndex: chunk.index,
//             wordCount: chunk.wordCount
//           }
//         });
//
//         // Store chunk info in your database
//         await sql`
//           INSERT INTO content_chunks (content_id, chunk_text, chunk_index, pinecone_id)
//           VALUES (${id}, ${chunk.text}, ${chunk.index}, ${vectorId})
//         `;
//
//         // Small delay to avoid rate limits
//         await new Promise(resolve => setTimeout(resolve, 100));
//
//       } catch (error) {
//         console.error(`Failed to process chunk ${chunk.index}:`, error);
//       }
//     }
//
//     // Step 3: Upload to Pinecone
//     if (vectors.length > 0) {
//       await upsertVectors(vectors);
//     }
//
//     // Step 4: Update status in database
//     await sql`
//       UPDATE scraped_content
//       SET status = 'processed', chunk_count = ${chunks.length}
//       WHERE id = ${id}
//     `;
//
//     return NextResponse.json({
//       success: true,
//       message: `Processed ${chunks.length} chunks and stored ${vectors.length} embeddings`,
//       data: {
//         contentId: id,
//         chunksCreated: chunks.length,
//         vectorsStored: vectors.length,
//         title,
//         url
//       }
//     });
//
//   } catch (error) {
//     console.error('Processing error:', error);
//     return NextResponse.json(
//       { error: 'Failed to process content: ' + error.message },
//       { status: 500 }
//     );
//   }
// }
//
// // app/test/page.tsx - Add this to your existing test page
// 'use client';
// import { useState } from 'react';
//
// export default function TestPage() {
//   const [url, setUrl] = useState('');
//   const [contentId, setContentId] = useState('');
//   const [results, setResults] = useState('');
//   const [loading, setLoading] = useState(false);
//
//   const testScrape = async () => {
//     setLoading(true);
//     try {
//       const response = await fetch('/api/scrape', {
//         method: 'POST',
//         headers: { 'Content-Type': 'application/json' },
//         body: JSON.stringify({ url })
//       });
//
//       const data = await response.json();
//       if (data.success) {
//         setContentId(data.data.id);
//       }
//       setResults(prev => prev + '\n\nSCRAPE RESULT:\n' + JSON.stringify(data, null, 2));
//     } catch (error) {
//       setResults(prev => prev + '\n\nSCRAPE ERROR: ' + error);
//     }
//     setLoading(false);
//   };
//
//   const testProcess = async () => {
//     if (!contentId) {
//       setResults(prev => prev + '\n\nERROR: No content ID. Scrape something first.');
//       return;
//     }
//
//     setLoading(true);
//     try {
//       const response = await fetch('/api/process', {
//         method: 'POST',
//         headers: { 'Content-Type': 'application/json' },
//         body: JSON.stringify({ contentId })
//       });
//
//       const data = await response.json();
//       setResults(prev => prev + '\n\nPROCESS RESULT:\n' + JSON.stringify(data, null, 2));
//     } catch (error) {
//       setResults(prev => prev + '\n\nPROCESS ERROR: ' + error);
//     }
//     setLoading(false);
//   };
//
//   return (
//     <div className="max-w-4xl mx-auto p-8">
//       <h1 className="text-2xl font-bold mb-4">RAG Pipeline Test</h1>
//
//       <div className="space-y-4">
//         {/* Step 1: Scraping */}
//         <div className="border p-4 rounded">
//           <h2 className="font-semibold mb-2">Step 1: Scrape Content</h2>
//           <input
//             type="url"
//             value={url}
//             onChange={(e) => setUrl(e.target.value)}
//             placeholder="Enter URL (try: https://en.wikipedia.org/wiki/Artificial_intelligence)"
//             className="w-full p-2 border rounded mb-2"
//           />
//           <button
//             onClick={testScrape}
//             disabled={loading}
//             className="px-4 py-2 bg-blue-500 text-white rounded disabled:opacity-50"
//           >
//             {loading ? 'Scraping...' : 'Scrape URL'}
//           </button>
//         </div>
//
//         {/* Step 2: Processing */}
//         <div className="border p-4 rounded">
//           <h2 className="font-semibold mb-2">Step 2: Process into Embeddings</h2>
//           <p className="text-sm text-gray-600 mb-2">Content ID: {contentId || 'None yet'}</p>
//           <button
//             onClick={testProcess}
//             disabled={loading || !contentId}
//             className="px-4 py-2 bg-green-500 text-white rounded disabled:opacity-50"
//           >
//             {loading ? 'Processing...' : 'Create Embeddings'}
//           </button>
//         </div>
//
//         {/* Results */}
//         {results && (
//           <div className="border p-4 rounded">
//             <h2 className="font-semibold mb-2">Results</h2>
//             <pre className="bg-gray-100 p-4 rounded overflow-auto text-sm max-h-96">
//               {results}
//             </pre>
//           </div>
//         )}
//       </div>
//     </div>
//   );
// }