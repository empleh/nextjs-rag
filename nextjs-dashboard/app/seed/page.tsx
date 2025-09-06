'use client';

import { useState } from 'react';

interface SeedMessage {
  id: number;
  message: string;
  type: 'info' | 'success' | 'error' | 'warning';
  timestamp: Date;
}

export default function SeedPage() {
  const [messages, setMessages] = useState<SeedMessage[]>([]);
  const [isSeeding, setIsSeeding] = useState(false);

  const addMessage = (message: string, type: SeedMessage['type'] = 'info') => {
    const newMessage: SeedMessage = {
      id: Date.now(),
      message,
      type,
      timestamp: new Date(),
    };
    setMessages(prev => [...prev, newMessage]);
  };

  const clearMessages = () => {
    setMessages([]);
  };

  const startSeeding = async () => {
    setIsSeeding(true);
    clearMessages();
    
    addMessage('🌱 Starting seeding process...', 'info');

    try {
      const response = await fetch('/api/seed', {
        method: 'GET', // Current route uses GET
        headers: {
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || `HTTP ${response.status}: ${response.statusText}`);
      }

      const data = await response.json();
      
      if (data.message) {
        addMessage(`✅ ${data.message}`, 'success');
        addMessage(`📊 Database tables created and seeded`, 'success');
      } else if (data.error) {
        addMessage(`❌ Seeding failed: ${data.error}`, 'error');
      } else {
        addMessage(`✅ Seeding completed successfully!`, 'success');
      }
    } catch (error) {
      console.error('Seeding error:', error);
      addMessage(`❌ Error: ${error instanceof Error ? error.message : String(error)}`, 'error');
    } finally {
      setIsSeeding(false);
      addMessage('🏁 Seeding process finished', 'info');
    }
  };

  const getMessageColor = (type: SeedMessage['type']) => {
    switch (type) {
      case 'success': return 'text-green-600 bg-green-50 border-green-200';
      case 'error': return 'text-red-600 bg-red-50 border-red-200';
      case 'warning': return 'text-yellow-600 bg-yellow-50 border-yellow-200';
      default: return 'text-blue-600 bg-blue-50 border-blue-200';
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-4xl mx-auto px-4">
        <div className="bg-white rounded-lg shadow-md">
          {/* Header */}
          <div className="border-b border-gray-200 px-6 py-4">
            <h1 className="text-2xl font-bold text-gray-900">Database Seeding</h1>
            <p className="text-gray-600 mt-1">
              Initialize PostgreSQL database tables with sample data and schema
            </p>
          </div>

          {/* Controls */}
          <div className="px-6 py-4 border-b border-gray-200 bg-gray-50">
            <div className="flex items-center justify-between">
              <div className="flex space-x-3">
                <button
                  onClick={startSeeding}
                  disabled={isSeeding}
                  className="bg-blue-600 text-white px-6 py-2 rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  {isSeeding ? (
                    <>
                      <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white inline" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                      </svg>
                      Seeding...
                    </>
                  ) : (
                    '🌱 Start Seeding'
                  )}
                </button>

                <button
                  onClick={clearMessages}
                  disabled={isSeeding}
                  className="bg-gray-200 text-gray-700 px-4 py-2 rounded-md hover:bg-gray-300 focus:outline-none focus:ring-2 focus:ring-gray-500 focus:ring-offset-2 disabled:opacity-50 transition-colors"
                >
                  Clear Messages
                </button>
              </div>

              <div className="text-sm text-gray-500">
                Status: <span className={`font-medium ${isSeeding ? 'text-blue-600' : 'text-gray-700'}`}>
                  {isSeeding ? 'Running' : 'Ready'}
                </span>
              </div>
            </div>
          </div>

          {/* Messages */}
          <div className="px-6 py-4">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Output Messages</h2>
            
            <div className="bg-gray-900 rounded-lg p-4 h-96 overflow-y-auto">
              {messages.length === 0 ? (
                <div className="text-gray-400 text-center mt-20">
                  <div className="text-4xl mb-4">📋</div>
                  <p>No messages yet. Click "Start Seeding" to begin.</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {messages.map((msg) => (
                    <div
                      key={msg.id}
                      className={`px-3 py-2 rounded border text-sm ${getMessageColor(msg.type)}`}
                    >
                      <div className="flex items-center justify-between">
                        <span className="font-mono">{msg.message}</span>
                        <span className="text-xs opacity-75">
                          {msg.timestamp.toLocaleTimeString()}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Info */}
          <div className="px-6 py-4 bg-gray-50 border-t border-gray-200 rounded-b-lg">
            <div className="text-sm text-gray-600">
              <h3 className="font-medium text-gray-900 mb-2">What this does:</h3>
              <ul className="list-disc list-inside space-y-1">
                <li>Creates PostgreSQL database tables (users, customers, invoices, revenue)</li>
                <li>Sets up scraped_content and content_chunks tables</li>
                <li>Inserts sample data for the dashboard</li>
                <li>Initializes database schema for the application</li>
              </ul>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}