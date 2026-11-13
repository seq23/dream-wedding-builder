#!/usr/bin/env python3
"""Product mock-ups in the Dream Wedding design system, made from the real files.

Purpose:
- Replaces the old blush-and-gold storefront renders (florals, a "DWB" monogram)
  with flat mock-ups of the actual product: pages rendered from the released PDFs
  in the private product folder (DW_PRODUCTS_DIR), and the free Builder's dated plan as captured at
  390px (data/brand/builder-dated-plan-390.png). No stock, no AI imagery, no
  invented names (Dream Wedding design system, approved 6 Nov 2026).
- Overwrites the existing files in place at their existing sizes, so every src,
  alt text and schema image URL stays exactly as it was.

Inputs: $DW_PRODUCTS_DIR/product-builds/releases/DWB-*-001_v2.0.0.pdf (private, default
~/.boss-os/dream-wedding/products; absent = [PRODUCTS_DIR_MISSING]), data/brand/builder-dated-plan-390.png,
fonts named by DW_FONT_DIR (Instrument Serif, Instrument Sans, DM Mono; OFL, from
google/fonts). Needs pdftoppm (poppler) and Pillow. CI never runs this; the PNG/WebP
files it writes are committed.

Run: DW_FONT_DIR=/path/to/fonts python3 scripts/brand/generate_product_mockups.py
"""
import os, subprocess, sys, tempfile
from PIL import Image, ImageDraw, ImageFilter, ImageFont

ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
PRODUCTS_DIR = os.environ.get('DW_PRODUCTS_DIR') or os.path.expanduser('~/.boss-os/dream-wedding/products')
REL = os.path.join(PRODUCTS_DIR, 'product-builds', 'releases')
if not os.path.isdir(REL):
    sys.exit(f'[PRODUCTS_DIR_MISSING] generate_product_mockups: the paid product files are not at {REL}. They are private and never in this repo. Set DW_PRODUCTS_DIR, then run this again. Nothing was written.')
PUB = os.path.join(ROOT, 'public', 'product-images')
FONT_DIR = os.environ.get('DW_FONT_DIR', '')
IVORY, RAISED, MIDNIGHT, MUTED, RULE = '#FAF7F2', '#FFFFFF', '#1B1F3B', '#555A73', '#E3DCCF'
BLUE, BLUE_SOFT, CORAL = '#2747D9', '#E8ECFC', '#F28C6B'

def font(name, size, variation=None):
    path = os.path.join(FONT_DIR, name)
    if not os.path.exists(path):
        sys.exit(f'generate_product_mockups: font missing: {path} (set DW_FONT_DIR)')
    f = ImageFont.truetype(path, size)
    if variation:
        try: f.set_variation_by_name(variation)
        except Exception: pass
    return f

SERIF = lambda s: font('InstrumentSerif-Regular.ttf', s)
SANS = lambda s, v='Regular': font('InstrumentSans.ttf', s, v)
MONO = lambda s: font('DMMono-Medium.ttf', s)

PRODUCTS = {
    'checklist-pdf': dict(pdf='DWB-CHECKLIST-001', name='Wedding Checklist PDF', front=4, back=1, tabs=['12+ MONTHS', '9 MONTHS', '6 MONTHS', 'WEDDING WEEK']),
    'budget-spreadsheet': dict(pdf='DWB-BUDGET-001', name='Wedding Budget Spreadsheet', front=2, back=1),
    'timeline-template': dict(pdf='DWB-TIMELINE-001', name='Wedding Timeline Template', front=2, back=1),
    'seating-chart-maker': dict(pdf='DWB-SEATING-001', name='Wedding Seating Chart Maker', front=2, back=1),
}
SUITE = dict(pdf='DWB-SUITE-001', name='Dream Wedding Operations Suite')

_cache = {}
def pages(pdf):
    if pdf in _cache: return _cache[pdf]
    tmp = tempfile.mkdtemp()
    subprocess.run(['pdftoppm', '-r', '110', '-png', os.path.join(REL, f'{pdf}_v2.0.0.pdf'), os.path.join(tmp, 'p')], check=True)
    out = [Image.open(os.path.join(tmp, f)).convert('RGB') for f in sorted(os.listdir(tmp))]
    _cache[pdf] = out
    return out

