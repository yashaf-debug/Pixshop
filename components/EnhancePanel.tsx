/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/

import React from 'react';
import { useLanguage } from '../contexts/LanguageContext';
import { EnhanceIcon } from './icons';

interface EnhancePanelProps {
  onEnhance: () => void;
  isLoading: boolean;
}

const EnhancePanel: React.FC<EnhancePanelProps> = ({ onEnhance, isLoading }) => {
  const { t } = useLanguage();

  return (
    <div className="w-full bg-gray-800/50 border border-gray-700 rounded-lg p-4 flex flex-col items-center gap-4 animate-fade-in backdrop-blur-sm">
      <h3 className="text-lg font-semibold text-gray-300">{t('enhancePanel.title')}</h3>
      <p className="text-sm text-gray-400 -mt-2 text-center">{t('enhancePanel.description')}</p>

      <button
        onClick={onEnhance}
        disabled={isLoading}
        className="w-full max-w-xs mt-2 flex items-center justify-center gap-2 bg-gradient-to-br from-blue-600 to-blue-500 text-white font-bold py-4 px-6 rounded-lg transition-all duration-300 ease-in-out shadow-lg shadow-blue-500/20 hover:shadow-xl hover:shadow-blue-500/40 hover:-translate-y-px active:scale-95 active:shadow-inner text-base disabled:from-blue-800 disabled:to-blue-700 disabled:shadow-none disabled:cursor-not-allowed disabled:transform-none"
      >
        <EnhanceIcon className="w-6 h-6" />
        {t('enhancePanel.enhanceButton')}
      </button>
    </div>
  );
};

export default EnhancePanel;