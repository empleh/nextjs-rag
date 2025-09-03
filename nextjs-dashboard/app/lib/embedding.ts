// lib/embeddings.ts
import OpenAI from 'openai';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

export async function generateEmbedding(text: string): Promise<number[]> {
  try {
    const response = await openai.embeddings.create({
      model: 'text-embedding-3-small', // 1536 dimensions, cost-effective
      input: text.substring(0, 8000), // Truncate if too long
    });
    
    return response.data[0].embedding;
  } catch (error) {
    console.error('Embedding generation failed:', error);
    throw error;
  }
}

// lib/chunking.ts
export interface ContentChunk {
  text: string;
  index: number;
  wordCount: number;
}

export function createSemanticChunks(
  content: string, 
  maxTokens: number = 500,
  overlapTokens: number = 50
): ContentChunk[] {
  // Clean the content first
  const cleanContent = content
    .replace(/\s+/g, ' ')
    .replace(/\n+/g, '\n')
    .trim();
  
  // Split by double newlines (paragraphs) first
  const paragraphs = cleanContent.split('\n').filter(p => p.trim().length > 20);
  
  const chunks: ContentChunk[] = [];
  let currentChunk = '';
  let chunkIndex = 0;
  
  for (const paragraph of paragraphs) {
    const estimatedTokens = (currentChunk + paragraph).length / 4; // Rough estimation
    
    if (estimatedTokens > maxTokens && currentChunk.length > 0) {
      // Save current chunk
      chunks.push({
        text: currentChunk.trim(),
        index: chunkIndex++,
        wordCount: currentChunk.split(' ').length
      });
      
      // Start new chunk with overlap from previous
      const words = currentChunk.split(' ');
      const overlapWords = words.slice(-overlapTokens);
      currentChunk = overlapWords.join(' ') + ' ' + paragraph;
    } else {
      currentChunk += (currentChunk ? ' ' : '') + paragraph;
    }
  }
  
  // Don't forget the last chunk
  if (currentChunk.trim()) {
    chunks.push({
      text: currentChunk.trim(),
      index: chunkIndex,
      wordCount: currentChunk.split(' ').length
    });
  }
  
  return chunks.filter(chunk => chunk.text.length > 50); // Filter out tiny chunks
}