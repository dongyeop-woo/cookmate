#!/usr/bin/env python3
"""
썸네일 그리드 카드 생성기 — 한 장에 여러 개를 늘어놓는 "모음" 포맷.

    python3 scripts/gen-grid-cards.py --content data/grid-sample.json

큐레이션 계정이 쓰는 형식이다. 캐러셀보다 저장·공유가 잘 되는 대신
개별 설명을 못 넣으니, "목록 자체가 콘텐츠"인 주제에만 쓴다.

JSON 형식
  bg          배경 hex. 단색이 기본이지만 진한 색을 깔면 썸네일이 살아난다
  tile_ratio  "2:3"=포스터, "1:1"=정사각(음식·제품), "16:9"=가로
  cols        가로 칸 수. 타일 크기는 개수에 맞춰 자동으로 줄어든다
  tiles       [{image, name}] — image 는 assets/ 기준 상대경로 또는 URL

출력: out/grid/<slug>/01.png (1080x1350)
"""
import argparse, io, json, math, os, sys, urllib.request
from PIL import Image, ImageDraw, ImageFont, ImageFilter

BASE = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..')
A = os.path.join(BASE, 'assets')
F_BOLD = os.path.join(A, 'Pretendard-Bold.otf')
F_SEMI = os.path.join(A, 'Pretendard-SemiBold.otf')
F_MED = os.path.join(A, 'Pretendard-Medium.otf')

W, H = 1080, 1350
PAD = 56
RATIOS = {'2:3': (2, 3), '1:1': (1, 1), '3:4': (3, 4), '16:9': (16, 9)}


def font(p, s):
    return ImageFont.truetype(p, s)


def hexcolor(s, fallback=(24, 22, 60)):
    s = (s or '').lstrip('#')
    if len(s) != 6:
        return fallback
    try:
        return tuple(int(s[i:i+2], 16) for i in (0, 2, 4))
    except ValueError:
        return fallback


def readable(bg):
    """배경 밝기로 글자색을 정한다. 배경색을 바꿀 때마다 글자색까지 손대면 귀찮다."""
    lum = 0.2126*bg[0] + 0.7152*bg[1] + 0.0722*bg[2]
    return ((20, 20, 24), (70, 70, 78)) if lum > 150 else ((255, 255, 255), (198, 198, 214))


def load_image(src):
    if not src:
        return None
    try:
        if src.startswith(('http://', 'https://')):
            req = urllib.request.Request(src, headers={'User-Agent': 'cookmate-grid/1.0'})
            return Image.open(io.BytesIO(urllib.request.urlopen(req, timeout=30).read())).convert('RGB')
        p = src if os.path.isabs(src) else os.path.join(A, src)
        return Image.open(p).convert('RGB') if os.path.exists(p) else None
    except Exception:
        return None


def cover_crop(im, w, h):
    r = max(w / im.width, h / im.height)
    im = im.resize((max(1, round(im.width*r)), max(1, round(im.height*r))), Image.LANCZOS)
    x, y = (im.width - w)//2, int((im.height - h)*0.35)
    return im.crop((x, y, x+w, y+h))


def rounded(im, radius):
    m = Image.new('L', im.size, 0)
    ImageDraw.Draw(m).rounded_rectangle([0, 0, im.size[0]-1, im.size[1]-1], radius, fill=255)
    out = Image.new('RGBA', im.size)
    out.paste(im, (0, 0), m)
    return out


def fit_text(d, s, path, max_w, size, min_size=13):
    """칸 폭에 맞춰 글자를 줄인다. 그래도 넘치면 말줄임."""
    while size > min_size:
        f = font(path, size)
        if d.textbbox((0, 0), s, font=f)[2] <= max_w:
            return s, f
        size -= 1
    f = font(path, min_size)
    while s and d.textbbox((0, 0), s + '…', font=f)[2] > max_w:
        s = s[:-1]
    return (s + '…') if s else s, f


