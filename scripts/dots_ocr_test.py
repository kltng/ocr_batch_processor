# /// script
# requires-python = "==3.12.*"
# dependencies = [
#   "torch",
#   "torchvision",
#   "transformers==4.53.3",
#   "accelerate",
#   "pillow",
#   "qwen-vl-utils",
#   "einops",
#   "huggingface-hub",
# ]
# ///
"""
Run rednote-hilab/dots.mocr locally via HF Transformers on Apple Silicon (MPS).

This is the path that actually works on a Mac (vLLM is CUDA-only; the LM Studio
MLX/GGUF builds have a broken/unsupported vision tower). Downloads ~6GB on first
run. CONFIRMED WORKING 2026-05-29 on M1 Max (modern Chinese book page).

Five Mac-specific hurdles, all handled below:
  1. flash_attn is hard-imported but CUDA-only -> inject a stub module...
  2. ...the stub needs a real __spec__ or transformers' find_spec check fails.
  3. dots' vision tower CALLS flash_attn_varlen_func directly -> the stub
     provides a pure-torch SDPA implementation (works on MPS).
  4. The repo dir name "dots.mocr" has a period, breaking relative imports
     (`from .modeling_dots_vision ...`) -> snapshot into a period-free dir.
  5. Load in bfloat16 (vision patch-embed is bf16; fp16 -> dtype mismatch),
     and use transformers>=4.53 with dots' NATIVE processor (older versions
     hit a chat_template arg collision; the stock Qwen processor emits the
     wrong number of image-pad tokens -> vision/text token-count assert).

Generation on MPS is SLOW (eager attention + per-segment vision attention):
expect minutes per page. Downscale aggressively and cap --max-tokens.

Usage:
    uv run scripts/dots_ocr_test.py <image_path> [--ocr] [--max-tokens=N]

    (default = full layout JSON; --ocr = plain text extraction)
"""
import sys
import types

# dots.ocr's modeling file hard-imports flash_attn, which is CUDA-only and cannot
# build on Apple Silicon. We use eager attention (no flash_attn calls), so satisfy
# transformers' import check with a stub module before anything imports the model.
if "flash_attn" not in sys.modules:
    import importlib.machinery

    def _make_stub(name):
        m = types.ModuleType(name)
        # transformers checks importlib.util.find_spec(); a real spec is required
        # or it raises "flash_attn.__spec__ is None".
        m.__spec__ = importlib.machinery.ModuleSpec(name, loader=None)
        m.__version__ = "2.0.0"
        return m

    # Real pure-torch implementation injected below (after it's defined) so the
    # vision tower's flash_attn_varlen_func call works on MPS.
    _stub = _make_stub("flash_attn")
    _fa_func = _make_stub("flash_attn.flash_attn_interface")
    _bert = _make_stub("flash_attn.bert_padding")
    _bert.index_first_axis = None
    _bert.pad_input = None
    _bert.unpad_input = None
    sys.modules["flash_attn"] = _stub
    sys.modules["flash_attn.flash_attn_interface"] = _fa_func
    sys.modules["flash_attn.bert_padding"] = _bert

import os
import torch
import torch.nn.functional as F
from PIL import Image
from huggingface_hub import snapshot_download
from transformers import AutoModelForCausalLM, AutoProcessor, Qwen2_5_VLProcessor


def _flash_attn_varlen_func(q, k, v, cu_seqlens_q, cu_seqlens_k,
                            max_seqlen_q=None, max_seqlen_k=None,
                            dropout_p=0.0, softmax_scale=None, causal=False, **kwargs):
    """Pure-PyTorch stand-in for flash_attn_varlen_func (CUDA-only) so dots.ocr's
    vision tower runs on MPS/CPU. q,k,v: [total_tokens, heads, head_dim], packed
    by cu_seqlens. Runs scaled-dot-product attention per variable-length segment."""
    cu = cu_seqlens_q.tolist()
    outputs = []
    for i in range(len(cu) - 1):
        s, e = cu[i], cu[i + 1]
        # [seg, heads, dim] -> [1, heads, seg, dim] for SDPA
        qi = q[s:e].transpose(0, 1).unsqueeze(0)
        ki = k[s:e].transpose(0, 1).unsqueeze(0)
        vi = v[s:e].transpose(0, 1).unsqueeze(0)
        oi = F.scaled_dot_product_attention(qi, ki, vi, is_causal=causal, scale=softmax_scale)
        outputs.append(oi.squeeze(0).transpose(0, 1))  # back to [seg, heads, dim]
    return torch.cat(outputs, dim=0)


