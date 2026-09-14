#!/usr/bin/env python3
"""
Scene Asset Extractor
=====================
Reviews an image, identifies the buildings, roads, and discrete objects inside
it, and writes each one out as an individual transparent PNG cutout with a short
description. The goal is a reusable library of building / road / prop assets you
can drop into other scenes and background (parallax) animations later.

LIBRARY WORKFLOW (the default)
------------------------------
Point the tool at an assets folder. It scans the top level images, and for each
one writes a sibling subfolder named after the image, holding that image's
cutouts plus a descriptions file. A log.md at the folder root records what has
already been screened, so rerunning after you drop in more images only processes
the new ones. Your own notes in log.md are preserved.

    assets/
        log.md                         what has been screened, plus your notes
        example-image-1.png            <- your source image
        example-image-2.jpeg
        example-image-1/               <- created by the tool
            example-image-1-road.png
            example-image-1-building-1.png
            example-image-1-building-2.png
            example-image-1-descriptions.md
        example-image-2/
            ...

HOW IT WORKS (why these choices)
--------------------------------
1. Semantic segmentation with a SegFormer model fine tuned on ADE20K. ADE20K is
   used on purpose: its 150 class vocabulary contains "building", "road",
   "skyscraper", "car", "tree", "streetlight" and friends, which the far more
   common COCO detector vocabulary does NOT. That is the whole reason we can
   separate a building from a road at all.
2. Each class mask is split into individual instances with connected components,
   so you get one cutout per physically separate object rather than one blob.
3. Every instance becomes an alpha matted cutout (mask -> alpha, small feather
   for clean edges), trimmed tight with optional padding.
4. Metrics are derived once per asset (size, position, dominant color, aspect)
   and a parallax depth layer is inferred, because "reusable for background
   animation" means each asset needs a scroll depth hint, not just a picture.
5. A local caption model (BLIP), grounded on the detected class, writes a natural
   description per asset. If it cannot load, the tool falls back to a heuristic
   sentence so it never hard fails on the network.

Cutouts default to PNG. JPEG cannot store transparency, so a jpg cutout gets a
baked white background and stops being a clean sprite. Use --format webp for
transparent cutouts at a smaller file size.

Nothing here uses dashes as separators in generated prose, matching the repo
owner's writing preference.
"""

from __future__ import annotations

import argparse
import base64
import hashlib
import io
import re
import sys
import warnings
from datetime import datetime, timezone
from pathlib import Path
from typing import Optional

import numpy as np
from PIL import Image

warnings.filterwarnings("ignore")

IMG_EXTS = {".jpg", ".jpeg", ".png", ".webp", ".bmp"}

# ---------------------------------------------------------------------------
# Class buckets. ADE20K gives 150 labels; we fold them into four buckets.
# Precedence when a label could fit two: building, then road, then backdrop,
# else it is treated as a discrete object. Edit these sets to retune what the
# tool considers a "road" vs a "prop"; they are the single source of truth.
# ---------------------------------------------------------------------------
BUILDING_LABELS = {"building", "house", "skyscraper", "hovel", "tower", "booth"}
ROAD_LABELS = {"road", "sidewalk", "path", "runway", "dirt track", "bridge",
               "stairs", "stairway", "escalator"}
# Backdrops are broad "stuff" surfaces. Skipped unless --all is passed, because
# a sky or a wall is a fill, not a reusable cut out prop.
BACKDROP_LABELS = {"wall", "sky", "floor", "ceiling", "grass", "earth", "water",
                   "sea", "river", "lake", "mountain", "hill", "field", "sand",
                   "land", "rock", "snow", "rug", "dirt", "ground"}

BUCKET_ORDER = {"building": 0, "road": 1, "object": 2}
BUCKET_COLORS = {  # RGB used only for the QA overlay
    "building": (233, 84, 84),
    "road": (84, 132, 233),
    "object": (95, 205, 128),
    "backdrop": (140, 140, 140),
}

BASIC_COLORS = {
    "black": (18, 18, 20), "white": (245, 245, 245), "gray": (128, 128, 128),
    "red": (200, 40, 40), "orange": (232, 140, 45), "yellow": (233, 213, 60),
    "green": (60, 160, 70), "teal": (45, 200, 190), "blue": (60, 110, 205),
    "navy": (30, 40, 92), "purple": (132, 70, 172), "pink": (232, 150, 182),
    "brown": (120, 80, 50), "beige": (212, 192, 150), "tan": (182, 150, 110),
    "cream": (240, 230, 205),
}


