# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Build & Development Commands

- `npm run dev` — Start Vite dev server on port 5173
- `npm run build` — Type-check with `tsc` then build with Vite
- `npm run preview` — Preview the production build

No test framework is configured. No linter is configured.

## Project Overview

A React PWA for batch OCR processing. Users open a local folder via the File System Access API, select image/PDF files, and run OCR through one of three vision-language model providers. Results are saved as `.ocr.json` sidecar files in an `ocr_outputs/` subdirectory next to the source images.

Deployed to GitHub Pages at `/ocr_batch_processor/` (configured in `vite.config.ts` `base`).

## Architecture

### OCR Pipeline (the core data flow)

1. **Image → Provider Client** — `App.tsx:processOneOcr` reads the file as a data URL and dispatches to the selected provider client
2. **Provider Clients** (`lmStudioClient.ts`, `geminiClient.ts`, `ollamaClient.ts`) — Each has its own API format but all accept the same inputs (image data URL + system prompt) and return raw text
3. **Response Parsing** (`ocr/parseOcrResponse.ts`) — Normalizes raw model output. Handles multiple formats: GLM-OCR JSON arrays (with `label`/`bbox`/`content` fields, converted to HTML divs with `data-bbox` and `data-label`), structured JSON objects with `html`/`content`/`text` keys, or raw HTML strings
4. **Post-processing** — HTML is converted to markdown (`ocr/htmlToMarkdown.ts`), and bounding boxes are rendered as a canvas overlay (`ocr/renderBboxes.ts`)
5. **Storage** — Result saved as `OcrStoredResult` to the filesystem via `storage/ocrFileSystem.ts`. IndexedDB storage exists in `storage/ocrStore.ts` but the filesystem approach is primary

### Provider Pattern

Three providers share the same interface shape but use different APIs:
- **LM Studio** — Native REST API v1 (`/api/v1/chat`), uses `input` array with `{type: "text"/"image"}` items
- **Google Gemini** — REST API with `inline_data` for images, has built-in 12-second rate limiting for batch processing (5 RPM free tier)
- **Ollama** — `/api/generate` endpoint with `images` array (raw base64, no data URL prefix), `stream: false`

### Prompt Profiles

`ocr/prompts.ts` defines built-in prompt profiles (Chandra-OCR HTML/Layout, GLM-OCR Markdown/Layout) and supports custom profiles stored in localStorage. The `PromptProfile` type is the union of built-in keys; custom profiles use string IDs like `custom_<timestamp>`.

### Bounding Box Normalization

Two coordinate scales exist: Chandra-OCR uses 0–1024, GLM-OCR uses 0–1000. `renderBboxes.ts` auto-detects the scale by checking if any coordinate exceeds 1000.

### State Management

All state lives in `App.tsx` via `useState` hooks — no external state library. `App.tsx` is the orchestrator: it holds provider config, workspace state, file selection, and OCR results, passing them down as props to layout components.

### Component Structure

- `WorkspaceLayout` — Shell layout with sidebar/toolbar/content slots
- `FileSidebar` — File list with multi-select (shift/cmd+click)
- `ActionToolbar` — Run OCR, split pages, convert PDF actions
- `DocumentViewer` — Split view (original + annotated) or text view
- `SettingsDialog` — Provider config, prompt profile selection, connection testing
- `components/ui/` — Minimal shadcn-style primitives (button, card, input, label, textarea)

### File System Access API

The app uses the browser File System Access API (`showDirectoryPicker`, `FileSystemDirectoryHandle`) for reading source files and writing results. This requires a Chromium-based browser and only works over HTTP (localhost) or HTTPS. An HTTPS warning banner appears when local providers are used on a deployed (non-localhost) HTTPS site.

### PDF Tools

`lib/pdfTools.ts` uses `pdfjs-dist` for:
- **PDF to Images** — Renders each page to canvas at 2x scale, exports as JPEG to `converted_jpegs/` subdirectory
- **Split Pages** — Splits double-page scans into left/right halves, supports LR or RL reading order, outputs to `split_jpegs/`

## Tech Stack

- React 18 + TypeScript (strict mode)
- Vite 5 + SWC (via `@vitejs/plugin-react-swc`)
- Tailwind CSS 3
- PWA via `vite-plugin-pwa` (autoUpdate registration)
- `pdfjs-dist` for PDF rendering
- `jszip` for export bundling
- `clsx` + `tailwind-merge` (via `lib/utils.ts` `cn` helper)