# Bind the real implementation into the flash_attn stubs so the model's
# `from flash_attn import flash_attn_varlen_func` resolves to it.
for _m in ("flash_attn", "flash_attn.flash_attn_interface"):
    mod = sys.modules.get(_m)
    if mod is not None:
        mod.flash_attn_varlen_func = _flash_attn_varlen_func
        mod.flash_attn_func = _flash_attn_varlen_func

HF_REPO = "rednote-hilab/dots.mocr"
# The model's own code does `from .modeling_dots_vision import ...`, which fails
# if the local dir name contains a period ("dots.mocr" parses as a package path).
# The model card explicitly says: use a directory name WITHOUT periods. So we
# snapshot the repo into a period-free local folder and load from there.
LOCAL_DIR = os.path.expanduser("~/.cache/dots_mocr_local")

# Official dots.ocr prompts (from the model card).
PROMPT_LAYOUT = """Please output the layout information from the image, including each layout element's bbox, its category, and the corresponding text content within the bbox.

1. Bbox format: [x1, y1, x2, y2]

2. Layout Categories: The possible categories are ['Caption', 'Footnote', 'Formula', 'List-item', 'Page-footer', 'Page-header', 'Picture', 'Section-header', 'Table', 'Text', 'Title'].

3. Text Extraction & Formatting Rules:
    - Picture: For the 'Picture' category, the text field should be omitted.
    - Formula: Format its text as LaTeX.
    - Table: Format its text as HTML.
    - All Others (Text, Title, etc.): Format their text as Markdown.

4. Constraints:
    - The output text must be the original text from the image, with no translation.
    - All layout elements must be sorted according to human reading order.

5. Final Output: The entire output must be a single JSON object."""

PROMPT_OCR = "Extract the text content from this image."


def main():
    if len(sys.argv) < 2:
        print("usage: uv run scripts/dots_ocr_test.py <image> [--ocr]")
        sys.exit(1)
    image_path = sys.argv[1]
    prompt = PROMPT_OCR if "--ocr" in sys.argv else PROMPT_LAYOUT

    device = "mps" if torch.backends.mps.is_available() else "cpu"
    print(f"[dots] device={device}  fetching {HF_REPO} into {LOCAL_DIR} (first run downloads ~6GB)…", flush=True)
    snapshot_download(repo_id=HF_REPO, local_dir=LOCAL_DIR)
    print("[dots] loading model from local dir…", flush=True)

    # eager attention: flash-attention-2 is CUDA-only.
    # bfloat16: the model's vision patch-embed is saved in bf16; loading as fp16
    # causes "Input type (BFloat16) and bias type (Half)" in the patch conv. MPS
    # supports bf16, so keep the whole model bf16 for dtype consistency.
    model = AutoModelForCausalLM.from_pretrained(
        LOCAL_DIR,
        attn_implementation="eager",
        torch_dtype=torch.bfloat16,
        trust_remote_code=True,
    ).to(device)
    # Use dots' native processor — it inserts the correct number of image-pad
    # tokens to match the vision tower's output. (The stock Qwen processor only
    # emits one placeholder, causing a vision/text token-count mismatch.)
    processor = AutoProcessor.from_pretrained(LOCAL_DIR, trust_remote_code=True)
    print("[dots] model loaded.", flush=True)

    image = Image.open(image_path).convert("RGB")
    messages = [{
        "role": "user",
        "content": [
            {"type": "image", "image": image},
            {"type": "text", "text": prompt},
        ],
    }]

    text = processor.apply_chat_template(messages, tokenize=False, add_generation_prompt=True)
    inputs = processor(text=[text], images=[image], padding=True, return_tensors="pt").to(device)

    max_new = 512
    for a in sys.argv:
        if a.startswith("--max-tokens="):
            max_new = int(a.split("=", 1)[1])
    print(f"[dots] generating (max_new_tokens={max_new})…", flush=True)
    with torch.no_grad():
        out = model.generate(**inputs, max_new_tokens=max_new, do_sample=False)
    trimmed = out[:, inputs.input_ids.shape[1]:]
    result = processor.batch_decode(trimmed, skip_special_tokens=True)[0]

    print("\n===== DOTS.MOCR OUTPUT =====")
    print(result)
    print("===== END =====")


if __name__ == "__main__":
    main()
