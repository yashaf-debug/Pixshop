/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/
import React from 'react';
import { GalleryIcon } from './icons';
import { useLanguage } from '../contexts/LanguageContext';

const SparkleIcon: React.FC<{ className?: string }> = ({ className }) => (
  <svg className={className} xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09zM18.259 8.715L18 9.75l-.259-1.035a3.375 3.375 0 00-2.455-2.456L14.25 6l1.036-.259a3.375 3.375 0 002.455-2.456L18 2.25l.259 1.035a3.375 3.375 0 002.456 2.456L21.75 6l-1.035.259a3.375 3.375 0 00-2.456 2.456zM16.898 20.624l-.219.874-.219-.874a1.5 1.5 0 00-1.023-1.023l-.874-.219.874-.219a1.5 1.5 0 001.023-1.023l.219-.874.219.874a1.5 1.5 0 001.023 1.023l.874.219-.874.219a1.5 1.5 0 00-1.023 1.023z" />
  </svg>
);

interface HeaderProps {
    onOpenGallery: () => void;
}

const Header: React.FC<HeaderProps> = ({ onOpenGallery }) => {
  const { t, language, setLanguage } = useLanguage();

  return (
    <header className="w-full py-4 px-4 sm:px-8 border-b border-gray-700 bg-gray-800/30 backdrop-blur-sm sticky top-0 z-50">
      <div className="flex items-center justify-between">
          <div className="flex items-center justify-center gap-3">
              <SparkleIcon className="w-6 h-6 text-blue-400" />
              <h1 className="text-xl font-bold tracking-tight text-gray-100">
                Pixshop
              </h1>
          </div>
          <div className="flex items-center gap-2 sm:gap-4">
              <div className="flex items-center bg-gray-900/50 rounded-lg p-1">
                  <button 
                      onClick={() => setLanguage('en')}
                      className={`px-3 py-1 text-sm font-bold rounded-md transition-colors ${language === 'en' ? 'bg-blue-500 text-white' : 'text-gray-400 hover:bg-white/10'}`}
                  >
                      EN
                  </button>
                  <button 
                      onClick={() => setLanguage('ru')}
                      className={`px-3 py-1 text-sm font-bold rounded-md transition-colors ${language === 'ru' ? 'bg-blue-500 text-white' : 'text-gray-400 hover:bg-white/10'}`}
                  >
                      RU
                  </button>
              </div>
              <button 
                onClick={onOpenGallery}
                className="flex items-center gap-2 text-gray-300 hover:text-white hover:bg-white/10 transition-colors px-4 py-2 rounded-lg"
                aria-label={t('header.openGalleryAria')}
              >
                <GalleryIcon className="w-5 h-5" />
                <span className="hidden sm:inline font-medium">{t('header.gallery')}</span>
              </button>
          </div>
      </div>
    </header>
  );
};

export default Header;