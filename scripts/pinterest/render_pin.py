#!/usr/bin/env python3
"""Renders the 1000x1500 Pinterest daily-drip pins in the Dream Wedding brand (design
system approved 6 Nov 2026; same faces, palette and wordmark as the feed pins in
generate_pin_images.py, #95).

Each pin is a topic photo (data/pinterest/topic_art.json: licence-clean CC0 / public
domain photos, one set per page topic) or the product's own art, plus a text panel:
DM Mono eyebrow on a blue binder tab (a coral inactive tab stepped behind it), an
Instrument Serif headline, an Instrument Sans subline, and the two-tab wordmark.

Fonts are committed (scripts/pinterest/fonts, SIL OFL) so CI renders the same faces.

Serve mode (used by scripts/pinterest/render_pin.mjs): one JSON request per stdin line,
{"variant": {...}, "out": "/abs/path.jpg"}, one JSON reply per stdout line with the
text metrics the quality gate reads: every text role's font size, lines, whether it fit
uncut, and its ink and ground colours.
"""
import io, json, os, sys
from PIL import Image, ImageDraw, ImageFilter, ImageFont, ImageOps

ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
PUB = os.path.join(ROOT, 'public')
FONT_DIR = os.environ.get('DW_FONT_DIR') or os.path.join(ROOT, 'scripts', 'pinterest', 'fonts')
W, H = 1000, 1500
IVORY, MIDNIGHT, MUTED, BLUE, CORAL = '#FAF7F2', '#1B1F3B', '#555A73', '#2747D9', '#F28C6B'
BLUE_SOFT, CORAL_SOFT, WHITE = '#E8ECFC', '#FDE9E1', '#FFFFFF'

# Panel colour, headline ink, subline ink. Light only, no champagne/blush/sage/gold.
PALETTES = {
    'ivory': {'bg': IVORY, 'ink': MIDNIGHT, 'sub': MUTED},
    'blue-soft': {'bg': BLUE_SOFT, 'ink': MIDNIGHT, 'sub': '#3C4160'},
    'coral-soft': {'bg': CORAL_SOFT, 'ink': MIDNIGHT, 'sub': '#4A4560'},
    'midnight': {'bg': MIDNIGHT, 'ink': IVORY, 'sub': '#D9DCEB'},
}
LAYOUTS = ['tab-panel', 'header', 'card', 'binder-page', 'split']

# Floors that keep text readable on a 236px-wide thumbnail (scale 0.236): headline >= 14px
# there, everything else >= 10px. The fitter never goes below them; it reports fit=false.
HEADLINE_MAX, HEADLINE_MIN = 100, 60
SUB_SIZE, SUB_MIN = 46, 43
EYEBROW_SIZE = 43

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
serif_i = lambda s: font('InstrumentSerif-Italic.ttf', s)
sans = lambda s: font('InstrumentSans.ttf', s, 'SemiBold')
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
    if n > 1:  # balance: shrink the width until another line would be needed
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

def fit_headline(text, width, max_lines=3):
    text = ' '.join(str(text).split())
    for size in range(HEADLINE_MAX, HEADLINE_MIN - 1, -2):
        lines = wrap(serif(size), text, width, max_lines)
        if lines: return size, lines, True
    f = serif(HEADLINE_MIN)
    return HEADLINE_MIN, wrap(f, text, 10 ** 6, 1), False

def wrap_items(f, items, width, max_lines):
    """A dot list ("Garment · body · paper") breaks between items, never before a dot."""
    lines = []
    for it in items:
        if lines and text_w(f, f'{lines[-1]} · {it}') <= width: lines[-1] = f'{lines[-1]} · {it}'
        else: lines.append(it)
    return lines if len(lines) <= max_lines and all(text_w(f, l) <= width for l in lines) else None

def fit_sub(text, width, max_lines=2):
    text = ' '.join(str(text).split())
    items = [t.strip() for t in text.split('·')] if '·' in text else None
    for size in range(SUB_SIZE, SUB_MIN - 1, -1):
        lines = wrap_items(sans(size), items, width, max_lines) if items else wrap(sans(size), text, width, max_lines)
        if lines: return size, lines, True
    return SUB_MIN, [text], False

def photo(rel, w, h, focus=(0.5, 0.5)):
    img = ImageOps.exif_transpose(Image.open(os.path.join(PUB, rel.lstrip('/')))).convert('RGB')
    return ImageOps.fit(img, (w, h), Image.LANCZOS, centering=tuple(focus))