# ---------------------------------------------------------------------------
# Small helpers
# ---------------------------------------------------------------------------
def log(msg: str) -> None:
    print(msg, flush=True)


def slugify(s: str) -> str:
    return re.sub(r"[^a-z0-9]+", "-", s.lower()).strip("-") or "img"


def file_hash(path: Path) -> str:
    """Short content hash so a replaced image with the same name is reprocessed."""
    h = hashlib.sha1()
    h.update(Path(path).read_bytes())
    return h.hexdigest()[:12]


def bucket_for(label: str) -> str:
    lab = label.strip().lower()
    if lab in BUILDING_LABELS:
        return "building"
    if lab in ROAD_LABELS:
        return "road"
    if lab in BACKDROP_LABELS:
        return "backdrop"
    for kw in BUILDING_LABELS:
        if kw in lab:
            return "building"
    for kw in ROAD_LABELS:
        if kw in lab:
            return "road"
    for kw in BACKDROP_LABELS:
        if kw in lab:
            return "backdrop"
    return "object"


def nearest_color_name(rgb) -> str:
    r, g, b = rgb
    best, bestd = "gray", 1e18
    for name, (cr, cg, cb) in BASIC_COLORS.items():
        d = (r - cr) ** 2 + (g - cg) ** 2 + (b - cb) ** 2
        if d < bestd:
            best, bestd = name, d
    return best


def dominant_color(rgb_img: np.ndarray, mask: np.ndarray):
    """Median color of the masked pixels plus a tiny kmeans palette.
    Median (not mean) so a few bright outliers do not skew the reported hue."""
    import cv2
    pix = rgb_img[mask.astype(bool)]
    if pix.size == 0:
        return "#808080", "gray", ["#808080"]
    med = np.median(pix, axis=0).astype(int)
    hexc = "#{:02x}{:02x}{:02x}".format(*med)
    name = nearest_color_name(tuple(med))
    palette = [hexc]
    if len(pix) >= 24:
        sample = pix.astype(np.float32)
        if len(sample) > 4000:
            idx = np.linspace(0, len(sample) - 1, 4000).astype(int)
            sample = sample[idx]
        k = min(3, len(np.unique(sample.reshape(-1, 3), axis=0)))
        if k >= 1:
            crit = (cv2.TERM_CRITERIA_EPS + cv2.TERM_CRITERIA_MAX_ITER, 10, 1.0)
            _, labels, centers = cv2.kmeans(sample, k, None, crit, 3,
                                            cv2.KMEANS_PP_CENTERS)
            counts = np.bincount(labels.flatten())
            order = np.argsort(-counts)
            palette = ["#{:02x}{:02x}{:02x}".format(*centers[i].astype(int))
                       for i in order]
    return hexc, name, palette


def ahash(rgba: Image.Image) -> str:
    """64 bit average hash, used to drop near duplicate cutouts within one image."""
    g = rgba.convert("L").resize((8, 8), Image.BILINEAR)
    arr = np.asarray(g, dtype=np.float32)
    bits = (arr > arr.mean()).flatten()
    val = 0
    for b in bits:
        val = (val << 1) | int(b)
    return "{:016x}".format(val)


def hamming(a: str, b: str) -> int:
    return bin(int(a, 16) ^ int(b, 16)).count("1")


def depth_hint(bbox, frame_h: int, area_pct: float, bucket: str = "object"):
    """Infer a parallax layer. Assets low in the frame and larger read as nearer;
    high and small reads as far. Nearer layers scroll faster, so parallax rises
    with the near score. Buildings are pushed back a notch: a facade fills the
    lower frame but in a scene it is almost always a far layer."""
    x, y, w, h = bbox
    bottom_norm = (y + h) / max(1, frame_h)
    near = 0.65 * bottom_norm + 0.35 * min(1.0, area_pct * 6.0)
    if bucket == "building":
        near *= 0.6
    if near > 0.66:
        layer = "foreground"
    elif near > 0.40:
        layer = "midground"
    else:
        layer = "background"
    parallax = round(0.15 + 0.85 * max(0.0, min(1.0, near)), 2)
    return layer, parallax


def size_word(area_pct: float) -> str:
    if area_pct > 0.15:
        return "large"
    if area_pct > 0.04:
        return "medium"
    if area_pct > 0.008:
        return "small"
    return "tiny"


