import { NextRequest, NextResponse } from 'next/server';
import { google } from '@ai-sdk/google';
import { convertToModelMessages, streamText, embed } from 'ai';
import { queryVectors } from '@/app/lib/pinecone';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { messages } = body;

    if (!messages) {
      return NextResponse.json({ error: 'Question is required' }, { status: 400 });
    }

    // Use Google's text embedding model (768 dimensions)
    const { embedding } = await embed({
      model: google.textEmbeddingModel('text-embedding-004'),
      value: messages[0].parts[0].text,
    });

    console.log(messages[0].parts[0].text, embedding);

    const searchResults = await queryVectors(embedding, 5); // Top 5 matches
    console.log(`Found ${searchResults.matches?.length || 0} matches`);

    // Step 3: Extract and format the context
    const relevantChunks =
      searchResults.matches?.map((match) => ({
        text: match.metadata?.text || '',
        score: match.score || 0,
        url: match.metadata?.url || '',
        title: match.metadata?.title || '',
      })) || [];

    // Filter by relevance score (optional - adjust threshold as needed)
    const highQualityChunks = relevantChunks.filter((chunk) => chunk.score > 0.7);
    const chunksToUse = highQualityChunks.length > 0 ? highQualityChunks : relevantChunks.slice(0, 3);

    const context = defineContext('', []);

    const result = streamText({
      model: google('gemini-1.5-flash'),
      system: 'You are a system that answers questions about Christian Peters based on data provided to you.',
      messages: [
        {
          role: 'system',
          content: context,
        },
        ...convertToModelMessages(messages),
      ],
    });

    return result.toUIMessageStreamResponse();
  } catch (error) {
    console.error('Error in chat endpoint:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

function defineContext(context: string, chunksToUse: string[]) {
  const systemPrompt = `You are a helpful AI assistant that answers questions based on the provided context from scraped web content.

CONTEXT:
${context}

INSTRUCTIONS:
- Answer the user's question using the provided context
- If the context contains relevant information, use it to provide a detailed answer
- If the context doesn't contain enough relevant information, say so clearly
- Always cite which source(s) you're referencing when possible
- Be conversational and helpful
- If you're unsure about something, express that uncertainty

${
  chunksToUse.length === 0
    ? 'Note: No highly relevant context was found for this question. Provide a general response and suggest the user might need to add more relevant content to the knowledge base.'
    : ''
}`;

  return systemPrompt;
}

export async function GET() {
  return NextResponse.json({
    message: 'Chat API endpoint is running',
    endpoints: {
      POST: 'Send a message to chat with the AI',
    },
  });
}