def rounded(im, r):
    mask = Image.new('L', im.size, 0)
    ImageDraw.Draw(mask).rounded_rectangle((0, 0, im.width - 1, im.height - 1), r, fill=255)
    return mask

def shadow(base, box, r, offset=(0, 14), blur=22, alpha=70):
    x0, y0, x1, y1 = box
    pad = blur * 3
    sh = Image.new('L', (x1 - x0 + pad * 2, y1 - y0 + pad * 2), 0)
    ImageDraw.Draw(sh).rounded_rectangle((pad, pad, pad + x1 - x0, pad + y1 - y0), r, fill=alpha)
    sh = sh.filter(ImageFilter.GaussianBlur(blur))
    base.paste(Image.new('RGB', sh.size, '#0E1024'), (x0 - pad + offset[0], y0 - pad + offset[1]), sh)

def tabs(d, x, y_bottom, eyebrow, ground):
    """Stepped binder tabs: the coral inactive tab behind, the blue active tab carrying the
    eyebrow in white DM Mono. Returns the eyebrow metrics."""
    f = mono(EYEBROW_SIZE); sp = 3
    label = eyebrow.upper()
    tw = text_w(f, label, sp)
    w = int(tw + 64); h = 78
    d.rounded_rectangle((x + w - 30, y_bottom - h + 16, x + w + 120, y_bottom + 20), 16, fill=CORAL)
    d.rounded_rectangle((x, y_bottom - h, x + w, y_bottom + 20), 16, fill=BLUE)
    cx = x + 32; cy = y_bottom - h / 2 + 2
    for ch in label:
        d.text((cx, cy), ch, font=f, fill=WHITE, anchor='lm'); cx += f.getlength(ch) + sp
    return {'role': 'eyebrow', 'size': EYEBROW_SIZE, 'lines': [label], 'fit': x + w + 120 <= W, 'ink': WHITE, 'ground': BLUE}

def wordmark(d, x, y, dark=False, scale=1.0):
    """Two stepped binder tabs (blue over coral) + "Dream Wedding", BUILDER beneath."""
    s = scale; ink = IVORY if dark else MIDNIGHT
    d.rounded_rectangle((x + 14 * s, y + 8 * s, x + 50 * s, y + 46 * s), 6 * s, fill=CORAL)
    d.rounded_rectangle((x, y, x + 36 * s, y + 40 * s), 6 * s, fill=BLUE)
    fx = x + 66 * s
    d.text((fx, y - 6 * s), 'Dream ', font=serif(int(40 * s)), fill=ink)
    d.text((fx + serif(int(40 * s)).getlength('Dream '), y - 6 * s), 'Wedding', font=serif_i(int(40 * s)), fill=ink)
    d.text((fx + 2 * s, y + 38 * s), 'B U I L D E R', font=mono(int(15 * s)), fill=BLUE if not dark else '#AEB8F5')