def position_words(cx: float, cy: float, W: int, H: int) -> str:
    horiz = "left" if cx < W / 3 else ("right" if cx > 2 * W / 3 else "center")
    vert = "upper" if cy < H / 3 else ("lower" if cy > 2 * H / 3 else "middle")
    return f"{vert} {horiz}"


def aspect_word(ar: float) -> str:
    if ar > 1.6:
        return "wide"
    if ar < 0.62:
        return "tall"
    return "roughly square"


def tileable_x_score(rgba: np.ndarray, mask: np.ndarray, W: int) -> bool:
    """Best effort: would this asset loop horizontally as a background strip?
    True when it spans most of the width and its left and right edge colors match,
    which is what a repeatable road or wall texture looks like."""
    if mask.shape[1] < 0.6 * W:
        return False
    rgb = rgba[:, :, :3].astype(np.float32)
    m = mask.astype(bool)
    cols = np.where(m.any(axis=0))[0]
    if cols.size < 8:
        return False
    span = max(2, cols.size // 20)
    left = rgb[:, cols[:span]][m[:, cols[:span]]]
    right = rgb[:, cols[-span:]][m[:, cols[-span:]]]
    if left.size == 0 or right.size == 0:
        return False
    return float(np.linalg.norm(left.mean(0) - right.mean(0))) < 26.0


# ---------------------------------------------------------------------------
# Models
# ---------------------------------------------------------------------------
def load_segmenter(model_id: str):
    from transformers import AutoImageProcessor, AutoModelForSemanticSegmentation
    log(f"[seg] loading {model_id} (first run downloads weights, then caches)")
    proc = AutoImageProcessor.from_pretrained(model_id)
    model = AutoModelForSemanticSegmentation.from_pretrained(model_id)
    model.eval()
    return proc, model, model.config.id2label


def segment(image: Image.Image, proc, model) -> np.ndarray:
    import torch
    inputs = proc(images=image, return_tensors="pt")
    with torch.no_grad():
        outputs = model(**inputs)
    # target_sizes wants (height, width); PIL size is (width, height).
    seg = proc.post_process_semantic_segmentation(
        outputs, target_sizes=[image.size[::-1]])[0]
    return seg.cpu().numpy().astype(np.int32)


class Captioner:
    """Wraps BLIP. Never raises to the caller: a failed load or a failed caption
    downgrades to None so the pipeline keeps producing cutouts + heuristics."""

    def __init__(self, model_id: str):
        self.ok = False
        try:
            from transformers import AutoProcessor, BlipForConditionalGeneration
            log(f"[cap] loading {model_id}")
            self.proc = AutoProcessor.from_pretrained(model_id)
            self.model = BlipForConditionalGeneration.from_pretrained(model_id)
            self.model.eval()
            self.ok = True
        except Exception as e:
            log(f"[cap] caption model unavailable, using heuristics only: "
                f"{type(e).__name__}")

    def describe(self, rgba: Image.Image, label: Optional[str] = None) -> Optional[str]:
        if not self.ok:
            return None
        try:
            import torch
            bg = Image.new("RGB", rgba.size, (127, 127, 127))
            bg.paste(rgba, mask=rgba.split()[3])
            # Condition on the detected class so the caption stays grounded.
            prompt = f"a {label}" if label else None
            if prompt:
                inputs = self.proc(images=bg, text=prompt, return_tensors="pt")
            else:
                inputs = self.proc(images=bg, return_tensors="pt")
            with torch.no_grad():
                out = self.model.generate(**inputs, max_new_tokens=28)
            txt = self.proc.decode(out[0], skip_special_tokens=True).strip()
            return txt.replace(" - ", ", ").replace("--", ",") or None
        except Exception:
            return None


class _NoCaptioner:
    ok = False

    def describe(self, *a, **k):
        return None


# ---------------------------------------------------------------------------
# Analysis: detect, cut, measure, caption. No file writing here.
# ---------------------------------------------------------------------------
def refine_alpha(mask: np.ndarray, feather: int) -> np.ndarray:
    import cv2
    m = (mask.astype(np.uint8)) * 255
    kernel = cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (5, 5))
    m = cv2.morphologyEx(m, cv2.MORPH_CLOSE, kernel)
    if feather > 0:
        k = feather * 2 + 1
        m = cv2.GaussianBlur(m, (k, k), 0)
    return m


