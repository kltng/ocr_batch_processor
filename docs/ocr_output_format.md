# OCR Output Format (for downstream cleaning)

This document specifies the `.ocr.json` sidecar files produced by the OCR Batch
Processor, so a cleaning / post-processing step can parse them reliably. It is
the contract between this app and any downstream tool.

- **One file per source page.** Saved in the `ocr_outputs/` subdirectory next to
  the source images, named `<source-basename>.ocr.json` (the source extension is
  stripped, e.g. `book-007.png` → `book-007.ocr.json`).
- **Encoding:** UTF-8 JSON. Text is verbatim from the page (no translation).

---

## 1. Top-level schema

Every file is a single JSON object with these keys:

| Key                   | Type            | Meaning |
|-----------------------|-----------------|---------|
| `key`                 | string          | Internal id. Ignore for cleaning. |
| `imageName`           | string          | Source file name (with extension). |
| `model`               | string          | Model(s) used. **Also encodes which pipeline ran** — see §2. |
| `createdAt`           | number          | Unix epoch milliseconds. |
| `html`                | string          | Raw HTML from OCR pipeline. Empty `""` for structured-extraction pages. |
| `markdownWithHeaders` | string          | Markdown incl. running headers/footers. |
| `markdownNoHeaders`   | string          | Markdown with page headers/footers stripped. |
| `annotatedImageDataUrl` | string (opt.) | PNG data URL with bbox overlay. Often absent. |
| `extraction`          | string (opt.)   | Structured-extraction output. See §3. May be absent. |

All string fields may be empty (`""`); optional fields may be absent entirely.
A cleaner should treat missing and empty as equivalent.

---

## 2. Three page types — detect by content, not by trusting one field

A page was produced by one of three pipelines. **Determine the type with this
exact algorithm** (do not rely on `model` string matching alone; use the
structure):

```
extraction = obj.get("extraction")              # may be None/absent
if extraction is not None and extraction != "":
    try:
        parsed = json.loads(extraction)
        if isinstance(parsed, (dict, list)):
            page_type = "STRUCTURED"             # use `parsed` (see §3)
    except ValueError:
        page_type = "EXTRACTION_FALLBACK_LEGACY" # see §2.2
else:
    page_type = "OCR"                            # use markdown/html (see §2.3)
```

### 2.1 `STRUCTURED` — template extraction succeeded
- `extraction` is a string that **parses as JSON**.
- `html`, `markdownWithHeaders`, `markdownNoHeaders` are empty `""`.
- `model` is the extraction model (e.g. `nuextract3-mlxs`).
- **Cleaner: parse `extraction` as JSON and use its fields (§3).**

### 2.2 `EXTRACTION_FALLBACK_LEGACY` — extraction failed, old behavior
- `extraction` is a string that **does NOT parse as JSON** (raw OCR text/markdown,
  often starting with `<figure ...>` or a markdown heading `#`).
- Produced **before** the two-pass hybrid fix. The page hit a chapter-opening
  layout (decorative icon / large title) that makes the extraction model drop
  template mode and emit plain OCR into the `extraction` field.
- **Cleaner: treat `extraction` as plain OCR markdown, NOT as JSON.** Do not try
  to force-parse it. These files are re-generated as type `OCR` (§2.3) if the
  book is re-run with a current build.

### 2.3 `OCR` — transcription pipeline (incl. the new fallback pass)
- No `extraction` field (or empty), content is in `markdownNoHeaders` /
  `markdownWithHeaders` / `html`.
- This covers both normal OCR profiles **and** the hybrid fallback: when template
  extraction fails on a page, the app now re-OCRs it with a markdown model and
  stores the result here. Such pages have `model` like
  `"nuextract3-mlxs → numarkdown-8b-thinking-mlxs (fallback)"` (note the `→` and
  the `(fallback)` suffix).
- **Cleaner: prefer `markdownNoHeaders`; fall back to `markdownWithHeaders`, then
  strip tags from `html`.**

> **Identifying fallback pages explicitly:** `"(fallback)" in obj["model"]` is
> true only for hybrid-fallback OCR pages. Useful if you want to flag pages whose
> structured fields are unavailable because the model couldn't extract them.

---

## 3. Structured `extraction` payload

When `page_type == STRUCTURED`, `json.loads(extraction)` yields an object whose
shape is defined by the template that was used. The template is user-editable, so
**a cleaner must not assume a fixed set of keys** — read whatever is present.
Two built-in templates are common:

### 3.1 Modern book + footnotes template
```json
{
  "header": "第二章 孔庙",
  "page_number": "57",
  "main_text": "……正文…… ①",
  "footnotes": [
    { "marker": "①", "text": "(清) 孔毓圻……第 192 页。" },
    { "marker": "②", "text": "同上书，第 186—187 页。" }
  ]
}
```
- `header` — running header / chapter title at top of page.
- `page_number` — printed page number (string; may be zero-padded like `"029"`).
- `main_text` — body text, in reading order. Footnote reference markers
  (`①②③`…) are kept inline where they appear.
- `footnotes` — array; each `{marker, text}`. Empty array `[]` when the page has
  no footnotes (this is normal and NOT a failure). `text` may span what were
  several printed lines, joined.

### 3.2 Generic template
```json
{
  "title": "...",
  "page_numbers": ["..."],
  "figures": [{ "caption": "..." }],
  "main_text": "..."
}
```

### 3.3 Field-handling rules for cleaners
- Any field may be `""` or `[]` — treat as "absent on this page", not an error.
- Markers in `footnotes[].marker` may be circled digits (`①`), plain digits
  (`1`), or symbols. Match leniently.
- `page_number` is a **string**; do not assume it is numeric or unpadded.
- Do not assume key presence — iterate `parsed.items()` / read defensively.

---

## 4. Minimal reference parser (Python)

```python
import json
from pathlib import Path

def load_ocr_page(path):
    obj = json.loads(Path(path).read_text(encoding="utf-8"))
    ext = obj.get("extraction") or ""
    is_fallback = "(fallback)" in (obj.get("model") or "")

    if ext:
        try:
            parsed = json.loads(ext)
            if isinstance(parsed, (dict, list)):
                return {"type": "STRUCTURED", "data": parsed, "meta": obj}
        except ValueError:
            # extraction present but not JSON -> legacy fallback raw OCR
            return {"type": "OCR", "text": ext, "legacy_fallback": True, "meta": obj}

    text = obj.get("markdownNoHeaders") or obj.get("markdownWithHeaders") or obj.get("html") or ""
    return {"type": "OCR", "text": text, "legacy_fallback": False,
            "hybrid_fallback": is_fallback, "meta": obj}
```

This returns `STRUCTURED` (use `data` dict) or `OCR` (use `text` markdown) for
every file, with flags marking the two kinds of fallback.

---

## 5. Notes / known issues a cleaner should expect

- **Empty footnotes are normal**, not an error — many body pages have none.
- **Legacy fallback files** (§2.2) exist in books OCR'd before the hybrid fix.
  Their `extraction` is raw OCR (often opens with `<figure>`); never JSON-parse
  it. Re-running the book with a current build converts them to clean `OCR`
  pages (§2.3).
- **Page ordering** comes from the source filename's zero-padded index
  (`...-0001`, `...-0002`); sort by filename, not by `createdAt`.
- The extraction model copies text **verbatim**, so OCR errors (wrong/rare
  characters) are expected and are the cleaner's job to fix.
