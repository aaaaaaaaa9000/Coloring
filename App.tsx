/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/

import React, { useState, useCallback, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import StartScreen from './components/StartScreen';
import Canvas from './components/Canvas';
import ColorPanel from './components/ColorPanel';
import PosePanel from './components/PosePanel';
import { generateColorVariation, generatePoseVariation } from './services/geminiService';
import { ChevronDownIcon, ChevronUpIcon } from './components/icons';
import Footer from './components/Footer';
import { getFriendlyErrorMessage } from './lib/utils';
import Spinner from './components/Spinner';

const COLOR_FAMILIES = [
  {
    name: 'Reds',
    shades: [
      { name: 'Pastel Red', hex: '#fecaca' },
      { name: 'Vibrant Red', hex: '#ef4444' },
      { name: 'Deep Maroon', hex: '#881337' },
    ],
  },
  {
    name: 'Blues',
    shades: [
      { name: 'Sky Blue', hex: '#7dd3fc' },
      { name: 'Royal Blue', hex: '#3b82f6' },
      { name: 'Navy Blue', hex: '#1e3a8a' },
    ],
  },
  {
    name: 'Greens',
    shades: [
      { name: 'Mint Green', hex: '#a7f3d0' },
      { name: 'Emerald Green', hex: '#10b981' },
      { name: 'Forest Green', hex: '#14532d' },
    ],
  },
  {
    name: 'Teals',
    shades: [
      { name: 'Light Teal', hex: '#99f6e4' },
      { name: 'Teal', hex: '#2dd4bf' },
      { name: 'Petrol', hex: '#006469' },
    ],
  },
  {
    name: 'Yellows & Oranges',
    shades: [
      { name: 'Sunshine Yellow', hex: '#fde047' },
      { name: 'Gold', hex: '#f59e0b' },
      { name: 'Burnt Orange', hex: '#f97316' },
    ],
  },
  {
    name: 'Pinks',
    shades: [
        { name: 'Baby Pink', hex: '#fbcfe8' },
        { name: 'Hot Pink', hex: '#ec4899' },
        { name: 'Magenta', hex: '#be185d' },
    ],
  },
  {
    name: 'Neutrals',
    shades: [
      { name: 'Crisp White', hex: '#f9fafb' },
      { name: 'Light Gray', hex: '#d1d5db' },
      { name: 'Classic Black', hex: '#111827' },
    ],
  },
];


const POSES = [
  'Hands on hips',
  'Walking forward',
  'Leaning casually',
  'Arms crossed',
  'Looking over shoulder',
  'Waving',
];


const useMediaQuery = (query: string): boolean => {
  const [matches, setMatches] = useState(() => window.matchMedia(query).matches);

  useEffect(() => {
    const mediaQueryList = window.matchMedia(query);
    const listener = (event: MediaQueryListEvent) => setMatches(event.matches);
    mediaQueryList.addEventListener('change', listener);
    
    if (mediaQueryList.matches !== matches) {
      setMatches(mediaQueryList.matches);
    }

    return () => {
      mediaQueryList.removeEventListener('change', listener);
    };
  }, [query, matches]);

  return matches;
};


const App: React.FC = () => {
  const [originalImageUrl, setOriginalImageUrl] = useState<string | null>(null);
  const [activeImageUrl, setActiveImageUrl] = useState<string | null>(null); // Base for pose changes
  const [displayImageUrl, setDisplayImageUrl] = useState<string | null>(null);
  const [colorVariations, setColorVariations] = useState<Record<string, string>>({});
  const [poseVariations, setPoseVariations] = useState<Record<string, string>>({});
  const [isLoading, setIsLoading] = useState(false);
  const [loadingMessage, setLoadingMessage] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isSheetCollapsed, setIsSheetCollapsed] = useState(false);
  const isMobile = useMediaQuery('(max-width: 767px)');


  const handleImageUploaded = (url: string) => {
    setOriginalImageUrl(url);
    setActiveImageUrl(url);
    setDisplayImageUrl(url);
    setColorVariations({});
    setPoseVariations({});
    setError(null);
  };

  const handleStartOver = () => {
    setOriginalImageUrl(null);
    setActiveImageUrl(null);
    setDisplayImageUrl(null);
    setColorVariations({});
    setPoseVariations({});
    setIsLoading(false);
    setLoadingMessage('');
    setError(null);
    setIsSheetCollapsed(false);
  };

  const handleColorSelect = useCallback(async (colorName: string) => {
    if (!originalImageUrl || isLoading) return;

    const updateActiveImage = (newActiveUrl: string) => {
      if (activeImageUrl !== newActiveUrl) {
        setPoseVariations({}); // Poses for old active image are invalid
      }
      setActiveImageUrl(newActiveUrl);
      setDisplayImageUrl(newActiveUrl);
    };

    if (colorName === 'Original') {
      updateActiveImage(originalImageUrl);
      return;
    }

    if (colorVariations[colorName]) {
      updateActiveImage(colorVariations[colorName]);
      return;
    }

    setError(null);
    setIsLoading(true);
    setLoadingMessage(`Recoloring to ${colorName}...`);

    try {
      // Colors are always based on the pristine original image for best results
      const newImageUrl = await generateColorVariation(originalImageUrl, colorName);
      setColorVariations(prev => ({ ...prev, [colorName]: newImageUrl }));
      updateActiveImage(newImageUrl);
    } catch (err) {
      setError(getFriendlyErrorMessage(err, 'Failed to change color'));
    } finally {
      setIsLoading(false);
      setLoadingMessage('');
    }
  }, [originalImageUrl, isLoading, colorVariations, activeImageUrl]);

  const handlePoseSelect = useCallback(async (poseName: string) => {
    if (!activeImageUrl || isLoading) return;

    if (poseName === 'Original') {
        setDisplayImageUrl(activeImageUrl); // Revert to active image, not original
        return;
    }

    if (poseVariations[poseName]) {
        setDisplayImageUrl(poseVariations[poseName]);
        return;
    }

    setError(null);
    setIsLoading(true);
    setLoadingMessage(`Changing pose to "${poseName}"...`);

    try {
        const newImageUrl = await generatePoseVariation(activeImageUrl, poseName);
        setDisplayImageUrl(newImageUrl);
        setPoseVariations(prev => ({ ...prev, [poseName]: newImageUrl }));
    } catch (err) {
        setError(getFriendlyErrorMessage(err, 'Failed to change pose'));
    } finally {
        setIsLoading(false);
        setLoadingMessage('');
    }
  }, [activeImageUrl, isLoading, poseVariations]);


  const viewVariants = {
    initial: { opacity: 0, y: 15 },
    animate: { opacity: 1, y: 0 },
    exit: { opacity: 0, y: -15 },
  };

  return (
    <div className="font-sans">
      <AnimatePresence mode="wait">
        {!originalImageUrl ? (
          <motion.div
            key="start-screen"
            className="w-screen min-h-screen flex items-start sm:items-center justify-center bg-gray-50 p-4 pb-20"
            variants={viewVariants}
            initial="initial"
            animate="animate"
            exit="exit"
            transition={{ duration: 0.5, ease: 'easeInOut' }}
          >
            <StartScreen onImageUploaded={handleImageUploaded} />
          </motion.div>
        ) : (
          <motion.div
            key="main-app"
            className="relative flex flex-col h-screen bg-white overflow-hidden"
            variants={viewVariants}
            initial="initial"
            animate="animate"
            exit="exit"
            transition={{ duration: 0.5, ease: 'easeInOut' }}
          >
            <main className="flex-grow relative flex flex-col md:flex-row overflow-hidden">
              <div className="w-full h-full flex-grow flex items-center justify-center bg-white pb-16 relative">
                <Canvas 
                  displayImageUrl={displayImageUrl}
                  onStartOver={handleStartOver}
                  isLoading={isLoading}
                  loadingMessage={loadingMessage}
                />
              </div>

              <aside 
                className={`absolute md:relative md:flex-shrink-0 bottom-0 right-0 h-auto md:h-full w-full md:w-1/3 md:max-w-sm bg-white/80 backdrop-blur-md flex flex-col border-t md:border-t-0 md:border-l border-gray-200/60 transition-transform duration-500 ease-in-out ${isSheetCollapsed ? 'translate-y-[calc(100%-4.5rem)]' : 'translate-y-0'} md:translate-y-0`}
                style={{ transitionProperty: 'transform' }}
              >
                  <button 
                    onClick={() => setIsSheetCollapsed(!isSheetCollapsed)} 
                    className="md:hidden w-full h-8 flex items-center justify-center bg-gray-100/50"
                    aria-label={isSheetCollapsed ? 'Expand panel' : 'Collapse panel'}
                  >
                    {isSheetCollapsed ? <ChevronUpIcon className="w-6 h-6 text-gray-500" /> : <ChevronDownIcon className="w-6 h-6 text-gray-500" />}
                  </button>
                  <div className="p-4 md:p-6 pb-20 overflow-y-auto flex-grow flex flex-col gap-8">
                    {error && (
                      <div className="bg-red-100 border-l-4 border-red-500 text-red-700 p-4 mb-4 rounded-md" role="alert">
                        <p className="font-bold">Error</p>
                        <p>{error}</p>
                      </div>
                    )}
                    <ColorPanel
                      colorFamilies={COLOR_FAMILIES}
                      onColorSelect={handleColorSelect}
                      isLoading={isLoading}
                      originalImageUrl={originalImageUrl}
                      activeImageUrl={activeImageUrl}
                      colorVariations={colorVariations}
                    />
                    <PosePanel
                      poses={POSES}
                      onPoseSelect={handlePoseSelect}
                      isLoading={isLoading}
                    />
                  </div>
              </aside>
            </main>
            <AnimatePresence>
              {isLoading && isMobile && (
                <motion.div
                  className="fixed inset-0 bg-white/80 backdrop-blur-md flex flex-col items-center justify-center z-50"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                >
                  <Spinner />
                  {loadingMessage && (
                    <p className="text-lg font-serif text-gray-700 mt-4 text-center px-4">{loadingMessage}</p>
                  )}
                </motion.div>
              )}
            </AnimatePresence>
          </motion.div>
        )}
      </AnimatePresence>
      <Footer isOnDressingScreen={!!originalImageUrl} />
    </div>
  );
};

export default App;