def analyze_image(image: Image.Image, label_map: np.ndarray, id2label, cap, args):
    """Return (instances, overlay_rgb, dupes) for one image.
    Each instance is a dict carrying its RGBA crop plus all metrics, but no final
    filename yet (naming depends on how many of each label the image has)."""
    import cv2
    rgb = np.asarray(image.convert("RGB"))
    H, W = label_map.shape
    frame_area = H * W
    min_area = max(int(args.min_area_pct / 100.0 * frame_area), 64)
    hashes: list[str] = []  # dedupe within this image only
    instances = []
    overlay = rgb.copy()
    dupes = 0

    for cls in np.unique(label_map):
        label = str(id2label.get(int(cls), f"class_{cls}"))
        bucket = bucket_for(label)
        if bucket == "backdrop" and not args.all:
            continue
        if bucket == "backdrop":
            bucket = "object"
        if args.classes and label.lower() not in args.classes:
            continue

        class_mask = (label_map == cls).astype(np.uint8)
        n, comp, stats, cents = cv2.connectedComponentsWithStats(class_mask, 8)
        for i in range(1, n):
            area = int(stats[i, cv2.CC_STAT_AREA])
            if area < min_area:
                continue
            x = int(stats[i, cv2.CC_STAT_LEFT]); y = int(stats[i, cv2.CC_STAT_TOP])
            w = int(stats[i, cv2.CC_STAT_WIDTH]); h = int(stats[i, cv2.CC_STAT_HEIGHT])
            inst = (comp == i).astype(np.uint8)

            alpha_full = refine_alpha(inst, args.feather)
            pad = args.pad
            x0, y0 = max(0, x - pad), max(0, y - pad)
            x1, y1 = min(W, x + w + pad), min(H, y + h + pad)
            crop_a = alpha_full[y0:y1, x0:x1]
            rgba = np.dstack([rgb[y0:y1, x0:x1], crop_a]).astype(np.uint8)
            pil = Image.fromarray(rgba, "RGBA")

            ph = ahash(pil)
            if args.dedupe and any(hamming(ph, prev) <= args.dedupe_dist for prev in hashes):
                dupes += 1
                continue
            hashes.append(ph)

            cx, cy = float(cents[i][0]), float(cents[i][1])
            area_pct = area / frame_area
            ar = w / max(1, h)
            hexc, cname, palette = dominant_color(rgb, inst)
            layer, parallax = depth_hint((x, y, w, h), H, area_pct, bucket)
            tile = tileable_x_score(rgba, crop_a, W) if bucket == "road" else False

            heur = (f"{size_word(area_pct)} {label}, "
                    f"{position_words(cx, cy, W, H)} of the frame, "
                    f"{aspect_word(ar)}, dominant {cname} ({hexc}). "
                    f"Suggested {layer} layer, parallax {parallax}.")
            caption = (cap.describe(pil, label)
                       if area_pct * 100 >= args.caption_min_pct else None)

            instances.append({
                "label": label, "bucket": bucket, "pil": pil,
                "area_px": area, "area_pct": area_pct, "centroid": (cx, cy),
                "centroid_norm": (round(cx / W, 3), round(cy / H, 3)),
                "aspect": ar, "bbox": (x, y, w, h),
                "hex": hexc, "cname": cname, "palette": palette,
                "layer": layer, "parallax": parallax, "tileable": bool(tile),
                "phash": ph, "heuristic": heur, "caption": caption,
            })

            col = BUCKET_COLORS[bucket]
            overlay[inst.astype(bool)] = (
                0.5 * overlay[inst.astype(bool)] + 0.5 * np.array(col)).astype(np.uint8)
            cv2.rectangle(overlay, (x, y), (x + w, y + h), (255, 255, 255), 2)
            cv2.putText(overlay, label, (x + 3, max(14, y + 16)),
                        cv2.FONT_HERSHEY_SIMPLEX, 0.5, (255, 255, 255), 1, cv2.LINE_AA)

    # Buildings first, then roads, then objects; largest first within a label so
    # building-1 is the biggest building, and the descriptions read top down.
    instances.sort(key=lambda d: (BUCKET_ORDER.get(d["bucket"], 3), -d["area_px"]))
    return instances, overlay, dupes


def assign_names(instances):
    """Return [(name_core, instance)] where name_core is the label slug, with a
    numeric suffix only when the image has more than one of that label. Matches
    example-image-1-road (single) vs example-image-1-building-1 / building-2."""
    counts = {}
    for inst in instances:
        s = slugify(inst["label"])
        counts[s] = counts.get(s, 0) + 1
    seen = {}
    named = []
    for inst in instances:
        s = slugify(inst["label"])
        seen[s] = seen.get(s, 0) + 1
        core = s if counts[s] == 1 else f"{s}-{seen[s]}"
        named.append((core, inst))
    return named


