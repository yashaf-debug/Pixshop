/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/

const DB_NAME = 'PixshopGalleryDB';
const DB_VERSION = 1;
const STORE_NAME = 'editedImages';

let db: IDBDatabase;

const initDB = (): Promise<IDBDatabase> => {
  return new Promise((resolve, reject) => {
    if (db) {
      return resolve(db);
    }

    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onerror = () => {
      console.error('IndexedDB error:', request.error);
      reject('Error opening database');
    };

    request.onsuccess = () => {
      db = request.result;
      resolve(db);
    };

    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: 'id', autoIncrement: true });
      }
    };
  });
};

export const saveImageToGallery = async (file: File): Promise<number> => {
    const db = await initDB();
    return new Promise((resolve, reject) => {
        const transaction = db.transaction(STORE_NAME, 'readwrite');
        const store = transaction.objectStore(STORE_NAME);
        const request = store.add({ file, timestamp: new Date() });

        request.onsuccess = () => {
            resolve(request.result as number);
        };

        request.onerror = () => {
            console.error('Error saving image:', request.error);
            reject('Could not save image to gallery.');
        };
    });
};

export interface GalleryItem {
    id: number;
    file: File;
    timestamp: Date;
}

export const getImagesFromGallery = async (): Promise<GalleryItem[]> => {
    const db = await initDB();
    return new Promise((resolve, reject) => {
        const transaction = db.transaction(STORE_NAME, 'readonly');
        const store = transaction.objectStore(STORE_NAME);
        const request = store.getAll();

        request.onsuccess = () => {
            // Sort by timestamp descending to show newest first
            const sortedResults = request.result.sort((a, b) => b.timestamp - a.timestamp);
            resolve(sortedResults as GalleryItem[]);
        };

        request.onerror = () => {
            console.error('Error fetching images:', request.error);
            reject('Could not fetch images from gallery.');
        };
    });
};

export const deleteImageFromGallery = async (id: number): Promise<void> => {
    const db = await initDB();
    return new Promise((resolve, reject) => {
        const transaction = db.transaction(STORE_NAME, 'readwrite');
        const store = transaction.objectStore(STORE_NAME);
        const request = store.delete(id);

        request.onsuccess = () => {
            resolve();
        };

        request.onerror = () => {
            console.error('Error deleting image:', request.error);
            reject('Could not delete image from gallery.');
        };
    });
};
