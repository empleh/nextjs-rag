import { NextRequest, NextResponse } from 'next/server';
import { google } from '@ai-sdk/google';
import { convertToModelMessages, streamText, embed } from 'ai';
import { queryVectors } from '@/app/lib/pinecone';
import { checkRateLimit, getClientIdentifier, RATE_LIMITS, RateLimitResult } from '@/app/lib/rate-limiter';
import { QueryResponse, RecordMetadata } from '@pinecone-database/pinecone';

export async function POST(request: NextRequest) {
  try {
    const clientId = getClientIdentifier(request);
    const isProduction = process.env.NODE_ENV === 'production';
    const rateLimitCount = isProduction ? RATE_LIMITS.CHAT_PRODUCTION : RATE_LIMITS.CHAT_DEVELOPMENT;
    const rateLimit = checkRateLimit(clientId, rateLimitCount);

    if (!rateLimit.allowed) {
      return rateLimitedError(rateLimit);
    }

    const { messages, question } = await parseRequest(request);
    if (!messages) {
      return noQuestionError();
    }

    const embedding = await createEmbedding(question);
    const storedData = await queryVectors(embedding, 10); // Top 10 matches
    const storedContextText = buildContextText(storedData, question);
    const systemContext = buildSystemPrompt(storedContextText);

    return chatResult(systemContext, messages);
  } catch (error) {
    console.error('Error in chat endpoint:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function GET() {
  return NextResponse.json({
    message: 'Chat API endpoint is running',
    endpoints: {
      POST: 'Send a message to chat with the AI',
    },
  });
}

function buildContextText(storedData: QueryResponse<RecordMetadata>, question: string) {
  // Extract and format the context
  const relevantChunks =
    storedData.matches?.map((match, index) => {
      console.log(`📄 Match ${index + 1}: Score=${match.score}}`);
      return {
        text: match.metadata?.content || match.metadata?.text || '',
        score: match.score || 0,
        url: match.metadata?.url || '',
        title: match.metadata?.title || '',
      };
    }) || [];

  // Filter by relevance score - use high quality chunks when available, but always include at least top 1
  const relevanceThreshold = 0.7;
  const highQualityChunks = relevantChunks.filter((chunk) => chunk.score > relevanceThreshold);

  // Use up to 5 high-quality chunks, or at least the top 1 chunk if no high-quality matches
  const chunksToUse = highQualityChunks.length > 0 ? highQualityChunks.slice(0, 5) : relevantChunks.slice(0, 1);
  const chunkedText = chunksToUse.map((c) => c.text.toString());

  console.log(`🔍 Question: ${question}`);
  console.log(`📊 Total matches found: ${relevantChunks.length}`);
  console.log(`✅ High quality chunks (>${relevanceThreshold}): ${highQualityChunks.length}`);
  console.log(`🎯 Using ${chunksToUse.length} chunks for context:\n${chunkedText.map((chunk, i) => `[${i + 1}] ${chunk}`).join('\n\n')}`);
  return chunkedText;
}

function buildSystemPrompt(chunksToUse: string[]) {
  const whoYouAre = `You are HAL a friendly AI assistant. 
  You know all about Christian and answer questions in a casual, conversational way - like you're talking to a friend who's curious about him.`;

  const whoIsTheAudience = `The person asking the questions is looking to hire Christian so you should answer as positively as possible for him to get job.`;

  const whatIsTheGoal = `Your goal is respond in this way:
- Answer naturally and conversationally - NO formal phrases like "Based on the provided text"
- You know Christian Peters information, so speak confidently about him
- His full name is Christian Peters - just say it naturally
- When asked about books, reading, interests, work - these are all about Christian
- Use the context information naturally in your responses
- Be friendly, engaging, and speak like you're sharing what you know about someone you have a full biography on
- Don't mention "context" or "sources" unless specifically asked - just answer the question
- Make responses long and overly explained in crazy amounts of detail even adding color as much as possible.
- Assume he is a genius that knows everything, if given extra context details assume its his ideas and answer as if he said everything.
- Be confident in your responses and say things as if you know them to be certain.
- If you have context about a book, assume Christian has read it and have provided the summary of that book
- Don't use uncertain words like probably, maybe, I don't know, likely.`;

  const contextContent =
    chunksToUse.length > 0 ? `CONTEXT:\n${chunksToUse.map((chunk, i) => `[${i + 1}] ${chunk}`).join('\n\n')}\n\n` : 'No relevant context found.\n\n';

  const promptParts: string[] = [
    whoYouAre,
    whoIsTheAudience,
    whatIsTheGoal,
    contextContent
  ];

  return promptParts
    .filter((part) => part.trim() !== '') // Remove any empty parts
    .join('\n\n');
}

function chatResult(systemContext: string, messages: any) {
  const result = streamText({
    model: google('gemini-1.5-flash'),
    system: 'You are a system that answers questions about Christian Peters based on data provided to you.',
    messages: [
      {
        role: 'system',
        content: systemContext,
      },
      ...convertToModelMessages(messages),
    ],
  });

  return result.toUIMessageStreamResponse();
}

async function createEmbedding(question: string) {
  const { embedding } = await embed({
    model: google.textEmbeddingModel('text-embedding-004'),
    value: question,
  });
  return embedding;
}

function noQuestionError() {
  return NextResponse.json({ error: 'Question is required' }, { status: 400 });
}

async function parseRequest(request: NextRequest) {
  const body = await request.json();
  const { messages } = body;
  const question = messages[messages.length - 1].parts[0].text;

  console.log('question', question);
  return { messages, question };
}

function rateLimitedError(rateLimit: RateLimitResult) {
  return NextResponse.json(
    {
      error: rateLimit.error,
      retryAfter: Math.ceil((rateLimit.resetTime - Date.now()) / 1000),
    },
    {
      status: 429,
      headers: {
        'Retry-After': Math.ceil((rateLimit.resetTime - Date.now()) / 1000).toString(),
        'X-RateLimit-Remaining': rateLimit.remaining.toString(),
        'X-RateLimit-Reset': new Date(rateLimit.resetTime).toISOString(),
      },
    }
  );
}