# ---------------------------------------------------------------------------
# Writing: per image subfolder, cutouts, descriptions.md, optional overlay
# ---------------------------------------------------------------------------
def resolve_ext(fmt: str, source_path: Path) -> str:
    if fmt == "source":
        e = source_path.suffix.lower().lstrip(".")
        return "jpg" if e == "jpeg" else (e or "png")
    return fmt


def save_cutout(pil: Image.Image, path: Path, ext: str) -> None:
    if ext in ("jpg", "jpeg", "bmp"):
        # No alpha channel available, so composite over white to stay usable.
        bg = Image.new("RGB", pil.size, (255, 255, 255))
        bg.paste(pil, mask=pil.split()[3])
        bg.save(str(path), quality=92)
    elif ext == "webp":
        pil.save(str(path), "WEBP", lossless=True)
    else:
        pil.save(str(path), "PNG")


def thumb_from_pil(pil: Image.Image, box: int = 200) -> str:
    im = pil.copy().convert("RGBA")
    im.thumbnail((box, box), Image.LANCZOS)
    buf = io.BytesIO()
    im.save(buf, "PNG")
    return base64.b64encode(buf.getvalue()).decode()


def write_descriptions(md_path: Path, stem: str, source_name: str, size,
                       named, run_ts: str, model: str, cap_model: Optional[str],
                       ext: str) -> None:
    W, H = size
    b = sum(1 for _, i in named if i["bucket"] == "building")
    r = sum(1 for _, i in named if i["bucket"] == "road")
    o = sum(1 for _, i in named if i["bucket"] == "object")
    cap_line = f"captions: {cap_model}" if cap_model else "captions: heuristic only"
    out = [
        f"# {stem}", "",
        f"Source image: {source_name}  ({W}x{H})",
        f"Screened: {run_ts} UTC",
        f"Model: {model}. {cap_line}.",
        f"{len(named)} assets  ({b} buildings, {r} roads, {o} objects)",
        "", "---", "",
    ]
    if not named:
        out.append("No buildings, roads, or objects were detected in this image.")
    for core, inst in named:
        fname = f"{stem}-{core}.{ext}"
        x, y, w, h = inst["bbox"]
        pos = position_words(inst["centroid"][0], inst["centroid"][1], W, H)
        tile = " Tiles horizontally." if inst["tileable"] else ""
        # Use the caption when we have one; otherwise a short heuristic phrase, so
        # the size / color / layer lines below are not repeated back verbatim.
        if inst["caption"]:
            sentence = inst["caption"]
        else:
            sentence = f"{size_word(inst['area_pct'])} {inst['label']}, {pos}, {aspect_word(inst['aspect'])}"
        out += [
            f"## {fname}",
            f"**{inst['label']}** ({inst['bucket']}). {sentence.rstrip('.')}.",
            f"Size {inst['area_pct'] * 100:.1f}% of frame, {pos}, {aspect_word(inst['aspect'])}. "
            f"Color {inst['cname']} ({inst['hex']}).",
            f"Layer {inst['layer']}, parallax {inst['parallax']}.{tile}",
            f"Box x{x} y{y} w{w} h{h}.",
            "",
        ]
    md_path.write_text("\n".join(out), encoding="utf-8")


def write_library_image(source_path: Path, instances, overlay, out_root: Path,
                        args, run_ts: str, model: str, cap_model: Optional[str],
                        size) -> tuple:
    """Write one image's subfolder: cutouts + descriptions.md + optional overlay.
    Returns (stem, named, cards) for the run log and the optional gallery."""
    stem = slugify(source_path.stem)
    subdir = out_root / stem
    subdir.mkdir(parents=True, exist_ok=True)
    ext = resolve_ext(args.format, source_path)

    # Clear this stem's previous outputs so a reprocess never leaves orphans,
    # while leaving anything else in the folder untouched.
    for old in subdir.glob(f"{stem}-*"):
        if old.is_file():
            old.unlink()

    named = assign_names(instances)
    cards = []
    for core, inst in named:
        fname = f"{stem}-{core}.{ext}"
        save_cutout(inst["pil"], subdir / fname, ext)
        cards.append({
            "thumb": thumb_from_pil(inst["pil"]), "id": f"{stem}-{core}",
            "bucket": inst["bucket"], "caption": inst["caption"],
            "heuristic": inst["heuristic"], "area_pct": inst["area_pct"],
            "layer": inst["layer"], "parallax": inst["parallax"],
            "hex": inst["hex"], "cname": inst["cname"], "tileable": inst["tileable"],
        })

    write_descriptions(subdir / f"{stem}-descriptions.md", stem, source_path.name,
                       size, named, run_ts, model, cap_model, ext)
    if args.overlay and overlay is not None:
        Image.fromarray(overlay).save(str(subdir / f"{stem}-overlay.png"))
    return stem, named, cards


