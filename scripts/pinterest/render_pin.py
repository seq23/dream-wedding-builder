#!/usr/bin/env python3
"""Renders the 1000x1500 Pinterest daily-drip pins (look approved for sampling 6 Nov 2026,
from the Pinterest assessment: what wins on wedding searches is a quiet daylight photo with
one short serif line on a soft band, never a framed template or a product screenshot).

Every pin is a full-bleed topic photo (data/pinterest/topic_art.json: free Unsplash,
Pexels or Pixabay licence, >= 1000px wide, no watermark) with ONE soft translucent band
holding the search-phrase headline (Instrument Serif), the instruction (Instrument Sans)
and the small brand line "Wedding Checklist PDF" (the account's and the site's name).
Three layouts (band at the top, band low, a thin ivory frame with the band inside) x
four soft palettes (ivory, blush, sage, champagne). The binder-page and tab-panel frames
are retired; pins drawn in them before 7 Nov 2026 keep their published images.

Fonts are committed (scripts/pinterest/fonts, SIL OFL) so CI renders the same faces.

Serve mode (used by scripts/pinterest/render_pin.mjs): one JSON request per stdin line,
{"variant": {...}, "out": "/abs/path.jpg"}, one JSON reply per stdout line with the
metrics the quality gate reads: every text role's size, lines, fit, ink and ground, and
the layout's photo share, band count and brand text.
"""
import io, json, os, sys
from PIL import Image, ImageDraw, ImageEnhance, ImageFilter, ImageFont, ImageOps, ImageStat

ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
PUB = os.path.join(ROOT, 'public')
FONT_DIR = os.environ.get('DW_FONT_DIR') or os.path.join(ROOT, 'scripts', 'pinterest', 'fonts')
W, H = 1000, 1500
BRAND = 'Wedding Checklist PDF'
# Band colour, headline ink, subline ink. Daylight wedding colours: ivory, blush, sage,
# soft gold (champagne). Inks are warm darks that keep >= 4.5:1 on the band.
PALETTES = {
    'ivory': {'bg': '#FBF8F3', 'ink': '#2B2622', 'sub': '#564C43'},
    'blush': {'bg': '#F8ECE7', 'ink': '#3A2828', 'sub': '#5E4844'},
    'sage': {'bg': '#EEF1EA', 'ink': '#24302A', 'sub': '#46524A'},
    'champagne': {'bg': '#F6EFE2', 'ink': '#2E2A22', 'sub': '#564C3C'},
}
LAYOUTS = ['band-top', 'band-low', 'band-frame']
BAND_ALPHA = 0.9
FRAME = '#FBF8F3'

# Floors that keep text readable on a 236px-wide thumbnail (scale 0.236): headline >= 14px
# there, subline >= 10px. The fitter never goes below them; it reports fit=false.
HEADLINE_MAX, HEADLINE_MIN = 104, 64
SUB_SIZE, SUB_MIN = 46, 43
BRAND_SIZE = 25

_fonts = {}
def font(name, size, variation=None):
    key = (name, size, variation)
    if key not in _fonts:
        path = os.path.join(FONT_DIR, name)
        if not os.path.exists(path):
            raise SystemExit(f'render_pin: font missing: {path}')
        f = ImageFont.truetype(path, size)
        if variation:
            try: f.set_variation_by_name(variation)
            except Exception: pass
        _fonts[key] = f
    return _fonts[key]

serif = lambda s: font('InstrumentSerif-Regular.ttf', s)
sans = lambda s: font('InstrumentSans.ttf', s, 'Medium')
mono = lambda s: font('DMMono-Medium.ttf', s)

def text_w(f, s, spacing=0):
    return f.getlength(s) + spacing * max(0, len(s) - 1)

def wrap(f, text, width, max_lines):
    """Greedy wrap, then balance: the fewest lines that fit, with the most even lengths."""
    words = text.split()
    lines = []
    for w in words:
        if lines and text_w(f, f'{lines[-1]} {w}') <= width: lines[-1] = f'{lines[-1]} {w}'
        else: lines.append(w)
    if len(lines) > max_lines or any(text_w(f, l) > width for l in lines): return None
    n = len(lines)
    if n > 1:
        lo, hi = width * 0.45, width
        for _ in range(14):
            mid = (lo + hi) / 2
            trial = []
            for w in words:
                if trial and text_w(f, f'{trial[-1]} {w}') <= mid: trial[-1] = f'{trial[-1]} {w}'
                else: trial.append(w)
            if len(trial) <= n and all(text_w(f, l) <= mid for l in trial): hi = mid; lines = trial
            else: lo = mid
    return lines

def fit(text, width, face, sizes, max_lines):
    text = ' '.join(str(text).split())
    for size in sizes:
        lines = wrap(face(size), text, width, max_lines)
        if lines: return size, lines, True
    return sizes[-1], [text], False

def photo(rel, w, h, focus=(0.5, 0.5)):
    img = ImageOps.exif_transpose(Image.open(os.path.join(PUB, rel.lstrip('/')))).convert('RGB')
    img = ImageOps.fit(img, (w, h), Image.LANCZOS, centering=tuple(focus))
    # A light polish (the glossy look of the winning pins): a touch more light and colour.
    img = ImageEnhance.Brightness(img).enhance(1.03)
    img = ImageEnhance.Contrast(img).enhance(1.04)
    return ImageEnhance.Color(img).enhance(1.06)

def hex_rgb(h): return tuple(int(h[i:i + 2], 16) for i in (1, 3, 5))
def rgb_hex(c): return '#%02X%02X%02X' % tuple(int(round(x)) for x in c)

