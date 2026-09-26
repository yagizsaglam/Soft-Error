#!/usr/bin/env python3
"""Compress oversized images in webpics/det/ to <2MB (long side capped at 4000px).

Originals are moved to webpics/det/暂存/ (mirroring the C1..C6 structure).
Re-runnable: files already in 暂存/ are skipped, and a file is only processed
while it still exceeds the 2MB target.
"""
import os, io, glob
from PIL import Image, ImageOps

Image.MAX_IMAGE_PIXELS = None

ROOT = 'webpics/det'
BACKUP = os.path.join(ROOT, '暂存')
TARGET = 2 * 1024 * 1024        # 2MB
MAX_SIDE = 4000                 # long-side cap, in px
QUALITIES = list(range(90, 47, -5))  # 90, 85, ..., 50


def files_over():
    out = []
    for f in glob.glob(os.path.join(ROOT, '**', '*.jpg'), recursive=True):
        norm = f.replace('\\', '/')
        if BACKUP.replace('\\', '/') + '/' in norm:
            continue
        if os.path.getsize(f) > TARGET:
            out.append(f)
    return sorted(out)


def encode_under(img, target):
    """Return (jpeg_bytes, quality) at the highest quality that fits under target."""
    best = None
    for q in QUALITIES:
        buf = io.BytesIO()
        img.save(buf, 'JPEG', quality=q, optimize=True, progressive=True)
        data = buf.getvalue()
        if len(data) <= target:
            return data, q
        if best is None or len(data) < len(best[0]):
            best = (data, q)
    return best


def main():
    files = files_over()
    print('found %d files >2MB' % len(files))
    total_before = sum(os.path.getsize(f) for f in files)
    total_after = 0

    for f in files:
        rel = os.path.relpath(f, ROOT)
        backup = os.path.join(BACKUP, rel)
        os.makedirs(os.path.dirname(backup), exist_ok=True)
        os.replace(f, backup)                 # move original out of the way

        img = Image.open(backup)
        img = ImageOps.exif_transpose(img)    # bake in EXIF rotation
        img = img.convert('RGB')
        w, h = img.size
        long = max(w, h)
        if long > MAX_SIDE:
            s = MAX_SIDE / long
            img = img.resize((max(1, round(w * s)), max(1, round(h * s))), Image.LANCZOS)

        data, q = encode_under(img, TARGET)
        with open(f, 'wb') as fh:
            fh.write(data)

        after = os.path.getsize(f)
        total_after += after
        print('%s: %.2fMB -> %.2fMB (q=%d, %dx%d)'
              % (rel, os.path.getsize(backup) / 1e6, after / 1e6, q, img.size[0], img.size[1]))

    print()
    print('total before : %.1f MB' % (total_before / 1e6))
    print('total after  : %.1f MB' % (total_after / 1e6))
    print('saved        : %.1f MB' % ((total_before - total_after) / 1e6))


if __name__ == '__main__':
    main()
