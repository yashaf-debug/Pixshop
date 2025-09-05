

/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/


import React, { useState, useCallback, useRef, useEffect } from 'react';
import ReactCrop, { type Crop, type PixelCrop } from 'react-image-crop';
import { generateErasedImage, generateFilteredImage, generateAdjustedImage, generateCombinedImage, generateExpandedImage, generateRemovedBackgroundImage, generatePortraitEnhancement, generateEnhancedImage, dataURLtoFile } from './services/geminiService';
import { saveImageToGallery } from './services/galleryService';
import Header from './components/Header';
import Spinner from './components/Spinner';
import FilterPanel from './components/FilterPanel';
import AdjustmentPanel from './components/AdjustmentPanel';
import CropPanel from './components/CropPanel';
import CombinePanel from './components/CombinePanel';
import ErasePanel from './components/ErasePanel';
import ExpandPanel from './components/ExpandPanel';
import BackgroundPanel from './components/BackgroundPanel';
import BatchProcessor from './components/BatchProcessor';
import PortraitPanel from './components/PortraitPanel';
import EnhancePanel from './components/EnhancePanel';
import { UndoIcon, RedoIcon, EyeIcon, ZoomInIcon, ZoomOutIcon, ExpandIcon } from './components/icons';
import StartScreen from './components/StartScreen';
import GalleryModal from './components/GalleryModal';
import ImageGenerator from './components/ImageGenerator';
import { LanguageProvider, useLanguage } from './contexts/LanguageContext';
import { TranslationKey } from './translations';

type Tab = 'enhance' | 'erase' | 'adjust' | 'filters' | 'crop' | 'combine' | 'expand' | 'bgRemove' | 'portrait';
type SaveState = 'idle' | 'saving' | 'saved';
type AppMode = 'start' | 'editor' | 'batch' | 'generator';

const tabTranslationMap: Record<Tab, TranslationKey> = {
  enhance: 'app.tabEnhance',
  filters: 'app.tabFilters',
  adjust: 'app.tabAdjust',
  portrait: 'app.tabPortrait',
  erase: 'app.tabErase',
  expand: 'app.tabExpand',
  bgRemove: 'app.tabBgRemove',
  crop: 'app.tabCrop',
  combine: 'app.tabCombine',
};

interface EditorContentProps {
  initialImage: File;
  onUploadNew: () => void;
  onOpenGallery: () => void;
}