# ---------------------------------------------------------------------------
# log.md: resumable record of screened images, with a preserved notes section
# ---------------------------------------------------------------------------
AUTO_BEGIN = "<!-- BEGIN AUTO LOG :: managed by extract_assets.py, do not edit between these markers -->"
AUTO_END = "<!-- END AUTO LOG -->"
LOG_HEADER = (
    "# Asset extraction log\n\n"
    "This folder is scanned by the scene asset extractor (nexious-scripts). Every\n"
    "image listed below has already been screened; rerunning skips it unless the\n"
    "image content changes. Write your own notes under Notes; the tool never edits\n"
    "that section."
)


def read_log_records(log_path: Path) -> dict:
    recs = {}
    if not log_path.exists():
        return recs
    text = log_path.read_text(encoding="utf-8", errors="ignore")
    if AUTO_BEGIN not in text or AUTO_END not in text:
        return recs
    block = text.split(AUTO_BEGIN, 1)[1].split(AUTO_END, 1)[0]
    for line in block.splitlines():
        line = line.strip()
        if not line.startswith("|"):
            continue
        cells = [c.strip() for c in line.strip("|").split("|")]
        if len(cells) < 7:
            continue
        if cells[0].lower() == "image" or set(cells[0]) <= set("-: "):
            continue
        recs[cells[0]] = {"date": cells[1], "total": cells[2], "b": cells[3],
                          "r": cells[4], "o": cells[5], "hash": cells[6]}
    return recs


def write_log(log_path: Path, records: dict) -> None:
    header = ("| Image | Screened (UTC) | Assets | Buildings | Roads | Objects | Content hash |\n"
              "| ----- | -------------- | ------ | --------- | ----- | ------- | ------------ |")
    rows = [f"| {n} | {r['date']} | {r['total']} | {r['b']} | {r['r']} | {r['o']} | {r['hash']} |"
            for n, r in sorted(records.items())]
    body = "\n".join(rows) if rows else "| (none yet) |  |  |  |  |  |  |"
    block = f"{AUTO_BEGIN}\n\nScreened images:\n\n{header}\n{body}\n\n{AUTO_END}"

    if log_path.exists():
        text = log_path.read_text(encoding="utf-8", errors="ignore")
        if AUTO_BEGIN in text and AUTO_END in text:
            pre = text.split(AUTO_BEGIN, 1)[0]
            post = text.split(AUTO_END, 1)[1]
            new = pre + block + post
        else:  # user made a log without markers; append ours, keep theirs
            new = text.rstrip() + "\n\n" + block + "\n"
    else:
        new = (LOG_HEADER + "\n\n" + block +
               "\n\n## Notes\n\n_Add your notes here. The tool never edits this section._\n")
    log_path.write_text(new, encoding="utf-8")


