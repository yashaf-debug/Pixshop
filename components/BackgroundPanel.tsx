/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/

import React from 'react';
import { useLanguage } from '../contexts/LanguageContext';
import { BackgroundRemoveIcon } from './icons';

interface BackgroundPanelProps {
  onRemoveBackground: () => void;
  isLoading: boolean;
}

const BackgroundPanel: React.FC<BackgroundPanelProps> = ({ onRemoveBackground, isLoading }) => {
  const { t } = useLanguage();

  return (
    <div className="w-full bg-gray-800/50 border border-gray-700 rounded-lg p-4 flex flex-col items-center gap-4 animate-fade-in backdrop-blur-sm">
      <h3 className="text-lg font-semibold text-gray-300">{t('bgRemovePanel.title')}</h3>
      <p className="text-sm text-gray-400 -mt-2 text-center">{t('bgRemovePanel.description')}</p>

      <button
        onClick={onRemoveBackground}
        disabled={isLoading}
        className="w-full max-w-xs mt-2 flex items-center justify-center gap-2 bg-gradient-to-br from-blue-600 to-blue-500 text-white font-bold py-4 px-6 rounded-lg transition-all duration-300 ease-in-out shadow-lg shadow-blue-500/20 hover:shadow-xl hover:shadow-blue-500/40 hover:-translate-y-px active:scale-95 active:shadow-inner text-base disabled:from-blue-800 disabled:to-blue-700 disabled:shadow-none disabled:cursor-not-allowed disabled:transform-none"
      >
        <BackgroundRemoveIcon className="w-6 h-6" />
        {t('bgRemovePanel.removeButton')}
      </button>
    </div>
  );
};

export default BackgroundPanel;