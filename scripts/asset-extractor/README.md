# Scene Asset Extractor

Point it at a folder of images. For each image it identifies the buildings,
roads, and objects, writes each one as its own transparent PNG cutout into a
subfolder named after that image, describes every asset, and keeps a resumable
`log.md` so rerunning after you add more images only screens the new ones. The
goal is a reusable library of building, road, and prop assets you can drop into
other scenes and background (parallax) animations later.

> Lives in `nexious-scripts/scripts/asset-extractor/`. Python does the vision
> work; a small Node wrapper keeps the `npm run` ergonomics of the rest of the repo.

---

## Folder layout it produces

Run it on an `assets/` folder that holds your source images:

```
assets/
    log.md                          what has been screened, plus your own notes
    plaza.png                       <- your source image
    townhouse.jpeg
    plaza/                          <- created by the tool
        plaza-building.png
        plaza-car.png
        plaza-road.png
        plaza-sidewalk-1.png
        plaza-sidewalk-2.png
        plaza-descriptions.md
    townhouse/
        townhouse-building.png
        townhouse-road.png
        townhouse-tree.png
        townhouse-descriptions.md
```

A label with a single instance is unnumbered (`plaza-road.png`); when an image
has more than one, they are numbered largest first (`plaza-sidewalk-1.png`,
`plaza-sidewalk-2.png`). Only the top level images of the folder are scanned, so
the subfolders it creates are never re-ingested on the next run.

---

## Install

Python 3.9 or newer. From this folder:

```bash
# CPU only machine: install torch + torchvision from the SAME channel first
pip install torch torchvision --index-url https://download.pytorch.org/whl/cpu
pip install -r requirements.txt
```

First run downloads the segmentation model (about 100 MB) and, unless you pass
`--no-captions`, the caption model (about 1 GB). Both cache after that.

---

## Usage

```bash
# scan a folder in place (the common case)
npm run extract:assets -- ./assets
python3 extract_assets.py ./assets

# run it again later after adding images: only the new ones are processed
python3 extract_assets.py ./assets

# force a full rescan (for example after changing settings)
python3 extract_assets.py ./assets --rescan

# smaller transparent cutouts (helps the folder stay lean)
python3 extract_assets.py ./assets --format webp

# also drop a browsable gallery.html and a QA overlay per image
python3 extract_assets.py ./assets --gallery --overlay
```

### Why the cutouts are PNG, not JPEG

A cutout has a transparent background; that transparency is what makes it a
reusable sprite. JPEG cannot store transparency, so a `.jpg` cutout comes out
with a baked white background. The tool therefore defaults to PNG regardless of
the source image type. `--format webp` gives you transparency at a smaller file
size. `--format jpg` and `--format source` (when the source is a jpeg) exist if
you truly want a flat background, but you lose the reusable cutout.

### Flags

| Flag                 | Default                                    | What it does                                                     |
| -------------------- | ------------------------------------------ | ---------------------------------------------------------------- |
| `--out`              | the input folder                           | write results somewhere other than beside the source images      |
| `--format`           | `png`                                      | `png`, `webp` (both transparent), `jpg`, or `source`             |
| `--rescan`           | off                                        | reprocess images even if the log says they were screened         |
| `--gallery`          | off                                        | also write `gallery.html` at the output root                     |
| `--overlay`          | off                                        | write a QA overlay next to each image's cutouts                  |
| `--no-captions`      | off                                        | skip the caption model, heuristics only                          |
| `--caption-min-pct`  | `2.0`                                      | assets below this percent of the frame skip the AI caption       |
| `--min-area-pct`     | `0.4`                                      | ignore instances smaller than this percent of the frame          |
| `--pad`              | `8`                                        | transparent padding in pixels around each cutout                 |
| `--feather`          | `1`                                        | soften the alpha edge by this many pixels                        |
| `--classes`          | all                                        | comma list to restrict labels, e.g. `building,road,car`          |
| `--all`              | off                                        | also extract backdrop surfaces (sky, walls, grass, water)        |
| `--model`            | `nvidia/segformer-b2-finetuned-ade-512-512`| any ADE20K semantic segmentation model on Hugging Face           |
| `--no-dedupe`        | dedupe on                                  | keep near duplicate cutouts within an image                      |

---

## What is in each file

`<image>-descriptions.md` lists every asset from that image: its filename, its
class and bucket, a grounded natural language description (or a heuristic when
the asset is too small to caption reliably), its size, screen position, dominant
color, and its suggested parallax layer and scroll factor.

`log.md` has a machine managed table of screened images (name, date, asset
counts, and a content hash so a replaced image is reprocessed) fenced between
markers, and a `## Notes` section below it that the tool never touches. Put
whatever you want there; it survives every run.

---

## How it works, and why

Segmentation runs a SegFormer model fine tuned on ADE20K, chosen because that
vocabulary contains `building`, `road`, `car`, `tree`, `streetlight` and friends
that the usual COCO detector does not. Each class mask is split into separate
instances by connected component, so you get one cutout per physically separate
object. The instance mask becomes the alpha channel, closed to avoid pinholes
and feathered for clean edges. Size, position, aspect, and a dominant color plus
palette are measured from the masked pixels. Each asset gets a suggested parallax
layer (background, midground, foreground) and a factor from 0.15 to 1.0, inferred
from how low and how large it is, with buildings nudged back because a facade is
almost always a far layer. Descriptions come from BLIP conditioned on the detected
class so they stay grounded; if the caption model cannot load, a heuristic
sentence is used instead. A perceptual hash drops near duplicate cutouts within
an image.

---

## Tuning

The class buckets are plain sets at the top of `extract_assets.py`; edit them to
retune what counts as a building, a road, or a prop. For sharper masks at the
cost of speed, point `--model` at a larger checkpoint such as
`nvidia/segformer-b4-finetuned-ade-512-512`.

## Roadmap ideas

- A `--tile` export that emits seamless horizontal strips for assets already
  flagged `tileable_x`.
- A depth model (MiDaS) to replace the geometric parallax heuristic.
- A scene composer that reads the descriptions and recombines cutouts into a new
  parallax scene, which turns this from an extractor into an animation pipeline.