# ---------------------------------------------------------------------------
# Optional review gallery across everything processed this run
# ---------------------------------------------------------------------------
def render_gallery(cards, out_path: Path, title: str, subtitle: str) -> None:
    by_bucket = {"building": [], "road": [], "object": []}
    for c in cards:
        by_bucket.setdefault(c["bucket"], []).append(c)
    blocks = []
    for bucket in ("building", "road", "object"):
        group = by_bucket.get(bucket, [])
        if not group:
            continue
        blocks.append(f'<h2>{bucket.title()}s <span class="c">{len(group)}</span></h2>')
        blocks.append('<div class="grid">')
        for c in group:
            chips = (f'<span class="chip">{c["area_pct"]*100:.1f}% of frame</span>'
                     f'<span class="chip">{c["layer"]}</span>'
                     f'<span class="chip">parallax {c["parallax"]}</span>'
                     f'<span class="chip"><i style="background:{c["hex"]}"></i>{c["cname"]}</span>')
            if c["tileable"]:
                chips += '<span class="chip tile">tiles horizontally</span>'
            cap = f'<div class="cap">{c["caption"]}</div>' if c["caption"] else ""
            blocks.append(
                f'<figure><div class="thumb"><img src="data:image/png;base64,{c["thumb"]}"></div>'
                f'<figcaption><b>{c["id"]}</b>{cap}'
                f'<div class="heur">{c["heuristic"]}</div>'
                f'<div class="chips">{chips}</div></figcaption></figure>')
        blocks.append('</div>')
    html = f"""<!doctype html><html lang="en"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1"><title>{title}</title>
<style>
:root{{--bg:#0b1120;--card:#131a2b;--line:#24304a;--ink:#e7ecf6;--mut:#93a0bd;--ind:#818cf8;--teal:#2dd4bf}}
*{{box-sizing:border-box}}body{{margin:0;background:var(--bg);color:var(--ink);font:15px/1.5 system-ui,Segoe UI,Roboto,sans-serif}}
header{{padding:26px 30px;border-bottom:1px solid var(--line);background:linear-gradient(180deg,#141d33,#0b1120)}}
header h1{{margin:0 0 4px;font-size:22px}}header p{{margin:0;color:var(--mut)}}
main{{padding:24px 30px;max-width:1200px;margin:0 auto}}
h2{{margin:30px 0 12px;font-size:16px;text-transform:uppercase;letter-spacing:.08em;color:var(--ind)}}
h2 .c{{background:var(--line);color:var(--ink);border-radius:20px;padding:1px 10px;font-size:12px;margin-left:6px}}
.grid{{display:grid;grid-template-columns:repeat(auto-fill,minmax(240px,1fr));gap:16px}}
figure{{margin:0;background:var(--card);border:1px solid var(--line);border-radius:12px;overflow:hidden;display:flex;flex-direction:column}}
.thumb{{height:170px;display:flex;align-items:center;justify-content:center;background-color:#1a2136;
  background-image:linear-gradient(45deg,#182034 25%,transparent 25%),linear-gradient(-45deg,#182034 25%,transparent 25%),linear-gradient(45deg,transparent 75%,#182034 75%),linear-gradient(-45deg,transparent 75%,#182034 75%);
  background-size:18px 18px;background-position:0 0,0 9px,9px -9px,-9px 0}}
.thumb img{{max-width:94%;max-height:94%;filter:drop-shadow(0 4px 10px rgba(0,0,0,.5))}}
figcaption{{padding:12px 13px;border-top:1px solid var(--line)}}
figcaption b{{color:var(--teal);font-family:ui-monospace,monospace;font-size:13px}}
.cap{{margin:5px 0;font-size:13px}}.heur{{color:var(--mut);font-size:12px;margin:4px 0 8px}}
.chips{{display:flex;flex-wrap:wrap;gap:5px}}
.chip{{font-size:11px;background:#0e1626;border:1px solid var(--line);color:var(--mut);border-radius:20px;padding:2px 8px;display:inline-flex;align-items:center;gap:5px}}
.chip i{{width:10px;height:10px;border-radius:50%;display:inline-block;border:1px solid rgba(255,255,255,.25)}}
.chip.tile{{color:#0b1120;background:var(--teal);border-color:var(--teal);font-weight:600}}
</style></head><body>
<header><h1>{title}</h1><p>{subtitle}</p></header>
<main>{''.join(blocks)}</main></body></html>"""
    out_path.write_text(html, encoding="utf-8")


# ---------------------------------------------------------------------------
# CLI
# ---------------------------------------------------------------------------
def top_level_images(d: Path):
    return [f for f in sorted(Path(d).iterdir())
            if f.is_file() and f.suffix.lower() in IMG_EXTS]


def resolve_sources(inputs, out_arg):
    """Work out which images to process and where outputs go. The common case is
    a single assets folder: scan its top level images (never its subfolders, so
    previously written cutouts are not re-ingested) and write results in place."""
    raw = [Path(p) for p in inputs]
    dirs = [p for p in raw if p.is_dir()]
    imgs = [p for p in raw if p.is_file() and p.suffix.lower() in IMG_EXTS]
    if len(dirs) == 1 and not imgs:
        root = dirs[0]
        out_root = Path(out_arg) if out_arg else root
        sources = top_level_images(root)
    else:
        out_root = Path(out_arg) if out_arg else (
            dirs[0] if dirs else (imgs[0].parent if imgs else Path(".")))
        sources = []
        for d in dirs:
            sources += top_level_images(d)
        sources += imgs
    seen, uniq = set(), []
    for s in sources:
        rp = str(s.resolve())
        if rp not in seen:
            seen.add(rp); uniq.append(s)
    return uniq, out_root


