'use client';

import { useMemo } from 'react';
import { getORPIndex } from '@/lib/pdfParser';

interface WordDisplayProps {
  word: string;
}

export default function WordDisplay({ word }: WordDisplayProps) {
  const { before, anchor, after } = useMemo(() => {
    if (!word) {
      return { before: '', anchor: '', after: '' };
    }

    const orpIndex = getORPIndex(word);
    return {
      before: word.slice(0, orpIndex),
      anchor: word[orpIndex] || '',
      after: word.slice(orpIndex + 1),
    };
  }, [word]);

  if (!word) {
    return (
      <div className="h-32 flex items-center justify-center">
        <span className="text-gray-500 text-xl">Upload a PDF to begin</span>
      </div>
    );
  }

  return (
    <div className="h-32 flex items-center justify-center relative">
      {/* Center line indicator */}
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-0.5 h-3 bg-red-500" />
      <div className="absolute bottom-0 left-1/2 -translate-x-1/2 w-0.5 h-3 bg-red-500" />

      {/* Word display with ORP anchoring */}
      <div className="font-mono text-5xl tracking-wider flex">
        {/* Before anchor - right aligned */}
        <span className="text-gray-300 text-right min-w-[120px]">
          {before}
        </span>

        {/* Anchor character - centered, highlighted */}
        <span className="text-red-500 font-bold w-[1ch] text-center">
          {anchor}
        </span>

        {/* After anchor - left aligned */}
        <span className="text-gray-300 text-left min-w-[120px]">
          {after}
        </span>
      </div>
    </div>
  );
}
