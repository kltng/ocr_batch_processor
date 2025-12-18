# LM Studio OCR Application

An installable progressive web application (PWA) for running privacy-focused OCR using **LM Studio** (local) or **Google Gemini** (cloud).

This app is designed to streamline the workflow of converting documents (PDFs, Images) into structured Markdown and HTML, leveraging the power of modern Vision Language Models (VLMs).

---

## 🚀 Features

### 1. Dual Providers
- **LM Studio (Local)**: Connects to your local LM Studio instance via its OpenAI-compatible server. Privacy-first, no data leaves your machine.
- **Google Gemini (Cloud)**: Uses Google's generative AI models for high-accuracy OCR if you have an API key.

### 2. Workspace-Based Workflow
- **Open Folder**: Work directly with files on your local file system.
- **Sidecar Output**: OCR results are saved as `.json` sidecar files next to your images (e.g., `image.png` -> `image.json`).
- **Markdown Export**: Automatically generates markdown files for easy reading and documentation.

### 3. Batch Processing tools
- **Batch OCR**: Process multiple selected files in queue.
- **Smart Skip**: "Skip Processed" option prevents re-running OCR on already analyzed files.
- **PDF Tools**:
  - **PDF to Images**: Convert PDF pages into individual JPEGs for optimal OCR accuracy.
  - **Split Pages**: Automatically split double-page scans into single pages.

### 4. Advanced Viewer
- **Side-by-Side View**: Toggle between:
  - **Original Image**
  - **Annotated Image** (with bounding boxes for detected text/layout)
  - **Markdown/HTML** (structured text output)
- **Live Updates**: Changes in storage are immediately reflected in the viewer.

---

## 🛠 Prerequisites

### For Local OCR (LM Studio)
- **LM Studio**: [Download here](https://lmstudio.ai).
- A **Vision Model**: Search for and download a vision-capable model (like `Qwen-VL`, `Llava`, `BakLLaVA`, or `Gemma-3-Vision`).
- **Local Server**: Start the LM Studio Local Server (usually port `1234`).

### For Cloud OCR (Google Gemini)
- **Google API Key**: Get one from [Google AI Studio](https://aistudio.google.com/).

---

## 📦 Installation & Setup

1. **Clone the repository**:
   ```bash
   git clone <repo-url>
   cd lmstudio_ocr_pwa
   ```

2. **Install dependencies**:
   ```bash
   npm install
   ```

3. **Run locally**:
   ```bash
   npm run dev
   ```
   Open `http://localhost:5173` in your browser.

---

## 📖 Usage Guide

### 1. Connection Setup
Click the **Settings (⚙️)** icon in the toolbar.
- **LM Studio**: Check that Base URL is `http://localhost:1234` (or your custom port) and ensure your model is loaded in LM Studio.
- **Google Gemini**: Select "Google Gemini" and paste your API Key.

### 2. Managing Files
- Click **Open Folder** in the sidebar to select a directory containing your documents.
- The sidebar lists all supported files (`.png`, `.jpg`, `.jpeg`, `.webp`, `.pdf`).
- **Click** a file to view it.
- **Shift+Click** or **Cmd/Ctrl+Click** to select multiple files.

### 3. Running OCR
- Select one or more files in the sidebar.
- Click **Run OCR** in the top toolbar.
- The app will process each file using the selected provider.
- Results are saved to disk automatically.

### 4. Splitting & Converting
- **Split Pages**: If you have Scanned Double-Pages (e.g., a book scan), select them and click "Split Pages". The app will generate `_L.jpg` and `_R.jpg` for left and right pages.
- **PDF to Images**: Convert a PDF into a folder of JPEG images for easier processing.

---

## 🏗 Project Structure

- **`src/App.tsx`**: Main application logic and state management.
- **`src/components/layout/WorkspaceLayout.tsx`**: Core layout with Sidebar, Toolbar, and Content.
- **`src/components/InstructionPage.tsx`**: In-app help guide.
- **`src/lmStudioClient.ts` / `src/geminiClient.ts`**: API clients for the respective providers.
- **`src/storage/ocrFileSystem.ts`**: Handles reading/writing results to the user's local file system.

---

## 📝 License

MIT License. Feel free to fork and modify for your own use.