def band(pin, box, pal, headline, subline):
    """One soft translucent band. Returns its text metrics; the ground each role is checked
    against is the band colour over the photo's own mean colour under the band."""
    x0, y0, x1, y1 = box
    region = pin.crop(box)
    mean = ImageStat.Stat(region).mean[:3]
    bg = hex_rgb(pal['bg'])
    ground = rgb_hex([BAND_ALPHA * b + (1 - BAND_ALPHA) * m for b, m in zip(bg, mean)])
    overlay = Image.new('RGBA', pin.size, (0, 0, 0, 0))
    od = ImageDraw.Draw(overlay)
    sh = Image.new('L', pin.size, 0)
    ImageDraw.Draw(sh).rounded_rectangle((x0, y0 + 10, x1, y1 + 10), 30, fill=46)
    sh = sh.filter(ImageFilter.GaussianBlur(18))
    pin.paste(Image.new('RGB', pin.size, '#2B2622'), (0, 0), sh)
    od.rounded_rectangle(box, 30, fill=bg + (int(255 * BAND_ALPHA),))
    pin.paste(Image.alpha_composite(pin.convert('RGBA'), overlay).convert('RGB'))
    return ground

def layout_text(width, headline, subline):
    hs, hl, hfit = fit(headline, width, serif, list(range(HEADLINE_MAX, HEADLINE_MIN - 1, -2)), 3)
    ss, sl, sfit = fit(subline, width, sans, list(range(SUB_SIZE, SUB_MIN - 1, -1)), 2)
    lh, sh = int(hs * 1.02), int(ss * 1.28)
    height = 46 + len(hl) * lh + 22 + len(sl) * sh + 30 + 2 + 22 + BRAND_SIZE + 40
    return (hs, hl, hfit, lh), (ss, sl, sfit, sh), height

def draw_text(d, box, pal, ground, h, s):
    x0, y0, x1, y1 = box
    cx = (x0 + x1) / 2
    hs, hl, hfit, lh = h; ss, sl, sfit, sh = s
    y = y0 + 46
    for line in hl:
        d.text((cx, y), line, font=serif(hs), fill=pal['ink'], anchor='mt'); y += lh
    y += 22
    for line in sl:
        d.text((cx, y), line, font=sans(ss), fill=pal['sub'], anchor='mt'); y += sh
    y += 30
    d.line((cx - 36, y, cx + 36, y), fill='#B08D57', width=2); y += 22
    label = BRAND.upper(); f = mono(BRAND_SIZE); sp = 4
    tx = cx - text_w(f, label, sp) / 2
    for ch in label:
        d.text((tx, y), ch, font=f, fill=pal['sub']); tx += f.getlength(ch) + sp
    return [
        {'role': 'headline', 'size': hs, 'lines': hl, 'fit': hfit, 'ink': pal['ink'], 'ground': ground},
        {'role': 'subline', 'size': ss, 'lines': sl, 'fit': sfit, 'ink': pal['sub'], 'ground': ground},
        {'role': 'brand', 'size': BRAND_SIZE, 'lines': [BRAND], 'fit': True, 'ink': pal['sub'], 'ground': ground},
    ]

def render(v):
    pal = PALETTES.get(v['palette'])
    if not pal: raise ValueError(f"{v['id']}: unknown palette {v['palette']}")
    layout = v['layout']; focus = v.get('focus') or (0.5, 0.5)
    if layout not in LAYOUTS: raise ValueError(f"{v['id']}: unknown layout {layout}")
    pin = Image.new('RGB', (W, H), FRAME)
    if layout == 'band-frame':
        inset = 30
        pin.paste(photo(v['art'], W - 2 * inset, H - 2 * inset, focus), (inset, inset))
        photo_area = (W - 2 * inset) * (H - 2 * inset)
        bx0, bx1 = inset + 44, W - inset - 44
    else:
        pin.paste(photo(v['art'], W, H, focus), (0, 0))
        photo_area = W * H
        bx0, bx1 = 48, W - 48
    h, s, height = layout_text(bx1 - bx0 - 96, v['headline'], v['subline'])
    if layout == 'band-top': box = (bx0, 60, bx1, 60 + height)
    elif layout == 'band-low': box = (bx0, H - 70 - height, bx1, H - 70)
    else: box = (bx0, 30 + 48, bx1, 30 + 48 + height)
    ground = band(pin, box, pal, v['headline'], v['subline'])
    d = ImageDraw.Draw(pin)
    m = draw_text(d, box, pal, ground, h, s)
    band_area = (box[2] - box[0]) * (box[3] - box[1])
    shape = {'layout': layout, 'photo_fraction': round((photo_area - band_area) / (W * H), 3), 'bands': 1, 'brand': BRAND}
    return pin, m, shape

def save(pin, out):
    buf = io.BytesIO(); pin.save(buf, 'JPEG', quality=84, optimize=True, progressive=True)
    raw = buf.getvalue()
    os.makedirs(os.path.dirname(out), exist_ok=True)
    open(out, 'wb').write(raw)
    return len(raw)

def serve():
    for line in sys.stdin:
        if not line.strip(): continue
        req = json.loads(line)
        try:
            pin, metrics, shape = render(req['variant'])
            if pin.size != (W, H): raise ValueError(f'rendered {pin.size}')
            length = save(pin, req['out'])
            reply = {'ok': True, 'length': length, 'width': W, 'height': H, 'text': metrics, 'shape': shape}
        except Exception as e:
            reply = {'ok': False, 'error': f'{type(e).__name__}: {e}'}
        sys.stdout.write(json.dumps(reply) + '\n'); sys.stdout.flush()

if __name__ == '__main__':
    if '--serve' in sys.argv: serve()
    else:
        v = json.loads(sys.argv[1]); pin, metrics, shape = render(v); save(pin, sys.argv[2]); print(json.dumps({'text': metrics, 'shape': shape}))
