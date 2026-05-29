// Remove scanner-background black borders from a scanned page.
//
// Approach: flood-fill inward from every image edge, turning edge-connected
// dark pixels white. Scanner background is always connected to the border;
// interior text is always surrounded by white, so it is never touched. Uses
// 8-way connectivity so a single-pixel diagonal seam (common JPEG artifact
// between the page and the black margin) does not block the fill.

export type DeborderOptions = {
  // Pixels with luminance below this (0-255) count as "dark". Higher = more
  // aggressive. ~110-140 suits high-contrast B&W book scans.
  threshold?: number;
};

const DEFAULT_THRESHOLD = 120;

function loadImage(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("Failed to load image for deborder"));
    img.src = url;
  });
}

/**
 * Returns a JPEG data URL of the image with edge-connected black removed.
 * On any failure, returns the original data URL unchanged (deborder is a
 * best-effort cleanup and must never block OCR).
 */
export async function deborderDataUrl(
  imageDataUrl: string,
  options: DeborderOptions = {}
): Promise<string> {
  const threshold = options.threshold ?? DEFAULT_THRESHOLD;

  try {
    const img = await loadImage(imageDataUrl);
    const w = img.naturalWidth;
    const h = img.naturalHeight;
    if (!w || !h) return imageDataUrl;

    const canvas = document.createElement("canvas");
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext("2d", { willReadFrequently: true });
    if (!ctx) return imageDataUrl;

    ctx.drawImage(img, 0, 0);
    const imageData = ctx.getImageData(0, 0, w, h);
    const data = imageData.data; // RGBA

    // Precompute a dark mask using luminance (Rec. 601).
    const n = w * h;
    const dark = new Uint8Array(n);
    for (let i = 0; i < n; i++) {
      const o = i << 2;
      const lum = (data[o] * 299 + data[o + 1] * 587 + data[o + 2] * 114) / 1000;
      if (lum < threshold) dark[i] = 1;
    }

    // BFS from all border pixels over the dark mask (8-connected).
    const visited = new Uint8Array(n);
    // Ring buffer queue of pixel indices — avoids array push/shift overhead.
    const queue = new Int32Array(n);
    let head = 0;
    let tail = 0;

    const push = (idx: number) => {
      if (!visited[idx] && dark[idx]) {
        visited[idx] = 1;
        queue[tail++] = idx;
      }
    };

    for (let x = 0; x < w; x++) {
      push(x); // top row
      push((h - 1) * w + x); // bottom row
    }
    for (let y = 0; y < h; y++) {
      push(y * w); // left column
      push(y * w + (w - 1)); // right column
    }

    while (head < tail) {
      const idx = queue[head++];
      const x = idx % w;
      const y = (idx - x) / w;
      for (let dy = -1; dy <= 1; dy++) {
        const ny = y + dy;
        if (ny < 0 || ny >= h) continue;
        for (let dx = -1; dx <= 1; dx++) {
          if (dx === 0 && dy === 0) continue;
          const nx = x + dx;
          if (nx < 0 || nx >= w) continue;
          push(ny * w + nx);
        }
      }
    }

    // Paint visited (edge-connected dark) pixels white.
    for (let i = 0; i < n; i++) {
      if (visited[i]) {
        const o = i << 2;
        data[o] = 255;
        data[o + 1] = 255;
        data[o + 2] = 255;
        data[o + 3] = 255;
      }
    }

    ctx.putImageData(imageData, 0, 0);
    return canvas.toDataURL("image/jpeg", 0.92);
  } catch {
    return imageDataUrl;
  }
}