def main():
    ap = argparse.ArgumentParser(
        description="Scan an assets folder and extract buildings, roads, and "
                    "objects from each image into its own subfolder, with a "
                    "descriptions file and a resumable log.md.")
    ap.add_argument("inputs", nargs="+", help="an assets folder, or image file(s)")
    ap.add_argument("--out", default=None,
                    help="output root; defaults to the input folder so results "
                         "sit beside the source images")
    ap.add_argument("--model", default="nvidia/segformer-b2-finetuned-ade-512-512",
                    help="HF semantic segmentation model fine tuned on ADE20K")
    ap.add_argument("--caption-model", default="Salesforce/blip-image-captioning-base")
    ap.add_argument("--no-captions", action="store_true",
                    help="skip the caption model, heuristics only")
    ap.add_argument("--caption-min-pct", type=float, default=2.0,
                    help="skip AI captions for assets smaller than this percent of the frame")
    ap.add_argument("--min-area-pct", type=float, default=0.4,
                    help="ignore instances smaller than this percent of the frame")
    ap.add_argument("--pad", type=int, default=8, help="transparent padding px")
    ap.add_argument("--feather", type=int, default=1, help="alpha edge feather px")
    ap.add_argument("--classes", default="",
                    help="comma list to restrict labels, e.g. 'building,road,car'")
    ap.add_argument("--all", action="store_true",
                    help="also extract backdrop surfaces (sky, walls, grass)")
    ap.add_argument("--format", choices=["png", "webp", "jpg", "source"], default="png",
                    help="cutout format. png and webp keep transparency; jpg (and "
                         "'source' when the source is a jpeg) bakes a white background")
    ap.add_argument("--rescan", action="store_true",
                    help="reprocess images even if the log says they were screened")
    ap.add_argument("--gallery", action="store_true",
                    help="also write gallery.html at the output root")
    ap.add_argument("--overlay", action="store_true",
                    help="write a QA overlay next to each image's cutouts")
    ap.add_argument("--no-dedupe", dest="dedupe", action="store_false")
    ap.add_argument("--dedupe-dist", type=int, default=6)
    ap.set_defaults(dedupe=True)
    args = ap.parse_args()
    args.classes = {c.strip().lower() for c in args.classes.split(",") if c.strip()}

    sources, out_root = resolve_sources(args.inputs, args.out)
    if not sources:
        log("No images found in the given inputs.")
        sys.exit(2)
    out_root.mkdir(parents=True, exist_ok=True)
    run_ts = datetime.now(timezone.utc).strftime("%Y-%m-%d %H:%M")

    proc, model, id2label = load_segmenter(args.model)
    cap = _NoCaptioner() if args.no_captions else Captioner(args.caption_model)
    cap_model = args.caption_model if getattr(cap, "ok", False) else None

    log_path = out_root / "log.md"
    records = read_log_records(log_path)

    processed = skipped = total_assets = 0
    gallery_cards = []
    for src in sources:
        h = file_hash(src)
        rec = records.get(src.name)
        if rec and rec.get("hash") == h and not args.rescan:
            log(f"[skip] {src.name} already screened")
            skipped += 1
            continue
        log(f"[img] {src.name}")
        image = Image.open(src).convert("RGB")
        W, H = image.size
        label_map = segment(image, proc, model)
        instances, overlay, dupes = analyze_image(image, label_map, id2label, cap, args)
        stem, named, cards = write_library_image(
            src, instances, overlay, out_root, args, run_ts, args.model, cap_model, (W, H))
        b = sum(1 for _, i in named if i["bucket"] == "building")
        r = sum(1 for _, i in named if i["bucket"] == "road")
        o = sum(1 for _, i in named if i["bucket"] == "object")
        records[src.name] = {"date": run_ts, "total": str(len(named)),
                             "b": str(b), "r": str(r), "o": str(o), "hash": h}
        total_assets += len(named)
        processed += 1
        gallery_cards += cards
        log(f"      {len(named)} assets -> {out_root}/{stem}/  ({dupes} duplicates skipped)")

    write_log(log_path, records)
    if args.gallery and gallery_cards:
        render_gallery(gallery_cards, out_root / "gallery.html",
                       "Scene Asset Library",
                       f"{total_assets} assets across {processed} images. Model {args.model}.")
    log(f"[done] processed {processed}, skipped {skipped}, {total_assets} new assets. "
        f"Log at {log_path}")


if __name__ == "__main__":
    main()
