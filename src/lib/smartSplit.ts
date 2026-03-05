/**
 * Content-aware page split algorithm inspired by ScanTailor.
 *
 * Instead of splitting at the exact center, this analyses the image to find
 * the gutter (whitespace gap) that most evenly divides content between left
 * and right halves — the same heuristic ScanTailor uses in its whitespace-
 * based fallback (Phase 2).
 *
 * Algorithm:
 *  1. Downsample for speed
 *  2. Binarize (grayscale → black/white)
 *  3. Build a column histogram (dark-pixel count per column)
 *  4. Walk the histogram to find content spans and whitespace gaps
 *  5. Score each gap by how evenly it divides total content (balance ratio)
 *  6. Among near-equal gaps (within 90 % of best ratio), pick the widest
 *  7. Return the centre of that gap, scaled back to original coordinates
 */

interface Span {
    start: number;
    end: number;
    /** Sum of histogram values across this span (only meaningful for content spans). */
    weight: number;
}

interface Gap {
    start: number;
    end: number;
    width: number;
    /** Total content weight to the left of this gap. */
    leftWeight: number;
    /** Total content weight to the right of this gap. */
    rightWeight: number;
    /** min(left, right) / max(left, right). 1.0 = perfectly balanced. */
    balanceRatio: number;
}

/**
 * Find the optimal vertical split x-coordinate for a double-page scan.
 * Returns a pixel x in original-image coordinates.
 */
export function findSplitLine(canvas: HTMLCanvasElement): number {
    const origWidth = canvas.width;
    const origHeight = canvas.height;

    // --- 1. Downsample to ~1000 px wide for performance ---
    const maxAnalysisWidth = 1000;
    const scale = Math.min(1, maxAnalysisWidth / origWidth);
    const aw = Math.round(origWidth * scale);  // analysis width
    const ah = Math.round(origHeight * scale); // analysis height

    const tmp = document.createElement("canvas");
    tmp.width = aw;
    tmp.height = ah;
    const ctx = tmp.getContext("2d")!;
    ctx.drawImage(canvas, 0, 0, aw, ah);

    const { data } = ctx.getImageData(0, 0, aw, ah);

    // --- 2. Build column histogram of dark pixels ---
    const histogram = buildColumnHistogram(data, aw, ah);

    // --- 3. Find content spans and whitespace gaps ---
    // Adaptive thresholds based on image size
    const minContentPx = Math.max(2, Math.floor(ah * 0.005));
    const minWhitespaceW = Math.max(6, Math.floor(aw * 0.005));
    const minContentW = Math.max(3, Math.floor(aw * 0.003));

    const contentSpans = findContentSpans(histogram, aw, minContentPx, minWhitespaceW, minContentW);

    if (contentSpans.length < 2) {
        // No meaningful gap — fall back to centre
        return Math.floor(origWidth / 2);
    }

    // --- 4. Analyse gaps between content spans ---
    const totalWeight = contentSpans.reduce((s, sp) => s + sp.weight, 0);
    const gaps = buildGaps(contentSpans, totalWeight);

    if (gaps.length === 0) {
        return Math.floor(origWidth / 2);
    }

    // --- 5. Pick the most balanced gap ---
    const splitX = pickBestGap(gaps, aw);

    // Scale back to original coordinates
    return Math.round(splitX / scale);
}

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

/** Grayscale-binarize + count dark pixels per column. */
function buildColumnHistogram(
    data: Uint8ClampedArray,
    w: number,
    h: number,
    threshold = 128
): Uint32Array {
    const hist = new Uint32Array(w);
    for (let y = 0; y < h; y++) {
        const rowOff = y * w * 4;
        for (let x = 0; x < w; x++) {
            const i = rowOff + x * 4;
            // Luminance (BT.601)
            const gray = 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2];
            if (gray < threshold) hist[x]++;
        }
    }
    return hist;
}

/**
 * Walk the histogram to extract alternating content / whitespace spans.
 * A column is "content" when its dark-pixel count ≥ minContentPx.
 */
