import React from 'react';
import { translations, Language } from '../utils/translations';

interface VolumeTrackerProps {
  volumeA: number;
  volumeB: number;
  target: number;
  setTarget: (target: number) => void;
  lang: Language;
}

const formatCompact = (num: number) => {
    if (num >= 1_000_000) return `${(num / 1_000_000).toFixed(2)}M`;
    if (num >= 1_000) return `${(num / 1_000).toFixed(1)}K`;
    return num.toFixed(0);
};

const ProgressBar: React.FC<{ label: string; volume: number; target: number; colorClass: string }> = ({ label, volume, target, colorClass }) => {
  const percentage = target > 0 ? Math.min((volume / target) * 100, 100) : 0;

  return (
    <div className="w-full">
      <div className="flex justify-between items-center mb-1">
        <span className="text-sm font-medium text-gray-300">{label}</span>
        <span className="text-xs font-mono bg-gray-900 px-2 py-1 rounded">
            {formatCompact(volume)} / {formatCompact(target)} ({percentage.toFixed(1)}%)
        </span>
      </div>
      <div className="w-full bg-gray-700 rounded-full h-4">
        <div
          className={`h-4 rounded-full transition-all duration-500 ease-out ${colorClass}`}
          style={{ width: `${percentage}%` }}
        ></div>
      </div>
    </div>
  );
};

const VolumeTracker: React.FC<VolumeTrackerProps> = ({ volumeA, volumeB, target, setTarget, lang }) => {
  const t = translations[lang];

  return (
    <div className="bg-gray-800 p-6 rounded-lg shadow-lg">
      <div className="flex flex-wrap justify-between items-center gap-4 mb-4">
        <h3 className="text-xl font-semibold text-white">{t.monthlyTarget} Tracker</h3>
        <div className="flex items-center space-x-2">
            <label htmlFor="volumeTarget" className="text-sm font-medium text-gray-400">{t.monthlyTarget}:</label>
            <input
                id="volumeTarget"
                type="number"
                value={target}
                onChange={(e) => setTarget(Number(e.target.value))}
                className="bg-gray-700 p-2 w-36 rounded-md text-white font-mono focus:ring-2 focus:ring-cyan-500 focus:outline-none"
                placeholder="e.g., 500000"
            />
        </div>
      </div>
      <div className="space-y-4">
        <ProgressBar label={t.volumeA} volume={volumeA} target={target} colorClass="bg-cyan-500" />
        <ProgressBar label={t.volumeB} volume={volumeB} target={target} colorClass="bg-purple-600" />
      </div>
    </div>
  );
};

export default VolumeTracker;