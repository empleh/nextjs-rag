'use client';

import { useState } from 'react';
import { apiClient } from '../lib/api-client';

export default function ScrapePage() {
  const [url, setUrl] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [result, setResult] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);

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
                disabled={isLoading}
              />
            </div>

            <button
              type="submit"
              disabled={isLoading}
              className="w-full bg-blue-600 text-white py-2 px-4 rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isLoading ? 'Scraping...' : 'Scrape URL'}
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
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
