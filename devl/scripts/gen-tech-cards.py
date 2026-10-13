#!/usr/bin/env python3
"""
AI 테크 큐레이션 계정용 인스타 카드 생성기.

요잘알 카드(gen-insta-cards.py)와 달리 음식 사진을 쓰지 않는다.
커버는 인물 사진 위 타이포, 본문은 타이포만 — 매체형 계정이 쓰는 포맷이다.
사진은 컬러가 기본(--photo duo 로 흑백 2톤).

사용:
  python3 scripts/gen-tech-cards.py --content data/tech-cards-sample.json
  python3 scripts/gen-tech-cards.py --content data/x.json --theme light --slug x

인물 사진은 assets/people/ 에 두고 JSON 의 cover_image 로 가리킨다.
라이선스·출처는 assets/people/CREDITS.md 참고 — CC BY 는 캡션 표기가 의무다.

출력: out/tech/<slug>-<theme>/01_cover.png ... (1080x1350, 4:5)
"""
import argparse, json, os, sys
from PIL import Image, ImageDraw, ImageFont, ImageOps, ImageEnhance, ImageFilter

BASE = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..')
A = os.path.join(BASE, 'assets')
F_BOLD = os.path.join(A, 'Pretendard-Bold.otf')
F_SEMI = os.path.join(A, 'Pretendard-SemiBold.otf')
F_MED  = os.path.join(A, 'Pretendard-Medium.otf')
F_REG  = os.path.join(A, 'Pretendard-Regular.otf')

W, H = 1080, 1350
PAD = 84

THEMES = {
    'dark':  {'bg': (10, 10, 12),    'ink': (242, 242, 240), 'dim': (138, 138, 145),
              'accent': (198, 255, 77), 'rule': (42, 42, 48),
              'duo_lo': (12, 13, 18),  'duo_hi': (234, 237, 240)},
    'light': {'bg': (243, 241, 236), 'ink': (18, 18, 20),    'dim': (122, 120, 116),
              'accent': (255, 84, 46), 'rule': (216, 213, 206),
              'duo_lo': (26, 24, 22),  'duo_hi': (246, 244, 240)},
}


def font(p, s):
    return ImageFont.truetype(p, s)


def text_w(d, s, f):
    return d.textbbox((0, 0), s, font=f)[2]


def wrap(d, s, f, max_w):
    """한글은 어절 단위로 끊는 게 읽기 편하다. 어절 하나가 넘치면 글자로 쪼갠다."""
    lines = []
    for para in s.split('\n'):
        if not para.strip():
            lines.append('')
            continue
        cur = ''
        for word in para.split(' '):
            trial = word if not cur else cur + ' ' + word
            if text_w(d, trial, f) <= max_w:
                cur = trial
                continue
            if cur:
                lines.append(cur)
            if text_w(d, word, f) <= max_w:
                cur = word
            else:
                cur = ''
                for ch in word:
                    if text_w(d, cur + ch, f) <= max_w:
                        cur += ch
                    else:
                        lines.append(cur)
                        cur = ch
        if cur:
            lines.append(cur)
    return lines


def soft_shadow(im, items, strength=170, blur=18):
    """글자 뒤에만 그림자를 깐다. 배경 전체를 더 어둡게 하면 사진이 죽는데,
    이 방식은 사진을 그대로 두고 글자만 띄운다."""
    lay = Image.new('L', (W, H), 0)
    ld = ImageDraw.Draw(lay)
    for x, y, text, f in items:
        ld.text((x, y), text, font=f, fill=strength)
    lay = lay.filter(ImageFilter.GaussianBlur(blur))
    im.paste(Image.new('RGB', (W, H), (0, 0, 0)), (0, 0), lay)


def draw_block(d, x, y, lines, f, fill, leading):
    for ln in lines:
        d.text((x, y), ln, font=f, fill=fill)
        y += leading
    return y


# ── 사진 처리 ─────────────────────────────────────────────
def sharpen(im, amount=0):
    """확대한 사진의 또렷함을 되살린다. 없던 디테일이 생기진 않지만
    경계가 서서 눈에는 훨씬 덜 뭉개져 보인다."""
    if not amount:
        return im
    return im.filter(ImageFilter.UnsharpMask(radius=2, percent=int(amount), threshold=3))


