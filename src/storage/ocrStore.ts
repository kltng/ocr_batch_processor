export type OcrStoredResult = {
  key: string;
  imageName: string;
  model: string;
  createdAt: number;
  html: string;
  markdownWithHeaders: string;
  markdownNoHeaders: string;
  annotatedImageDataUrl?: string;
};

const DB_NAME = "lmstudio-ocr";
const DB_VERSION = 1;
const STORE_NAME = "ocrResults";

let dbPromise: Promise<IDBDatabase | null> | null = null;

function openDb(): Promise<IDBDatabase | null> {
  if (typeof indexedDB === "undefined") {
    return Promise.resolve(null);
  }

  if (!dbPromise) {
    dbPromise = new Promise((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, DB_VERSION);

      request.onupgradeneeded = () => {
        const db = request.result;
        if (!db.objectStoreNames.contains(STORE_NAME)) {
          db.createObjectStore(STORE_NAME, { keyPath: "key" });
        }
      };

      request.onsuccess = () => {
        resolve(request.result);
      };

      request.onerror = () => {
        console.warn("Failed to open IndexedDB for OCR storage", request.error);
        resolve(null);
      };
      request.onblocked = () => {
        console.warn("IndexedDB upgrade blocked for OCR storage");
      };
    });
  }

  return dbPromise;
}

function makeKey(hash: string, model: string): string {
  return `${hash}:${model}`;
}

export async function loadOcrResult(
  hash: string,
  model: string
): Promise<OcrStoredResult | null> {
  const db = await openDb();
  if (!db) {
    return null;
  }

  return new Promise((resolve) => {
    const tx = db.transaction(STORE_NAME, "readonly");
    const store = tx.objectStore(STORE_NAME);
    const request = store.get(makeKey(hash, model));

    request.onsuccess = () => {
      resolve((request.result as OcrStoredResult | undefined) ?? null);
    };

    request.onerror = () => {
      console.warn("Failed to read OCR result from IndexedDB", request.error);
      resolve(null);
    };
  });
}

export async function saveOcrResult(
  hash: string,
  model: string,
  data: Omit<OcrStoredResult, "key" | "model" | "createdAt"> & {
    createdAt?: number;
  }
): Promise<void> {
  const db = await openDb();
  if (!db) {
    return;
  }

  return new Promise((resolve) => {
    const tx = db.transaction(STORE_NAME, "readwrite");
    const store = tx.objectStore(STORE_NAME);

    const record: OcrStoredResult = {
      key: makeKey(hash, model),
      model,
      createdAt: data.createdAt ?? Date.now(),
      imageName: data.imageName,
      html: data.html,
      markdownWithHeaders: data.markdownWithHeaders,
      markdownNoHeaders: data.markdownNoHeaders,
      annotatedImageDataUrl: data.annotatedImageDataUrl
    };

    const request = store.put(record);

    request.onsuccess = () => resolve();
    request.onerror = () => {
      console.warn("Failed to write OCR result to IndexedDB", request.error);
      resolve();
    };
  });
}

export async function listAllOcrResults(): Promise<OcrStoredResult[]> {
  const db = await openDb();
  if (!db) {
    return [];
  }

  return new Promise((resolve) => {
    const tx = db.transaction(STORE_NAME, "readonly");
    const store = tx.objectStore(STORE_NAME);
    const request = store.getAll();

    request.onsuccess = () => {
      const results = (request.result as OcrStoredResult[]) || [];
      results.sort((a, b) => b.createdAt - a.createdAt);
      resolve(results);
    };

    request.onerror = () => {
      console.warn("Failed to list OCR results from IndexedDB", request.error);
      resolve([]);
    };
  });
}

export async function clearAllOcrResults(): Promise<void> {
  const db = await openDb();
  if (!db) {
    return;
  }

  return new Promise((resolve) => {
    const tx = db.transaction(STORE_NAME, "readwrite");
    const store = tx.objectStore(STORE_NAME);
    const request = store.clear();

    request.onsuccess = () => resolve();
    request.onerror = () => {
      console.warn("Failed to clear OCR results from IndexedDB", request.error);
      resolve();
    };
  });
}

