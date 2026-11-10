#!/usr/bin/env python3
"""Generates the 1000x1500 (2:3) Pinterest pin images for weddingchecklistpdf.com's
/pinfeed.xml from the site's own product art, in the Dream Wedding design system.

Each pin is a text panel (Instrument Serif title, DM Mono eyebrow, Instrument Sans
subtitle, on ivory or the soft brand tints) over the real product mock-ups that
scripts/brand/generate_product_mockups.py makes from the released files. No people,
no stock photos, no AI generation, no blush/sage/gold (design system, 6 Nov 2026).

Replaces generate_pin_images.mjs: sharp's SVG text could only reach installed system
fonts, so the brand faces never rendered. Same slugs, same text, same outputs:
public/pinterest/<slug>.jpg and data/pinterest/pin_images.json (byte sizes for the
feed's <enclosure length>, because the route runs in a Worker with no fs).

Run: DW_FONT_DIR=/path/to/fonts npm run pinterest:images
"""
import io, json, os, sys
from PIL import Image, ImageDraw, ImageFont, ImageOps

ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
PUB = os.path.join(ROOT, 'public')
OUT = os.path.join(PUB, 'pinterest')
MANIFEST = os.path.join(ROOT, 'data', 'pinterest', 'pin_images.json')
FONT_DIR = os.environ.get('DW_FONT_DIR') or os.path.join(ROOT, 'scripts', 'pinterest', 'fonts')
W, H = 1000, 1500
IVORY, MIDNIGHT, MUTED, BLUE = '#FAF7F2', '#1B1F3B', '#555A73', '#2747D9'
BLUE_SOFT, CORAL_SOFT = '#E8ECFC', '#FDE9E1'

def font(name, size, variation=None):
    path = os.path.join(FONT_DIR, name)
    if not os.path.exists(path):
        sys.exit(f'generate_pin_images: font missing: {path} (set DW_FONT_DIR to Instrument Serif, Instrument Sans and DM Mono)')
    f = ImageFont.truetype(path, size)
    if variation:
        try: f.set_variation_by_name(variation)
        except Exception: pass
    return f

def fit(rel, w, h, anchor):
    """Cover-fit to w x h. A portrait mock-up loses its caption block first (the pin's
    own panel carries the words), so the real pages fill the pin; a landscape one is
    centred on its page stack, which sits on the right."""
    img = Image.open(os.path.join(PUB, rel)).convert('RGB')
    if img.height > img.width:
        img = img.crop((0, int(img.height * 0.24), img.width, img.height))
        centering = {'north': (0.5, 0.0), 'south': (0.5, 1.0)}.get(anchor, (0.5, 0.5))
    else:
        centering = (0.78, 0.5) if w < img.width * h / img.height else (0.5, 0.5)
    return ImageOps.fit(img, (w, h), Image.LANCZOS, centering=centering)

def panel(height, bg, title, subtitle, eyebrow):
    img = Image.new('RGB', (W, height), bg); d = ImageDraw.Draw(img)
    lines = title.split('\n'); size = 84 if len(lines) > 1 else 90
    y = 70
    if eyebrow:
        f = font('DMMono-Medium.ttf', 28)
        spaced = ' '.join(eyebrow)  # letter-spacing for a mono label
        d.text((W / 2, y), spaced, font=f, fill=BLUE, anchor='mt'); y += 70
    f = font('InstrumentSerif-Regular.ttf', size)
    for line in lines:
        d.text((W / 2, y), line, font=f, fill=MIDNIGHT, anchor='mt'); y += int(size * 1.08)
    if subtitle:
        d.text((W / 2, y + 24), subtitle, font=font('InstrumentSans.ttf', 36), fill=MUTED, anchor='mt')
    return img

def card_pin(slug, card, panel_height, bg, title, subtitle, eyebrow):
    pin = Image.new('RGB', (W, H), bg)
    pin.paste(panel(panel_height, bg, title, subtitle, eyebrow), (0, 0))
    pin.paste(fit(card, W, H - panel_height, 'south'), (0, panel_height))
    return slug, pin

def bundle_pin():
    bg = IVORY; ph = 470; hero_h = round(W * 941 / 1672); row_top = ph + hero_h + 20
    cw = 320; ch = H - row_top - 20
    pin = Image.new('RGB', (W, H), bg)
    pin.paste(panel(ph, bg, 'Wedding Planning\nBundle', 'Checklist · Budget · Timeline · Seating chart', '4 WEDDING PLANNERS · $39'), (0, 0))
    pin.paste(fit('product-images/merch/operations-suite-hero.png', W, hero_h, 'centre'), (0, ph))
    for i, pid in enumerate(['budget-spreadsheet', 'timeline-template', 'seating-chart-maker']):
        pin.paste(fit(f'product-images/merch/{pid}-card.png', cw, ch, 'north'), (10 + i * (cw + 15), row_top))
    return 'wedding-planning-bundle', pin

def main():
    pins = [
        card_pin('wedding-checklist-pdf', 'product-images/merch/checklist-pdf-card.png', 360, IVORY, 'Wedding Checklist PDF', '104 tasks · 13 printable pages', 'PRINTABLE + EDITABLE · $9'),
        card_pin('printable-wedding-checklist', 'product-images/checklist-pdf-hero.png', 360, BLUE_SOFT, 'Printable Wedding Checklist', 'From 12+ months out to wedding week', 'MONTH-BY-MONTH PLANNER'),
        card_pin('elopement-planning-checklist', 'product-images/merch/checklist-pdf-card.png', 430, CORAL_SOFT, 'Elopement\nPlanning Checklist', 'License, witnesses, permits, travel', 'FREE CHECKLIST'),
        card_pin('courthouse-wedding-checklist', 'product-images/checklist-pdf-hero.png', 430, BLUE_SOFT, 'Courthouse\nWedding Checklist', 'Appointment, license, ID, witnesses', 'FREE CHECKLIST'),
        card_pin('destination-wedding-checklist', 'product-images/merch/checklist-pdf-card.png', 430, IVORY, 'Destination\nWedding Checklist', 'Travel, lodging, documents, vendors', 'FREE CHECKLIST'),
        bundle_pin(),
    ]
    os.makedirs(OUT, exist_ok=True)
    manifest = {}
    for slug, img in pins:
        if img.size != (W, H): sys.exit(f'{slug}: {img.size}, expected {W}x{H}')
        buf = io.BytesIO(); img.save(buf, 'JPEG', quality=86, optimize=True, progressive=True); raw = buf.getvalue()
        rel = f'/pinterest/{slug}.jpg'
        open(os.path.join(PUB, rel.lstrip('/')), 'wb').write(raw)
        manifest[slug] = {'path': rel, 'type': 'image/jpeg', 'width': W, 'height': H, 'length': len(raw)}
    os.makedirs(os.path.dirname(MANIFEST), exist_ok=True)
    open(MANIFEST, 'w').write(json.dumps(manifest, indent=2) + '\n')
    print(f'pinterest: wrote {len(pins)} pins ({W}x{H}) to public/pinterest/')

if __name__ == '__main__':
    main()