def cover_crop(im, w, h, zoom=1.0, fx=0.5, fy=0.32):
    """비율 유지하며 채우고 자른다.
    zoom 을 올리면 더 당겨 찍은 것처럼 되고(얼굴 클로즈업), fx/fy 로 자를 위치를 옮긴다.
    fy 기본값이 0.32 인 건 정중앙으로 자르면 인물 사진에서 이마가 날아가서다."""
    r = max(w / im.width, h / im.height) * zoom
    im = im.resize((max(w, round(im.width * r)), max(h, round(im.height * r))), Image.LANCZOS)
    x = int((im.width - w) * min(max(fx, 0), 1))
    y = int((im.height - h) * min(max(fy, 0), 1))
    return im.crop((x, y, x + w, y + h))


def duotone(im, t):
    """흑백 2톤. 카드마다 색이 튀지 않아 계정 톤이 일정하게 유지된다."""
    g = ImageOps.grayscale(im)
    g = ImageOps.autocontrast(g, cutoff=1)
    duo = ImageOps.colorize(g, black=t['duo_lo'], white=t['duo_hi'])
    return ImageEnhance.Brightness(duo).enhance(0.66)


def colorgrade(im, t):
    """원본 색을 살린다. 채도를 조금 낮추고 대비를 올려야 사진마다 튀는 게 줄어든다."""
    im = ImageOps.autocontrast(im, cutoff=1)
    im = ImageEnhance.Color(im).enhance(0.82)
    im = ImageEnhance.Contrast(im).enhance(1.08)
    return ImageEnhance.Brightness(im).enhance(0.70)


def treat_photo(im, t, mode='color'):
    return duotone(im, t) if mode == 'duo' else colorgrade(im, t)


def scrim(im, t, start=0.22, end=0.94):
    """아래로 갈수록 배경색으로 덮는다. 하단 정렬한 제목이 읽히게 하는 장치."""
    mask = Image.new('L', (W, H), 0)
    px = mask.load()
    y0, y1 = int(H * start), int(H * end)
    for y in range(H):
        if y <= y0:
            v = 0
        elif y >= y1:
            v = 255
        else:
            p = (y - y0) / (y1 - y0)
            v = int(255 * (p * p))       # 제곱이라 위쪽이 덜 덮인다
        for x in range(W):
            px[x, y] = v
    return Image.composite(Image.new('RGB', (W, H), t['bg']), im, mask)


def top_scrim(im, t, depth=0.20, power=0.75):
    """상단을 살짝 덮는다. 밝은 사진이 오면 칩과 메타 글자가 안 보인다."""
    mask = Image.new('L', (W, H), 0)
    px = mask.load()
    y1 = int(H * depth)
    for y in range(y1):
        v = int(255 * power * (1 - y / y1) ** 1.6)
        for x in range(W):
            px[x, y] = v
    return Image.composite(Image.new('RGB', (W, H), t['bg']), im, mask)


def vignette(im, strength=0.5):
    m = Image.new('L', (W, H), 0)
    ImageDraw.Draw(m).ellipse([-W * 0.30, -H * 0.18, W * 1.30, H * 1.18], fill=255)
    m = m.filter(ImageFilter.GaussianBlur(160))
    dark = ImageEnhance.Brightness(im).enhance(1 - strength)
    return Image.composite(im, dark, m)


def grain(im, amount=0.05):
    """미세한 노이즈. 평평한 단색 배경이 인쇄물처럼 보이게 한다."""
    n = Image.effect_noise((W, H), 22).convert('L')
    return Image.blend(im, Image.merge('RGB', (n, n, n)), amount)


