/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/

import React from 'react';

interface PosePanelProps {
  poses: string[];
  onPoseSelect: (pose: string) => void;
  isLoading: boolean;
}

const PosePanel: React.FC<PosePanelProps> = ({ poses, onPoseSelect, isLoading }) => {
  return (
    <div>
      <h2 className="text-xl font-serif tracking-wider text-gray-800 border-b border-gray-400/50 pb-2 mb-3">
        Change Pose
      </h2>
      <div className="flex flex-wrap items-center gap-2">
        <button
          onClick={() => onPoseSelect('Original')}
          disabled={isLoading}
          className={`px-4 py-2 text-sm font-semibold border rounded-full transition-colors bg-white text-gray-700 border-gray-300 hover:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed`}
        >
          Original Pose
        </button>
        {poses.map(pose => (
          <button
            key={pose}
            onClick={() => onPoseSelect(pose)}
            disabled={isLoading}
            className="px-4 py-2 text-sm font-semibold border rounded-full transition-colors bg-white text-gray-700 border-gray-300 hover:bg-gray-100 active:bg-gray-200 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {pose}
          </button>
        ))}
      </div>
      <p className="text-xs text-gray-500 mt-4">
        Select a new pose for the person in your photo. The AI will attempt to keep the clothing and background consistent.
      </p>
    </div>
  );
};

export default PosePanel;