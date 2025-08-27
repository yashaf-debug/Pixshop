/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/

import React, { useState } from 'react';
import { useLanguage } from '../contexts/LanguageContext';
import { generateImagesFromPrompt, dataURLtoFile } from '../services/geminiService';
import { StarsIcon, UndoIcon, UploadIcon } from './icons';
import Spinner from './Spinner';

interface ImageGeneratorProps {
    onBack: () => void;
    onImageSelectForEditing: (file: File) => void;
}

type AspectRatio = '1:1' | '16:9' | '9:16' | '4:3' | '3:4';
const aspectRatios: AspectRatio[] = ['1:1', '16:9', '9:16', '4:3', '3:4'];

const ImageGenerator: React.FC<ImageGeneratorProps> = ({ onBack, onImageSelectForEditing }) => {
    const { t } = useLanguage();
    const [prompt, setPrompt] = useState('');
    const [aspectRatio, setAspectRatio] = useState<AspectRatio>('1:1');
    const [numImages, setNumImages] = useState(1);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [generatedImages, setGeneratedImages] = useState<string[]>([]);

    const handleGenerate = async () => {
        if (!prompt.trim()) return;

        setIsLoading(true);
        setError(null);
        setGeneratedImages([]);

        try {
            const images = await generateImagesFromPrompt(prompt, numImages, aspectRatio);
            setGeneratedImages(images);
        } catch (err) {
            const errorMessage = err instanceof Error ? err.message : 'An unknown error occurred.';
            setError(t('app.errorFailedToGenerateAiImage', { errorMessage }));
            console.error(err);
        } finally {
            setIsLoading(false);
        }
    };

    const handleEdit = (imageUrl: string) => {
        const file = dataURLtoFile(imageUrl, `generated-${Date.now()}.png`);
        onImageSelectForEditing(file);
    };

    const handleDownload = (imageUrl: string) => {
        const link = document.createElement('a');
        link.href = imageUrl;
        link.download = `generated-${Date.now()}.png`;
        link.click();
    };

    const handleStartOver = () => {
        setPrompt('');
        setGeneratedImages([]);
        setError(null);
    }

    return (
        <div className="w-full max-w-6xl mx-auto flex flex-col items-center gap-6 animate-fade-in p-4">
            <button onClick={onBack} className="absolute top-6 left-6 flex items-center gap-2 text-gray-400 hover:text-white transition-colors">
                <UndoIcon className="w-5 h-5" />
                <span>{t('header.backToEditor')}</span>
            </button>
            <div className="text-center mt-12">
                <h1 className="text-4xl md:text-5xl font-bold">{t('generator.title')}</h1>
                <p className="text-gray-400 mt-2 max-w-2xl">{t('generator.subtitle')}</p>
            </div>

            <div className="w-full bg-gray-800/50 border border-gray-700 rounded-lg p-4 flex flex-col gap-4 backdrop-blur-sm">
                <textarea
                    value={prompt}
                    onChange={(e) => setPrompt(e.target.value)}
                    placeholder={t('generator.placeholder')}
                    className="w-full bg-gray-800 border border-gray-600 text-gray-200 rounded-lg p-4 focus:ring-2 focus:ring-blue-500 focus:outline-none transition text-base resize-none"
                    rows={3}
                    disabled={isLoading}
                />
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div>
                        <label className="block text-sm font-medium text-gray-400 mb-2">{t('generator.aspectRatio')}</label>
                        <div className="flex flex-wrap gap-2">
                            {aspectRatios.map(ar => (
                                <button key={ar} onClick={() => setAspectRatio(ar)} disabled={isLoading} className={`px-3 py-1.5 rounded-md text-sm font-semibold transition-colors ${aspectRatio === ar ? 'bg-blue-500 text-white' : 'bg-white/10 hover:bg-white/20 text-gray-300'}`}>
                                    {ar}
                                </button>
                            ))}
                        </div>
                    </div>
                    <div>
                        <label htmlFor="num-images" className="block text-sm font-medium text-gray-400 mb-2">{t('generator.numImages')}</label>
                        <div className="flex items-center gap-2">
                            <input
                                id="num-images"
                                type="range"
                                min="1"
                                max="4"
                                step="1"
                                value={numImages}
                                onChange={(e) => setNumImages(Number(e.target.value))}
                                className="w-full h-2 bg-gray-600 rounded-lg appearance-none cursor-pointer"
                                disabled={isLoading}
                            />
                            <span className="font-mono text-lg">{numImages}</span>
                        </div>
                    </div>
                    <button
                        onClick={handleGenerate}
                        disabled={isLoading || !prompt.trim()}
                        className="w-full h-full flex items-center justify-center gap-2 bg-gradient-to-br from-blue-600 to-cyan-500 text-white font-bold py-3 px-5 rounded-lg transition-all duration-300 ease-in-out shadow-lg shadow-cyan-500/20 hover:shadow-xl hover:shadow-cyan-500/40 hover:-translate-y-px active:scale-95 active:shadow-inner text-base disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        <StarsIcon className="w-6 h-6" />
                        {t('generator.generateButton')}
                    </button>
                </div>
            </div>

            <div className="w-full min-h-[40vh] flex items-center justify-center">
                {isLoading && (
                    <div className="text-center">
                        <Spinner />
                        <p className="mt-4 text-gray-400">{t('generator.generatingMessage')}</p>
                    </div>
                )}
                {error && (
                     <div className="text-center animate-fade-in bg-red-500/10 border border-red-500/20 p-6 rounded-lg max-w-xl mx-auto flex flex-col items-center gap-3">
                        <h2 className="text-xl font-bold text-red-300">{t('app.errorTitle')}</h2>
                        <p className="text-sm text-red-400">{error}</p>
                        <button onClick={() => setError(null)} className="bg-red-500 hover:bg-red-600 text-white font-bold py-2 px-4 rounded-lg text-sm transition-colors">{t('app.tryAgain')}</button>
                    </div>
                )}
                {generatedImages.length > 0 && (
                    <div className="w-full">
                         <div className={`grid gap-4 ${numImages === 1 ? 'grid-cols-1 max-w-lg mx-auto' : 'grid-cols-2'}`}>
                            {generatedImages.map((src, index) => (
                                <div key={index} className="group relative aspect-square rounded-lg overflow-hidden">
                                    <img src={src} alt={`Generated image ${index + 1}`} className="w-full h-full object-cover" />
                                    <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex flex-col items-center justify-center gap-2 p-4">
                                        <button onClick={() => handleEdit(src)} className="w-full bg-blue-500 text-white font-semibold py-2 px-4 rounded-md hover:bg-blue-600 transition-colors">{t('generator.editInEditor')}</button>
                                        <button onClick={() => handleDownload(src)} className="w-full bg-white/20 text-white font-semibold py-2 px-4 rounded-md hover:bg-white/30 transition-colors">{t('generator.download')}</button>
                                    </div>
                                </div>
                            ))}
                        </div>
                        <div className="text-center mt-6">
                            <button onClick={handleStartOver} className="bg-white/10 hover:bg-white/20 text-gray-200 font-semibold py-2 px-4 rounded-md transition-colors">{t('generator.startOver')}</button>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};

export default ImageGenerator;