def sheet(img, w):
    """A real page as a flat sheet: scaled, with a hairline edge."""
    h = int(img.height * w / img.width)
    s = img.resize((w, h), Image.LANCZOS)
    ImageDraw.Draw(s).rectangle([0, 0, w - 1, h - 1], outline=RULE, width=max(1, w // 400))
    return s

def drop(canvas, s, x, y, r=None):
    """Paste a sheet with the design system's one soft 'page' shadow."""
    pad = max(12, s.width // 14)
    sh = Image.new('RGBA', (s.width + pad * 2, s.height + pad * 2), (0, 0, 0, 0))
    ImageDraw.Draw(sh).rectangle([pad, pad + pad // 3, pad + s.width, pad + s.height + pad // 3], fill=(27, 31, 59, 34))
    sh = sh.filter(ImageFilter.GaussianBlur(pad / 2.2))
    canvas.alpha_composite(sh, (x - pad, y - pad))
    canvas.paste(s, (x, y))

def tabs(canvas, x, y, w, labels, size):
    """Binder tabs along the top edge of the front sheet: blue first, coral after."""
    d = ImageDraw.Draw(canvas)
    n = len(labels); gap = max(4, w // 120); tw = (w - gap * (n - 1)) // n; th = int(size * 2.4)
    for i, label in enumerate(labels):
        tx = x + i * (tw + gap)
        d.rounded_rectangle([tx, y - th, tx + tw, y + size], radius=size // 2, fill=BLUE if i == 0 else CORAL)
        f = MONO(size)
        while d.textlength(label, font=f) > tw - size and f.size > 8: f = MONO(f.size - 1)
        d.text((tx + tw / 2, y - th / 2), label, font=f, fill='#FFFFFF' if i == 0 else MIDNIGHT, anchor='mm')

def mark(canvas, x, y, h):
    """The brand's two stepped binder tabs (public/brand/dream-wedding-tab.svg geometry)."""
    d = ImageDraw.Draw(canvas); k = h / 56; r = int(8 * k)
    d.rounded_rectangle([x + int(12 * k), y, x + int(40 * k), y + int(48 * k)], radius=r, fill=CORAL, corners=(False, True, False, False))
    d.rounded_rectangle([x, y + int(10 * k), x + int(28 * k), y + int(56 * k)], radius=r, fill=BLUE, corners=(False, True, False, False))

def caption(canvas, x, y, w, kicker, title, sub, scale):
    d = ImageDraw.Draw(canvas)
    d.text((x, y), kicker, font=MONO(int(15 * scale)), fill=MUTED)
    f = SERIF(int(52 * scale))
    while d.textlength(title, font=f) > w and f.size > 20: f = SERIF(f.size - 2)
    d.text((x, y + int(28 * scale)), title, font=f, fill=MIDNIGHT)
    d.text((x, y + int(28 * scale) + int(f.size * 1.15)), sub, font=SANS(int(20 * scale)), fill=MUTED)
    return y + int(28 * scale) + int(f.size * 1.15) + int(34 * scale)

def product_mockup(pid, W, H):
    p = PRODUCTS[pid]; pg = pages(p['pdf']); n = len(pg)
    c = Image.new('RGBA', (W, H), IVORY)
    landscape = W > H * 1.2; scale = min(W, H) / 900
    kicker = 'LOOK INSIDE · THE REAL FILE'
    sub = f'{n}-page printable PDF + editable XLSX'
    if landscape:
        tx = int(W * 0.06); tw = int(W * 0.36)
        caption(c, tx, int(H * 0.36), tw, kicker, p['name'], sub, scale)
        mark(c, tx, int(H * 0.36) - int(80 * scale), int(52 * scale))
        sw = int(H * 0.74 * 612 / 792); x0 = int(W * 0.52); y0 = int(H * 0.13)
    else:
        tx = int(W * 0.08); tw = int(W * 0.84)
        mark(c, tx, int(H * 0.05), int(56 * scale))
        bottom = caption(c, tx, int(H * 0.05) + int(84 * scale), tw, kicker, p['name'], sub, scale)
        sw = int(W * 0.62); x0 = int(W * 0.22); y0 = bottom + int(40 * scale)
    back, front = sheet(pg[p['back']], sw), sheet(pg[p['front']], sw)
    drop(c, back, x0 + int(sw * 0.14), y0 - int(sw * 0.02))
    fy = y0 + int(sw * 0.08)
    drop(c, front, x0, fy)
    if p.get('tabs'):
        tabs(c, x0 + int(sw * 0.04), fy, int(sw * 0.92), p['tabs'], max(10, int(sw / 34)))
    return c.convert('RGB')

def suite_mockup(W, H):
    c = Image.new('RGBA', (W, H), IVORY); scale = min(W, H) / 900
    landscape = W > H * 1.2
    fronts = [pages(PRODUCTS[k]['pdf'])[PRODUCTS[k]['front']] for k in ('checklist-pdf', 'budget-spreadsheet', 'timeline-template', 'seating-chart-maker')]
    n = len(pages(SUITE['pdf']))
    sub = f'All four tools + a {n}-page suite PDF'
    if landscape:
        tx = int(W * 0.06); caption(c, tx, int(H * 0.36), int(W * 0.34), 'ALL FOUR TOOLS · THE REAL FILES', SUITE['name'], sub, scale)
        mark(c, tx, int(H * 0.36) - int(80 * scale), int(52 * scale))
        sw = int(H * 0.6 * 612 / 792); x0 = int(W * 0.46); y0 = int(H * 0.1); step = int((W * 0.5 - sw) / 3)
    else:
        tx = int(W * 0.08); mark(c, tx, int(H * 0.05), int(56 * scale))
        bottom = caption(c, tx, int(H * 0.05) + int(84 * scale), int(W * 0.84), 'ALL FOUR TOOLS · THE REAL FILES', SUITE['name'], sub, scale)
        sw = int(W * 0.44); x0 = int(W * 0.06); y0 = bottom + int(30 * scale); step = int(sw * 0.36)
    for i, pg in enumerate(fronts):
        drop(c, sheet(pg, sw), x0 + i * step, y0 + i * int(sw * 0.1))
    return c.convert('RGB')

def builder_mockup(W, H):
    """The free planner's dated plan, in a plain phone frame."""
    c = Image.new('RGBA', (W, H), IVORY); scale = min(W, H) / 900
    shot = Image.open(os.path.join(ROOT, 'data', 'brand', 'builder-dated-plan-390.png')).convert('RGB')
    ph = int(H * 0.84); pw = int(ph * 0.5); x = int(W * 0.56); y = int(H * 0.08)
    d = ImageDraw.Draw(c)
    frame = Image.new('RGBA', (pw, ph), (0, 0, 0, 0)); fd = ImageDraw.Draw(frame)
    fd.rounded_rectangle([0, 0, pw - 1, ph - 1], radius=int(pw * 0.12), fill=MIDNIGHT)
    inner = (int(pw * 0.045), int(pw * 0.045)); iw = pw - inner[0] * 2; ih = ph - inner[1] * 2
    s = shot.resize((iw, int(shot.height * iw / shot.width)), Image.LANCZOS).crop((0, 0, iw, ih))
    m = Image.new('L', (iw, ih), 0); ImageDraw.Draw(m).rounded_rectangle([0, 0, iw - 1, ih - 1], radius=int(pw * 0.09), fill=255)
    frame.paste(s, inner, m)
    sh = Image.new('RGBA', (pw + 80, ph + 80), (0, 0, 0, 0)); ImageDraw.Draw(sh).rounded_rectangle([40, 52, pw + 40, ph + 52], radius=int(pw * 0.12), fill=(27, 31, 59, 40))
    c.alpha_composite(sh.filter(ImageFilter.GaussianBlur(18)), (x - 40, y - 40)); c.alpha_composite(frame, (x, y))
    tx = int(W * 0.07); mark(c, tx, int(H * 0.3), int(52 * scale))
    caption(c, tx, int(H * 0.3) + int(80 * scale), int(W * 0.44), 'THE FREE PLANNER · YOUR DATE', 'A dated plan from your wedding day', 'Ticks, your own tasks, calendar reminders', scale)
    return c.convert('RGB')

def save(img, rel):
    path = os.path.join(PUB, rel)
    old = Image.open(path).size if os.path.exists(path) else img.size
    img = img.resize(old, Image.LANCZOS) if img.size != old else img
    if rel.endswith('.webp'): img.save(path, 'WEBP', quality=86, method=6)
    else: img.quantize(colors=128, method=Image.Quantize.MEDIANCUT).save(path, optimize=True)
    print(f'wrote {rel} {img.size} {os.path.getsize(path)} bytes')

def size_of(rel, default):
    path = os.path.join(PUB, rel)
    return Image.open(path).size if os.path.exists(path) else default

def main():
    for pid in PRODUCTS:
        for rel in (f'{pid}-hero.png', f'{pid}-hero.webp', f'{pid}.png', f'{pid}.webp', f'merch/{pid}-card.png', f'merch/{pid}-card.webp'):
            if os.path.exists(os.path.join(PUB, rel)): save(product_mockup(pid, *size_of(rel, (1122, 1402))), rel)
    for rel in ('operations-suite.png', 'operations-suite.webp', 'merch/operations-suite-hero.png', 'merch/operations-suite-hero.webp'):
        if os.path.exists(os.path.join(PUB, rel)): save(suite_mockup(*size_of(rel, (1672, 941))), rel)
    save(builder_mockup(1600, 1000), 'free-planner-dated-plan.png')

if __name__ == '__main__':
    main()