const EditorContent: React.FC<EditorContentProps> = ({ initialImage, onUploadNew, onOpenGallery }) => {
  const { t } = useLanguage();

  const [history, setHistory] = useState<File[]>([]);
  const [historyIndex, setHistoryIndex] = useState<number>(-1);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [loadingMessage, setLoadingMessage] = useState<string>('');
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<Tab>('enhance');
  
  const [crop, setCrop] = useState<Crop>();
  const [completedCrop, setCompletedCrop] = useState<PixelCrop>();
  const [aspect, setAspect] = useState<number | undefined>();
  const [isComparing, setIsComparing] = useState<boolean>(false);
  const imgRef = useRef<HTMLImageElement>(null);
  const maskCanvasRef = useRef<HTMLCanvasElement>(null);

  const [saveState, setSaveState] = useState<SaveState>('idle');
  
  const [scale, setScale] = useState<number>(1);
  const [position, setPosition] = useState<{ x: number, y: number }>({ x: 0, y: 0 });
  const viewportRef = useRef<HTMLDivElement>(null);
  const isPanning = useRef<boolean>(false);
  const panStart = useRef<{ x: number, y: number }>({ x: 0, y: 0 });
  const initialTouchDistance = useRef(0);
  const initialScale = useRef(1);

  const [brushSize, setBrushSize] = useState(40);
  const isDrawing = useRef(false);
  const [isMaskEmpty, setIsMaskEmpty] = useState(true);
  const lastPosition = useRef<{ x: number; y: number } | null>(null);

  const currentImage = history[historyIndex] ?? null;
  const originalImage = history[0] ?? null;

  const [currentImageUrl, setCurrentImageUrl] = useState<string | null>(null);
  const [originalImageUrl, setOriginalImageUrl] = useState<string | null>(null);
  
  const clearMask = useCallback(() => {
    const canvas = maskCanvasRef.current;
    if (canvas) {
        const ctx = canvas.getContext('2d');
        ctx?.clearRect(0, 0, canvas.width, canvas.height);
    }
    setIsMaskEmpty(true);
  }, []);

  const handleTabClick = (tab: Tab) => {
    setActiveTab(tab);
  };

  const resetZoomAndPan = useCallback(() => {
    setScale(1);
    setPosition({ x: 0, y: 0 });
  }, []);

  useEffect(() => {
    if (initialImage) {
      setError(null);
      setHistory([initialImage]);
      setHistoryIndex(0);
      setActiveTab('enhance');
      setCrop(undefined);
      setCompletedCrop(undefined);
      resetZoomAndPan();
    }
  }, [initialImage, resetZoomAndPan]);
  

  useEffect(() => {
    if (currentImage) {
      const url = URL.createObjectURL(currentImage);
      setCurrentImageUrl(url);
      setSaveState('idle');
      clearMask();
      return () => URL.revokeObjectURL(url);
    } else {
      setCurrentImageUrl(null);
    }
  }, [currentImage, clearMask]);
  
  useEffect(() => {
    if (originalImage) {
      const url = URL.createObjectURL(originalImage);
      setOriginalImageUrl(url);
      return () => URL.revokeObjectURL(url);
    } else {
      setOriginalImageUrl(null);
    }
  }, [originalImage]);

  const canUndo = historyIndex > 0;
  const canRedo = historyIndex < history.length - 1;

  const addImageToHistory = useCallback((newImageFile: File) => {
    const newHistory = history.slice(0, historyIndex + 1);
    newHistory.push(newImageFile);
    setHistory(newHistory);
    setHistoryIndex(newHistory.length - 1);
    setSaveState('idle');
    setCrop(undefined);
    setCompletedCrop(undefined);
    resetZoomAndPan();
    clearMask();
  }, [history, historyIndex, resetZoomAndPan, clearMask]);
  
  const handleErase = useCallback(async () => {
    if (!currentImage || !maskCanvasRef.current || isMaskEmpty) {
      setError(t('app.errorNoMask'));
      return;
    }
  
    setIsLoading(true);
    setError(null);
    setLoadingMessage('');
  
    try {
      const maskCanvas = maskCanvasRef.current;
      const originalImg = imgRef.current;
  
      if (!originalImg) throw new Error("Original image element not found.");
  
      const binaryMaskCanvas = document.createElement('canvas');
      binaryMaskCanvas.width = originalImg.naturalWidth;
      binaryMaskCanvas.height = originalImg.naturalHeight;
      const ctx = binaryMaskCanvas.getContext('2d');
      if (!ctx) throw new Error("Could not create canvas context for mask.");
  
      ctx.drawImage(maskCanvas, 0, 0, originalImg.naturalWidth, originalImg.naturalHeight);
  
      const imageData = ctx.getImageData(0, 0, binaryMaskCanvas.width, binaryMaskCanvas.height);
      const data = imageData.data;
      for (let i = 0; i < data.length; i += 4) {
        if (data[i + 3] > 0) {
          data[i] = 255; data[i + 1] = 255; data[i + 2] = 255; data[i + 3] = 255;
        } else {
          data[i] = 0; data[i + 1] = 0; data[i + 2] = 0; data[i + 3] = 255;
        }
      }
      ctx.putImageData(imageData, 0, 0);
  
      const maskFile = dataURLtoFile(binaryMaskCanvas.toDataURL('image/png'), 'mask.png');
      
      const erasedImageUrl = await generateErasedImage(currentImage, maskFile);
      const newImageFile = dataURLtoFile(erasedImageUrl, `erased-${Date.now()}.png`);
      addImageToHistory(newImageFile);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'An unknown error occurred.';
      setError(t('app.errorFailedToGenerate', { errorMessage }));
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  }, [currentImage, addImageToHistory, isMaskEmpty, t]);
  
  const handleApplyFilter = useCallback(async (filterPrompt: string) => {
    if (!currentImage) return;
    setIsLoading(true);
    setError(null);
    setLoadingMessage('');
    try {
        const filteredImageUrl = await generateFilteredImage(currentImage, filterPrompt);
        const newImageFile = dataURLtoFile(filteredImageUrl, `filtered-${Date.now()}.png`);
        addImageToHistory(newImageFile);
    } catch (err) {
        const errorMessage = err instanceof Error ? err.message : 'An unknown error occurred.';
        setError(t('app.errorFailedToFilter', { errorMessage }));
        console.error(err);
    } finally {
        setIsLoading(false);
    }
  }, [currentImage, addImageToHistory, t]);
  
  const handleApplyAdjustment = useCallback(async (adjustmentPrompt: string) => {
    if (!currentImage) return;
    setIsLoading(true);
    setError(null);
    setLoadingMessage('');
    try {
        const adjustedImageUrl = await generateAdjustedImage(currentImage, adjustmentPrompt);
        const newImageFile = dataURLtoFile(adjustedImageUrl, `adjusted-${Date.now()}.png`);
        addImageToHistory(newImageFile);
    } catch (err) {
        const errorMessage = err instanceof Error ? err.message : 'An unknown error occurred.';
        setError(t('app.errorFailedToAdjust', { errorMessage }));
        console.error(err);
    } finally {
        setIsLoading(false);
    }
  }, [currentImage, addImageToHistory, t]);

  const handleApplyPortraitEnhancement = useCallback(async (prompt: string) => {
    if (!currentImage) return;
    setIsLoading(true);
    setError(null);
    setLoadingMessage('');
    try {
        const resultUrl = await generatePortraitEnhancement(currentImage, prompt);
        const newImageFile = dataURLtoFile(resultUrl, `portrait-${Date.now()}.png`);
        addImageToHistory(newImageFile);
    } catch (err) {
        const errorMessage = err instanceof Error ? err.message : 'An unknown error occurred.';
        setError(t('app.errorFailedToEnhancePortrait', { errorMessage }));
        console.error(err);
    } finally {
        setIsLoading(false);
    }
  }, [currentImage, addImageToHistory, t]);

  const handleApplyEnhancement = useCallback(async () => {
    if (!currentImage) return;
    setIsLoading(true);
    setError(null);
    setLoadingMessage('');
    try {
        const resultUrl = await generateEnhancedImage(currentImage);
        const newImageFile = dataURLtoFile(resultUrl, `enhanced-${Date.now()}.png`);
        addImageToHistory(newImageFile);
    } catch (err) {
        const errorMessage = err instanceof Error ? err.message : 'An unknown error occurred.';
        setError(t('app.errorFailedToEnhance', { errorMessage }));
        console.error(err);
    } finally {
        setIsLoading(false);
    }
  }, [currentImage, addImageToHistory, t]);

  const handleApplyCrop = useCallback(() => {
    if (!completedCrop || !imgRef.current) return;
    const image = imgRef.current;
    const canvas = document.createElement('canvas');
    const scaleX = image.naturalWidth / image.width;
    const scaleY = image.naturalHeight / image.height;
    canvas.width = completedCrop.width;
    canvas.height = completedCrop.height;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const pixelRatio = window.devicePixelRatio || 1;
    canvas.width = completedCrop.width * pixelRatio;
    canvas.height = completedCrop.height * pixelRatio;
    ctx.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0);
    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(image, completedCrop.x * scaleX, completedCrop.y * scaleY, completedCrop.width * scaleX, completedCrop.height * scaleY, 0, 0, completedCrop.width, completedCrop.height);
    const croppedImageUrl = canvas.toDataURL('image/png');
    const newImageFile = dataURLtoFile(croppedImageUrl, `cropped-${Date.now()}.png`);
    addImageToHistory(newImageFile);
  }, [completedCrop, addImageToHistory]);

  const handleApplyExpand = useCallback(async (prompt: string, newWidth: number, newHeight: number, imageX: number, imageY: number) => {
    if (!currentImage || !imgRef.current) return;
    setIsLoading(true);
    setError(null);
    setLoadingMessage('');
    try {
        const expandedImageUrl = await generateExpandedImage(currentImage, prompt, newWidth, newHeight, imageX, imageY);
        const newImageFile = dataURLtoFile(expandedImageUrl, `expanded-${Date.now()}.png`);
        addImageToHistory(newImageFile);
    } catch (err) {
        const errorMessage = err instanceof Error ? err.message : 'An unknown error occurred.';
        setError(t('app.errorFailedToExpand', { errorMessage }));
        console.error(err);
    } finally {
        setIsLoading(false);
    }
}, [currentImage, addImageToHistory, t]);
  
  const handleCombine = useCallback(async (backgroundImage: File) => {
    if (!currentImage) return;
    setIsLoading(true);
    setError(null);
    setLoadingMessage('');
    try {
        const combinedImageUrl = await generateCombinedImage(currentImage, backgroundImage);
        const newImageFile = dataURLtoFile(combinedImageUrl, `combined-${Date.now()}.png`);
        addImageToHistory(newImageFile);
    } catch (err) {
        const errorMessage = err instanceof Error ? err.message : 'An unknown error occurred.';
        setError(t('app.errorFailedToCombine', { errorMessage }));
        console.error(err);
    } finally {
        setIsLoading(false);
    }
  }, [currentImage, addImageToHistory, t]);

  const handleRemoveBackground = useCallback(async () => {
    if (!currentImage) return;
    setIsLoading(true);
    setError(null);
    setLoadingMessage('');
    try {
        const resultUrl = await generateRemovedBackgroundImage(currentImage);
        const newImageFile = dataURLtoFile(resultUrl, `bg-removed-${Date.now()}.png`);
        addImageToHistory(newImageFile);
    } catch (err) {
        const errorMessage = err instanceof Error ? err.message : 'An unknown error occurred.';
        setError(t('app.errorFailedToRemoveBg', { errorMessage }));
        console.error(err);
    } finally {
        setIsLoading(false);
    }
  }, [currentImage, addImageToHistory, t]);

  const handleUndo = useCallback(() => { if (canUndo) setHistoryIndex(historyIndex - 1); resetZoomAndPan(); }, [canUndo, historyIndex, resetZoomAndPan]);
  const handleRedo = useCallback(() => { if (canRedo) setHistoryIndex(historyIndex + 1); resetZoomAndPan(); }, [canRedo, historyIndex, resetZoomAndPan]);
  const handleReset = useCallback(() => { if (history.length > 0) { setHistoryIndex(0); setError(null); resetZoomAndPan(); } }, [history, resetZoomAndPan]);
  
  const handleDownload = useCallback(() => {
      if (currentImage) {
          const link = document.createElement('a');
          link.href = URL.createObjectURL(currentImage);
          link.download = `edited-${currentImage.name}`;
          link.click();
          URL.revokeObjectURL(link.href);
      }
  }, [currentImage]);
  
  const handleHQDownload = useCallback(async () => {
    if (!currentImage) return;
    setIsLoading(true);
    setLoadingMessage(t('app.enhancingMessage'));
    setError(null);
    try {
        const enhancedImageUrl = await generateEnhancedImage(currentImage);
        const link = document.createElement('a');
        link.href = enhancedImageUrl;
        const baseName = currentImage.name.replace(/\.[^/.]+$/, "");
        link.download = `Pixshop_HQ_${baseName}.png`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    } catch (err) {
        const errorMessage = err instanceof Error ? err.message : 'An unknown error occurred.';
        setError(t('app.errorFailedToEnhance', { errorMessage }));
        console.error(err);
    } finally {
        setIsLoading(false);
        setLoadingMessage('');
    }
  }, [currentImage, t]);

  const getTransformedCoordinates = (e: React.MouseEvent | React.TouchEvent<HTMLDivElement>) => {
    const viewport = viewportRef.current;
    if (!viewport) return null;
    const rect = viewport.getBoundingClientRect();
    const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX;
    const clientY = 'touches' in e ? e.touches[0].clientY : e.clientY;
    const x = (clientX - rect.left - position.x) / scale;
    const y = (clientY - rect.top - position.y) / scale;
    return { x, y };
  };

  const drawOnCanvas = (e: React.MouseEvent | React.TouchEvent<HTMLDivElement>) => {
    const canvas = maskCanvasRef.current;
    const ctx = canvas?.getContext('2d');
    const currentPos = getTransformedCoordinates(e);
    if (!ctx || !currentPos) return;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.strokeStyle = 'rgba(239, 68, 68, 0.7)';
    ctx.lineWidth = brushSize / scale;
    ctx.beginPath();
    if (lastPosition.current) ctx.moveTo(lastPosition.current.x, lastPosition.current.y);
    ctx.lineTo(currentPos.x, currentPos.y);
    ctx.stroke();
    lastPosition.current = currentPos;
  };
  
  const handleZoom = useCallback((delta: number, centerX: number, centerY: number) => {
      const newScale = Math.min(Math.max(0.2, scale + delta), 8);
      const newX = centerX - (centerX - position.x) * (newScale / scale);
      const newY = centerY - (centerY - position.y) * (newScale / scale);
      setScale(newScale);
      setPosition({ x: newX, y: newY });
  }, [scale, position]);

  const handleWheel = (e: React.WheelEvent<HTMLDivElement>) => { e.preventDefault(); const rect = e.currentTarget.getBoundingClientRect(); handleZoom(-e.deltaY * 0.005, e.clientX - rect.left, e.clientY - rect.top); };
  
  const getCursorStyle = useCallback(() => (activeTab === 'erase' ? 'crosshair' : scale > 1 ? 'grab' : 'default'), [activeTab, scale]);

  const handleMouseDown = (e: React.MouseEvent<HTMLDivElement>) => {
      if (activeTab === 'erase') { if (e.button !== 0) return; isDrawing.current = true; setIsMaskEmpty(false); drawOnCanvas(e); } 
      else { if (e.button !== 0 || scale <= 1) return; isPanning.current = true; panStart.current = { x: e.clientX - position.x, y: e.clientY - position.y }; e.currentTarget.style.cursor = 'grabbing'; }
  };

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
      if (activeTab === 'erase' && isDrawing.current) drawOnCanvas(e); 
      else if (isPanning.current) setPosition({ x: e.clientX - panStart.current.x, y: e.clientY - panStart.current.y });
  };

  const handleMouseUpOrLeave = (e: React.MouseEvent<HTMLDivElement>) => {
      if (activeTab === 'erase' && isDrawing.current) { isDrawing.current = false; lastPosition.current = null; }
      if (isPanning.current) { isPanning.current = false; e.currentTarget.style.cursor = getCursorStyle(); }
  };
  
  const getDistance = (touches: React.TouchList) => Math.hypot(touches[0].clientX - touches[1].clientX, touches[0].clientY - touches[1].clientY);

  const handleTouchStart = (e: React.TouchEvent<HTMLDivElement>) => {
      if (e.touches.length === 2) { e.preventDefault(); initialTouchDistance.current = getDistance(e.touches); initialScale.current = scale; } 
      else if (e.touches.length === 1) {
          if (activeTab === 'erase') { isDrawing.current = true; setIsMaskEmpty(false); drawOnCanvas(e); } 
          else if (scale > 1) { isPanning.current = true; panStart.current = { x: e.touches[0].clientX - position.x, y: e.touches[0].clientY - position.y }; }
      }
  };

  const handleTouchMove = (e: React.TouchEvent<HTMLDivElement>) => {
      e.preventDefault();
      if (e.touches.length === 2) {
          const currentDistance = getDistance(e.touches);
          const scaleRatio = currentDistance / initialTouchDistance.current;
          const newScale = Math.min(Math.max(0.2, initialScale.current * scaleRatio), 8);
          const rect = e.currentTarget.getBoundingClientRect();
          const midPointX = (e.touches[0].clientX + e.touches[1].clientX) / 2 - rect.left;
          const midPointY = (e.touches[0].clientY + e.touches[1].clientY) / 2 - rect.top;
          const newX = midPointX - (midPointX - position.x) * (newScale / scale);
          const newY = midPointY - (midPointY - position.y) * (newScale / scale);
          setScale(newScale);
          setPosition({x: newX, y: newY});
      } else if (e.touches.length === 1) {
          if (activeTab === 'erase' && isDrawing.current) drawOnCanvas(e); 
          else if (isPanning.current) setPosition({ x: e.touches[0].clientX - panStart.current.x, y: e.touches[0].clientY - panStart.current.y });
      }
  };

  const handleTouchEnd = (e: React.TouchEvent<HTMLDivElement>) => {
    if (activeTab === 'erase' && isDrawing.current) { isDrawing.current = false; lastPosition.current = null; }
    isPanning.current = false; initialTouchDistance.current = 0;
  };

  const handleSaveToGallery = async () => {
    if (!currentImage) return;
    setSaveState('saving');
    try { await saveImageToGallery(currentImage); setSaveState('saved'); } 
    catch (err) { setError(t('app.errorSaveToGallery')); setSaveState('idle'); console.error(err); }
  };

    if (error) {
       return (
           <div className="text-center animate-fade-in bg-red-500/10 border border-red-500/20 p-8 rounded-lg max-w-2xl mx-auto flex flex-col items-center gap-4">
            <h2 className="text-2xl font-bold text-red-300">{t('app.errorTitle')}</h2>
            <p className="text-md text-red-400">{error}</p>
            <button onClick={() => setError(null)} className="bg-red-500 hover:bg-red-600 text-white font-bold py-2 px-6 rounded-lg text-md transition-colors">{t('app.tryAgain')}</button>
          </div>
        );
    }
    
    const imageLoaded = (img: HTMLImageElement) => {
        const canvas = maskCanvasRef.current;
        if (canvas) { canvas.width = img.clientWidth; canvas.height = img.clientHeight; clearMask(); }
    };

    const saveButtonContent = { idle: t('app.saveToGalleryButtonIdle'), saving: t('app.saveToGalleryButtonSaving'), saved: t('app.saveToGalleryButtonSaved') };
    
    return (
      <div className="w-full max-w-5xl mx-auto flex flex-col items-center gap-6 animate-fade-in">
          {activeTab === 'expand' ? (
            <ExpandPanel onApplyExpand={handleApplyExpand} imgRef={imgRef} isLoading={isLoading} isVisible={activeTab === 'expand'} />
          ) : (
            <>
              <div 
                  ref={viewportRef}
                  className="checkerboard-bg relative w-full shadow-2xl rounded-xl overflow-hidden bg-black/20 touch-none flex items-center justify-center"
                  onWheel={activeTab !== 'crop' ? handleWheel : undefined}
                  onMouseDown={activeTab !== 'crop' ? handleMouseDown : undefined}
                  onMouseMove={activeTab !== 'crop' ? handleMouseMove : undefined}
                  onMouseUp={activeTab !== 'crop' ? handleMouseUpOrLeave : undefined}
                  onMouseLeave={activeTab !== 'crop' ? handleMouseUpOrLeave : undefined}
                  onTouchStart={activeTab !== 'crop' ? handleTouchStart : undefined}
                  onTouchMove={activeTab !== 'crop' ? handleTouchMove : undefined}
                  onTouchEnd={activeTab !== 'crop' ? handleTouchEnd : undefined}
                  style={{ cursor: activeTab !== 'crop' ? getCursorStyle() : 'default', minHeight: '40vh' }}
              >
                  {isLoading && (
                      <div className="absolute inset-0 bg-black/70 z-30 flex flex-col items-center justify-center gap-4 animate-fade-in">
                          <Spinner />
                          <p className="text-gray-300">{loadingMessage || t('app.loadingMessage')}</p>
                      </div>
                  )}
                  
                  {activeTab === 'crop' ? (
                    <ReactCrop crop={crop} onChange={c => setCrop(c)} onComplete={c => setCompletedCrop(c)} aspect={aspect} className="max-h-[60vh]">
                      <img ref={imgRef} key={`crop-${currentImageUrl}`} src={currentImageUrl!} alt="Crop this image" className="w-full h-auto object-contain max-h-[60vh] rounded-xl" />
                    </ReactCrop>
                  ) : (
                    <>
                      <div className="w-full h-full" style={{ transform: `translate(${position.x}px, ${position.y}px) scale(${scale})`, transformOrigin: '0 0' }}>
                          <div className="relative">
                              {originalImageUrl && (<img key={originalImageUrl} src={originalImageUrl} alt="Original" className="w-full h-auto object-contain max-h-[60vh] rounded-xl pointer-events-none" />)}
                              <img ref={imgRef} key={currentImageUrl} src={currentImageUrl!} alt="Current" onLoad={(e) => imageLoaded(e.currentTarget)} className={`absolute top-0 left-0 w-full h-auto object-contain max-h-[60vh] rounded-xl transition-opacity duration-200 ease-in-out ${isComparing ? 'opacity-0' : 'opacity-100'}`} />
                              <canvas ref={maskCanvasRef} className={`absolute top-0 left-0 w-full h-full pointer-events-none transition-opacity duration-200 ease-in-out ${isComparing ? 'opacity-0' : 'opacity-100'}`} style={{ imageRendering: 'pixelated' }} />
                          </div>
                      </div>
                      
                      <div className="absolute bottom-4 left-1/2 -translate-x-1/2 bg-black/50 backdrop-blur-md rounded-full p-2 flex items-center gap-2 text-white">
                        <button onClick={() => handleZoom(0.2, viewportRef.current!.clientWidth / 2, viewportRef.current!.clientHeight / 2)} className="p-2 hover:bg-white/10 rounded-full transition-colors" aria-label={t('app.zoomInAria')}><ZoomInIcon className="w-5 h-5" /></button>
                        <span className="font-mono text-sm w-12 text-center cursor-pointer" onClick={resetZoomAndPan}>{Math.round(scale * 100)}%</span>
                        <button onClick={() => handleZoom(-0.2, viewportRef.current!.clientWidth / 2, viewportRef.current!.clientHeight / 2)} className="p-2 hover:bg-white/10 rounded-full transition-colors" aria-label={t('app.zoomOutAria')}><ZoomOutIcon className="w-5 h-5" /></button>
                        <div className="w-px h-5 bg-white/20 mx-1"></div>
                        <button onClick={resetZoomAndPan} className="p-2 hover:bg-white/10 rounded-full transition-colors" aria-label={t('app.zoomResetAria')}><ExpandIcon className="w-5 h-5" /></button>
                      </div>
                    </>
                  )}
              </div>
            </>
          )}

          <div className="w-full flex flex-wrap items-center justify-center gap-2 md:gap-4 p-4 bg-gray-900/30 border border-gray-700/50 rounded-lg">
              <div className="flex items-center gap-2">
                  <button onClick={handleUndo} disabled={!canUndo || isLoading} className="p-2 rounded-md bg-white/10 hover:bg-white/20 disabled:opacity-50 transition-colors" aria-label={t('app.undoAria')}><UndoIcon className="w-5 h-5" /></button>
                  <button onClick={handleRedo} disabled={!canRedo || isLoading} className="p-2 rounded-md bg-white/10 hover:bg-white/20 disabled:opacity-50 transition-colors" aria-label={t('app.redoAria')}><RedoIcon className="w-5 h-5" /></button>
                  <button onMouseDown={() => setIsComparing(true)} onMouseUp={() => setIsComparing(false)} onMouseLeave={() => setIsComparing(false)} onTouchStart={() => setIsComparing(true)} onTouchEnd={() => setIsComparing(false)} disabled={isLoading || !originalImage} className="px-4 py-2 flex items-center gap-2 rounded-md bg-white/10 hover:bg-white/20 disabled:opacity-50 transition-colors" aria-label={t('app.compareAria')}><EyeIcon className="w-5 h-5" /> <span className="hidden sm:inline">{t('app.compareButton')}</span></button>
                  <button onClick={handleReset} disabled={isLoading || !canUndo} className="px-4 py-2 rounded-md bg-white/10 hover:bg-white/20 disabled:opacity-50 transition-colors">{t('app.resetButton')}</button>
              </div>
              <div className="w-full sm:w-auto h-px sm:h-auto sm:w-px bg-gray-600/50 mx-2"></div>
              <div className="flex items-center gap-2">
                  <button onClick={onUploadNew} className="px-4 py-2 rounded-md bg-white/10 hover:bg-white/20 transition-colors font-medium">{t('app.uploadNewButton')}</button>
                  <button onClick={handleSaveToGallery} disabled={isLoading || saveState !== 'idle'} className={`px-4 py-2 rounded-md font-medium transition-colors ${saveState === 'idle' ? 'bg-indigo-500 hover:bg-indigo-600 text-white' : saveState === 'saving' ? 'bg-indigo-700 text-gray-300' : 'bg-green-500 text-white'}`}>{saveButtonContent[saveState]}</button>
                  <button onClick={handleDownload} disabled={isLoading} className="px-4 py-2 rounded-md bg-blue-500 hover:bg-blue-600 text-white font-medium">{t('app.downloadButton')}</button>
                  <button onClick={handleHQDownload} disabled={isLoading} className="px-4 py-2 rounded-md bg-gradient-to-br from-amber-400 to-orange-500 hover:from-amber-500 hover:to-orange-600 text-white font-medium transition-all shadow-md hover:shadow-lg disabled:opacity-50 disabled:from-amber-700 disabled:to-orange-800 disabled:shadow-none">{t('app.downloadHQButton')}</button>
              </div>
          </div>

          <div className="w-full overflow-x-auto">
              <div className="flex items-center justify-start md:justify-center gap-2 p-2 bg-gray-900/30 rounded-lg border border-gray-700/50 min-w-max">
                  {(Object.keys(tabTranslationMap) as Tab[]).map(tab => (
                      <button key={tab} onClick={() => handleTabClick(tab)} className={`px-4 py-2 text-sm font-semibold rounded-md transition-colors ${activeTab === tab ? 'bg-blue-500 text-white' : 'text-gray-300 hover:bg-white/10'}`}>
                          {t(tabTranslationMap[tab])}
                      </button>
                  ))}
              </div>
          </div>

          <div className="w-full">
              {activeTab === 'enhance' && <EnhancePanel onEnhance={handleApplyEnhancement} isLoading={isLoading} />}
              {activeTab === 'erase' && <ErasePanel onErase={handleErase} onClearMask={clearMask} brushSize={brushSize} onBrushSizeChange={setBrushSize} isLoading={isLoading} isMaskEmpty={isMaskEmpty} />}
              {activeTab === 'filters' && <FilterPanel onApplyFilter={handleApplyFilter} isLoading={isLoading} />}
              {activeTab === 'adjust' && <AdjustmentPanel onApplyAdjustment={handleApplyAdjustment} isLoading={isLoading} />}
              {activeTab === 'crop' && <CropPanel onApplyCrop={handleApplyCrop} onSetAspect={setAspect} isLoading={isLoading} isCropping={!!completedCrop} />}
              {activeTab === 'combine' && <CombinePanel onCombine={handleCombine} isLoading={isLoading} />}
              {activeTab === 'bgRemove' && <BackgroundPanel onRemoveBackground={handleRemoveBackground} isLoading={isLoading} />}
              {activeTab === 'portrait' && <PortraitPanel onApplyEnhancement={handleApplyPortraitEnhancement} isLoading={isLoading} />}
          </div>
      </div>
    );
};