def build(c):
    bg = hexcolor(c.get('bg'))
    ink, dim = readable(bg)
    accent = hexcolor(c.get('accent'), ink)
    im = Image.new('RGB', (W, H), bg)
    d = ImageDraw.Draw(im)

    tiles = c['tiles']
    cols = int(c.get('cols') or min(5, max(2, round(math.sqrt(len(tiles)*W/H)))))
    rows = math.ceil(len(tiles) / cols)
    rw, rh = RATIOS.get(c.get('tile_ratio', '2:3'), (2, 3))

    # ── 상단
    y = PAD
    if c.get('mark'):
        d.text((PAD, y), c['mark'], font=font(F_BOLD, 30), fill=ink)
    if c.get('tagline'):
        f = font(F_SEMI, 26)
        tw = d.textbbox((0, 0), c['tagline'], font=f)[2]
        d.text(((W - tw)//2, y + 2), c['tagline'], font=f, fill=ink)
    top = y + 78

    # ── 하단 (제목·부제는 아래에 둔다. 그리드가 먼저 읽혀야 한다)
    bot = H - PAD
    if c.get('subtitle'):
        f = font(F_MED, 28)
        tw = d.textbbox((0, 0), c['subtitle'], font=f)[2]
        bot -= 38
        d.text(((W - tw)//2, bot), c['subtitle'], font=f, fill=dim)
    if c.get('title'):
        f = font(F_BOLD, 44)
        tw = d.textbbox((0, 0), c['title'], font=f)[2]
        bot -= 26
        d.line([(W-260)//2, bot, (W+260)//2, bot], fill=dim, width=2)
        bot -= 62
        d.text(((W - tw)//2, bot), c['title'], font=f, fill=ink)
    if c.get('handle'):
        f = font(F_MED, 24)
        d.text((PAD, H - PAD - 24), c['handle'], font=f, fill=dim)
    bot -= 34

    # ── 타일 크기: 세로로 먼저 맞추고, 가로가 넘치면 가로 기준으로 다시
    gap, label_h = 14, 30
    avail_w, avail_h = W - PAD*2, bot - top
    tile_h = (avail_h - gap*(rows-1)) / rows - label_h
    tile_w = tile_h * rw / rh
    if tile_w*cols + gap*(cols-1) > avail_w:
        tile_w = (avail_w - gap*(cols-1)) / cols
        tile_h = tile_w * rh / rw
    tile_w, tile_h = int(tile_w), int(tile_h)

    grid_w = tile_w*cols + gap*(cols-1)
    grid_h = (tile_h + label_h)*rows + gap*(rows-1)
    x0 = (W - grid_w)//2
    y0 = top + max(0, (avail_h - grid_h)//2)

    f_name = font(F_MED, 19)
    for i, t in enumerate(tiles):
        r, cc = divmod(i, cols)
        x = x0 + cc*(tile_w + gap)
        yy = y0 + r*(tile_h + label_h + gap)
        src = load_image(t.get('image'))
        if src:
            im.paste(rounded(cover_crop(src, tile_w, tile_h), 10), (x, yy),
                     rounded(cover_crop(src, tile_w, tile_h), 10))
        else:
            # 이미지가 없어도 자리를 남겨 레이아웃이 안 무너지게
            d.rounded_rectangle([x, yy, x+tile_w, yy+tile_h], 10,
                                fill=tuple(min(255, v+22) for v in bg))
        name, fn = fit_text(d, t.get('name', ''), F_MED, tile_w, 19)
        nw = d.textbbox((0, 0), name, font=fn)[2]
        d.text((x + (tile_w-nw)//2, yy + tile_h + 7), name, font=fn, fill=ink)

    return im


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--content', required=True)
    ap.add_argument('--slug', default=None)
    ap.add_argument('--out', default=os.path.join(BASE, 'out', 'grid'))
    a = ap.parse_args()

    c = json.load(open(a.content, encoding='utf-8'))
    slug = a.slug or os.path.splitext(os.path.basename(a.content))[0]
    d = os.path.join(a.out, slug)
    os.makedirs(d, exist_ok=True)
    p = os.path.join(d, '01.png')
    build(c).save(p, 'PNG')
    print(f'✓ {p}  ({len(c["tiles"])}칸)')


if __name__ == '__main__':
    main()
