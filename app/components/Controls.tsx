'use client';

interface ControlsProps {
  isPlaying: boolean;
  onPlayPause: () => void;
  onRestart: () => void;
  onNewFile: () => void;
  hasContent: boolean;
}

export default function Controls({
  isPlaying,
  onPlayPause,
  onRestart,
  onNewFile,
  hasContent,
}: ControlsProps) {
  return (
    <div className="flex items-center justify-center gap-4">
      {/* Restart Button */}
      <button
        onClick={onRestart}
        disabled={!hasContent}
        className={`
          p-3 rounded-lg transition-colors
          ${hasContent
            ? 'bg-gray-700 hover:bg-gray-600 text-white'
            : 'bg-gray-800 text-gray-600 cursor-not-allowed'
          }
        `}
        title="Restart (R)"
      >
        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
          />
        </svg>
      </button>

      {/* Play/Pause Button */}
      <button
        onClick={onPlayPause}
        disabled={!hasContent}
        className={`
          p-4 rounded-full transition-colors
          ${hasContent
            ? 'bg-blue-600 hover:bg-blue-500 text-white'
            : 'bg-gray-800 text-gray-600 cursor-not-allowed'
          }
        `}
        title="Play/Pause (Space)"
      >
        {isPlaying ? (
          <svg className="w-8 h-8" fill="currentColor" viewBox="0 0 24 24">
            <rect x="6" y="4" width="4" height="16" />
            <rect x="14" y="4" width="4" height="16" />
          </svg>
        ) : (
          <svg className="w-8 h-8" fill="currentColor" viewBox="0 0 24 24">
            <path d="M8 5v14l11-7z" />
          </svg>
        )}
      </button>

      {/* New File Button */}
      <button
        onClick={onNewFile}
        className="p-3 rounded-lg bg-gray-700 hover:bg-gray-600 text-white transition-colors"
        title="Upload New File (N)"
      >
        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M9 13h6m-3-3v6m5 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
          />
        </svg>
      </button>
    </div>
  );
}
