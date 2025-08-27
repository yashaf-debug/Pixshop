/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/

import React, { useState, useEffect } from 'react';
import { useLanguage } from '../contexts/LanguageContext';
import { UploadIcon } from './icons';

interface CombinePanelProps {
  onCombine: (backgroundImage: File) => void;
  isLoading: boolean;
}

const CombinePanel: React.FC<CombinePanelProps> = ({ onCombine, isLoading }) => {
  const { t } = useLanguage();
  const [backgroundFile, setBackgroundFile] = useState<File | null>(null);
  const [backgroundUrl, setBackgroundUrl] = useState<string | null>(null);

  useEffect(() => {
    if (backgroundFile) {
      const url = URL.createObjectURL(backgroundFile);
      setBackgroundUrl(url);
      return () => URL.revokeObjectURL(url);
    } else {
      setBackgroundUrl(null);
    }
  }, [backgroundFile]);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setBackgroundFile(e.target.files[0]);
    }
  };

  const handleCombineClick = () => {
    if (backgroundFile) {
      onCombine(backgroundFile);
    }
  };

  return (
    <div className="w-full bg-gray-800/50 border border-gray-700 rounded-lg p-4 flex flex-col items-center gap-4 animate-fade-in backdrop-blur-sm">
      <h3 className="text-lg font-semibold text-gray-300">{t('combinePanel.title')}</h3>
      <p className="text-sm text-gray-400 -mt-2 text-center">{t('combinePanel.description')}</p>

      <div className="w-full flex flex-col md:flex-row items-center justify-center gap-4 mt-2">
        <label htmlFor="bg-upload" className="w-full md:w-auto cursor-pointer flex flex-col items-center justify-center bg-white/5 border-2 border-dashed border-gray-600 hover:border-blue-500 rounded-lg p-6 transition-colors">
            {backgroundUrl ? (
                 <img src={backgroundUrl} alt="Background Preview" className="w-32 h-32 object-cover rounded-md" />
            ) : (
                <>
                    <UploadIcon className="w-8 h-8 text-gray-400 mb-2" />
                    <span className="font-semibold text-blue-400">{t('combinePanel.uploadButton')}</span>
                </>
            )}
        </label>
        <input id="bg-upload" type="file" className="hidden" accept="image/*" onChange={handleFileChange} disabled={isLoading} />
        
        <button
            onClick={handleCombineClick}
            disabled={isLoading || !backgroundFile}
            className="w-full md:w-auto bg-gradient-to-br from-blue-600 to-blue-500 text-white font-bold py-4 px-8 rounded-lg transition-all duration-300 ease-in-out shadow-lg shadow-blue-500/20 hover:shadow-xl hover:shadow-blue-500/40 hover:-translate-y-px active:scale-95 active:shadow-inner text-base disabled:from-blue-800 disabled:to-blue-700 disabled:shadow-none disabled:cursor-not-allowed disabled:transform-none"
        >
            {t('combinePanel.combineButton')}
        </button>
      </div>
    </div>
  );
};

export default CombinePanel;