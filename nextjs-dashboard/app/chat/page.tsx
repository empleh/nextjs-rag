'use client';

import { useState } from 'react';
import { useChat } from '@ai-sdk/react';
import { DefaultChatTransport } from 'ai';

export default function Page() {
  const { messages, sendMessage, status } = useChat({
    transport: new DefaultChatTransport({
      api: '/api/chat',
    }),
  });

  const [question, setQuestion] = useState('');
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    setError(null);

    try {

      if (!question) {
        setError('Please ask a question');
        return;
      }

      await sendMessage({ text: question });
      setQuestion('');
    }
    catch (error) {
      setError(error instanceof Error ? error.message : 'Not an error');
    }
  };

  return (
    <div className="min-h-screen bg-gray-100 py-8">
      <div className="max-w-2xl mx-auto px-4">
        <h1 className="text-3xl font-bold text-gray-900 mb-8">Chat Me</h1>
        <div className="bg-white shadow-md rounded-lg p-6">
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label htmlFor="question" className="block text-sm font-medium text-gray-700 mb-2">
                About Christian
              </label>
              <input
                type="text"
                id="question"
                value={question}
                onChange={(e) => setQuestion(e.target.value)}
                placeholder="How many books does Christian read a year?"
                className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                disabled={status !== 'ready'}
              />
            </div>

            <button
              type="submit"
              disabled={status !== 'ready'}
              className="w-full bg-blue-600 text-white py-2 px-4 rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {status !== 'ready' ? 'AI Thinking...' : 'Ask'}
            </button>
          </form>
          {error && (
            <div className="mt-4 p-4 bg-red-50 border border-red-200 rounded-md">
              <p className="text-red-600">{error}</p>
            </div>
          )}
          {messages.map((message) => (
            <div key={message.id}>
              {message.role === 'user' ? 'User: ' : 'AI: '}
              {message.parts.map((part, index) => (part.type === 'text' ? <span key={index}>{part.text}</span> : null))}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