const AppContent: React.FC = () => {
    const [appMode, setAppMode] = useState<AppMode>('start');
    const [initialEditorImage, setInitialEditorImage] = useState<File | null>(null);
    const [isGalleryOpen, setIsGalleryOpen] = useState(false);

    const handleFileSelect = (files: FileList | null) => {
        if (files && files[0]) {
            setInitialEditorImage(files[0]);
            setAppMode('editor');
        }
    };
    
    const handleUploadNew = () => {
        setInitialEditorImage(null);
        setAppMode('start');
    };

    const handleGenerateClick = () => {
        setAppMode('generator');
    };

    const handleImageSelectForEditing = (file: File) => {
        setInitialEditorImage(file);
        setAppMode('editor');
    };

    const handleSwitchMode = (mode: 'editor' | 'batch') => {
      // If we are in the editor and there's an image, switch to batch.
      // If we are in batch, switch back to editor.
      if (appMode === 'editor' && initialEditorImage) {
        setAppMode('batch');
      } else {
        setAppMode('editor');
      }
    };

    return (
        <div className="min-h-screen flex flex-col">
            <Header 
              onOpenGallery={() => setIsGalleryOpen(true)} 
              appMode={appMode}
              onSwitchMode={handleSwitchMode} 
            />
            <main className="flex-grow flex items-center justify-center p-4 sm:p-8">
                {appMode === 'start' && <StartScreen onFileSelect={handleFileSelect} onGenerateClick={handleGenerateClick} />}
                {appMode === 'editor' && initialEditorImage && <EditorContent key={initialEditorImage.name + initialEditorImage.lastModified} initialImage={initialEditorImage} onUploadNew={handleUploadNew} onOpenGallery={() => setIsGalleryOpen(true)} />}
                {appMode === 'batch' && <BatchProcessor onExit={() => setAppMode('editor')} />}
                {appMode === 'generator' && <ImageGenerator onBack={handleUploadNew} onImageSelectForEditing={handleImageSelectForEditing} />}
            </main>
            <GalleryModal 
              isOpen={isGalleryOpen} 
              onClose={() => setIsGalleryOpen(false)} 
              onImageSelect={handleImageSelectForEditing} 
            />
        </div>
    );
};


const App: React.FC = () => {
  return (
    <LanguageProvider>
      <AppContent />
    </LanguageProvider>
  );
};

export default App;