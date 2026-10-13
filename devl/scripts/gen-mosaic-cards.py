#!/usr/bin/env python3
"""
모자이크 모음 카드 — 한 장에 여러 명/여러 개를 늘어놓되, 균일 그리드로 안 만든다.

    python3 scripts/gen-mosaic-cards.py --content data/mosaic-ai-people.json

큐레이션 계정이 쓰는 "TOP N 모음" 포맷인데, 흔한 대칭 그리드(가운데 정렬 ·
아래 제목 · 균일 타일)와 정반대로 짰다.

  - 첫 칸을 2x2 히어로로 키워 시선 진입점을 만든다
  - 제목은 위, 왼쪽 정렬. 아래 가운데 정렬은 쓰지 않는다
  - 이름은 타일 아래 왼쪽에 2줄(이름/소속)
  - 모서리 갈고리 · 눈금자 푸터 · 그레인은 gen-tech-cards 와 공유한다
    (같은 계정 게시물로 읽혀야 한다)

출력: out/mosaic/<slug>/01.png (1080x1350)
"""
import argparse, importlib.util, io, json, math, os, sys, urllib.request
from PIL import Image, ImageDraw, ImageFont

BASE = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..')
A = os.path.join(BASE, 'assets')

_spec = importlib.util.spec_from_file_location(
    'gen_tech_cards', os.path.join(BASE, 'scripts', 'gen-tech-cards.py'))
tech = importlib.util.module_from_spec(_spec)
sys.modules['gen_tech_cards'] = tech
_spec.loader.exec_module(tech)

W, H = tech.W, tech.H
PAD = 72
GAP = 12
COLS = 4
F_BOLD, F_SEMI, F_MED = tech.F_BOLD, tech.F_SEMI, tech.F_MED


def font(p, s):
    return ImageFont.truetype(p, s)


def load_image(src):
    if not src:
        return None
    try:
        if src.startswith(('http://', 'https://')):
            req = urllib.request.Request(src, headers={'User-Agent': 'cookmate-mosaic/1.0'})
            return Image.open(io.BytesIO(urllib.request.urlopen(req, timeout=30).read())).convert('RGB')
        p = src if os.path.isabs(src) else os.path.join(A, src)
        return Image.open(p).convert('RGB') if os.path.exists(p) else None
    except Exception:
        return None


def tile_image(im, w, h, t, mode, treat=True):
    """얼굴 위쪽을 더 남기고 자른다. 정중앙이면 이마가 잘린다.
    포스터는 이미 완성된 디자인이라 톤 보정을 걸면 탁해진다 — treat=False 로 원본을 쓴다."""
    r = max(w / im.width, h / im.height)
    im = im.resize((max(1, round(im.width*r)), max(1, round(im.height*r))), Image.LANCZOS)
    x, y = (im.width - w)//2, int((im.height - h)*(0.26 if treat else 0.5))
    im = im.crop((x, y, x+w, y+h))
    return tech.treat_photo(im, t, mode) if treat else im


def rounded_mask(size, radius):
    m = Image.new('L', size, 0)
    ImageDraw.Draw(m).rounded_rectangle([0, 0, size[0]-1, size[1]-1], radius, fill=255)
    return m


def fit(d, s, path, max_w, size, min_size=11):
    while size > min_size:
        f = font(path, size)
        if d.textbbox((0, 0), s, font=f)[2] <= max_w:
            return s, f
        size -= 1
    f = font(path, min_size)
    while s and d.textbbox((0, 0), s + '…', font=f)[2] > max_w:
        s = s[:-1]
    return (s + '…') if s else s, f


def cells(n):
    """히어로(2x2) 를 왼쪽 위에 놓고 나머지를 읽는 순서로 채운다."""
    rows = math.ceil((n + 3) / COLS)
    rows = max(rows, 2)
    taken = {(0, 0), (0, 1), (1, 0), (1, 1)}
    out = [(0, 0, 2, 2)]                      # (col, row, w, h)
    for r in range(rows):
        for c in range(COLS):
            if (c, r) in taken or len(out) >= n:
                continue
            out.append((c, r, 1, 1))
    return out, rows


