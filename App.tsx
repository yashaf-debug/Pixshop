/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/


import React, { useState, useCallback, useRef, useEffect } from 'react';
import ReactCrop, { type Crop, type PixelCrop } from 'react-image-crop';
import { generateErasedImage, generateFilteredImage, generateAdjustedImage, generateCombinedImage, generateExpandedImage, generateRemovedBackgroundImage, generatePortraitEnhancement, dataURLtoFile } from './services/geminiService';
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
import { UndoIcon, RedoIcon, EyeIcon, ZoomInIcon, ZoomOutIcon, ExpandIcon } from './components/icons';
import StartScreen from './components/StartScreen';
import GalleryModal from './components/GalleryModal';
import { LanguageProvider, useLanguage } from './contexts/LanguageContext';
import { TranslationKey } from './translations';

type Tab = 'erase' | 'adjust' | 'filters' | 'crop' | 'combine' | 'expand' | 'bgRemove' | 'portrait';
type SaveState = 'idle' | 'saving' | 'saved';
type ViewMode = 'editor' | 'batch';

const tabTranslationMap: Record<Tab, TranslationKey> = {
  erase: 'app.tabErase',
  expand: 'app.tabExpand',
  bgRemove: 'app.tabBgRemove',
  crop: 'app.tabCrop',
  adjust: 'app.tabAdjust',
  filters: 'app.tabFilters',
  combine: 'app.tabCombine',
  portrait: 'app.tabPortrait',
};

