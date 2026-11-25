"""Contact sheets of the shots of a scenario: each picture is cropped of its empty bottom, the main column is kept (the menu is cut), and the sheets carry the caption of each shot.
usage: python sheet.py T1A  [more prefixes]   ->  sheets/<prefix>_<n>.png"""
import os, sys, json
from PIL import Image, ImageDraw, ImageFont
sys.stdout.reconfigure(encoding='utf-8')
HERE = os.path.dirname(os.path.abspath(__file__))
SHOTS = os.path.join(HERE, 'shots')
OUT = os.path.join(HERE, 'sheets')
os.makedirs(OUT, exist_ok=True)
idx = json.load(open(os.path.join(HERE, 'index.json'), encoding='utf-8'))
cap = {x['file']: x['caption'] for x in idx if x['kind'] == 'shot'}
F = ImageFont.truetype('C:/Windows/Fonts/segoeuib.ttf', 17)
BG = (241, 245, 249)


def trimmed(path):
    im = Image.open(path).convert('RGB')
    im = im.crop((320, 56, im.width, im.height - 90))          # the menu and the footer out
    px = im.load()
    last = 0
    for y in range(im.height - 1, 0, -4):
        if any(px[x, y] != (255, 255, 255) and px[x, y] != (249, 250, 251) for x in range(0, im.width, 12)):
            last = y
            break
    return im.crop((0, 0, im.width, min(im.height, last + 30)))


def sheets(prefix, per=4, width=720):
    files = sorted(f for f in os.listdir(SHOTS) if f.startswith(prefix) and f.endswith('.png'))
    for n in range(0, len(files), per):
        group = files[n:n + per]
        tiles = []
        for f in group:
            im = trimmed(os.path.join(SHOTS, f))
            im = im.resize((width, round(im.height * width / im.width)), Image.LANCZOS)
            tiles.append((f, im))
        cols = 2
        rows = [tiles[i:i + cols] for i in range(0, len(tiles), cols)]
        pad, head = 24, 44
        H = sum(max(t[1].height for t in r) + head + pad for r in rows) + pad
        W = cols * width + (cols + 1) * pad
        sheet = Image.new('RGB', (W, H), BG)
        d = ImageDraw.Draw(sheet)
        y = pad
        for r in rows:
            for c, (f, im) in enumerate(r):
                x = pad + c * (width + pad)
                d.text((x, y), (f.split('__')[0] + '  ' + cap.get(f, ''))[:78], font=F, fill=(15, 23, 42))
                d.rectangle((x - 1, y + head - 1, x + im.width, y + head + im.height), outline=(203, 213, 225))
                sheet.paste(im, (x, y + head))
            y += max(t[1].height for t in r) + head + pad
        out = os.path.join(OUT, f'{prefix}_{n // per + 1}.png')
        sheet.save(out, optimize=True)
        print(out, sheet.size)


for p in sys.argv[1:]:
    sheets(p)
