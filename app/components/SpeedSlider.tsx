'use client';

interface SpeedSliderProps {
  wpm: number;
  onWpmChange: (wpm: number) => void;
  minWpm?: number;
  maxWpm?: number;
}

export default function SpeedSlider({
  wpm,
  onWpmChange,
  minWpm = 350,
  maxWpm = 900,
}: SpeedSliderProps) {
  return (
    <div className="w-full max-w-md">
      <div className="flex items-center justify-between mb-2">
        <label className="text-sm text-gray-400">Reading Speed</label>
        <span className="text-sm font-mono text-white">{wpm} WPM</span>
      </div>

      <input
        type="range"
        min={minWpm}
        max={maxWpm}
        step={10}
        value={wpm}
        onChange={(e) => onWpmChange(Number(e.target.value))}
        className="w-full h-2 bg-gray-700 rounded-lg appearance-none cursor-pointer
          [&::-webkit-slider-thumb]:appearance-none
          [&::-webkit-slider-thumb]:w-4
          [&::-webkit-slider-thumb]:h-4
          [&::-webkit-slider-thumb]:bg-blue-500
          [&::-webkit-slider-thumb]:rounded-full
          [&::-webkit-slider-thumb]:cursor-pointer
          [&::-webkit-slider-thumb]:hover:bg-blue-400
          [&::-moz-range-thumb]:w-4
          [&::-moz-range-thumb]:h-4
          [&::-moz-range-thumb]:bg-blue-500
          [&::-moz-range-thumb]:rounded-full
          [&::-moz-range-thumb]:cursor-pointer
          [&::-moz-range-thumb]:border-0"
      />

      <div className="flex justify-between text-xs text-gray-500 mt-1">
        <span>{minWpm}</span>
        <span>{maxWpm}</span>
      </div>
    </div>
  );
}
