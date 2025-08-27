/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/

import React, { useState } from 'react';
import { UploadIcon, MagicWandIcon, PaletteIcon, SunIcon, StarsIcon } from './icons';
import { useLanguage } from '../contexts/LanguageContext';

interface StartScreenProps {
  onFileSelect: (files: FileList | null) => void;
  onGenerateClick: () => void;
}

const StartScreen: React.FC<StartScreenProps> = ({ onFileSelect, onGenerateClick }) => {
  const { t } = useLanguage();
  const [isDraggingOver, setIsDraggingOver] = useState(false);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    onFileSelect(e.target.files);
  };

  return (
    <div 
      className={`w-full max-w-5xl mx-auto text-center p-8 transition-all duration-300 rounded-2xl ${isDraggingOver ? 'bg-blue-500/20 ring-4 ring-blue-500/50' : 'bg-gray-800/30'}`}
      onDragEnter={(e) => { e.preventDefault(); e.stopPropagation(); setIsDraggingOver(true); }}
      onDragOver={(e) => { e.preventDefault(); e.stopPropagation(); setIsDraggingOver(true); }}
      onDragLeave={(e) => { e.preventDefault(); e.stopPropagation(); setIsDraggingOver(false); }}
      onDrop={(e) => {
        e.preventDefault();
        e.stopPropagation();
        setIsDraggingOver(false);
        onFileSelect(e.dataTransfer.files);
      }}
    >
      <div className="animate-fade-in">
        <h1 className="text-4xl md:text-5xl font-extrabold text-transparent bg-clip-text bg-gradient-to-br from-white to-gray-300 tracking-tight mb-4">
          {t('startScreen.title1')}
          <span className="text-cyan-400">{t('startScreen.title2')}</span>
        </h1>
        <p className="max-w-3xl mx-auto text-lg text-gray-400 mb-8">{t('startScreen.subtitle')}</p>
        
        <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
          <label htmlFor="file-upload" className="w-full sm:w-auto cursor-pointer flex items-center justify-center gap-2 bg-gradient-to-br from-blue-600 to-blue-500 text-white font-bold py-4 px-8 rounded-lg transition-all duration-300 ease-in-out shadow-lg shadow-blue-500/20 hover:shadow-xl hover:shadow-blue-500/40 hover:-translate-y-px active:scale-95 active:shadow-inner text-lg">
            <UploadIcon className="w-6 h-6" />
            {t('startScreen.uploadButton')}
          </label>
          <input id="file-upload" type="file" className="hidden" accept="image/*" onChange={handleFileChange} />
          <button 
            onClick={onGenerateClick}
            className="w-full sm:w-auto cursor-pointer flex items-center justify-center gap-2 bg-gray-700 text-gray-200 font-bold py-4 px-8 rounded-lg transition-all duration-300 ease-in-out shadow-lg shadow-gray-900/20 hover:shadow-xl hover:shadow-gray-900/40 hover:bg-gray-600 hover:-translate-y-px active:scale-95 active:shadow-inner text-lg"
          >
            <StarsIcon className="w-6 h-6" />
            {t('startScreen.generateButton')}
          </button>
        </div>
        <p className="text-gray-500 mt-4">{t('startScreen.dragDrop')}</p>
        
        <div className="mt-16 grid grid-cols-1 md:grid-cols-3 gap-8 text-left">
          <div className="bg-white/5 p-6 rounded-lg border border-white/10">
            <MagicWandIcon className="w-8 h-8 text-blue-400 mb-4" />
            <h3 className="text-xl font-bold text-gray-200 mb-2">{t('startScreen.feature1Title')}</h3>
            <p className="text-gray-400">{t('startScreen.feature1Desc')}</p>
          </div>
          <div className="bg-white/5 p-6 rounded-lg border border-white/10">
            <PaletteIcon className="w-8 h-8 text-cyan-400 mb-4" />
            <h3 className="text-xl font-bold text-gray-200 mb-2">{t('startScreen.feature2Title')}</h3>
            <p className="text-gray-400">{t('startScreen.feature2Desc')}</p>
          </div>
          <div className="bg-white/5 p-6 rounded-lg border border-white/10">
            <SunIcon className="w-8 h-8 text-yellow-400 mb-4" />
            <h3 className="text-xl font-bold text-gray-200 mb-2">{t('startScreen.feature3Title')}</h3>
            <p className="text-gray-400">{t('startScreen.feature3Desc')}</p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default StartScreen;