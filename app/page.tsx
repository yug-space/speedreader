'use client';

import { useState, useEffect, useCallback, useRef, useLayoutEffect } from 'react';
import { extractTextFromPDF, getORPIndex } from '@/lib/pdfParser';

export default function Home() {
  const [words, setWords] = useState<string[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [wpm, setWpm] = useState(400);
  const [isLoading, setIsLoading] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [progress, setProgress] = useState(0);
  const [progressMsg, setProgressMsg] = useState('');
  const [showControls, setShowControls] = useState(false);

  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const beforeRef = useRef<HTMLSpanElement>(null);
  const anchorRef = useRef<HTMLSpanElement>(null);
  const [wordLeft, setWordLeft] = useState(0);

  const currentWord = words[currentIndex] || '';

  const getWordParts = (word: string) => {
    if (!word) return { before: '', anchor: '', after: '' };
    // Center character = middle of word (length / 2)
    const centerIndex = Math.floor(word.length / 2);
    return {
      before: word.slice(0, centerIndex),
      anchor: word[centerIndex] || '',
      after: word.slice(centerIndex + 1),
    };
  };

  const { before, anchor, after } = getWordParts(currentWord);

  // Calculate position to center anchor character on screen
  useLayoutEffect(() => {
    if (beforeRef.current && anchorRef.current && typeof window !== 'undefined') {
      const beforeWidth = beforeRef.current.getBoundingClientRect().width;
      const anchorWidth = anchorRef.current.getBoundingClientRect().width;
      const screenCenter = window.innerWidth / 2;
      // Position word so anchor center is at screen center
      // Word left edge should be at: screenCenter - beforeWidth - anchorWidth/2
      const left = screenCenter - beforeWidth - (anchorWidth / 2);
      setWordLeft(left);
    }
  }, [currentWord, before, anchor]);

  const handleFileSelect = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setIsLoading(true);
    setShowSettings(false);
    try {
      const extractedWords = await extractTextFromPDF(file, (p, m) => {
        setProgress(p);
        setProgressMsg(m);
      });
      setWords(extractedWords);
      setCurrentIndex(0);
    } catch (error) {
      alert('Failed to read PDF');
    } finally {
      setIsLoading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  }, []);

  const togglePlay = useCallback(() => {
    if (words.length > 0) setIsPlaying((prev) => !prev);
  }, [words.length]);

  const skipWords = useCallback((count: number) => {
    setCurrentIndex((prev) => Math.max(0, Math.min(words.length - 1, prev + count)));
  }, [words.length]);

  useEffect(() => {
    if (isPlaying && words.length > 0) {
      intervalRef.current = setInterval(() => {
        setCurrentIndex((prev) => {
          if (prev >= words.length - 1) { setIsPlaying(false); return prev; }
          return prev + 1;
        });
      }, (60 / wpm) * 1000);
      return () => { if (intervalRef.current) clearInterval(intervalRef.current); };
    }
  }, [isPlaying, wpm, words.length]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement) return;
      if (e.code === 'Space') { e.preventDefault(); togglePlay(); }
      if (e.code === 'ArrowLeft') { e.preventDefault(); skipWords(-1); }
      if (e.code === 'ArrowRight') { e.preventDefault(); skipWords(1); }
      if (e.code === 'ArrowUp') { e.preventDefault(); skipWords(-10); }
      if (e.code === 'ArrowDown') { e.preventDefault(); skipWords(10); }
      if (e.code === 'KeyR') { e.preventDefault(); setCurrentIndex(0); setIsPlaying(false); }
      if (e.code === 'Escape') { e.preventDefault(); setShowSettings(false); }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [togglePlay, skipWords]);

  // No PDF loaded - show upload screen
  if (words.length === 0) {
    return (
      <main className="h-screen w-screen bg-black flex items-center justify-center">
        <input ref={fileInputRef} type="file" accept=".pdf" onChange={handleFileSelect} className="hidden" />

        {isLoading ? (
          <div className="text-center">
            <div className="text-gray-500 mb-3">{progressMsg}</div>
            <div className="w-64 h-1 bg-gray-800 rounded">
              <div className="h-full bg-gray-600 rounded transition-all" style={{ width: `${progress}%` }} />
            </div>
          </div>
        ) : (
          <div
            onClick={() => fileInputRef.current?.click()}
            className="border-2 border-dashed border-gray-700 hover:border-gray-500 rounded-2xl p-16 cursor-pointer transition-colors"
          >
            <div className="text-gray-500 text-center">
              <svg className="w-12 h-12 mx-auto mb-4 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
              <div className="text-lg">Drop PDF here or click to open</div>
            </div>
          </div>
        )}
      </main>
    );
  }

  // PDF loaded - show word reader
  return (
    <main
      className="h-screen w-screen bg-black flex items-center justify-center cursor-pointer select-none overflow-hidden"
      onClick={(e) => {
        if ((e.target as HTMLElement).closest('.settings')) return;
        togglePlay();
      }}
    >
      {/* Settings icon - always visible */}
      <button
        className="settings fixed top-4 right-4 p-2 text-white/50 hover:text-white transition-colors"
        onClick={(e) => { e.stopPropagation(); setShowSettings(!showSettings); }}
      >
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}>
          <path d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
          <circle cx="12" cy="12" r="3" />
        </svg>
      </button>

      {/* Settings dropdown */}
      {showSettings && (
        <div className="settings fixed top-12 right-4 bg-neutral-900 rounded-lg p-4 w-56 text-sm" onClick={(e) => e.stopPropagation()}>
          {/* Speed control */}
          <div className="flex justify-between text-gray-400 mb-2">
            <span>Speed</span>
            <span className="text-white">{wpm} WPM</span>
          </div>
          <input
            type="range" min={100} max={1200} step={25} value={wpm}
            onChange={(e) => setWpm(Number(e.target.value))}
            className="w-full h-1 bg-gray-700 rounded appearance-none [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-3 [&::-webkit-slider-thumb]:h-3 [&::-webkit-slider-thumb]:bg-white [&::-webkit-slider-thumb]:rounded-full"
          />

          {/* Navigation buttons */}
          <div className="flex gap-2 mt-4">
            <button
              onClick={() => skipWords(-1)}
              className="flex-1 py-2 bg-gray-800 hover:bg-gray-700 rounded text-gray-300 flex items-center justify-center gap-1"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
              Prev
            </button>
            <button
              onClick={() => skipWords(1)}
              className="flex-1 py-2 bg-gray-800 hover:bg-gray-700 rounded text-gray-300 flex items-center justify-center gap-1"
            >
              Next
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
            </button>
          </div>

          {/* Play/Pause button */}
          <button
            onClick={togglePlay}
            className="w-full mt-2 py-2 bg-gray-800 hover:bg-gray-700 rounded text-gray-300 flex items-center justify-center gap-2"
          >
            {isPlaying ? (
              <>
                <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M6 4h4v16H6V4zm8 0h4v16h-4V4z" />
                </svg>
                Pause
              </>
            ) : (
              <>
                <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M8 5v14l11-7z" />
                </svg>
                Play
              </>
            )}
          </button>

          {/* Show controls toggle */}
          <div className="flex items-center justify-between mt-4 pt-3 border-t border-gray-700">
            <span className="text-gray-400">Show controls</span>
            <button
              onClick={() => setShowControls(!showControls)}
              className={`w-10 h-5 rounded-full transition-colors ${showControls ? 'bg-red-500' : 'bg-gray-700'}`}
            >
              <div className={`w-4 h-4 bg-white rounded-full transition-transform mx-0.5 ${showControls ? 'translate-x-5' : ''}`} />
            </button>
          </div>

          {/* New PDF button */}
          <button
            onClick={() => { setWords([]); setCurrentIndex(0); setIsPlaying(false); setShowSettings(false); }}
            className="w-full mt-3 py-2 bg-gray-800 hover:bg-gray-700 rounded text-gray-300"
          >
            New PDF
          </button>

          {/* Progress info */}
          <div className="mt-3 pt-3 border-t border-gray-700 text-gray-500 text-xs text-center">
            Word {currentIndex + 1} of {words.length}
          </div>
        </div>
      )}

      {/* On-screen controls (when enabled) */}
      {showControls && (
        <div className="settings fixed bottom-8 left-1/2 -translate-x-1/2 flex items-center gap-4 bg-neutral-900/80 rounded-full px-6 py-3">
          <button onClick={() => skipWords(-10)} className="text-white/50 hover:text-white p-1">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 19l-7-7 7-7m8 14l-7-7 7-7" />
            </svg>
          </button>
          <button onClick={() => skipWords(-1)} className="text-white/50 hover:text-white p-1">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </button>
          <button onClick={togglePlay} className="text-white hover:text-red-400 p-2">
            {isPlaying ? (
              <svg className="w-8 h-8" fill="currentColor" viewBox="0 0 24 24">
                <path d="M6 4h4v16H6V4zm8 0h4v16h-4V4z" />
              </svg>
            ) : (
              <svg className="w-8 h-8" fill="currentColor" viewBox="0 0 24 24">
                <path d="M8 5v14l11-7z" />
              </svg>
            )}
          </button>
          <button onClick={() => skipWords(1)} className="text-white/50 hover:text-white p-1">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
          </button>
          <button onClick={() => skipWords(10)} className="text-white/50 hover:text-white p-1">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 5l7 7-7 7M5 5l7 7-7 7" />
            </svg>
          </button>
        </div>
      )}

      {/* Word display - anchor at exact screen center using JS calculation */}
      <div
        className="fixed pointer-events-none font-mono text-5xl sm:text-6xl md:text-7xl lg:text-8xl whitespace-nowrap"
        style={{
          top: '50%',
          left: `${wordLeft}px`,
          transform: 'translateY(-50%)'
        }}
      >
        <span ref={beforeRef} className="text-white">{before}</span>
        <span ref={anchorRef} className="text-red-500 font-bold">{anchor}</span>
        <span className="text-white">{after}</span>
      </div>

      {/* Built by credit */}
      <a
        href="https://x.com/syuggupta"
        target="_blank"
        rel="noopener noreferrer"
        className="fixed bottom-4 left-1/2 -translate-x-1/2 text-gray-600 hover:text-gray-400 text-xs transition-colors"
        onClick={(e) => e.stopPropagation()}
      >
        Built by @syuggupta
      </a>
    </main>
  );
}
