'use client';

import { useState, useEffect, useRef } from 'react';
import { apiClient } from '../lib/api-client';

type ContentType = 'url' | 'pdf';

export default function ScrapePage() {
  const [contentType, setContentType] = useState<ContentType>('url');
  const [url, setUrl] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [title, setTitle] = useState('Resume');
  const [isLoading, setIsLoading] = useState(false);
  const [result, setResult] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);
  const [isScrapingEnabled, setIsScrapingEnabled] = useState(true);
  const [dragOver, setDragOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Check if scraping is enabled
  useEffect(() => {
    setIsScrapingEnabled(process.env.NODE_ENV !== 'production');
  }, []);

  const handleFileSelect = (selectedFile: File) => {
    if (selectedFile.type === 'application/pdf') {
      setFile(selectedFile);
      setError(null);
      // Auto-generate title from filename
      const filename = selectedFile.name.replace('.pdf', '');
      setTitle(filename);
    } else {
      setError('Please select a PDF file');
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    
    const droppedFile = e.dataTransfer.files[0];
    if (droppedFile) {
      handleFileSelect(droppedFile);
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
  };

  const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (selectedFile) {
      handleFileSelect(selectedFile);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    try {
      setIsLoading(true);
      setResult(null);

      if (contentType === 'url') {
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
      } else {
        // PDF upload
        if (!file) {
          setError('Please select a PDF file');
          return;
        }

        if (!title.trim()) {
          setError('Please enter a title');
          return;
        }

        const formData = new FormData();
        formData.append('file', file);
        formData.append('title', title.trim());

        const response = await fetch('/api/upload-pdf', {
          method: 'POST',
          body: formData,
        });

        const data = await response.json();

        if (!response.ok) {
          setError(data.error || 'Upload failed');
          return;
        }

        setResult(data);
        // Clear form
        setFile(null);
        setTitle('Resume');
        if (fileInputRef.current) {
          fileInputRef.current.value = '';
        }
      }
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-100 py-8">
      <div className="max-w-2xl mx-auto px-4">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">Add Content</h1>
          <p className="text-gray-600">Scrape web content or upload PDF documents to add to the knowledge base.</p>
        </div>

        {/* Content Type Tabs */}
        <div className="mb-6">
          <div className="flex space-x-1 rounded-lg bg-gray-200 p-1">
            <button
              type="button"
              onClick={() => {
                setContentType('url');
                setResult(null);
                setError(null);
              }}
              className={`flex-1 px-3 py-2 text-sm font-medium rounded-md transition-colors ${
                contentType === 'url'
                  ? 'bg-white text-blue-600 shadow-sm'
                  : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              🌐 Web URL
            </button>
            <button
              type="button"
              onClick={() => {
                setContentType('pdf');
                setResult(null);
                setError(null);
              }}
              className={`flex-1 px-3 py-2 text-sm font-medium rounded-md transition-colors ${
                contentType === 'pdf'
                  ? 'bg-white text-blue-600 shadow-sm'
                  : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              📄 PDF Upload
            </button>
          </div>
        </div>

        {!isScrapingEnabled && contentType === 'url' && (
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
                <h3 className="text-sm font-medium text-yellow-800">Web Scraping Disabled</h3>
                <p className="mt-1 text-sm text-yellow-700">
                  Web scraping is disabled in production. PDF upload is still available.
                </p>
              </div>
            </div>
          </div>
        )}

        <div className="bg-white shadow-md rounded-lg p-6">
          <form onSubmit={handleSubmit} className="space-y-6">
            {contentType === 'url' ? (
              /* URL Scraping Form */
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
            ) : (
              /* PDF Upload Form */
              <>
                {/* File Drop Zone */}
                <div
                  className={`border-2 border-dashed rounded-lg p-8 text-center transition-colors cursor-pointer ${
                    dragOver
                      ? 'border-blue-500 bg-blue-50'
                      : file
                      ? 'border-green-500 bg-green-50'
                      : 'border-gray-300 hover:border-gray-400'
                  }`}
                  onDrop={handleDrop}
                  onDragOver={handleDragOver}
                  onDragLeave={handleDragLeave}
                  onClick={() => fileInputRef.current?.click()}
                >
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept=".pdf"
                    onChange={handleFileInputChange}
                    className="hidden"
                  />
                  
                  {file ? (
                    <div className="space-y-2">
                      <svg className="w-12 h-12 mx-auto text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                      <div>
                        <p className="text-green-600 font-medium">{file.name}</p>
                        <p className="text-sm text-gray-500">{(file.size / 1024).toFixed(1)} KB</p>
                      </div>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      <svg className="w-12 h-12 mx-auto text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                      </svg>
                      <div>
                        <p className="text-lg font-medium text-gray-900">Drop PDF here or click to select</p>
                        <p className="text-sm text-gray-500">Only PDF files are accepted</p>
                      </div>
                    </div>
                  )}
                </div>

                {/* Title Input */}
                <div>
                  <label htmlFor="title" className="block text-sm font-medium text-gray-700 mb-2">
                    Document Title
                  </label>
                  <input
                    type="text"
                    id="title"
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    placeholder="e.g., John Doe Resume, CV, etc."
                    className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    disabled={isLoading}
                  />
                  <p className="mt-1 text-sm text-gray-500">This helps identify the document in the knowledge base</p>
                </div>
              </>
            )}

            <button
              type="submit"
              disabled={isLoading || (contentType === 'url' && !isScrapingEnabled) || (contentType === 'pdf' && !file)}
              className="w-full bg-blue-600 text-white py-3 px-4 rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {isLoading ? (
                <div className="flex items-center justify-center space-x-2">
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                  <span>
                    {contentType === 'url' ? 'Scraping...' : 'Processing PDF...'}
                  </span>
                </div>
              ) : contentType === 'url' ? (
                !isScrapingEnabled ? 'Web Scraping Disabled' : 'Scrape URL'
              ) : (
                'Upload & Process PDF'
              )}
            </button>
          </form>
          {error && (
            <div className="mt-4 p-4 bg-red-50 border border-red-200 rounded-md">
              <p className="text-red-600">{error}</p>
            </div>
          )}
          {result && (
            <div className="mt-6 space-y-4">
              <h2 className="text-xl font-semibold text-gray-900">
                {contentType === 'url' ? 'Scraping Results' : 'Upload Results'}
              </h2>

              <div className="bg-green-50 border border-green-200 rounded-md p-4">
                <p className="text-green-600 font-medium">{result.message}</p>
              </div>

              {result.data && (
                <>
                  <div className="bg-gray-50 border border-gray-200 rounded-md p-4">
                    <h3 className="font-medium text-gray-900 mb-2">
                      {contentType === 'url' ? 'Scraped Content:' : 'Document Information:'}
                    </h3>
                    <div className="space-y-2 text-sm text-gray-600">
                      {contentType === 'url' ? (
                        <>
                          <p><strong>ID:</strong> {result.data.id}</p>
                          <p><strong>URL:</strong> {result.data.url}</p>
                          <p><strong>Title:</strong> {result.data.title}</p>
                          <p><strong>Chunks Processed:</strong> {result.data.chunksProcessed}</p>
                        </>
                      ) : (
                        <>
                          <p><strong>Title:</strong> {result.data.title}</p>
                          <p><strong>Original File:</strong> {result.data.originalFileName}</p>
                          <p><strong>File Size:</strong> {(result.data.fileSize / 1024).toFixed(1)} KB</p>
                          <p><strong>Text Length:</strong> {result.data.textLength?.toLocaleString()} characters</p>
                          <p><strong>Chunks Processed:</strong> {result.data.chunksProcessed}</p>
                        </>
                      )}
                      {result.data.deletedVectors > 0 && (
                        <p>
                          <strong>Previous Vectors {contentType === 'url' ? 'Deleted' : 'Replaced'}:</strong> {result.data.deletedVectors}
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
                        {result.data.chunks.length > 5 && (
                          <p className="text-sm text-gray-500 text-center">... and {result.data.chunks.length - 5} more chunks</p>
                        )}
                      </div>
                    </div>
                  )}

                  {/* Call to Action */}
                  <div className="bg-blue-50 border border-blue-200 rounded-md p-4">
                    <p className="text-blue-800">
                      <strong>Next step:</strong> Go to the <a href="/chat" className="underline hover:text-blue-900">chat page</a> to ask questions about the {contentType === 'url' ? 'scraped' : 'uploaded'} content!
                    </p>
                  </div>
                </>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
