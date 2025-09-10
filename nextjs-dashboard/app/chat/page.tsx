'use client';

import { useState, useRef, useEffect } from 'react';
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
  const inputRef = useRef<HTMLInputElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, status]);

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
      inputRef.current?.focus();
    }
    catch (error) {
      setError(error instanceof Error ? error.message : 'Not an error');
    }
  };

  return (
    <div className="flex flex-col h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 px-6 py-4 shadow-sm">
        <div className="flex items-center space-x-3">
          <div className="w-10 h-10 bg-blue-500 rounded-full flex items-center justify-center">
            <span className="text-white font-semibold">AI</span>
          </div>
          <div>
            <h1 className="text-lg font-semibold text-gray-900">Ask About Christian</h1>
          </div>
        </div>
      </div>

      {/* Messages Container */}
      <div className="flex-1 overflow-y-auto px-4 py-6 space-y-4">
        {messages.length === 0 && (
          <div className="text-center text-gray-500 mt-20">
            <div className="w-16 h-16 bg-gray-200 rounded-full mx-auto mb-4 flex items-center justify-center">
              <span className="text-2xl">💬</span>
            </div>
            <p className="text-lg font-medium">Start a conversation</p>
            <p className="text-sm">Ask me about Christian's reading, interests, or anything else!</p>
          </div>
        )}
        
        {messages.map((message) => (
          <div key={message.id} className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}>
            <div className={`max-w-xs lg:max-w-md px-4 py-2 rounded-2xl ${
              message.role === 'user' 
                ? 'bg-blue-500 text-white ml-auto' 
                : 'bg-white text-gray-900 shadow-sm border border-gray-200'
            }`}>
              {message.parts.map((part, index) => (
                part.type === 'text' ? (
                  <p key={index} className="text-sm whitespace-pre-wrap">
                    {part.text}
                    {/* Show cursor for streaming assistant messages */}
                    {message.role === 'assistant' && status === 'streaming' && index === message.parts.length - 1 && (
                      <span className="inline-block w-2 h-4 bg-gray-400 ml-1 animate-pulse"></span>
                    )}
                  </p>
                ) : null
              ))}
            </div>
          </div>
        ))}
        
        <div ref={messagesEndRef} />
      </div>

      {/* Error Message */}
      {error && (
        <div className="px-4 py-2 bg-red-50 border-t border-red-100">
          <p className="text-red-600 text-sm text-center">{error}</p>
        </div>
      )}

      {/* Input Area */}
      <div className="bg-white border-t border-gray-200 px-4 py-4">
        <form onSubmit={handleSubmit} className="flex items-end space-x-3">
          <div className="flex-1">
            <input
              ref={inputRef}
              type="text"
              id="question"
              value={question}
              onChange={(e) => setQuestion(e.target.value)}
              placeholder="Type your message..."
              className="w-full px-4 py-3 border border-gray-300 rounded-full focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
              disabled={status !== 'ready'}
            />
          </div>
          <button
            type="submit"
            disabled={status !== 'ready' || !question.trim()}
            className="bg-blue-500 text-white p-3 rounded-full hover:bg-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
            </svg>
          </button>
        </form>
      </div>
    </div>
  );
}
