/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/

import React, { useState, useCallback } from 'react';
import { motion } from 'framer-motion';
import { UploadCloudIcon } from './icons';

interface StartScreenProps {
  onImageUploaded: (imageUrl: string) => void;
}

const StartScreen: React.FC<StartScreenProps> = ({ onImageUploaded }) => {
  const [error, setError] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);

  const handleFileSelect = useCallback((file: File) => {
    if (!file.type.startsWith('image/')) {
        setError('Please select an image file.');
        return;
    }
    
    setIsProcessing(true);
    setError(null);

    const reader = new FileReader();
    reader.onload = (e) => {
        const dataUrl = e.target?.result as string;
        onImageUploaded(dataUrl);
        // No need to set isProcessing to false, as the component will unmount
    };
    reader.onerror = () => {
        setError('Failed to read the selected file.');
        setIsProcessing(false);
    }
    reader.readAsDataURL(file);
  }, [onImageUploaded]);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      handleFileSelect(e.target.files[0]);
    }
  };

  const screenVariants = {
    initial: { opacity: 0, y: 15 },
    animate: { opacity: 1, y: 0 },
    exit: { opacity: 0, y: -15 },
  };

  return (
    <motion.div
        key="uploader"
        className="w-full max-w-lg mx-auto flex flex-col items-center justify-center text-center"
        variants={screenVariants}
        initial="initial"
        animate="animate"
        exit="exit"
        transition={{ duration: 0.5, ease: "easeInOut" }}
    >
        <h1 className="text-5xl md:text-6xl font-serif font-bold text-gray-900 leading-tight">
            Recolor Your Wardrobe.
        </h1>
        <p className="mt-4 text-lg text-gray-600">
            Upload a photo and instantly see your clothes in different colors. It's that simple.
        </p>
        <hr className="my-8 border-gray-200 w-1/3" />
        <div className="flex flex-col items-center w-full max-w-sm gap-3">
            <label 
                htmlFor="image-upload-start" 
                className={`w-full relative flex items-center justify-center px-8 py-3 text-base font-semibold text-white bg-gray-900 rounded-md transition-colors ${isProcessing ? 'cursor-not-allowed bg-gray-600' : 'cursor-pointer hover:bg-gray-700'}`}
            >
                <UploadCloudIcon className="w-5 h-5 mr-3" />
                {isProcessing ? 'Processing...' : 'Upload Photo'}
            </label>
            <input id="image-upload-start" type="file" className="hidden" accept="image/png, image/jpeg, image/webp, image/avif, image/heic, image/heif" onChange={handleFileChange} disabled={isProcessing} />
            <p className="text-gray-500 text-xs mt-1">By uploading, you agree not to create harmful, explicit, or unlawful content. This service is for creative and responsible use only.</p>
            {error && <p className="text-red-500 text-sm mt-2">{error}</p>}
        </div>
    </motion.div>
  );
};

export default StartScreen;