import React from 'react';

export const formatTime = (timeInSeconds: number): string => {
  const time = Math.max(0, timeInSeconds);
  const hours = Math.floor(time / 3600);
  const minutes = Math.floor((time % 3600) / 60);
  const seconds = Math.floor(time % 60);

  const pad = (num: number) => num.toString().padStart(2, '0');

  if (hours > 0) {
    return `${hours}:${pad(minutes)}:${pad(seconds)}`;
  }
  return `${pad(minutes)}:${pad(seconds)}`;
};

interface TimecodeProps {
  currentTime: number;
  duration: number;
  onSeek: (time: number) => void;
}

export const Timecode: React.FC<TimecodeProps> = ({ currentTime, duration }) => {
  return (
    <div className="flex items-center text-xs font-mono select-none text-gray-300">
      <span>{formatTime(currentTime)}</span>
      <span className="mx-1">/</span>
      <span>{formatTime(duration)}</span>
    </div>
  );
};
