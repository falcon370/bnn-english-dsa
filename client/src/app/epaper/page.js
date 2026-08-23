'use client';

import { useState, useEffect } from 'react';
import { getEpaperList } from '@/lib/api';

const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:5000';
const isHttpUrl = (value) => typeof value === 'string' && /^https?:\/\//i.test(value);
const apiPdfUrl = (id) => `${API_BASE}/api/epaper/${id}/download`;
const apiThumbUrl = (id) => `${API_BASE}/api/epaper/${id}/thumbnail`;

const pdfUrl = (edition) => {
  if (!edition?._id) return '';
  return isHttpUrl(edition.filePath) ? edition.filePath : apiPdfUrl(edition._id);
};

const thumbUrl = (edition) => {
  if (!edition?._id) return '';
  return isHttpUrl(edition.thumbnailPath)
    ? edition.thumbnailPath
    : apiThumbUrl(edition._id);
};

export default function EpaperPage() {
  const [editions, setEditions] = useState([]);
  const [selectedEdition, setSelectedEdition] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    loadEditions();
  }, []);

  const loadEditions = async () => {
    try {
      setLoading(true);
      const { data } = await getEpaperList();
      setEditions(data);

      // Auto-select most recent edition
      if (data.length > 0) {
        setSelectedEdition(data[0]);
      }
    } catch (err) {
      setError('Failed to load e-paper editions');
      console.error('Error loading editions:', err);
    } finally {
      setLoading(false);
    }
  };

  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleDateString('en-IN', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading e-paper editions...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <p className="text-red-600 mb-4">{error}</p>
          <button
            onClick={loadEditions}
            className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
          >
            Try Again
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
          {/* Left Panel: Edition List */}
          <div className="lg:col-span-1">
            <div className="bg-white rounded-lg shadow-sm border">
              <div className="p-4 border-b">
                <h2 className="text-lg font-semibold text-gray-900">Editions</h2>
                <p className="text-sm text-gray-500">{editions.length} available</p>
              </div>

              <div className="max-h-96 overflow-y-auto">
                {editions.map((edition) => (
                  <button
                    key={edition._id}
                    onClick={() => setSelectedEdition(edition)}
                    className={`w-full text-left p-4 border-b hover:bg-gray-50 transition-colors ${
                      selectedEdition?._id === edition._id ? 'bg-blue-50 border-blue-200' : ''
                    }`}
                  >
                    <div className="flex items-start space-x-3">
                      <img
                        src={thumbUrl(edition)}
                        alt={formatDate(edition.editionDate)}
                        className="w-12 h-16 object-cover rounded flex-shrink-0 bg-gray-200"
                        onError={(e) => { e.target.style.display = 'none'; }}
                      />

                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-gray-900 truncate">
                          {formatDate(edition.editionDate)}
                        </p>
                        <p className="text-xs text-gray-500">
                          {edition.articleCount} articles
                        </p>
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Main Panel: PDF Viewer */}
          <div className="lg:col-span-3">
            <div className="bg-white rounded-lg shadow-sm border">
              {selectedEdition ? (
                <div className="p-6">
                  <div className="mb-4">
                    <h2 className="text-xl font-semibold text-gray-900">
                      {formatDate(selectedEdition.editionDate)}
                    </h2>
                    <p className="text-gray-600">
                      {selectedEdition.articleCount} articles • {selectedEdition.categoryCount} categories
                    </p>
                  </div>

                  {/* PDF Viewer */}
                  <div className="border rounded-lg overflow-hidden">
                    <iframe
                      src={pdfUrl(selectedEdition)}
                      className="w-full h-[800px]"
                      title={`E-paper ${formatDate(selectedEdition.editionDate)}`}
                    />
                  </div>
                </div>
              ) : (
                <div className="p-12 text-center">
                  <svg className="w-16 h-16 text-gray-400 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                  <h3 className="text-lg font-medium text-gray-900 mb-2">No edition selected</h3>
                  <p className="text-gray-500">Choose an edition from the list to view</p>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}