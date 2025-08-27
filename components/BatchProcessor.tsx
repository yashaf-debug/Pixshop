/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/

import React, { useState, useCallback, useEffect } from 'react';
import JSZip from 'jszip';
import { useLanguage } from '../contexts/LanguageContext';
import { generateFilteredImage, dataURLtoFile } from '../services/geminiService';
import { UploadIcon, PaletteIcon } from './icons';
import Spinner from './Spinner';

interface BatchProcessorProps {
  onExit: () => void;
}

interface BatchImage {
    id: number;
    file: File;
    previewUrl: string;
    status: 'pending' | 'processing' | 'done' | 'error';
    resultUrl?: string;
    error?: string;
}

const BatchProcessor: React.FC<BatchProcessorProps> = ({ onExit }) => {
    const { t } = useLanguage();
    const [images, setImages] = useState<BatchImage[]>([]);
    const [selectedFilter, setSelectedFilter] = useState<string>('');
    const [status, setStatus] = useState<'idle' | 'processing' | 'compressing' | 'downloading'>('idle');
    const [progress, setProgress] = useState({ current: 0, total: 0 });
    const [isDraggingOver, setIsDraggingOver] = useState(false);

    useEffect(() => {
        // Cleanup object URLs on unmount
        return () => {
            images.forEach(img => URL.revokeObjectURL(img.previewUrl));
        };
    }, [images]);
    
    const filters = [
        { name: t('filterPanel.presetSynthwave'), prompt: 'Apply a vibrant 80s synthwave aesthetic with neon magenta and cyan glows, and subtle scan lines.' },
        { name: t('filterPanel.presetAnime'), prompt: 'Give the image a vibrant Japanese anime style, with bold outlines, cel-shading, and saturated colors.' },
        { name: t('filterPanel.presetLomo'), prompt: 'Apply a Lomography-style cross-processing film effect with high-contrast, oversaturated colors, and dark vignetting.' },
        { name: t('filterPanel.presetGlitch'), prompt: 'Transform the image into a futuristic holographic projection with digital glitch effects and chromatic aberration.' },
    ];

    const handleFileSelect = (files: FileList | null) => {
        if (!files) return;
        const newImages = Array.from(files)
            .filter(file => file.type.startsWith('image/'))
            .map((file, index) => ({
                id: Date.now() + index,
                file,
                previewUrl: URL.createObjectURL(file),
                status: 'pending' as const,
            }));

        setImages(prev => [...prev, ...newImages]);
    };

    const processImages = async () => {
        if (!selectedFilter || images.length === 0) return;

        setStatus('processing');
        setProgress({ current: 0, total: images.length });

        const processedImages: BatchImage[] = [];

        for (let i = 0; i < images.length; i++) {
            const image = images[i];
            setProgress({ current: i + 1, total: images.length });
            setImages(prev => prev.map(img => img.id === image.id ? { ...img, status: 'processing' } : img));
            
            try {
                const resultUrl = await generateFilteredImage(image.file, selectedFilter);
                setImages(prev => prev.map(img => img.id === image.id ? { ...img, status: 'done', resultUrl } : img));
                processedImages.push({ ...image, status: 'done', resultUrl });
            } catch (err) {
                const errorMessage = err instanceof Error ? err.message : 'Unknown error';
                setImages(prev => prev.map(img => img.id === image.id ? { ...img, status: 'error', error: errorMessage } : img));
                processedImages.push({ ...image, status: 'error', error: errorMessage });
            }
        }
        return processedImages.filter(img => img.status === 'done');
    };

    const downloadZip = async (processed: BatchImage[]) => {
        if (processed.length === 0) {
            setStatus('idle');
            return;
        }

        setStatus('compressing');
        const zip = new JSZip();
        
        for (const image of processed) {
            if (image.resultUrl) {
                const file = dataURLtoFile(image.resultUrl, `filtered-${image.file.name}`);
                zip.file(file.name, file);
            }
        }
        
        const content = await zip.generateAsync({ type: 'blob' });

        setStatus('downloading');
        const link = document.createElement('a');
        link.href = URL.createObjectURL(content);
        link.download = `pixshop-batch-${Date.now()}.zip`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(link.href);
        
        setStatus('idle');
    };
    
    const handleApplyAndDownload = async () => {
        const successfullyProcessed = await processImages();
        if (successfullyProcessed && successfullyProcessed.length > 0) {
            await downloadZip(successfullyProcessed);
        } else {
            setStatus('idle'); // Reset if nothing was processed
        }
    };
    
    const isLoading = status !== 'idle';

    const getStatusMessage = () => {
        switch (status) {
            case 'processing':
                return t('batch.processing', { current: String(progress.current), total: String(progress.total) });
            case 'compressing':
                return t('batch.compressing');
            case 'downloading':
                return t('batch.downloading');
            default:
                return '';
        }
    };

    return (
        <div className="w-full flex flex-col items-center gap-6 animate-fade-in">
            <div className="text-center">
                <h1 className="text-4xl font-bold">{t('batch.title')}</h1>
                <p className="text-gray-400 mt-2">{t('batch.subtitle')}</p>
            </div>
            
            <div className="w-full grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="md:col-span-2 bg-gray-800/50 border border-gray-700 rounded-lg p-4 backdrop-blur-sm min-h-[50vh] flex flex-col">
                    {images.length === 0 ? (
                         <div 
                            className={`w-full h-full flex-grow flex flex-col items-center justify-center text-center p-8 transition-all duration-300 rounded-lg border-2 border-dashed ${isDraggingOver ? 'border-blue-500 bg-blue-500/10' : 'border-gray-600'}`}
                            onDragEnter={(e) => { e.preventDefault(); e.stopPropagation(); setIsDraggingOver(true); }}
                            onDragOver={(e) => { e.preventDefault(); e.stopPropagation(); setIsDraggingOver(true); }}
                            onDragLeave={(e) => { e.preventDefault(); e.stopPropagation(); setIsDraggingOver(false); }}
                            onDrop={(e) => {
                                e.preventDefault();
                                e.stopPropagation();
                                setIsDraggingOver(false);
                                handleFileSelect(e.dataTransfer.files);
                            }}
                         >
                            <UploadIcon className="w-12 h-12 text-gray-500 mb-4" />
                            <label htmlFor="batch-upload" className="font-semibold text-blue-400 cursor-pointer hover:underline">{t('batch.uploadButton')}</label>
                            <p className="text-gray-500 mt-1">{t('startScreen.dragDrop')}</p>
                            <input id="batch-upload" type="file" multiple className="hidden" accept="image/*" onChange={(e) => handleFileSelect(e.target.files)} />
                        </div>
                    ) : (
                        <>
                            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4 overflow-y-auto flex-grow pr-2">
                                {images.map(image => (
                                    <div key={image.id} className="relative aspect-square rounded-lg overflow-hidden group">
                                        <img src={image.previewUrl} className="w-full h-full object-cover" />
                                        <div className="absolute inset-0 bg-black/50 flex items-center justify-center">
                                            {image.status === 'processing' && <Spinner />}
                                            {image.status === 'done' && <div className="w-8 h-8 rounded-full bg-green-500 flex items-center justify-center text-white">✓</div>}
                                            {image.status === 'error' && <div className="w-8 h-8 rounded-full bg-red-500 flex items-center justify-center text-white">!</div>}
                                        </div>
                                    </div>
                                ))}
                            </div>
                            <div className="flex-shrink-0 mt-4 flex gap-2">
                                <label htmlFor="batch-upload-more" className="cursor-pointer bg-white/10 hover:bg-white/20 text-gray-200 font-semibold py-2 px-4 rounded-md transition-colors">
                                    {t('batch.uploadMore')}
                                </label>
                                <input id="batch-upload-more" type="file" multiple className="hidden" accept="image/*" onChange={(e) => handleFileSelect(e.target.files)} />
                                <button onClick={() => setImages([])} className="bg-red-500/20 hover:bg-red-500/40 text-red-300 font-semibold py-2 px-4 rounded-md transition-colors">{t('batch.clearQueue')}</button>
                            </div>
                        </>
                    )}
                </div>

                <div className="md:col-span-1 bg-gray-800/50 border border-gray-700 rounded-lg p-4 backdrop-blur-sm flex flex-col gap-4">
                    <div>
                        <h3 className="text-lg font-semibold text-gray-300">{t('batch.selectFilter')}</h3>
                        <div className="grid grid-cols-2 gap-2 mt-2">
                             {filters.map(filter => (
                                <button
                                    key={filter.name}
                                    onClick={() => setSelectedFilter(filter.prompt)}
                                    disabled={isLoading}
                                    className={`w-full text-center bg-white/10 border border-transparent text-gray-200 font-semibold py-3 px-2 rounded-md transition-all duration-200 ease-in-out hover:bg-white/20 active:scale-95 text-sm disabled:opacity-50 ${selectedFilter === filter.prompt ? 'ring-2 ring-offset-2 ring-offset-gray-800 ring-blue-500' : ''}`}
                                >
                                    {filter.name}
                                </button>
                            ))}
                        </div>
                    </div>
                    <div className="flex-grow"></div>
                    <div>
                         <h3 className="text-lg font-semibold text-gray-300">{t('batch.applyAndDownload')}</h3>
                        <button
                            onClick={handleApplyAndDownload}
                            disabled={isLoading || !selectedFilter || images.length === 0}
                            className="w-full mt-2 flex items-center justify-center gap-2 bg-gradient-to-br from-green-600 to-green-500 text-white font-bold py-4 px-5 rounded-lg transition-all duration-300 ease-in-out shadow-lg shadow-green-500/20 hover:shadow-xl hover:shadow-green-500/40 hover:-translate-y-px active:scale-95 active:shadow-inner text-base disabled:from-green-800 disabled:to-green-700 disabled:shadow-none disabled:cursor-not-allowed disabled:transform-none"
                        >
                            <PaletteIcon className="w-5 h-5" />
                            {t('batch.applyAndDownload')}
                        </button>
                        {isLoading && (
                            <div className="text-center text-sm text-gray-400 mt-2 h-5">
                               {getStatusMessage()}
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
};

export default BatchProcessor;
