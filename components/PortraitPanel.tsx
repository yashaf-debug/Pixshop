/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/

import React, { useState } from 'react';
import { useLanguage } from '../contexts/LanguageContext';
import { PortraitIcon } from './icons';

interface PortraitPanelProps {
  onApplyEnhancement: (prompt: string) => void;
  isLoading: boolean;
}

const PortraitPanel: React.FC<PortraitPanelProps> = ({ onApplyEnhancement, isLoading }) => {
  const { t } = useLanguage();
  const [selectedPresetPrompt, setSelectedPresetPrompt] = useState<string | null>(null);

  const presets = [
    { name: t('portraitPanel.presetNatural'), prompt: 'Perform a subtle and natural portrait retouch. Smooth skin slightly to reduce minor blemishes and wrinkles, but preserve natural skin texture. Brighten eyes subtly and slightly enhance lip color. Do not change facial features or structure.' },
    { name: t('portraitPanel.presetStudio'), prompt: 'Apply professional studio lighting to the portrait. Create a soft key light to illuminate the subject\'s face, a gentle fill light to soften shadows, and a subtle rim light to separate the subject from the background. The result should look like a high-end studio photograph.' },
    { name: t('portraitPanel.presetDramatic'), prompt: 'Enhance the portrait with a dramatic, high-contrast look. Deepen the shadows and increase the highlights (dodging and burning) to sculpt the facial features. Slightly desaturate the colors for a moody, cinematic feel.' },
  ];

  const handlePresetClick = (prompt: string) => {
    setSelectedPresetPrompt(prompt);
  };

  const handleApply = () => {
    if (selectedPresetPrompt) {
      onApplyEnhancement(selectedPresetPrompt);
    }
  };

  return (
    <div className="w-full bg-gray-800/50 border border-gray-700 rounded-lg p-4 flex flex-col gap-4 animate-fade-in backdrop-blur-sm">
      <div className="flex flex-col items-center">
        <h3 className="text-lg font-semibold text-gray-300">{t('portraitPanel.title')}</h3>
        <p className="text-sm text-gray-400 -mt-1">{t('portraitPanel.description')}</p>
      </div>
      
      <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
        {presets.map(preset => (
          <button
            key={preset.name}
            onClick={() => handlePresetClick(preset.prompt)}
            disabled={isLoading}
            className={`w-full text-center bg-white/10 border border-transparent text-gray-200 font-semibold py-3 px-4 rounded-md transition-all duration-200 ease-in-out hover:bg-white/20 hover:border-white/20 active:scale-95 text-base disabled:opacity-50 disabled:cursor-not-allowed ${selectedPresetPrompt === preset.prompt ? 'ring-2 ring-offset-2 ring-offset-gray-800 ring-blue-500' : ''}`}
          >
            {preset.name}
          </button>
        ))}
      </div>

      {selectedPresetPrompt && (
        <div className="animate-fade-in flex flex-col gap-4 pt-2">
            <button
                onClick={handleApply}
                className="w-full flex items-center justify-center gap-2 bg-gradient-to-br from-blue-600 to-blue-500 text-white font-bold py-4 px-6 rounded-lg transition-all duration-300 ease-in-out shadow-lg shadow-blue-500/20 hover:shadow-xl hover:shadow-blue-500/40 hover:-translate-y-px active:scale-95 active:shadow-inner text-base disabled:from-blue-800 disabled:to-blue-700 disabled:shadow-none disabled:cursor-not-allowed disabled:transform-none"
                disabled={isLoading || !selectedPresetPrompt}
            >
                <PortraitIcon className="w-5 h-5" />
                {t('portraitPanel.applyButton')}
            </button>
        </div>
      )}
    </div>
  );
};

export default PortraitPanel;