const AppContent: React.FC = () => {
  const { t } = useLanguage();
  
  const [viewMode, setViewMode] = useState<ViewMode>('editor');

  const [history, setHistory] = useState<File[]>([]);
  const [historyIndex, setHistoryIndex] = useState<number>(-1);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<Tab>('erase');
  
  const [crop, setCrop] = useState<Crop>();
  const [completedCrop, setCompletedCrop] = useState<PixelCrop>();
  const [aspect, setAspect] = useState<number | undefined>();
  const [isComparing, setIsComparing] = useState<boolean>(false);
  const imgRef = useRef<HTMLImageElement>(null);
  const maskCanvasRef = useRef<HTMLCanvasElement>(null);

  const [isGalleryOpen, setIsGalleryOpen] = useState<boolean>(false);
  const [saveState, setSaveState] = useState<SaveState>('idle');
  
  // Zoom and Pan state
  const [scale, setScale] = useState<number>(1);
  const [position, setPosition] = useState<{ x: number, y: number }>({ x: 0, y: 0 });
  const viewportRef = useRef<HTMLDivElement>(null);
  const isPanning = useRef<boolean>(false);
  const panStart = useRef<{ x: number, y: number }>({ x: 0, y: 0 });
  const initialTouchDistance = useRef(0);
  const initialScale = useRef(1);

  // Erase tab state
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

  const handleViewModeSwitch = (mode: ViewMode) => {
      setViewMode(mode);
  };

  // Effect to create and revoke object URLs safely for the current image
  useEffect(() => {
    if (currentImage) {
      const url = URL.createObjectURL(currentImage);
      setCurrentImageUrl(url);
      setSaveState('idle'); // Reset save state when image changes
      clearMask();
      return () => URL.revokeObjectURL(url);
    } else {
      setCurrentImageUrl(null);
    }
  }, [currentImage, clearMask]);
  
  // Effect to create and revoke object URLs safely for the original image
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

  const resetZoomAndPan = useCallback(() => {
    setScale(1);
    setPosition({ x: 0, y: 0 });
  }, []);

  const addImageToHistory = useCallback((newImageFile: File) => {
    const newHistory = history.slice(0, historyIndex + 1);
    newHistory.push(newImageFile);
    setHistory(newHistory);
    setHistoryIndex(newHistory.length - 1);
    setSaveState('idle');
    // Reset transient states after an action
    setCrop(undefined);
    setCompletedCrop(undefined);
    resetZoomAndPan();
    clearMask();
  }, [history, historyIndex, resetZoomAndPan, clearMask]);

  const handleImageUpload = useCallback((file: File) => {
    setError(null);
    setHistory([file]);
    setHistoryIndex(0);
    setActiveTab('filters');
    setCrop(undefined);
    setCompletedCrop(undefined);
    resetZoomAndPan();
  }, [resetZoomAndPan]);
  
  const handleErase = useCallback(async () => {
    if (!currentImage || !maskCanvasRef.current || isMaskEmpty) {
      setError(t('app.errorNoMask'));
      return;
    }
  
    setIsLoading(true);
    setError(null);
  
    try {
      const maskCanvas = maskCanvasRef.current;
      const originalImg = imgRef.current;
  
      if (!originalImg) throw new Error("Original image element not found.");
  
      // Create a full-resolution, binary mask
      const binaryMaskCanvas = document.createElement('canvas');
      binaryMaskCanvas.width = originalImg.naturalWidth;
      binaryMaskCanvas.height = originalImg.naturalHeight;
      const ctx = binaryMaskCanvas.getContext('2d');
      if (!ctx) throw new Error("Could not create canvas context for mask.");
  
      // Draw the user's mask, scaled up to full resolution
      ctx.drawImage(maskCanvas, 0, 0, originalImg.naturalWidth, originalImg.naturalHeight);
  
      // Convert to binary black/white
      const imageData = ctx.getImageData(0, 0, binaryMaskCanvas.width, binaryMaskCanvas.height);
      const data = imageData.data;
      for (let i = 0; i < data.length; i += 4) {
        // If the pixel has any opacity from the brush, make it fully white. Otherwise, black.
        if (data[i + 3] > 0) {
          data[i] = 255;     // R
          data[i + 1] = 255; // G
          data[i + 2] = 255; // B
          data[i + 3] = 255; // A
        } else {
          data[i] = 0;
          data[i + 1] = 0;
          data[i + 2] = 0;
          data[i + 3] = 255;
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
    if (!currentImage) {
      setError(t('app.errorNoImageForFilter'));
      return;
    }
    
    setIsLoading(true);
    setError(null);
    
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
    if (!currentImage) {
      setError(t('app.errorNoImageForAdjustment'));
      return;
    }
    
    setIsLoading(true);
    setError(null);
    
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
    if (!currentImage) {
      setError(t('app.errorNoImageForPortrait'));
      return;
    }
    
    setIsLoading(true);
    setError(null);
    
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


  const handleApplyCrop = useCallback(() => {
    if (!completedCrop || !imgRef.current) {
        setError(t('app.errorNoCropSelection'));
        return;
    }

    const image = imgRef.current;
    const canvas = document.createElement('canvas');
    const scaleX = image.naturalWidth / image.width;
    const scaleY = image.naturalHeight / image.height;
    
    canvas.width = completedCrop.width;
    canvas.height = completedCrop.height;
    const ctx = canvas.getContext('2d');

    if (!ctx) {
        setError(t('app.errorCropProcess'));
        return;
    }

    const pixelRatio = window.devicePixelRatio || 1;
    canvas.width = completedCrop.width * pixelRatio;
    canvas.height = completedCrop.height * pixelRatio;
    ctx.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0);
    ctx.imageSmoothingQuality = 'high';

    ctx.drawImage(
      image,
      completedCrop.x * scaleX,
      completedCrop.y * scaleY,
      completedCrop.width * scaleX,
      completedCrop.height * scaleY,
      0,
      0,
      completedCrop.width,
      completedCrop.height,
    );
    
    const croppedImageUrl = canvas.toDataURL('image/png');
    const newImageFile = dataURLtoFile(croppedImageUrl, `cropped-${Date.now()}.png`);
    addImageToHistory(newImageFile);

  }, [completedCrop, addImageToHistory, t]);

  const handleApplyExpand = useCallback(async (prompt: string, newWidth: number, newHeight: number, imageX: number, imageY: number) => {
    if (!currentImage || !imgRef.current) {
        setError(t('app.errorNoImage'));
        return;
    }

    setIsLoading(true);
    setError(null);

    try {
        const expandedImageUrl = await generateExpandedImage(
            currentImage,
            prompt,
            newWidth,
            newHeight,
            imageX,
            imageY,
        );
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
    if (!currentImage) {
      setError(t('app.errorNoImage'));
      return;
    }
    if (!backgroundImage) {
      setError(t('app.errorNoBackgroundImage'));
      return;
    }
    
    setIsLoading(true);
    setError(null);
    
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
    if (!currentImage) {
      setError(t('app.errorNoImage'));
      return;
    }
    
    setIsLoading(true);
    setError(null);
    
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


  const handleUndo = useCallback(() => {
    if (canUndo) {
      setHistoryIndex(historyIndex - 1);
      resetZoomAndPan();
    }
  }, [canUndo, historyIndex, resetZoomAndPan]);
  
  const handleRedo = useCallback(() => {
    if (canRedo) {
      setHistoryIndex(historyIndex + 1);
      resetZoomAndPan();
    }
  }, [canRedo, historyIndex, resetZoomAndPan]);

  const handleReset = useCallback(() => {
    if (history.length > 0) {
      setHistoryIndex(0);
      setError(null);
      resetZoomAndPan();
    }
  }, [history, resetZoomAndPan]);

  const handleUploadNew = useCallback(() => {
      setHistory([]);
      setHistoryIndex(-1);
      setError(null);
      resetZoomAndPan();
  }, [resetZoomAndPan]);

  const handleDownload = useCallback(() => {
      if (currentImage) {
          const link = document.createElement('a');
          link.href = URL.createObjectURL(currentImage);
          link.download = `edited-${currentImage.name}`;
          document.body.appendChild(link);
          link.click();
          document.body.removeChild(link);
          URL.revokeObjectURL(link.href);
      }
  }, [currentImage]);
  
  const handleFileSelect = (files: FileList | null) => {
    if (files && files[0]) {
      handleImageUpload(files[0]);
    }
  };

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
    ctx.strokeStyle = 'rgba(239, 68, 68, 0.7)'; // semi-transparent red
    ctx.lineWidth = brushSize / scale; // Adjust brush size based on zoom

    ctx.beginPath();
    if (lastPosition.current) {
        ctx.moveTo(lastPosition.current.x, lastPosition.current.y);
    }
    ctx.lineTo(currentPos.x, currentPos.y);
    ctx.stroke();
    
    lastPosition.current = currentPos;
  };
  
  // Zoom and Pan Handlers
  const handleZoom = useCallback((delta: number, centerX: number, centerY: number) => {
      const newScale = Math.min(Math.max(0.2, scale + delta), 8);
      const newX = centerX - (centerX - position.x) * (newScale / scale);
      const newY = centerY - (centerY - position.y) * (newScale / scale);

      setScale(newScale);
      setPosition({ x: newX, y: newY });
  }, [scale, position]);

  const handleWheel = (e: React.WheelEvent<HTMLDivElement>) => {
      e.preventDefault();
      const rect = e.currentTarget.getBoundingClientRect();
      handleZoom(-e.deltaY * 0.005, e.clientX - rect.left, e.clientY - rect.top);
  };

  const handleMouseDown = (e: React.MouseEvent<HTMLDivElement>) => {
      if (activeTab === 'erase') {
        if (e.button !== 0) return;
        isDrawing.current = true;
        setIsMaskEmpty(false);
        drawOnCanvas(e);
      } else {
        if (e.button !== 0 || scale <= 1) return;
        isPanning.current = true;
        panStart.current = { x: e.clientX - position.x, y: e.clientY - position.y };
        e.currentTarget.style.cursor = 'grabbing';
      }
  };

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
      if (activeTab === 'erase' && isDrawing.current) {
        drawOnCanvas(e);
      } else if (isPanning.current) {
        setPosition({ 
          x: e.clientX - panStart.current.x, 
          y: e.clientY - panStart.current.y 
        });
      }
  };
  
  const getCursorStyle = useCallback(() => {
    if (activeTab === 'erase') return 'crosshair';
    if (scale > 1) return 'grab';
    return 'default';
  }, [activeTab, scale]);

  const handleMouseUpOrLeave = (e: React.MouseEvent<HTMLDivElement>) => {
      if (activeTab === 'erase' && isDrawing.current) {
        isDrawing.current = false;
        lastPosition.current = null;
      }
      if (isPanning.current) {
          isPanning.current = false;
          e.currentTarget.style.cursor = getCursorStyle();
      }
  };
  
  // Touch Handlers
  const getDistance = (touches: React.TouchList) => Math.hypot(touches[0].clientX - touches[1].clientX, touches[0].clientY - touches[1].clientY);

  const handleTouchStart = (e: React.TouchEvent<HTMLDivElement>) => {
      if (e.touches.length === 2) {
          e.preventDefault();
          initialTouchDistance.current = getDistance(e.touches);
          initialScale.current = scale;
      } else if (e.touches.length === 1) {
          if (activeTab === 'erase') {
              isDrawing.current = true;
              setIsMaskEmpty(false);
              drawOnCanvas(e);
          } else if (scale > 1) {
              isPanning.current = true;
              panStart.current = { x: e.touches[0].clientX - position.x, y: e.touches[0].clientY - position.y };
          }
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
          if (activeTab === 'erase' && isDrawing.current) {
              drawOnCanvas(e);
          } else if (isPanning.current) {
              setPosition({ 
                x: e.touches[0].clientX - panStart.current.x,
                y: e.touches[0].clientY - panStart.current.y
              });
          }
      }
  };

  const handleTouchEnd = (e: React.TouchEvent<HTMLDivElement>) => {
    if (activeTab === 'erase' && isDrawing.current) {
      isDrawing.current = false;
      lastPosition.current = null;
    }
      isPanning.current = false;
      initialTouchDistance.current = 0;
  };

const handleSaveToGallery = async () => {
    if (!currentImage) return;

    setSaveState('saving');
    try {
      await saveImageToGallery(currentImage);
      setSaveState('saved');
    } catch (err) {
      setError(t('app.errorSaveToGallery'));
      setSaveState('idle');
      console.error(err);
    }
  };

  const handleSelectImageFromGallery = (file: File) => {
    handleImageUpload(file);
    setIsGalleryOpen(false);
  };

  const renderEditorContent = () => {
    if (error) {
       return (
           <div className="text-center animate-fade-in bg-red-500/10 border border-red-500/20 p-8 rounded-lg max-w-2xl mx-auto flex flex-col items-center gap-4">
            <h2 className="text-2xl font-bold text-red-300">{t('app.errorTitle')}</h2>
            <p className="text-md text-red-400">{error}</p>
            <button
                onClick={() => setError(null)}
                className="bg-red-500 hover:bg-red-600 text-white font-bold py-2 px-6 rounded-lg text-md transition-colors"
              >
                {t('app.tryAgain')}
            </button>
          </div>
        );
    }
    
    if (!currentImageUrl) {
      return <StartScreen onFileSelect={handleFileSelect} />;
    }
    
    const imageLoaded = (img: HTMLImageElement) => {
        const canvas = maskCanvasRef.current;
        if (canvas) {
            canvas.width = img.clientWidth;
            canvas.height = img.clientHeight;
            clearMask();
        }
    };

    const saveButtonContent = {
        idle: t('app.saveToGalleryButtonIdle'),
        saving: t('app.saveToGalleryButtonSaving'),
        saved: t('app.saveToGalleryButtonSaved')
    };
    
    return (
      <div className="w-full max-w-4xl mx-auto flex flex-col items-center gap-6 animate-fade-in">
        {activeTab === 'expand' ? (
          <ExpandPanel 
            onApplyExpand={handleApplyExpand} 
            imgRef={imgRef} 
            isLoading={isLoading} 
            isVisible={activeTab === 'expand'}
          />
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
                style={{ 
                    cursor: activeTab !== 'crop' ? getCursorStyle() : 'default',
                    minHeight: '40vh',
                }}
            >
                {isLoading && (
                    <div className="absolute inset-0 bg-black/70 z-30 flex flex-col items-center justify-center gap-4 animate-fade-in">
                        <Spinner />
                        <p className="text-gray-300">{t('app.loadingMessage')}</p>
                    </div>
                )}
                
                {activeTab === 'crop' ? (
                  <ReactCrop 
                    crop={crop} 
                    onChange={c => setCrop(c)} 
                    onComplete={c => setCompletedCrop(c)}
                    aspect={aspect}
                    className="max-h-[60vh]"
                  >
                    <img 
                        ref={imgRef}
                        key={`crop-${currentImageUrl}`}
                        src={currentImageUrl} 
                        alt="Crop this image"
                        className="w-full h-auto object-contain max-h-[60vh] rounded-xl"
                    />
                  </ReactCrop>
                ) : (
                  <>
                    <div 
                        className="w-full h-full"
                        style={{
                            transform: `translate(${position.x}px, ${position.y}px) scale(${scale})`,
                            transformOrigin: '0 0',
                        }}
                    >
                        <div className="relative">
                            {originalImageUrl && (
                                <img key={originalImageUrl} src={originalImageUrl} alt="Original" className="w-full h-auto object-contain max-h-[60vh] rounded-xl pointer-events-none" />
                            )}
                            <img
                                ref={imgRef}
                                key={currentImageUrl}
                                src={currentImageUrl}
                                alt="Current"
                                onLoad={(e) => imageLoaded(e.currentTarget)}
                                className={`absolute top-0 left-0 w-full h-auto object-contain max-h-[60vh] rounded-xl transition-opacity duration-200 ease-in-out ${isComparing ? 'opacity-0' : 'opacity-100'}`}
                            />
                            <canvas 
                                ref={maskCanvasRef}
                                className={`absolute top-0 left-0 w-full h-full pointer-events-none transition-opacity duration-200 ease-in-out ${isComparing ? 'opacity-0' : 'opacity-100'}`}
                                style={{ imageRendering: 'pixelated' }}
                            />
                        </div>
                    </div>
                    
                    <div className="absolute bottom-4 left-1/2 -translate-x-1/2 bg-black/50 backdrop-blur-md rounded-full p-2 flex items-center gap-1 text-white shadow-lg z-20 animate-fade-in">
                        <button onClick={() => handleZoom(0.25, viewportRef.current!.clientWidth / 2, viewportRef.current!.clientHeight / 2)} aria-label={t('app.zoomInAria')} className="p-2 hover:bg-white/20 rounded-full transition-colors"><ZoomInIcon className="w-5 h-5" /></button>
                        <span className="w-16 text-center font-mono text-sm" aria-live="polite">{Math.round(scale * 100)}%</span>
                        <button onClick={() => handleZoom(-0.25, viewportRef.current!.clientWidth / 2, viewportRef.current!.clientHeight / 2)} aria-label={t('app.zoomOutAria')} className="p-2 hover:bg-white/20 rounded-full transition-colors"><ZoomOutIcon className="w-5 h-5" /></button>
                        <div className="w-px h-5 bg-white/20 mx-1"></div>
                        <button onClick={resetZoomAndPan} aria-label={t('app.zoomResetAria')} className="p-2 hover:bg-white/20 rounded-full transition-colors"><ExpandIcon className="w-5 h-5" /></button>
                    </div>
                  </>
                )}
            </div>
            
            <div className="w-full">
                {activeTab === 'erase' && (
                    <ErasePanel 
                        onErase={handleErase}
                        onClearMask={clearMask}
                        brushSize={brushSize}
                        onBrushSizeChange={setBrushSize}
                        isLoading={isLoading}
                        isMaskEmpty={isMaskEmpty}
                    />
                )}
                {activeTab === 'combine' && <CombinePanel onCombine={handleCombine} isLoading={isLoading} />}
                {activeTab === 'crop' && <CropPanel onApplyCrop={handleApplyCrop} onSetAspect={setAspect} isLoading={isLoading} isCropping={!!completedCrop?.width && completedCrop.width > 0} />}
                {activeTab === 'adjust' && <AdjustmentPanel onApplyAdjustment={handleApplyAdjustment} isLoading={isLoading} />}
                {activeTab === 'filters' && <FilterPanel onApplyFilter={handleApplyFilter} isLoading={isLoading} />}
                {activeTab === 'bgRemove' && <BackgroundPanel onRemoveBackground={handleRemoveBackground} isLoading={isLoading} />}
                {activeTab === 'portrait' && <PortraitPanel onApplyEnhancement={handleApplyPortraitEnhancement} isLoading={isLoading} />}
            </div>
          </>
        )}
        
        <div className="w-full bg-gray-800/80 border border-gray-700/80 rounded-lg p-2 flex items-center justify-center gap-1 backdrop-blur-sm">
            {(['filters', 'adjust', 'portrait', 'erase', 'expand', 'bgRemove', 'crop', 'combine'] as Tab[]).map(tab => (
                 <button
                    key={tab}
                    onClick={() => handleTabClick(tab)}
                    className={`relative w-full capitalize font-semibold py-3 px-4 rounded-md transition-all duration-200 text-sm flex items-center justify-center gap-2 ${
                        activeTab === tab 
                        ? 'bg-gradient-to-br from-blue-500 to-cyan-400 text-white shadow-lg shadow-cyan-500/40' 
                        : 'text-gray-300 hover:text-white hover:bg-white/10'
                    }`}
                >
                    {t(tabTranslationMap[tab])}
                </button>
            ))}
        </div>
        
        <div className="w-full flex flex-wrap items-center justify-center gap-3 mt-6">
            <button 
                onClick={handleUndo}
                disabled={!canUndo}
                className="flex items-center justify-center text-center bg-white/10 border border-white/20 text-gray-200 font-semibold py-3 px-5 rounded-md transition-all duration-200 ease-in-out hover:bg-white/20 hover:border-white/30 active:scale-95 text-base disabled:opacity-50 disabled:cursor-not-allowed disabled:bg-white/5"
                aria-label={t('app.undoAria')}
            >
                <UndoIcon className="w-5 h-5 mr-2" />
                {t('app.undoButton')}
            </button>
            <button 
                onClick={handleRedo}
                disabled={!canRedo}
                className="flex items-center justify-center text-center bg-white/10 border border-white/20 text-gray-200 font-semibold py-3 px-5 rounded-md transition-all duration-200 ease-in-out hover:bg-white/20 hover:border-white/30 active:scale-95 text-base disabled:opacity-50 disabled:cursor-not-allowed disabled:bg-white/5"
                aria-label={t('app.redoAria')}
            >
                <RedoIcon className="w-5 h-5 mr-2" />
                {t('app.redoButton')}
            </button>
            
            <div className="h-6 w-px bg-gray-600 mx-1 hidden sm:block"></div>

            {canUndo && (
              <button 
                  onMouseDown={() => setIsComparing(true)}
                  onMouseUp={() => setIsComparing(false)}
                  onMouseLeave={() => setIsComparing(false)}
                  onTouchStart={() => setIsComparing(true)}
                  onTouchEnd={() => setIsComparing(false)}
                  className="flex items-center justify-center text-center bg-white/10 border border-white/20 text-gray-200 font-semibold py-3 px-5 rounded-md transition-all duration-200 ease-in-out hover:bg-white/20 hover:border-white/30 active:scale-95 text-base"
                  aria-label={t('app.compareAria')}
              >
                  <EyeIcon className="w-5 h-5 mr-2" />
                  {t('app.compareButton')}
              </button>
            )}

            <button 
                onClick={handleReset}
                disabled={!canUndo}
                className="text-center bg-transparent border border-white/20 text-gray-200 font-semibold py-3 px-5 rounded-md transition-all duration-200 ease-in-out hover:bg-white/10 hover:border-white/30 active:scale-95 text-base disabled:opacity-50 disabled:cursor-not-allowed disabled:bg-transparent"
              >
                {t('app.resetButton')}
            </button>
            
            <div className="flex-grow flex justify-center sm:justify-end gap-3">
                <button 
                    onClick={handleUploadNew}
                    className="text-center bg-white/10 border border-white/20 text-gray-200 font-semibold py-3 px-5 rounded-md transition-all duration-200 ease-in-out hover:bg-white/20 hover:border-white/30 active:scale-95 text-base"
                >
                    {t('app.uploadNewButton')}
                </button>
                <button 
                    onClick={handleSaveToGallery}
                    disabled={saveState !== 'idle' || !currentImage}
                    className="text-center bg-white/10 border border-white/20 text-gray-200 font-semibold py-3 px-5 rounded-md transition-all duration-200 ease-in-out hover:bg-white/20 hover:border-white/30 active:scale-95 text-base disabled:opacity-50 disabled:cursor-not-allowed"
                >
                    {saveButtonContent[saveState]}
                </button>
                <button 
                    onClick={handleDownload}
                    className="bg-gradient-to-br from-green-600 to-green-500 text-white font-bold py-3 px-5 rounded-md transition-all duration-300 ease-in-out shadow-lg shadow-green-500/20 hover:shadow-xl hover:shadow-green-500/40 hover:-translate-y-px active:scale-95 active:shadow-inner text-base"
                >
                    {t('app.downloadButton')}
                </button>
            </div>
        </div>
      </div>
    );
  };
  
  return (
    <div className="min-h-screen text-gray-100 flex flex-col">
        <Header 
            onOpenGallery={() => setIsGalleryOpen(true)}
            viewMode={viewMode}
            onSwitchView={handleViewModeSwitch}
        />
        <main className={`flex-grow w-full max-w-[1600px] mx-auto p-4 md:p-8 flex justify-center ${viewMode === 'editor' && !currentImage ? 'items-center' : 'items-start'}`}>
            {viewMode === 'editor' ? renderEditorContent() : <BatchProcessor onExit={() => setViewMode('editor')} />}
        </main>
        {viewMode === 'editor' && (
            <GalleryModal 
                isOpen={isGalleryOpen} 
                onClose={() => setIsGalleryOpen(false)} 
                onImageSelect={handleSelectImageFromGallery} 
            />
        )}
    </div>
  );
};

const App: React.FC = () => {
    return (
        <LanguageProvider>
            <AppContent />
        </LanguageProvider>
    )
}

export default App;