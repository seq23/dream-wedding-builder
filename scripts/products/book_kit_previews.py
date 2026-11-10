"""Flattened, watermarked previews of the three book kits (public/product-previews/<id>/).

Manual: needs pdftoppm (poppler) and Pillow. Input: the committed PDFs in product-builds/releases.
Usage: python scripts/products/book_kit_previews.py
"""
import subprocess, tempfile
from pathlib import Path
from PIL import Image, ImageDraw, ImageFont

ROOT = Path(__file__).resolve().parents[2]
KITS = {
    "courthouse-wedding-kit": ("DWB-COURTHOUSE-001_v1.0.0.pdf", "The Courthouse Wedding Kit", [(3, "License steps, in order"), (4, "Questions to call the clerk"), (6, "The courthouse day")]),
    "wedding-vows-workbook": ("DWB-VOWS-001_v1.0.0.pdf", "The Wedding Vows Workbook", [(6, "A five-part structure"), (7, "Fill-in template"), (10, "Length and timing guide")]),
    "maid-of-honor-kit": ("DWB-MOH-001_v1.0.0.pdf", "The Maid of Honor Kit", [(3, "Duties timeline"), (8, "Budget split sheet"), (9, "Speech builder")]),
}
IVORY, MID, BLUE = (250, 247, 242), (27, 31, 59), (39, 71, 217)

def font(size, bold=False):
    for name in (["Helvetica.ttc", "Arial Bold.ttf", "DejaVuSans-Bold.ttf"] if bold else ["Helvetica.ttc", "Arial.ttf", "DejaVuSans.ttf"]):
        for base in ("/System/Library/Fonts/", "/Library/Fonts/", "/usr/share/fonts/truetype/dejavu/"):
            try:
                return ImageFont.truetype(base + name, size)
            except OSError:
                pass
    return ImageFont.load_default()

for pid, (pdf, name, pages) in KITS.items():
    out = ROOT / "public/product-previews" / pid
    out.mkdir(parents=True, exist_ok=True)
    with tempfile.TemporaryDirectory() as tmp:
        for i, (n, label) in enumerate(pages, 1):
            subprocess.run(["pdftoppm", "-r", "90", "-f", str(n), "-l", str(n), "-png", str(ROOT / "product-builds/releases" / pdf), f"{tmp}/p"], check=True)
            page = Image.open(next(Path(tmp).glob("p*.png"))).convert("RGB")
            for f in Path(tmp).glob("p*.png"):
                f.unlink()
            canvas = Image.new("RGB", (1600, 1080), IVORY)
            d = ImageDraw.Draw(canvas)
            d.rounded_rectangle((80, 60, 470, 116), 28, fill=MID)
            d.text((108, 74), "LOOK INSIDE · $9 PDF KIT", fill=(255, 255, 255), font=font(24, True))
            d.text((80, 150), name, fill=MID, font=font(56, True))
            d.text((80, 225), label, fill=BLUE, font=font(34))
            page = page.crop((0, 0, page.width, int(page.height * 0.62)))
            scale = 1440 / page.width if page.width > 1440 else 1
            page = page.resize((int(page.width * min(scale, 1)), int(page.height * min(scale, 1))))
            ph = min(page.height, 700)
            page = page.crop((0, 0, page.width, ph))
            x = (1600 - page.width) // 2
            canvas.paste(page, (x, 300))
            wm = Image.new("RGBA", (1600, 1080), (0, 0, 0, 0))
            ImageDraw.Draw(wm).text((360, 560), "PREVIEW", fill=(39, 71, 217, 60), font=font(150, True))
            canvas = Image.alpha_composite(canvas.convert("RGBA"), wm.rotate(18, center=(800, 640))).convert("RGB")
            d = ImageDraw.Draw(canvas)
            d.rectangle((0, 1010, 1600, 1080), fill=IVORY)
            d.text((80, 1025), "Flattened preview of the printable PDF. The purchase includes every page at full size.", fill=MID, font=font(24))
            canvas.save(out / f"{pid}-preview-{i}.png", optimize=True)
    print(pid, len(pages), "previews")
