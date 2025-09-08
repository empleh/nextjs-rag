import { NextRequest, NextResponse } from 'next/server';
import { google } from '@ai-sdk/google';
import { convertToModelMessages, streamText, embed } from 'ai';
import { queryVectors } from '@/app/lib/pinecone';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { messages } = body;
    const question = messages[0].parts[0].text;

    if (!messages) {
      return NextResponse.json({ error: 'Question is required' }, { status: 400 });
    }

    // Use Google's text embedding model (768 dimensions)
    const { embedding } = await embed({
      model: google.textEmbeddingModel('text-embedding-004'),
      value: question,
    });

    const searchResults = await queryVectors(embedding, 5); // Top 5 matches

    // Step 3: Extract and format the context
    const relevantChunks =
      searchResults.matches?.map((match, index) => {
        console.log(`📄 Match ${index + 1}: Score=${match.score}}`);
        return {
          text: match.metadata?.content || match.metadata?.text || '',
          score: match.score || 0,
          url: match.metadata?.url || '',
          title: match.metadata?.title || '',
        };
      }) || [];

    // Filter by relevance score (optional - adjust threshold as needed)
    const highQualityChunks = relevantChunks.filter((chunk) => chunk.score > 0.7);
    const chunksToUse = highQualityChunks.length > 0 ? highQualityChunks : relevantChunks.slice(0, 3);

    const context = defineContext(chunksToUse.map((c) => c.text.toString()));

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

function defineContext(chunksToUse: string[]) {
  const contextContent =
    chunksToUse.length > 0 ? `CONTEXT:\n${chunksToUse.map((chunk, i) => `[${i + 1}] ${chunk}`).join('\n\n')}\n\n` : 'No relevant context found.\n\n';

  const systemPrompt = `You are Christian Peters' friendly AI assistant. You know all about Christian and answer questions in a casual, conversational way - like you're talking to a friend who's curious about him.

${contextContent}HOW TO RESPOND:
- Answer naturally and conversationally - NO formal phrases like "Based on the provided text"
- You know Christian Peters information, so speak confidently about him
- His full name is Christian Peters - just say it naturally
- When asked about books, reading, interests, work - these are all about Christian
- Use the context information naturally in your responses
- Be friendly, engaging, and speak like you're sharing what you know about someone you have a full biography on
- Don't mention "context" or "sources" unless specifically asked - just answer the question
- Keep responses concise and natural
 
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