# ── 공통 장식 ─────────────────────────────────────────────
def chip(d, x, y, label, t, f):
    tw = text_w(d, label, f)
    h = 64
    d.rounded_rectangle([x, y, x + tw + 52, y + h], radius=h // 2,
                        outline=t['accent'], width=3)
    bb = d.textbbox((0, 0), label, font=f)
    d.text((x + 26, y + (h - (bb[3] - bb[1])) // 2 - bb[1]), label, font=f, fill=t['accent'])


def corner_ticks(d, t, inset=44, L=32):
    """네 모서리 갈고리. 이거 하나로 '대충 만든 카드' 느낌이 사라진다."""
    a, w = t['accent'], 3
    for cx, cy, dx, dy in ((inset, inset, 1, 1), (W - inset, inset, -1, 1),
                           (inset, H - inset, 1, -1), (W - inset, H - inset, -1, -1)):
        d.line([cx, cy, cx + L * dx, cy], fill=a, width=w)
        d.line([cx, cy, cx, cy + L * dy], fill=a, width=w)


def crosshair(d, x, y, t, r=9):
    d.line([x - r, y, x + r, y], fill=t['dim'], width=2)
    d.line([x, y - r, x, y + r], fill=t['dim'], width=2)


def brand_badge(d, x, y, mark, t, size=44):
    """CC 가 쓰는 원형 모노그램. 로고가 없어도 브랜드처럼 보이게 하는 최소 장치."""
    d.ellipse([x, y, x + size, y + size], fill=t['accent'])
    f = font(F_BOLD, int(size * 0.44))
    bb = d.textbbox((0, 0), mark, font=f)
    d.text((x + (size - bb[2]) / 2, y + (size - (bb[3] - bb[1])) / 2 - bb[1]),
           mark, font=f, fill=t['bg'])


def footer(d, t, handle, right=None, mark=None):
    y = H - 96
    ry = y - 40
    d.line([PAD, ry, W - PAD, ry], fill=t['rule'], width=2)
    # 자를 닮은 눈금. 여백이 비어 보이지 않게 잡아준다.
    for i in range(0, (W - PAD * 2) // 200 + 1):
        x = PAD + i * 200
        d.line([x, ry, x, ry + 14], fill=t['rule'], width=2)
    f = font(F_MED, 34)
    hx = PAD
    if mark:
        brand_badge(d, PAD, y - 12, mark, t, 54)
        hx = PAD + 70
    d.text((hx, y), handle, font=f, fill=t['dim'])
    if right:
        d.text((W - PAD - text_w(d, right, f), y), right, font=f, fill=t['accent'])


def meta_top_right(d, t, s):
    f = font(F_MED, 30)
    d.text((W - PAD - text_w(d, s, f), PAD + 18), s, font=f, fill=t['dim'])


def contain(src, t, mode, blur, dim, pos):
    """가로로 긴 사진을 좌우 안 자르고 넣는다. 꽉 채워 자르면 양 끝 인물이 날아가고
    확대율도 커져서 화질이 무너진다. 뒤는 같은 사진을 크게 흐려 깔아 빈 곳을 메운다."""
    back = cover_crop(src, W, H).filter(ImageFilter.GaussianBlur(30))
    back = ImageEnhance.Brightness(treat_photo(back, t, mode)).enhance(0.5)

    fh = round(src.height * W / src.width)
    fg = src.resize((W, fh), Image.LANCZOS)
    if blur:
        fg = fg.filter(ImageFilter.GaussianBlur(blur))
    fg = treat_photo(fg, t, mode)
    if dim != 1.0:
        fg = ImageEnhance.Brightness(fg).enhance(dim)
    back.paste(fg, (0, int((H - fh) * pos)))
    return back


def canvas(t, image=None, photo_scrim=(0.22, 0.94), mode='color', blur=0, dim=1.0,
           fit='cover', pos=0.18, zoom=1.0, focus=(0.5, 0.32), sharp=0):
    if image and os.path.exists(image):
        src = Image.open(image).convert('RGB')
        if fit == 'contain':
            im = contain(src, t, mode, blur, dim, pos)
            im = scrim(im, t, *photo_scrim)
            im = top_scrim(im, t)
            im = vignette(im, 0.45)
            im = grain(im, 0.05)
            return im, ImageDraw.Draw(im)
        im = sharpen(cover_crop(src, W, H, zoom, focus[0], focus[1]), sharp)
        # 배경에 글자가 많은 이미지(영화 포스터 등)는 블러로 물러나게 한다.
        # 안 그러면 원본의 문구가 우리 헤드라인과 싸운다.
        if blur:
            im = im.filter(ImageFilter.GaussianBlur(blur))
        im = treat_photo(im, t, mode)
        if dim != 1.0:
            im = ImageEnhance.Brightness(im).enhance(dim)
        im = scrim(im, t, *photo_scrim)
        im = top_scrim(im, t)
        im = vignette(im, 0.45)
    else:
        im = Image.new('RGB', (W, H), t['bg'])
        im = vignette(im, 0.18)
    im = grain(im, 0.05)
    return im, ImageDraw.Draw(im)


# ── 카드 ──────────────────────────────────────────────────
def card_cover(c, t):
    im, d = canvas(t, c.get('cover_image'), mode=c.get('photo_mode', 'color'),
                   blur=c.get('photo_blur', 0), dim=c.get('photo_dim', 1.0),
                   fit=c.get('photo_fit', 'cover'), pos=c.get('photo_pos', 0.18),
                   zoom=c.get('photo_zoom', 1.0),
                   focus=tuple(c.get('photo_focus', (0.5, 0.32))),
                   sharp=c.get('photo_sharpen', 0))
    chip(d, PAD, PAD, c.get('label', 'AI'), t, font(F_SEMI, 34))
    meta_top_right(d, t, c.get('issue', ''))
    corner_ticks(d, t)

    # 줄바꿈을 직접 넣은 문장이 폭을 넘으면 글자를 줄여 그 줄 수를 지킨다.
    # 안 그러면 두 줄로 쓴 게 세 줄로 접혀서 균형이 깨진다.
    want = len([ln for ln in c['title'].split('\n') if ln.strip()])
    size = int(c.get('title_size', 104))
    acc_txt = c.get('title_accent') or ''
    while size > 54:
        f_title = font(F_BOLD, size)
        lines = wrap(d, c['title'], f_title, W - PAD * 2)
        # 강조어도 같은 크기로 그리므로 폭 검사에 같이 넣는다
        if len(lines) <= want and text_w(d, acc_txt, f_title) <= W - PAD * 2:
            break
        size -= 4
    lead = int(size * 1.23)
    accent = c.get('title_accent')
    total = lead * (len(lines) + (1 if accent else 0))
    y = H - 250 - total

    # 인물 사진을 쓰면 누구인지 한 줄로 밝힌다. 초상권 시비를 줄이는 최소한의 장치.
    f_cap = font(F_SEMI, 32)
    if c.get('cover_image') and os.path.exists(c['cover_image']):
        sh = [(PAD, y + i*lead, ln, f_title) for i, ln in enumerate(lines)]
        if accent:
            sh.append((PAD, y + len(lines)*lead, accent, f_title))
        if c.get('cover_caption'):
            sh.append((PAD, y - 60, c['cover_caption'], f_cap))
        soft_shadow(im, sh)

    if c.get('cover_caption'):
        d.text((PAD, y - 60), c['cover_caption'], font=f_cap, fill=t['accent'])

    y = draw_block(d, PAD, y, lines, f_title, t['ink'], lead)
    if accent:
        d.text((PAD, y), accent, font=f_title, fill=t['accent'])

    footer(d, t, c['handle'], '밀어서 보기 →', c.get('brand_mark'))
    return im


def card_item(c, t, idx, item, total):
    # 항목 카드에도 사진을 넣을 수 있게 열어둔다. 없으면 단색.
    im, d = canvas(t, item.get('image'), photo_scrim=(0.05, 0.72),
                   mode=c.get('photo_mode', 'color'),
                   blur=c.get('photo_blur', 0), dim=c.get('photo_dim', 1.0),
                   fit=c.get('photo_fit', 'cover'), pos=c.get('photo_pos', 0.18),
                   zoom=c.get('photo_zoom', 1.0),
                   focus=tuple(c.get('photo_focus', (0.5, 0.32))),
                   sharp=c.get('photo_sharpen', 0))
    chip(d, PAD, PAD, c.get('label', 'AI'), t, font(F_SEMI, 34))
    meta_top_right(d, t, f'{idx:02d} / {total:02d}')
    corner_ticks(d, t)

    f_num = font(F_BOLD, 132)
    f_of = font(F_MED, 36)
    f_head = font(F_BOLD, 76)
    f_body = font(F_REG, 40)

    head = wrap(d, item['head'], f_head, W - PAD * 2)
    body = wrap(d, item['body'], f_body, W - PAD * 2)

    cap = item.get('caption')
    block = 150 + 94 * len(head) + 52 + 66 * len(body) + (58 if cap else 0)
    y = H - 250 - block

    if cap:
        d.text((PAD, y), cap, font=font(F_SEMI, 32), fill=t['accent'])
        y += 58
    d.text((PAD - 6, y - 24), f'{idx:02d}', font=f_num, fill=t['accent'])
    nw = text_w(d, f'{idx:02d}', f_num)
    d.text((PAD + nw + 14, y + 74), f'/ {total:02d}', font=f_of, fill=t['dim'])
    crosshair(d, W - PAD - 10, y + 40, t)

    if item.get('image') and os.path.exists(item['image']):
        sh = [(PAD - 6, y - 24, f'{idx:02d}', f_num)]
        sh += [(PAD, y + 150 + i*94, ln, f_head) for i, ln in enumerate(head)]
        sh += [(PAD, y + 150 + len(head)*94 + 52 + i*66, ln, f_body)
               for i, ln in enumerate(body)]
        soft_shadow(im, sh, strength=150, blur=16)
        d.text((PAD - 6, y - 24), f'{idx:02d}', font=f_num, fill=t['accent'])
        if cap:
            d.text((PAD, y - 64), cap, font=font(F_SEMI, 32), fill=t['accent'])

    y = draw_block(d, PAD, y + 150, head, f_head, t['ink'], 94)
    draw_block(d, PAD, y + 52, body, f_body, t['dim'], 66)

    footer(d, t, c['handle'], f'{idx} / {total}', c.get('brand_mark'))
    return im


def card_outro(c, t):
    im, d = canvas(t, c.get('outro_image'), mode=c.get('photo_mode', 'color'))
    chip(d, PAD, PAD, c.get('label', 'AI'), t, font(F_SEMI, 34))
    corner_ticks(d, t)

    f_head = font(F_BOLD, 88)
    f_body = font(F_MED, 38)
    lines = wrap(d, c.get('outro_head', ''), f_head, W - PAD * 2)
    body = wrap(d, c.get('outro_body', ''), f_body, W - PAD * 2)

    total = 112 * len(lines) + 56 + 60 * len(body) + 104
    y = H - 250 - total
    y = draw_block(d, PAD, y, lines, f_head, t['ink'], 112)
    y = draw_block(d, PAD, y + 56, body, f_body, t['dim'], 60)
    d.text((PAD, y + 48), '저장 · 팔로우', font=font(F_BOLD, 40), fill=t['accent'])

    footer(d, t, c['handle'], None, c.get('brand_mark'))
    return im


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--content', required=True)
    ap.add_argument('--theme', default='dark', choices=list(THEMES))
    ap.add_argument('--slug', default=None)
    ap.add_argument('--handle', default=None)
    ap.add_argument('--photo', choices=['color', 'duo'], default=None,
                    help='color=원본 색 유지(기본), duo=흑백 2톤')
    ap.add_argument('--out', default=os.path.join(BASE, 'out', 'tech'))
    args = ap.parse_args()

    for p in (F_BOLD, F_SEMI, F_MED, F_REG):
        if not os.path.exists(p):
            sys.exit(f'폰트 없음: {p}')

    with open(args.content, encoding='utf-8') as fp:
        c = json.load(fp)
    if args.handle:
        c['handle'] = args.handle
    if args.photo:
        c['photo_mode'] = args.photo

    # JSON 의 이미지 경로는 assets/ 기준 상대경로로 적는다.
    def fix(p):
        return p if not p or os.path.isabs(p) else os.path.join(A, p)
    c['cover_image'] = fix(c.get('cover_image'))
    c['outro_image'] = fix(c.get('outro_image'))
    for it in c['items']:
        it['image'] = fix(it.get('image'))

    t = THEMES[args.theme]
    slug = args.slug or os.path.splitext(os.path.basename(args.content))[0]
    outdir = os.path.join(args.out, f'{slug}-{args.theme}')
    os.makedirs(outdir, exist_ok=True)

    pages = [('01_cover', card_cover(c, t))]
    n = len(c['items'])
    for i, item in enumerate(c['items'], 1):
        pages.append((f'{i + 1:02d}_item', card_item(c, t, i, item, n)))
    if c.get('outro_head'):
        pages.append((f'{n + 2:02d}_outro', card_outro(c, t)))

    for name, im in pages:
        p = os.path.join(outdir, f'{name}.png')
        im.save(p, 'PNG')
        print('✓', p)
    print(f'\n{len(pages)}장 · {W}x{H} · theme={args.theme}')


if __name__ == '__main__':
    main()
