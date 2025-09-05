import { NextRequest, NextResponse } from 'next/server';
import { google } from '@ai-sdk/google';
import { convertToModelMessages, streamText } from 'ai';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { messages } = body;

    if (!messages) {
      return NextResponse.json({ error: 'Question is required' }, { status: 400 });
    }

    const result = streamText({
      model: google('gemini-1.5-flash'),
      system: 'You are a helpful assistant.',
      messages:  convertToModelMessages(messages),
    });

    return result.toUIMessageStreamResponse();
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
