'use client';

import { useState } from 'react';

interface FirestoreSchedule {
  side: 'North' | 'South' | 'Both';
  dayOfWeek: number;
  startTime: string;
  endTime: string;
  weeksOfMonth: number[];
}

interface StreetSegmentDoc {
  id: string;
  cnn: string;
  streetName: string;
  fromAddress: string;
  toAddress: string;
  geometry: string;
  schedules: FirestoreSchedule[];
  syncVersion: string;
}

interface DebugData {
  count: number;
  segments: StreetSegmentDoc[];
  error?: string;
}

interface Props {
  data: DebugData;
}

export function DebugDataDisplay({ data }: Props) {
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const copyToClipboard = async (text: string, id: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedId(id);
      setTimeout(() => setCopiedId(null), 2000);
    } catch (err) {
      console.error('Failed to copy:', err);
    }
  };

  const handleCopyAll = () => {
    copyToClipboard(JSON.stringify(data, null, 2), 'all');
  };

  const handleCopySegment = (segment: StreetSegmentDoc) => {
    copyToClipboard(JSON.stringify(segment, null, 2), segment.id);
  };

  return (
    <div className="min-h-screen bg-gray-50 p-8">
      <div className="max-w-7xl mx-auto">
        <div className="bg-white rounded-lg shadow-md p-6 mb-6">
          <h1 className="text-3xl font-bold mb-2">Firestore Debug - Street Segments</h1>
          <p className="text-gray-600 mb-4">
            Displaying raw data from the <code className="bg-gray-100 px-2 py-1 rounded">streetSegments</code> collection
          </p>

          {data.error ? (
            <div className="bg-red-50 border border-red-200 rounded p-4 mb-4">
              <p className="text-red-800 font-semibold">Error loading data:</p>
              <p className="text-red-600 font-mono text-sm">{data.error}</p>
            </div>
          ) : (
            <div className="bg-blue-50 border border-blue-200 rounded p-4 mb-4">
              <p className="text-blue-800">
                <strong>Total documents:</strong> {data.count} (showing first 100)
              </p>
            </div>
          )}

          <div className="mb-4">
            <button
              onClick={handleCopyAll}
              className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700 transition-colors"
            >
              {copiedId === 'all' ? '✓ Copied!' : 'Copy All Data (JSON)'}
            </button>
          </div>
        </div>

        <div className="space-y-6">
          {data.segments.map((segment, index) => (
            <div key={segment.id} className="bg-white rounded-lg shadow-md p-6">
              <div className="flex justify-between items-start mb-4">
                <div>
                  <h2 className="text-xl font-bold text-gray-800">
                    {index + 1}. {segment.streetName}
                  </h2>
                  <p className="text-gray-600 text-sm">
                    {segment.fromAddress} - {segment.toAddress}
                  </p>
                  <p className="text-gray-500 text-xs font-mono mt-1">
                    CNN: {segment.cnn} | ID: {segment.id}
                  </p>
                </div>
                <button
                  onClick={() => handleCopySegment(segment)}
                  className="bg-gray-600 text-white px-3 py-1 rounded text-sm hover:bg-gray-700 transition-colors"
                >
                  {copiedId === segment.id ? '✓ Copied!' : 'Copy'}
                </button>
              </div>

              <div className="grid grid-cols-1 gap-4">
                {/* Schedules */}
                <div>
                  <h3 className="font-semibold text-gray-700 mb-2">Schedules:</h3>
                  <div className="bg-gray-50 p-3 rounded">
                    {segment.schedules && segment.schedules.length > 0 ? (
                      <ul className="space-y-2">
                        {segment.schedules.map((schedule, idx) => (
                          <li key={idx} className="text-sm">
                            <span className="font-medium">{schedule.side}:</span>{' '}
                            Day {schedule.dayOfWeek}, {schedule.startTime}-{schedule.endTime},{' '}
                            Weeks: [{schedule.weeksOfMonth.join(', ')}]
                          </li>
                        ))}
                      </ul>
                    ) : (
                      <p className="text-gray-500 text-sm">No schedules</p>
                    )}
                  </div>
                </div>

                {/* Geometry Preview */}
                <div>
                  <h3 className="font-semibold text-gray-700 mb-2">Geometry (JSON string):</h3>
                  <div className="bg-gray-50 p-3 rounded">
                    <pre className="text-xs overflow-x-auto text-gray-700 whitespace-pre-wrap break-all">
                      {segment.geometry}
                    </pre>
                  </div>
                </div>

                {/* Parsed Geometry */}
                <div>
                  <h3 className="font-semibold text-gray-700 mb-2">Parsed Geometry:</h3>
                  <div className="bg-gray-50 p-3 rounded">
                    <pre className="text-xs overflow-x-auto text-gray-700">
                      {JSON.stringify(JSON.parse(segment.geometry), null, 2)}
                    </pre>
                  </div>
                </div>

                {/* Raw Document */}
                <div>
                  <h3 className="font-semibold text-gray-700 mb-2">Full Raw Document:</h3>
                  <div className="bg-gray-900 p-3 rounded">
                    <pre className="text-xs overflow-x-auto text-green-400">
                      {JSON.stringify(segment, null, 2)}
                    </pre>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>

        {data.segments.length === 0 && !data.error && (
          <div className="bg-yellow-50 border border-yellow-200 rounded p-6 text-center">
            <p className="text-yellow-800">No street segments found in the collection.</p>
          </div>
        )}
      </div>
    </div>
  );
}