function findContentSpans(
    histogram: Uint32Array,
    width: number,
    minContentPx: number,
    minWhitespaceWidth: number,
    minContentWidth: number
): Span[] {
    // First pass: label each column as content (true) or whitespace (false)
    const isContent = new Uint8Array(width);
    for (let x = 0; x < width; x++) {
        isContent[x] = histogram[x] >= minContentPx ? 1 : 0;
    }

    // Second pass: find raw runs
    const rawSpans: { start: number; end: number; content: boolean }[] = [];
    let runStart = 0;
    let runContent = !!isContent[0];
    for (let x = 1; x <= width; x++) {
        const c = x < width ? !!isContent[x] : !runContent; // force close at end
        if (c !== runContent) {
            rawSpans.push({ start: runStart, end: x, content: runContent });
            runStart = x;
            runContent = c;
        }
    }

    // Third pass: merge short whitespace gaps into adjacent content
    const merged: typeof rawSpans = [];
    for (const span of rawSpans) {
        if (
            !span.content &&
            span.end - span.start < minWhitespaceWidth &&
            merged.length > 0
        ) {
            // Too-narrow whitespace: absorb into previous content span
            const prev = merged[merged.length - 1];
            if (prev.content) {
                prev.end = span.end;
                continue;
            }
        }
        merged.push({ ...span });
    }

    // Also merge consecutive content spans that became adjacent
    const consolidated: typeof rawSpans = [];
    for (const span of merged) {
        const prev = consolidated[consolidated.length - 1];
        if (prev && prev.content && span.content) {
            prev.end = span.end;
        } else {
            consolidated.push(span);
        }
    }

    // Fourth pass: drop tiny content spans and compute weights
    const result: Span[] = [];
    for (const span of consolidated) {
        if (!span.content) continue;
        if (span.end - span.start < minContentWidth) continue;
        let weight = 0;
        for (let x = span.start; x < span.end; x++) weight += histogram[x];
        result.push({ start: span.start, end: span.end, weight });
    }

    return result;
}

/** Build gap descriptors between each pair of adjacent content spans. */
function buildGaps(contentSpans: Span[], totalWeight: number): Gap[] {
    const gaps: Gap[] = [];
    let leftWeight = 0;

    for (let i = 0; i < contentSpans.length - 1; i++) {
        leftWeight += contentSpans[i].weight;
        const rightWeight = totalWeight - leftWeight;

        const gapStart = contentSpans[i].end;
        const gapEnd = contentSpans[i + 1].start;
        const width = gapEnd - gapStart;

        const maxW = Math.max(leftWeight, rightWeight);
        const minW = Math.min(leftWeight, rightWeight);
        const balanceRatio = maxW > 0 ? minW / maxW : 0;

        gaps.push({ start: gapStart, end: gapEnd, width, leftWeight, rightWeight, balanceRatio });
    }

    return gaps;
}

/**
 * Among all gaps, find the one with the best balance ratio.
 * Among gaps within 90 % of the best ratio, pick the widest.
 * Prefer gaps in the central 70 % of the image.
 */
function pickBestGap(gaps: Gap[], imageWidth: number): number {
    // Prefer gaps in the central region
    const marginFrac = 0.15;
    const leftBound = imageWidth * marginFrac;
    const rightBound = imageWidth * (1 - marginFrac);

    // Separate central gaps from edge gaps
    const centralGaps = gaps.filter(
        (g) => (g.start + g.end) / 2 >= leftBound && (g.start + g.end) / 2 <= rightBound
    );
    const candidates = centralGaps.length > 0 ? centralGaps : gaps;

    // Find best balance ratio
    let bestRatio = 0;
    for (const g of candidates) bestRatio = Math.max(bestRatio, g.balanceRatio);

    if (bestRatio < 0.1) {
        // Content is overwhelmingly on one side — just use image centre
        return Math.floor(imageWidth / 2);
    }

    // Among gaps within 90 % of the best ratio, pick the widest
    const threshold = bestRatio * 0.9;
    let best: Gap | null = null;
    for (const g of candidates) {
        if (g.balanceRatio < threshold) continue;
        if (!best || g.width > best.width) best = g;
    }

    return best ? Math.floor((best.start + best.end) / 2) : Math.floor(imageWidth / 2);
}
