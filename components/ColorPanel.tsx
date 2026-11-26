/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/

import React, { useMemo, useState, useEffect } from 'react';
import { cn } from '../lib/utils';

interface ColorFamily {
  name: string;
  shades: { name: string; hex: string }[];
}

interface ColorPanelProps {
  colorFamilies: ColorFamily[];
  onColorSelect: (color: string) => void;
  isLoading: boolean;
  originalImageUrl: string | null;
  activeImageUrl: string | null;
  colorVariations: Record<string, string>;
}

const ColorPanel: React.FC<ColorPanelProps> = ({ colorFamilies, onColorSelect, isLoading, originalImageUrl, activeImageUrl, colorVariations }) => {
  const [customColor, setCustomColor] = useState('#000000');

  const activeColorName = useMemo(() => {
    if (!activeImageUrl) return null;
    if (activeImageUrl === originalImageUrl) return 'Original';
    return Object.keys(colorVariations).find(name => colorVariations[name] === activeImageUrl) || null;
  }, [activeImageUrl, originalImageUrl, colorVariations]);

  useEffect(() => {
    if (activeColorName && activeColorName.startsWith('#')) {
        setCustomColor(activeColorName);
    }
  }, [activeColorName]);

  const handleCustomColorChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    let value = e.target.value;
    if (!value.startsWith('#')) {
        value = '#' + value;
    }
    setCustomColor(value.substring(0, 7));
  };
  
  const handleApplyCustomColor = () => {
    if (customColor.match(/^#[0-9a-f]{6}$/i)) {
      onColorSelect(customColor);
    }
  };

  return (
    <div>
      <h2 className="text-xl font-serif tracking-wider text-gray-800 border-b border-gray-400/50 pb-2 mb-3">
        Recolor Garment
      </h2>
      <div className="flex flex-col gap-4">
        <div className="flex flex-wrap items-center">
            <button
            onClick={() => onColorSelect('Original')}
            disabled={isLoading || activeColorName === 'Original'}
            className={`px-4 py-2 text-sm font-semibold border rounded-full transition-colors ${
                activeColorName === 'Original'
                ? 'bg-gray-800 text-white border-gray-800'
                : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-100'
            } disabled:opacity-50 disabled:cursor-not-allowed`}
            >
            Original
            </button>
        </div>

        {colorFamilies.map(family => (
          <div key={family.name}>
            <h3 className="text-sm font-medium text-gray-700 mb-2">{family.name}</h3>
            <div className="flex flex-wrap items-center gap-3">
              {family.shades.map(color => {
                const isActive = activeColorName === color.name;
                return (
                  <button
                    key={color.name}
                    onClick={() => onColorSelect(color.name)}
                    className={cn(
                      "w-8 h-8 rounded-full border border-gray-300/50 transition-transform duration-150 ease-in-out hover:scale-110 focus:outline-none disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100",
                      isActive 
                        ? 'ring-2 ring-offset-2 ring-gray-800' 
                        : 'focus:ring-2 focus:ring-offset-2 focus:ring-gray-800'
                    )}
                    style={{ backgroundColor: color.hex }}
                    aria-label={`Change color to ${color.name}`}
                    title={color.name}
                    disabled={isLoading}
                  />
                );
              })}
            </div>
          </div>
        ))}

        {/* Custom Color Section */}
        <div>
          <h3 className="text-sm font-medium text-gray-700 mb-2">Custom Color</h3>
          <div className="flex items-center gap-3">
            <div className="relative w-8 h-8">
              <input
                type="color"
                value={customColor}
                onChange={handleCustomColorChange}
                disabled={isLoading}
                className="absolute inset-0 w-full h-full opacity-0 cursor-pointer disabled:cursor-not-allowed"
                aria-label="Select custom color"
              />
              <div 
                className={cn(
                  "w-full h-full rounded-full border border-gray-300/50",
                  activeColorName === customColor && 'ring-2 ring-offset-2 ring-gray-800'
                )}
                style={{ backgroundColor: customColor }}
              />
            </div>
            <input
              type="text"
              value={customColor}
              onChange={handleCustomColorChange}
              disabled={isLoading}
              className="px-3 py-1.5 text-sm font-mono border rounded-md w-24 border-gray-300 focus:ring-gray-800 focus:border-gray-800 disabled:opacity-50"
              placeholder="#000000"
              maxLength={7}
            />
            <button
              onClick={handleApplyCustomColor}
              disabled={isLoading || !customColor.match(/^#[0-9a-f]{6}$/i)}
              className="px-4 py-2 text-sm font-semibold border rounded-full transition-colors bg-white text-gray-700 border-gray-300 hover:bg-gray-100 active:bg-gray-200 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Apply
            </button>
          </div>
        </div>

      </div>
      <p className="text-xs text-gray-500 mt-4">
        Select a color to change the clothing in your photo. The AI will try to identify the main garment and recolor it.
      </p>
    </div>
  );
};

export default ColorPanel;