def text_block(d, box, pal, headline, subline, align='left'):
    x0, y0, x1, y1 = box
    width = x1 - x0
    hs, hl, hfit = fit_headline(headline, width)
    ss, sl, sfit = fit_sub(subline, width)
    lh = int(hs * 1.04); sh = int(ss * 1.25)
    total = len(hl) * lh + 34 + len(sl) * sh
    y = y0 + max(0, (y1 - y0 - total) // 2)
    fit = hfit and sfit and total <= (y1 - y0) + 4
    anchor = 'mt' if align == 'centre' else 'lt'
    ax = (x0 + x1) / 2 if align == 'centre' else x0
    for line in hl:
        d.text((ax, y), line, font=serif(hs), fill=pal['ink'], anchor=anchor); y += lh
    y += 34
    for line in sl:
        d.text((ax, y), line, font=sans(ss), fill=pal['sub'], anchor=anchor); y += sh
    return [
        {'role': 'headline', 'size': hs, 'lines': hl, 'fit': hfit and fit, 'ink': pal['ink'], 'ground': pal['bg']},
        {'role': 'subline', 'size': ss, 'lines': sl, 'fit': sfit and fit, 'ink': pal['sub'], 'ground': pal['bg']},
    ]

def render(v):
    pal = PALETTES.get(v['palette'])
    if not pal: raise ValueError(f"{v['id']}: unknown palette {v['palette']}")
    layout = v['layout']; focus = v.get('focus') or (0.5, 0.5)
    dark = pal['bg'] == MIDNIGHT
    pin = Image.new('RGB', (W, H), pal['bg']); d = ImageDraw.Draw(pin)
    m = []
    if layout == 'tab-panel':
        ph = 840
        pin.paste(photo(v['art'], W, ph, focus), (0, 0))
        m.append(tabs(d, 60, ph, v['eyebrow'], pal['bg']))
        d.rectangle((0, ph, W, H), fill=pal['bg'])
        m += text_block(d, (64, ph + 44, W - 64, H - 120), pal, v['headline'], v['subline'])
        wordmark(d, 64, H - 92, dark)
    elif layout == 'header':
        top = 640
        d.rectangle((0, 0, W, top), fill=pal['bg'])
        pin.paste(photo(v['art'], W, H - top, focus), (0, top))
        m.append(tabs(d, 60, 118, v['eyebrow'], pal['bg']))
        m += text_block(d, (64, 186, W - 64, top - 40), pal, v['headline'], v['subline'])
        chip = (W - 330, H - 104, W - 26, H - 26)
        d.rounded_rectangle(chip, 18, fill=IVORY)
        wordmark(d, chip[0] + 22, chip[1] + 20, False, 0.9)
    elif layout == 'card':
        # The photo fills the top 1000px; the card covers only its lower edge, so the
        # subject stays in view.
        # Below the photo: a ground that the card stands out from.
        d.rectangle((0, 1000, W, H), fill=IVORY if pal['bg'] in (MIDNIGHT, BLUE_SOFT, CORAL_SOFT) else BLUE_SOFT)
        pin.paste(photo(v['art'], W, 1000, focus), (0, 0))
        card = (56, 820, W - 56, H - 56)
        shadow(pin, card, 30)
        d = ImageDraw.Draw(pin)
        m.append(tabs(d, 100, card[1] + 4, v['eyebrow'], pal['bg']))
        d.rounded_rectangle(card, 30, fill=pal['bg'])
        m += text_block(d, (card[0] + 52, card[1] + 40, card[2] - 52, card[3] - 108), pal, v['headline'], v['subline'], 'centre')
        wordmark(d, W / 2 - 150, card[3] - 86, dark, 0.95)
    elif layout == 'binder-page':
        frame = (56, 56, W - 110, 800)
        shadow(pin, frame, 20, (0, 10), 16, 60)
        d = ImageDraw.Draw(pin)
        # Stepped tabs on the page's right edge, like a binder divider.
        for i, col in enumerate([BLUE, CORAL, CORAL]):
            ty = 120 + i * 140
            d.rounded_rectangle((frame[2] - 20, ty, frame[2] + 52, ty + 112), 14, fill=col)
        d.rounded_rectangle(frame, 20, fill=WHITE)
        inner = (frame[0] + 74, frame[1] + 24, frame[2] - 24, frame[3] - 24)
        ph = photo(v['art'], inner[2] - inner[0], inner[3] - inner[1], focus)
        pin.paste(ph, inner[:2], rounded(ph, 12))
        for i in range(3):  # punched holes in the page margin
            cy = frame[1] + 150 + i * 220
            d.ellipse((frame[0] + 20, cy - 17, frame[0] + 54, cy + 17), fill=pal['bg'], outline='#C9CCDA', width=2)
        m.append(tabs(d, 60, 902, v['eyebrow'], pal['bg']))
        m += text_block(d, (64, 940, W - 64, H - 112), pal, v['headline'], v['subline'])
        wordmark(d, 64, H - 86, dark)
    elif layout == 'split':
        top = 700
        d.rectangle((0, 0, W, top), fill=pal['bg'])
        wordmark(d, 64, 58, dark)
        m += text_block(d, (64, 140, W - 64, top - 96), pal, v['headline'], v['subline'])
        d.rectangle((0, top, W, top + 14), fill=BLUE)
        pin.paste(photo(v['art'], W, H - top - 14, focus), (0, top + 14))
        m.append(tabs(d, W - 60 - 64 - text_w(mono(EYEBROW_SIZE), v['eyebrow'].upper(), 3) - 120, top, v['eyebrow'], pal['bg']))
    else:
        raise ValueError(f"{v['id']}: unknown layout {layout}")
    return pin, m

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
            pin, metrics = render(req['variant'])
            if pin.size != (W, H): raise ValueError(f'rendered {pin.size}')
            length = save(pin, req['out'])
            reply = {'ok': True, 'length': length, 'width': W, 'height': H, 'text': metrics}
        except Exception as e:
            reply = {'ok': False, 'error': f'{type(e).__name__}: {e}'}
        sys.stdout.write(json.dumps(reply) + '\n'); sys.stdout.flush()

if __name__ == '__main__':
    if '--serve' in sys.argv: serve()
    else:
        v = json.loads(sys.argv[1]); pin, metrics = render(v); save(pin, sys.argv[2]); print(json.dumps(metrics))
