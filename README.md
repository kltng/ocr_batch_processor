# LM Studio OCR Application

An installable progressive web application (PWA) for running OCR with any vision-capable model hosted in **LM Studio**, with:

- Single-image and batch OCR
- Smart caching and resume using IndexedDB
- Annotated images with bounding boxes
- Local gallery and export to folder or ZIP
- Light / dark / system theme support

> This app is a TypeScript/React port of the reference Python LM Studio OCR tool, designed to run fully in the browser while talking to LM Studio over its OpenAI-compatible HTTP API.

---

## 1. Requirements

- **Node.js**: v18+ (you have v24.x locally, which is fine)
- **npm**: v9+ (you have v11.x)
- **LM Studio**:
  - Latest LM Studio desktop app
  - A **vision-capable model** (e.g. `chandra-ocr`, `qwen2.5-vl-*`, `gemma-3-*`), downloaded and loaded
  - **OpenAI-compatible API server enabled**
  - **CORS enabled for this app’s origin** (see below)

The app assumes LM Studio is reachable at something like:

- `http://localhost:1234` (default in the UI)

You can change this in the app at runtime.

---

## 2. Project structure

Key files and directories:

- `index.html` – HTML entrypoint, sets the app title.
- `vite.config.ts` – Vite + React + PWA plugin configuration.
- `src/main.tsx` – React root renderer.
- `src/App.tsx` – Main application UI and logic.
- `src/styles.css` – Tailwind + shadcn-style tokens and base styles.
- `src/lmStudioClient.ts` – Wrapper to call LM Studio’s OpenAI-compatible `/v1/chat/completions` endpoint.
- `src/ocr/prompts.ts` – OCR system prompts (ported from `prompts.py`).
- `src/ocr/parseOcrResponse.ts` – Normalizes LM Studio responses into HTML text.
- `src/ocr/htmlToMarkdown.ts` – HTML → markdown conversion (with/without headers/footers).
- `src/ocr/renderBboxes.ts` – HTML + `data-bbox` / `data-label` → canvas-drawn bounding boxes.
- `src/storage/ocrStore.ts` – IndexedDB wrapper for caching OCR results.
- `src/export/exportAll.ts` – Export helpers for folder and ZIP export.
- `src/components/ui/*` – shadcn-style UI primitives (`Button`, `Input`, `Label`, `Textarea`, `Card`).
- `src/lib/hash.ts` – SHA-256 hashing helper for files.
- `src/lib/utils.ts` – `cn` class merging helper.

---

## 3. Installing and running

From the project root:

```bash
npm install

# Development server
npm run dev

# Production build
npm run build

# Preview production build locally
npm run preview
```

The dev server will typically run at `http://localhost:5173`.

---

## 4. LM Studio configuration

To use the app, LM Studio must:

1. Have a **vision-capable model** loaded (e.g. `chandra-ocr`).
2. Have the **OpenAI-compatible API server** enabled on some port (e.g. `http://localhost:1234`).
3. Have **CORS enabled** for the app’s origin:
   - If you host the app at `https://your-domain`, add that origin in LM Studio’s CORS configuration.
   - For local development (`http://localhost:5173`), ensure that origin is allowed.

In the UI, you configure:

- **Base URL** – defaults to `http://localhost:1234`, but can be changed (e.g., `http://127.0.0.1:1234` or a different port).
- **Model name** – defaults to `chandra-ocr`, but should match the exact model name shown in LM Studio.
- **API key** – default `lm-studio`, which is LM Studio’s default key for OpenAI-compat.

The **“Test connection”** button performs a `GET /api/v0/models` request and reports how many models LM Studio returns, so you can verify connectivity and CORS.

---

## 5. Features and workflows

### 5.1 Single-image OCR

On the **“Single Image OCR”** card:

1. Select an image file (`.png`, `.jpg`, `.jpeg`, `.tiff`, `.tif`).
2. Choose an **output format**:
   - `All (HTML + markdown)`
   - `Markdown with headers/footers`
   - `Markdown without headers/footers`
   - `HTML only`
3. Click **“Run OCR”**.

The app will:

- Check IndexedDB for a cached result using a hash of the file contents plus the current model name.
- If cached:
  - Load HTML, markdown outputs, and annotated image from local storage.
  - Skip the LM Studio call.
  - Set status to **“Loaded from cache”**.
- If not cached:
  - Convert the file to a Data URL and send it to LM Studio via `/v1/chat/completions`.
  - Use the `ocr_layout` prompt (so `data-bbox` + `data-label` are present).
  - Parse the response into HTML.
  - Generate:
    - Markdown with headers/footers.
    - Markdown without headers/footers (removes `Page-Header` and `Page-Footer`).
  - Render annotated image with bounding boxes using `<canvas>`.
  - Store all outputs in IndexedDB.

Results appear in the **“Results”** card:

- Raw HTML text area.
- Markdown (with headers) text area.
- Markdown (no headers) text area.
- Annotated image preview (if bounding boxes are present).

### 5.2 Batch OCR

On the **“Batch OCR”** card:

1. Select multiple images via the **Images** file input (same supported formats).
2. The app builds a **queue** showing each file and its status:
   - `queued`
   - `processing`
   - `done`
   - `error`
   - A **“cached”** pill appears if a result is served from local cache.
