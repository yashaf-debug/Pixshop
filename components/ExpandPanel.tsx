/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useLanguage } from '../contexts/LanguageContext';
import { ExpandFrameIcon } from './icons';

interface ExpandPanelProps {
    onApplyExpand: (prompt: string, newWidth: number, newHeight: number, imageX: number, imageY: number) => void;
    imgRef: React.RefObject<HTMLImageElement>;
    isLoading: boolean;
    isVisible: boolean;
}

type Handle = 'top-left' | 'top' | 'top-right' | 'left' | 'right' | 'bottom-left' | 'bottom' | 'bottom-right';

const ExpandPanel: React.FC<ExpandPanelProps> = ({ onApplyExpand, imgRef, isLoading, isVisible }) => {
    const { t } = useLanguage();
    const [prompt, setPrompt] = useState('');

    const containerRef = useRef<HTMLDivElement>(null);
    const [imageRect, setImageRect] = useState({ width: 0, height: 0 });
    const [expandRect, setExpandRect] = useState({ top: 0, left: 0, width: 0, height: 0 });
    
    const dragState = useRef<{
        isDragging: boolean;
        handle: Handle | null;
        startX: number;
        startY: number;
        initialRect: typeof expandRect;
    }>({ isDragging: false, handle: null, startX: 0, startY: 0, initialRect: { ...expandRect } });

    const resetExpandRect = useCallback(() => {
        if (imgRef.current) {
            const { clientWidth, clientHeight } = imgRef.current;
            setImageRect({ width: clientWidth, height: clientHeight });
            setExpandRect({ top: 0, left: 0, width: clientWidth, height: clientHeight });
        }
    }, [imgRef]);

    useEffect(() => {
        if (isVisible && imgRef.current?.src) {
            const timer = setTimeout(() => {
                resetExpandRect();
            }, 50);
            return () => clearTimeout(timer);
        }
    }, [isVisible, imgRef.current?.src, resetExpandRect]);


    const handleMouseDown = (e: React.MouseEvent<HTMLDivElement>, handle: Handle) => {
        e.preventDefault();
        e.stopPropagation();
        dragState.current = {
            isDragging: true,
            handle,
            startX: e.clientX,
            startY: e.clientY,
            initialRect: expandRect,
        };
        window.addEventListener('mousemove', handleMouseMove);
        window.addEventListener('mouseup', handleMouseUp);
    };

    const handleMouseMove = useCallback((e: MouseEvent) => {
        if (!dragState.current.isDragging || !dragState.current.handle) return;
        
        const deltaX = e.clientX - dragState.current.startX;
        const deltaY = e.clientY - dragState.current.startY;
        
        let { top, left, width, height } = { ...dragState.current.initialRect };
        const handle = dragState.current.handle;

        if (handle.includes('top')) {
            const newTop = top + deltaY;
            const newHeight = height - deltaY;
            if (newHeight >= imageRect.height) {
                height = newHeight;
                top = newTop;
            }
        }
        if (handle.includes('bottom')) {
            const newHeight = height + deltaY;
            if (newHeight >= imageRect.height) {
                height = newHeight;
            }
        }
        if (handle.includes('left')) {
            const newLeft = left + deltaX;
            const newWidth = width - deltaX;
            if (newWidth >= imageRect.width) {
                width = newWidth;
                left = newLeft;
            }
        }
        if (handle.includes('right')) {
            const newWidth = width + deltaX;
            if (newWidth >= imageRect.width) {
                width = newWidth;
            }
        }
        
        setExpandRect({ top, left, width, height });
    }, [imageRect]);

    const handleMouseUp = useCallback(() => {
        dragState.current.isDragging = false;
        dragState.current.handle = null;
        window.removeEventListener('mousemove', handleMouseMove);
        window.removeEventListener('mouseup', handleMouseUp);
    }, [handleMouseMove]);
    
    const handleGenerateClick = () => {
        if (!imgRef.current) return;
        
        const originalNaturalWidth = imgRef.current.naturalWidth;
        const originalNaturalHeight = imgRef.current.naturalHeight;

        const scaleX = originalNaturalWidth / imageRect.width;
        const scaleY = originalNaturalHeight / imageRect.height;

        const newNaturalWidth = Math.round(expandRect.width * scaleX);
        const newNaturalHeight = Math.round(expandRect.height * scaleY);
        const imageNaturalX = Math.round(Math.abs(expandRect.left) * scaleX);
        const imageNaturalY = Math.round(Math.abs(expandRect.top) * scaleY);

        onApplyExpand(prompt, newNaturalWidth, newNaturalHeight, imageNaturalX, imageNaturalY);
    };

    const isExpanded = expandRect.width > imageRect.width || expandRect.height > imageRect.height;

    return (
        <div className="w-full flex flex-col items-center gap-6">
            <div
                ref={containerRef}
                className="relative flex items-center justify-center max-h-[60vh] max-w-full touch-none select-none"
            >
                <div 
                    className="absolute border-2 border-dashed border-cyan-400 bg-black/20"
                    style={{
                        top: expandRect.top,
                        left: expandRect.left,
                        width: expandRect.width,
                        height: expandRect.height,
                    }}
                >
                    {(['top-left', 'top', 'top-right', 'left', 'right', 'bottom-left', 'bottom', 'bottom-right'] as Handle[]).map(handle => (
                        <div
                            key={handle}
                            onMouseDown={(e) => handleMouseDown(e, handle)}
                            className="absolute w-4 h-4 bg-cyan-400 rounded-full border-2 border-gray-900 -m-2"
                            style={{
                                top: handle.includes('top') ? 0 : handle.includes('bottom') ? '100%' : '50%',
                                left: handle.includes('left') ? 0 : handle.includes('right') ? '100%' : '50%',
                                transform: `translate(${handle.includes('left') ? '-50%' : handle.includes('right') ? '-50%' : '-50%'}, ${handle.includes('top') ? '-50%' : handle.includes('bottom') ? '-50%' : '-50%'})`,
                                cursor: `${handle.includes('top') ? 'n' : handle.includes('bottom') ? 's' : ''}${handle.includes('left') ? 'w' : handle.includes('right') ? 'e' : ''}-resize`,
                            }}
                        />
                    ))}
                </div>
                 <img 
                    ref={imgRef}
                    src={imgRef.current?.src}
                    alt="Expand this image"
                    className="w-full h-auto object-contain max-h-[60vh] opacity-80"
                />
            </div>

             <div className="w-full bg-gray-800/50 border border-gray-700 rounded-lg p-4 flex flex-col items-center gap-4 animate-fade-in backdrop-blur-sm">
                <h3 className="text-lg font-semibold text-center text-gray-300">{t('expandPanel.title')}</h3>
                <p className="text-sm text-gray-400 -mt-2 text-center">{t('expandPanel.description')}</p>
                 <div className="w-full flex flex-col md:flex-row items-center gap-3">
                    <input
                        type="text"
                        value={prompt}
                        onChange={(e) => setPrompt(e.target.value)}
                        placeholder={t('expandPanel.placeholder')}
                        className="flex-grow bg-gray-800 border border-gray-600 text-gray-200 rounded-lg p-4 focus:ring-2 focus:ring-blue-500 focus:outline-none transition w-full disabled:cursor-not-allowed disabled:opacity-60 text-base"
                        disabled={isLoading}
                    />
                    <button
                        onClick={handleGenerateClick}
                        disabled={isLoading || !isExpanded}
                        className="w-full md:w-auto flex items-center justify-center gap-2 bg-gradient-to-br from-blue-600 to-blue-500 text-white font-bold py-4 px-5 rounded-lg transition-all duration-300 ease-in-out shadow-lg shadow-blue-500/20 hover:shadow-xl hover:shadow-blue-500/40 hover:-translate-y-px active:scale-95 active:shadow-inner text-base disabled:from-blue-800 disabled:to-blue-700 disabled:shadow-none disabled:cursor-not-allowed disabled:transform-none"
                    >
                        <ExpandFrameIcon className="w-5 h-5" />
                        {t('expandPanel.generateButton')}
                    </button>
                 </div>
            </div>
        </div>
    );
};

export default ExpandPanel;
