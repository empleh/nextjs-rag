'use client';

import { useState, useEffect } from 'react';
import { apiClient } from '../lib/api-client';

export default function ScrapePage() {
  const [url, setUrl] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [result, setResult] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);
  const [isScrapingEnabled, setIsScrapingEnabled] = useState(true);

  // Check if scraping is enabled
  useEffect(() => {
    setIsScrapingEnabled(process.env.NODE_ENV !== 'production');
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    try {
      setIsLoading(true);
      setResult(null);

      if (!url) {
        setError('Please enter a URL');
        return;
      }

      const request = { url };
      const response = await apiClient.post('/api/scrape', request);

      if (!response.success) {
        setError(response.messages[0]);
        return;
      }

      setResult(response.data);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-100 py-8">
      <div className="max-w-2xl mx-auto px-4">
        <h1 className="text-3xl font-bold text-gray-900 mb-8">Web Scraper</h1>

        {!isScrapingEnabled && (
          <div className="mb-6 p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
            <div className="flex">
              <div className="flex-shrink-0">
                <svg className="h-5 w-5 text-yellow-400" viewBox="0 0 20 20" fill="currentColor">
                  <path
                    fillRule="evenodd"
                    d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z"
                    clipRule="evenodd"
                  />
                </svg>
              </div>
              <div className="ml-3">
                <h3 className="text-sm font-medium text-yellow-800">Scraping Disabled</h3>
                <p className="mt-1 text-sm text-yellow-700">
                  Web scraping is disabled.
                </p>
              </div>
            </div>
          </div>
        )}

        <div className="bg-white shadow-md rounded-lg p-6">
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label htmlFor="url" className="block text-sm font-medium text-gray-700 mb-2">
                URL to Scrape
              </label>
              <input
                type="url"
                id="url"
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                placeholder="https://example.com"
                className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                disabled={isLoading || !isScrapingEnabled}
              />
            </div>

            <button
              type="submit"
              disabled={isLoading || !isScrapingEnabled}
              className="w-full bg-blue-600 text-white py-2 px-4 rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {!isScrapingEnabled ? 'Scraping Disabled' : isLoading ? 'Scraping...' : 'Scrape URL'}
            </button>
          </form>
          {error && (
            <div className="mt-4 p-4 bg-red-50 border border-red-200 rounded-md">
              <p className="text-red-600">{error}</p>
            </div>
          )}
          {result && (
            <div className="mt-6 space-y-4">
              <h2 className="text-xl font-semibold text-gray-900">Scraping Results</h2>

              <div className="bg-green-50 border border-green-200 rounded-md p-4">
                <p className="text-green-600 font-medium">{result.message}</p>
              </div>

              {result.data && (
                <>
                  <div className="bg-gray-50 border border-gray-200 rounded-md p-4">
                    <h3 className="font-medium text-gray-900 mb-2">Scraped Content:</h3>
                    <div className="space-y-2 text-sm text-gray-600">
                      <p>
                        <strong>ID:</strong> {result.data.id}
                      </p>
                      <p>
                        <strong>URL:</strong> {result.data.url}
                      </p>
                      <p>
                        <strong>Title:</strong> {result.data.title}
                      </p>
                      <p>
                        <strong>Chunks Processed:</strong> {result.data.chunksProcessed}
                      </p>
                      {result.data.deletedVectors > 0 && (
                        <p>
                          <strong>Previous Vectors Deleted:</strong> {result.data.deletedVectors}
                        </p>
                      )}
                    </div>
                  </div>

                  {result.data.chunks && result.data.chunks.length > 0 && (
                    <div className="bg-white border border-gray-200 rounded-md p-4">
                      <h3 className="font-medium text-gray-900 mb-4">Content Chunks ({result.data.chunks.length})</h3>
                      <div className="space-y-4 max-h-96 overflow-y-auto">
                        {result.data.chunks.map((chunk: any, index: number) => (
                          <div key={index} className="border border-gray-100 rounded-md p-3 bg-gray-50">
                            <div className="flex justify-between items-center mb-2">
                              <span className="text-xs font-medium text-blue-600 bg-blue-100 px-2 py-1 rounded">Chunk {chunk.index + 1}</span>
                              <span className="text-xs text-gray-500">{chunk.length} characters</span>
                            </div>
                            <div className="text-sm text-gray-700">
                              <div className="mb-2">
                                <strong className="text-gray-900">Preview:</strong>
                              </div>
                              <div className="bg-white p-2 rounded border text-xs leading-relaxed">{chunk.preview}</div>
                              <details className="mt-2">
                                <summary className="cursor-pointer text-blue-600 text-xs hover:underline">Show full content</summary>
                                <div className="mt-2 bg-white p-2 rounded border text-xs leading-relaxed max-h-40 overflow-y-auto">{chunk.content}</div>
                              </details>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
