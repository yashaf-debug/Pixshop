/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/

import React, { useState, useEffect, useCallback } from 'react';
import { getImagesFromGallery, deleteImageFromGallery } from '../services/galleryService';
import { TrashIcon } from './icons';
import Spinner from './Spinner';
import { useLanguage } from '../contexts/LanguageContext';

interface GalleryModalProps {
  isOpen: boolean;
  onClose: () => void;
  onImageSelect: (file: File) => void;
}

interface GalleryImage {
  id: number;
  file: File;
  url: string;
}

const GalleryModal: React.FC<GalleryModalProps> = ({ isOpen, onClose, onImageSelect }) => {
  const { t } = useLanguage();
  const [images, setImages] = useState<GalleryImage[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadImages = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const items = await getImagesFromGallery();
      const imageObjects = items.map(item => ({
        ...item,
        url: URL.createObjectURL(item.file),
      }));
      setImages(imageObjects);
    } catch (err) {
      setError(t('gallery.loadingError'));
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  }, [t]);

  useEffect(() => {
    if (isOpen) {
      loadImages();
    }

    const currentImages = images;
    return () => {
      // Revoke object URLs on cleanup
      currentImages.forEach(image => URL.revokeObjectURL(image.url));
    };
  }, [isOpen, loadImages]);

  const handleDelete = async (id: number, url: string) => {
    try {
      await deleteImageFromGallery(id);
      URL.revokeObjectURL(url);
      setImages(prevImages => prevImages.filter(image => image.id !== id));
    } catch (err) {
      setError(t('gallery.deleteError'));
      console.error(err);
    }
  };

  const handleSelect = (file: File) => {
    onImageSelect(file);
    onClose();
  };
  
  // Handle Escape key to close modal
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onClose();
      }
    };
    if (isOpen) {
        window.addEventListener('keydown', handleKeyDown);
    }
    return () => {
        window.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen, onClose]);


  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 bg-black/80 backdrop-blur-lg z-50 flex items-center justify-center animate-fade-in"
      onClick={onClose}
      aria-modal="true"
      role="dialog"
    >
      <div
        className="bg-gray-900/80 border border-gray-700 w-full max-w-6xl h-[90vh] rounded-2xl shadow-2xl flex flex-col p-6"
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-4 flex-shrink-0">
          <h2 className="text-2xl font-bold text-gray-100">{t('gallery.title')}</h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-white transition-colors text-3xl leading-none"
            aria-label={t('gallery.closeAria')}
          >
            &times;
          </button>
        </div>
        
        <div className="flex-grow overflow-y-auto pr-2 -mr-2">
            {isLoading ? (
                <div className="flex items-center justify-center h-full">
                    <Spinner />
                </div>
            ) : error ? (
                <div className="flex items-center justify-center h-full text-red-400">{error}</div>
            ) : images.length === 0 ? (
                <div className="flex items-center justify-center h-full text-gray-400">
                    <p className="text-lg">{t('gallery.emptyMessage')}</p>
                </div>
            ) : (
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
                    {images.map(image => (
                        <div key={image.id} className="group relative aspect-square rounded-lg overflow-hidden cursor-pointer" onClick={() => handleSelect(image.file)}>
                            <img src={image.url} alt={`Edited image ${image.id}`} className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105" />
                            <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex items-center justify-center">
                                <span className="text-white font-semibold">{t('gallery.loadImage')}</span>
                            </div>
                            <button
                                onClick={(e) => { e.stopPropagation(); handleDelete(image.id, image.url); }}
                                className="absolute top-2 right-2 p-2 bg-black/50 rounded-full text-white hover:bg-red-600 transition-colors opacity-0 group-hover:opacity-100"
                                aria-label={t('gallery.deleteAria')}
                            >
                                <TrashIcon className="w-5 h-5" />
                            </button>
                        </div>
                    ))}
                </div>
            )}
        </div>
      </div>
    </div>
  );
};

export default GalleryModal;