def text_tiles(im, d, c, t, top, bot):
    """사진 없이 글자만으로 채우는 타일. 포스터처럼 저작권이 걸린 이미지를
    못 쓸 때 쓴다. 빈 칸으로 두는 것보다 의도된 디자인으로 보인다."""
    tiles = c['tiles']
    cols = int(c.get('cols') or 3)
    rows = math.ceil(len(tiles) / cols)
    tw = (W - PAD*2 - GAP*(cols-1)) / cols
    th = ((bot - top) - GAP*(rows-1)) / rows
    tw, th = int(tw), int(th)

    panel = tuple(min(255, v + 13) for v in t['bg'])
    f_num = font(F_BOLD, 21)
    f_meta = font(F_MED, 17)

    for i, item in enumerate(tiles):
        r, cc = divmod(i, cols)
        x = PAD + cc*(tw + GAP)
        y = top + r*(th + GAP)
        d.rounded_rectangle([x, y, x+tw, y+th], 12, fill=panel)
        # 왼쪽 세로 막대 하나로 카드마다 강조색을 남긴다
        d.rounded_rectangle([x, y+16, x+4, y+th-16], 2, fill=t['accent'])

        # 번호·제목·메타를 한 덩어리로 묶어 타일 안에서 세로 가운데에 놓는다.
        # 위아래로 흩어 놓으면 칸이 클수록 가운데가 비어 보인다.
        name = item.get('name', '')
        lines, size, f = [], 27, font(F_BOLD, 27)
        while size >= 18:
            f = font(F_BOLD, size)
            lines = tech.wrap(d, name, f, tw - 44)
            if len(lines) <= 2:
                break
            size -= 2
        lines = lines[:2]
        meta = item.get('org', '')

        block = 30 + (size + 6)*len(lines) + (24 if meta else 0)
        ty = y + max(16, (th - block)//2)

        d.text((x+22, ty), f'{i+1:02d}', font=f_num, fill=t['accent'])
        ty += 30
        for ln in lines:
            d.text((x+22, ty), ln, font=f, fill=t['ink'])
            ty += size + 6
        if meta:
            d.text((x+22, ty + 4), meta, font=f_meta, fill=t['dim'])


def poster_tiles(im, d, c, t, top, bot):
    """포스터 그리드. 2:3 타일 + 아래 2줄 라벨(제목/연도).
    한글 제목은 길어서 한 줄에 안 들어가는 게 많아 두 줄까지 접는다."""
    tiles = c['tiles']
    cols = int(c.get('cols') or 5)
    rows = math.ceil(len(tiles) / cols)
    mode = c.get('photo_mode', 'color')
    pad = int(c.get('grid_pad', PAD))
    gap = int(c.get('grid_gap', GAP))

    tw = int((W - pad*2 - gap*(cols-1)) / cols)
    th = int(tw * 3 / 2)
    label_h = int(c.get('label_h', 78))
    grid_h = (th + label_h)*rows + gap*(rows-1)
    y0 = top + max(0, ((bot - top) - grid_h)//2)

    f_name = font(F_SEMI, int(c.get('name_size', 20)))
    f_year = font(F_MED, int(c.get('year_size', 17)))
    for i, item in enumerate(tiles):
        r, cc = divmod(i, cols)
        x = pad + cc*(tw + gap)
        y = y0 + r*(th + label_h + gap)

        src = load_image(item.get('image'))
        if src:
            pic = tile_image(src, tw, th, t, mode, treat=(mode == 'duo'))
            im.paste(pic, (x, y), rounded_mask((tw, th), 8))
        else:
            d.rounded_rectangle([x, y, x+tw, y+th], 8, fill=t['rule'])
            n, fn = fit(d, item.get('name', ''), F_SEMI, tw-16, 17)
            d.text((x+8, y + th//2 - 10), n, font=fn, fill=t['dim'])

        # 번호를 포스터 위에 겹쳐 얹는다. 목록이라는 게 먼저 읽혀야 한다
        d.rounded_rectangle([x+6, y+6, x+34, y+30], 6, fill=t['bg'])
        d.text((x+13, y+9), f'{i+1:02d}', font=font(F_BOLD, 15), fill=t['accent'])

        ny = y + th + 9
        lines = tech.wrap(d, item.get('name', ''), f_name, tw)
        for ln in lines[:2]:
            d.text((x, ny), ln, font=f_name, fill=t['ink'])
            ny += int(f_name.size * 1.3)
        if item.get('org'):
            d.text((x, ny + 2), item['org'], font=f_year, fill=t['dim'])


def build(c):
    t = tech.THEMES[c.get('theme', 'dark')]
    mode = c.get('photo_mode', 'color')
    tiles = c['tiles']

    im = Image.new('RGB', (W, H), t['bg'])
    im = tech.vignette(im, 0.18)
    im = tech.grain(im, 0.05)
    d = ImageDraw.Draw(im)

    tech.chip(d, PAD, PAD, c.get('label', 'AI'), t, font(F_SEMI, 34))
    tech.meta_top_right(d, t, c.get('issue', ''))

    # ── 제목: 위 · 왼쪽. 흔한 모음 카드는 아래 가운데라 일부러 반대로 둔다
    y = PAD + 92
    f_title = font(F_BOLD, int(c.get('title_size', 66)))
    lines = tech.wrap(d, c['title'], f_title, W - PAD*2)
    lead = int(int(c.get('title_size', 66)) * 1.21)
    for ln in lines:
        d.text((PAD, y), ln, font=f_title, fill=t['ink'])
        y += lead
    if c.get('title_accent'):
        d.text((PAD, y), c['title_accent'], font=f_title, fill=t['accent'])
        y += lead
    if c.get('kicker'):
        d.text((PAD, y + 4), c['kicker'], font=font(F_MED, 26), fill=t['dim'])
        y += 44

    # ── 타일
    if c.get('layout') == 'poster':
        poster_tiles(im, d, c, t, y + 26, H - 150)
        tech.corner_ticks(d, t)
        tech.footer(d, t, c.get('handle', ''), c.get('footer_right') or f'{len(tiles)}편')
        return im

    if c.get('layout') == 'text':
        text_tiles(im, d, c, t, y + 26, H - 150)
        tech.corner_ticks(d, t)
        tech.footer(d, t, c.get('handle', ''),
                    c.get('footer_right') or f'{len(tiles)}편', c.get('brand_mark'))
        return im

    plan, rows = cells(len(tiles))
    grid_top = y + 26
    grid_bot = H - 150
    label_h = 46
    tw = (W - PAD*2 - GAP*(COLS-1)) / COLS
    cell_h = tw + label_h
    total_h = cell_h*rows + GAP*(rows-1)
    if total_h > grid_bot - grid_top:                 # 넘치면 폭을 줄여 맞춘다
        tw = ((grid_bot - grid_top) - GAP*(rows-1)) / rows - label_h
        cell_h = tw + label_h
    tw = int(tw)
    cell_h = int(cell_h)
    x0 = PAD
    y0 = grid_top

    f_hero = font(F_SEMI, 27)
    f_horg = font(F_MED, 21)
    for (col, row, cw, ch), item in zip(plan, tiles):
        bw = tw*cw + GAP*(cw-1)
        bh = tw*ch + GAP*(ch-1)
        x = x0 + col*(tw + GAP)
        yy = y0 + row*(cell_h + GAP)

        src = load_image(item.get('image'))
        if src:
            pic = tile_image(src, bw, bh, t, mode)
            im.paste(pic, (x, yy), rounded_mask((bw, bh), 12))
        else:
            d.rounded_rectangle([x, yy, x+bw, yy+bh], 12, fill=t['rule'])

        hero = cw > 1
        fn_n, fn_o = (f_hero, f_horg) if hero else (None, None)
        name, fn = (fn_n, ) and (item.get('name', ''), fn_n) if hero else \
                   fit(d, item.get('name', ''), F_SEMI, bw, 18)
        d.text((x, yy + bh + 9), name, font=fn, fill=t['ink'])
        org = item.get('org', '')
        if org:
            o, fo = (org, fn_o) if hero else fit(d, org, F_MED, bw, 14)
            d.text((x, yy + bh + 9 + (34 if hero else 24)), o, font=fo, fill=t['dim'])

    tech.corner_ticks(d, t)
    tech.footer(d, t, c.get('handle', ''), c.get('footer_right') or f'{len(tiles)}인',
                c.get('brand_mark'))
    return im


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--content', required=True)
    ap.add_argument('--slug', default=None)
    ap.add_argument('--out', default=os.path.join(BASE, 'out', 'mosaic'))
    a = ap.parse_args()
    c = json.load(open(a.content, encoding='utf-8'))
    slug = a.slug or os.path.splitext(os.path.basename(a.content))[0]
    dd = os.path.join(a.out, slug)
    os.makedirs(dd, exist_ok=True)
    p = os.path.join(dd, '01.png')
    build(c).save(p, 'PNG')
    print(f'✓ {p}  ({len(c["tiles"])}칸)')


if __name__ == '__main__':
    main()
