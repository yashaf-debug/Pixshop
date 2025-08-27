/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/

import React from 'react';
import { EraserIcon } from './icons';
import { useLanguage } from '../contexts/LanguageContext';

interface ErasePanelProps {
  onErase: () => void;
  onClearMask: () => void;
  brushSize: number;
  onBrushSizeChange: (size: number) => void;
  isLoading: boolean;
  isMaskEmpty: boolean;
}

const ErasePanel: React.FC<ErasePanelProps> = ({
  onErase,
  onClearMask,
  brushSize,
  onBrushSizeChange,
  isLoading,
  isMaskEmpty
}) => {
  const { t } = useLanguage();

  return (
    <div className="w-full bg-gray-800/50 border border-gray-700 rounded-lg p-4 flex flex-col items-center gap-4 animate-fade-in backdrop-blur-sm">
      <div className="flex flex-col items-center">
        <h3 className="text-lg font-semibold text-gray-300">{t('erasePanel.title')}</h3>
        <p className="text-sm text-gray-400 -mt-1">{t('erasePanel.description')}</p>
      </div>
      
      <div className="w-full flex flex-col md:flex-row items-center justify-center gap-4 mt-2">
        <div className="flex-grow flex items-center gap-3 w-full md:w-auto">
            <label htmlFor="brush-size" className="text-sm font-medium text-gray-400 whitespace-nowrap">{t('erasePanel.brushSize')}:</label>
            <input
                id="brush-size"
                type="range"
                min="5"
                max="100"
                value={brushSize}
                onChange={(e) => onBrushSizeChange(Number(e.target.value))}
                className="w-full h-2 bg-gray-600 rounded-lg appearance-none cursor-pointer"
                disabled={isLoading}
            />
            <span className="font-mono text-sm w-8 text-center">{brushSize}</span>
        </div>

        <button
            onClick={onClearMask}
            disabled={isLoading || isMaskEmpty}
            className="w-full md:w-auto bg-white/10 border border-white/20 text-gray-200 font-semibold py-3 px-5 rounded-md transition-all duration-200 ease-in-out hover:bg-white/20 hover:border-white/30 active:scale-95 text-base disabled:opacity-50 disabled:cursor-not-allowed"
        >
            {t('erasePanel.clearButton')}
        </button>
        
        <button
            onClick={onErase}
            disabled={isLoading || isMaskEmpty}
            className="w-full md:w-auto flex items-center justify-center gap-2 bg-gradient-to-br from-blue-600 to-blue-500 text-white font-bold py-3 px-5 rounded-lg transition-all duration-300 ease-in-out shadow-lg shadow-blue-500/20 hover:shadow-xl hover:shadow-blue-500/40 hover:-translate-y-px active:scale-95 active:shadow-inner text-base disabled:from-blue-800 disabled:to-blue-700 disabled:shadow-none disabled:cursor-not-allowed disabled:transform-none"
        >
            <EraserIcon className="w-5 h-5" />
            {t('erasePanel.eraseButton')}
        </button>
      </div>
    </div>
  );
};

export default ErasePanel;
