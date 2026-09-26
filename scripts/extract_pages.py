"""
Extract PDF pages as cropped WebP images.
Output: images/pages/page_001.webp ~ page_053.webp
Also generates chapters.json with page ranges and cover page markers.
"""
import fitz
import json
import os
from PIL import Image
import io

PDF_PATH = r"D:\RC6\Term3\final\final.pdf"
OUT_DIR = r"D:\RC6\Term4\code\images\pages"
DPI = 200
WEBP_QUALITY = 88
CROP_TOP = 140
CROP_BOTTOM = 200

CHAPTERS = {
    "front": {"start": 1, "end": 5, "label": "Front Matter — Cover & Introduction"},
    "chapter1": {"start": 6, "end": 29, "label": "CHAPTER 1: RESEARCH"},
    "chapter2": {"start": 30, "end": 45, "label": "CHAPTER 2: PRODUCTION"},
    "chapter3": {"start": 46, "end": 52, "label": "CHAPTER 3: DEVELOPMENT"},
    "back": {"start": 53, "end": 53, "label": "Back Cover"},
}

COVER_PAGES = {1, 6, 30, 46, 53}


def main():
    os.makedirs(OUT_DIR, exist_ok=True)
    doc = fitz.open(PDF_PATH)
    total = doc.page_count
    print(f"PDF: {total} pages, DPI: {DPI}, Crop: top={CROP_TOP}px bottom={CROP_BOTTOM}px")

    for i in range(total):
        page = doc[i]
        pix = page.get_pixmap(dpi=DPI)
        img = Image.open(io.BytesIO(pix.tobytes("png")))
        pg_num = i + 1
        is_cover = pg_num in COVER_PAGES

        if is_cover:
            # Cover pages: keep full size, no crop
            pass
        else:
            # Normal pages: crop header/footer
            w, h = img.size
            img = img.crop((0, CROP_TOP, w, h - CROP_BOTTOM))

        filename = f"page_{pg_num:03d}.webp"
        filepath = os.path.join(OUT_DIR, filename)
        img.save(filepath, "WEBP", quality=WEBP_QUALITY)
        size_kb = os.path.getsize(filepath) / 1024
        cover_tag = " [COVER]" if is_cover else ""
        print(f"  [{pg_num:2d}/{total}] {filename}  ({img.width}x{img.height}, {size_kb:.0f} KB){cover_tag}")

    doc.close()

    mapping = {}
    for key, info in CHAPTERS.items():
        mapping[key] = {
            "start": info["start"],
            "end": info["end"],
            "label": info["label"],
            "coverPage": info["start"] if info["start"] in COVER_PAGES else None
        }
    mapping_path = os.path.join(OUT_DIR, "chapters.json")
    with open(mapping_path, "w", encoding="utf-8") as f:
        json.dump(mapping, f, ensure_ascii=False, indent=2)
    print(f"\nChapter mapping: {mapping_path}")

    total_size = sum(
        os.path.getsize(os.path.join(OUT_DIR, f"page_{pg:03d}.webp"))
        for pg in range(1, total + 1)
    )
    print(f"Total size: {total_size / 1024 / 1024:.1f} MB")
    print("Done.")


if __name__ == "__main__":
    main()