3. Click **“Run batch”**.

For each file, the app:

- Computes a hash and checks IndexedDB for an existing result.
  - Cache hit:
    - Loads HTML, markdown, and annotated image into the UI.
    - Marks the job as `done` with a **“cached”** indicator.
  - Cache miss:
    - Runs the same OCR pipeline as single-image.
    - Saves the result to IndexedDB.
    - Marks the job as `done` or `error` accordingly.

The **Results** card always shows the most recently processed image’s outputs.

### 5.3 Gallery

The **“Gallery & Export”** card shows a gallery of annotated images. It can be populated in two ways:

- Automatically as you process images:
  - After each OCR run (single or batch), if an annotated image is generated or loaded from cache, it is:
    - Added/updated in the gallery.
    - Tagged with whether it came from cache (`cached` chip).
- Manually from storage:
  - Click **“Load gallery from storage”** to:
    - Read all `OcrStoredResult` records from IndexedDB.
    - Build a gallery from those that have `annotatedImageDataUrl`.
    - Show how many were loaded.

Each gallery item shows:

- The annotated image preview.
- The source filename (truncated if long).
- A `cached` label if it originates from cache.

### 5.4 Export to folder (File System Access API)

If your browser supports the File System Access API (e.g., recent Chromium-based browsers), you can:

1. Click **“Export all to folder”**.
2. Select a target directory via the system folder picker.
3. The app will:
   - Fetch all stored results from IndexedDB.
   - Create an `output/` folder with:
     - `html_with_labels/`
     - `markdown_with_headers/`
     - `markdown/`
     - `images_with_bboxes/`
   - Write:
     - One `.html` file per image, wrapping the stored HTML in a minimal HTML document.
     - One `.md` per image in `markdown_with_headers` and/or `markdown`.
     - One `_bboxes.png` per image in `images_with_bboxes` when bounding boxes are available.
4. Status text indicates how many items were exported.

If the browser does not support folder selection, the button is disabled and an explanatory error message is shown if you try.

### 5.5 Export as ZIP

The **“Download all as ZIP”** button:

1. Reads all OCR results from IndexedDB.
2. Builds a ZIP archive in memory with the same `output/` structure as folder export.
3. Triggers a download of `ocr_outputs.zip`.

This is useful when:

- The File System Access API is not available.
- You want a single archive for sharing or manual placement.

### 5.6 Clearing local cache and gallery

The **“Clear gallery & cache”** button:

1. Shows a confirmation dialog:
   - Warns that it will clear all locally cached OCR results and gallery entries, and that this is irreversible.
2. On confirmation:
   - Clears the `ocrResults` object store in IndexedDB.
   - Clears the in-memory gallery.
   - Clears the annotated image preview.
   - Updates status text to indicate success.

Use this if:

- You want to free local storage.
- You changed models or prompts dramatically and don’t want old results to appear.

---

## 6. Theming (light/dark/system)

Theme can be controlled from the header:

- **System** (default):
  - Matches the OS/browser `prefers-color-scheme`.
  - Responds to changes in system theme.
- **Light**:
  - Forces light theme (`:root` CSS variables).
- **Dark**:
  - Forces dark theme (`.dark` CSS variables).

Implementation details:

- Theme preference is stored in `localStorage` under `theme-mode`.
- `App` toggles the `dark` class on `<html>` to switch palettes.

---

## 7. PWA behaviour

- Uses `vite-plugin-pwa` with `generateSW`:
  - Pre-caches app shell (JS, CSS, HTML).
  - Generates `manifest.webmanifest` and a service worker (`sw.js`).
- Once installed:
  - The app can be launched like a native application.
  - UI and cached results are available offline, but:
    - New OCR runs require LM Studio to be running and reachable.

---

## 8. Should you gitignore `dist/`?

By default, Vite builds into the `dist/` directory. In most setups:

- `dist/` is a **build artifact** and is **not committed** to git.
- Instead, you:
  - Commit source files.
  - Rebuild `dist/` in CI or your deployment environment.

In this project:

- The initial commit included `dist/` (for convenience).
- It is **recommended** to add `dist/` to `.gitignore` for ongoing development so that future builds don’t clutter your diffs.
- If you add `dist/` to `.gitignore`, you may also want to remove it from version control history or at least stop updating it:
  - `git rm -r --cached dist` (optional; run once if you want to untrack it).

The current `.gitignore` already includes:

- `node_modules/`
- `references/`
- OS-specific files (e.g. `.DS_Store`, `Thumbs.db`)

You can safely add:

```gitignore
/dist/
```

so that future builds are ignored by Git.

---

## 9. Notes and limitations

- The app relies on LM Studio’s **OpenAI-compatible HTTP API**; it does not use the Node-focused `@lmstudio/sdk` directly.
- Browser security:
  - If you host the PWA over **HTTPS**, and LM Studio runs over **HTTP**, you must ensure your browser and LM Studio’s CORS/mixed-content configuration allow this.
- IndexedDB:
  - Storage is local to the browser and origin.
  - Clearing site data or using private browsing may remove cached results.

If you’d like to extend this further (e.g., add merged markdown generation in the UI, model selection from LM Studio’s `/models` endpoint, or a more advanced job history browser), the current structure is prepared for those kinds of additions.

