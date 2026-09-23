#!/usr/bin/env python3
"""
인스타그램 레시피 모음 카드 생성기 (요잘알 브랜드 톤).

사용:
  python3 scripts/gen-insta-cards.py --title "환절기 보양 국물" --ids 213,205,101,208
  python3 scripts/gen-insta-cards.py --title "자취 야식 모음" --ids 211,213,215,210 --sub "10분이면 끝"

준비물: assets/fonts/BMJUA.otf (배달의민족 주아체).
        라이선스상 폰트 파일은 저장소에 올리지 않으므로 직접 받아 두어야 한다.
        https://www.woowahan.com/fonts

출력: out/insta/<slug>/01_cover.png, 02_grid.png, 03_grid.png ...
      1080x1080, 커버 1장 + 레시피 4개당 그리드 1장.

레시피 데이터·이미지는 라이브 API 에서 받는다(로컬 recipes.json 은 시드용이라 뒤처진다).
글자는 코드로 그리므로 한글이 깨지지 않는다. AI 생성 표기는 넣지 않는다 —
캡션에 직접 쓰기로 했다.
"""
import argparse, colorsys, io, json, os, re, sys, urllib.request
from PIL import Image, ImageDraw, ImageFont, ImageFilter

API = 'https://yojalal.com/api/recipes'
FONT = os.path.join(os.path.dirname(__file__), '..', 'assets', 'fonts', 'BMJUA.otf')
# 본문 보조용 — 주아체는 굵기가 하나뿐이라 작은 글씨에서 가독성이 떨어진다.
FONT_BODY = '/System/Library/Fonts/AppleSDGothicNeo.ttc'
W = H = 1080

# 앱에서 쓰는 브랜드 색 그대로
GREEN      = (27, 174, 116)
GREEN_DEEP = (20, 184, 111)
GREEN_PALE = (217, 241, 227)
# 제목용 강조색 — 앱에서 쓰는 노랑/주황 그대로. 따뜻한 음식 사진 위에서
# 초록은 가라앉아서 줄마다 번갈아 쓴다.
INK        = (26, 26, 26)
WHITE      = (255, 255, 255)

# ── 조절값 ────────────────────────────────────────────────
# scripts/insta-tuner.py 로 눈으로 보며 맞춘 뒤 data/insta-style.json 에 저장된다.
STYLE_DEFAULT = {
    'title_max': 150,      # 제목 최대 글자 크기
    'stroke_white': 8,     # 흰 테두리 = size / 이 값 (작을수록 두꺼움)
    'stroke_black': 15,    # 검정 테두리
    'mascot_scale': 1.05,  # 마지막 글자 폭 대비 마스코트 크기
    'mascot_dy': 4,        # 마스코트 세로 미세조정 (+ 아래 / - 위)
    'mascot_dx': 0,        # 마스코트 좌우 미세조정 (+ 오른쪽 / - 왼쪽)
    'hue_shift': 0.055,    # 두 줄 색 차이
    'mark_size': 150,      # 오른쪽 위 셰프모자 크기
}
STYLE_FILE = os.path.join(os.path.dirname(__file__), '..', 'data', 'insta-style.json')

def load_style():
    st = dict(STYLE_DEFAULT)
    if os.path.exists(STYLE_FILE):
        try:
            st.update(json.load(open(STYLE_FILE, encoding='utf-8')))
        except Exception as e:
            print(f'[insta] 스타일 파일 무시 — {e}')
    return st

STYLE = load_style()

def font(size, weight='regular'):
    """제목·강조는 주아체. 주아체는 단일 굵기라 weight 는 무시된다."""
    return ImageFont.truetype(FONT, size)

def body(size, weight='regular'):
    """재료·단계처럼 작고 긴 글은 애플고딕 — 주아체는 작을수록 뭉갠다."""
    idx = {'regular': 0, 'medium': 2, 'semibold': 4, 'bold': 6}[weight]
    return ImageFont.truetype(FONT_BODY, size, index=idx)

UA = {'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 '
                    '(KHTML, like Gecko) Chrome/126.0 Safari/537.36'}

def _get(url):
    """기본 User-Agent 는 Cloudflare 가 403 으로 막는다."""
    return urllib.request.urlopen(urllib.request.Request(url, headers=UA), timeout=30)

def fetch_recipes():
    with _get(API) as r:
        return {x['id']: x for x in json.load(r)}

_img_cache = {}
def fetch_image(url):
    if url in _img_cache:
        return _img_cache[url].copy()
    with _get(url) as r:
        im = Image.open(io.BytesIO(r.read())).convert('RGB')
    _img_cache[url] = im
    return im.copy()

def palette_from(im, n=6):
    """사진의 주된 색조를 뽑아 밝은 파스텔 그라데이션을 만든다.

    같은 색을 그대로 쓰면 사진에 묻히므로, 색상(hue)만 가져오고 명도는 크게
    올리고 채도는 낮춰 '사진과 같은 계열의 밝은 톤'으로 바꾼다.
    """
    sm = im.resize((80, 80)).convert('RGB')
    px = list(sm.getdata())
    best, bs = None, -1
    for r, g, b in px[::7]:
        h, l, sat = colorsys.rgb_to_hls(r / 255, g / 255, b / 255)
        score = sat * (1 - abs(l - 0.5) * 1.2)     # 선명하고 너무 어둡지 않은 색 우선
        if score > bs:
            bs, best = score, h
    to8 = lambda c: tuple(round(v * 255) for v in c)
    # 줄마다 다른 색을 쓰되 같은 계열에서 벗어나지 않게, 색상을 조금만 돌리고
    # 명도를 달리한다. 첫 줄은 밝은 크림, 둘째 줄은 한 톤 진한 살구.
    h2 = (best + STYLE['hue_shift']) % 1.0
    g1 = (to8(colorsys.hls_to_rgb(best, 0.95, 0.85)),
          to8(colorsys.hls_to_rgb(best, 0.80, 0.95)))
    g2 = (to8(colorsys.hls_to_rgb(h2, 0.84, 0.92)),
          to8(colorsys.hls_to_rgb(h2, 0.64, 1.00)))
    return [g1, g2]


def cover_fit(im, box_w, box_h):
    """비율 유지하며 채우고 가운데 크롭."""
    s = max(box_w / im.width, box_h / im.height)
    im = im.resize((round(im.width * s), round(im.height * s)), Image.LANCZOS)
    l = (im.width - box_w) // 2
    t = (im.height - box_h) // 2
    return im.crop((l, t, l + box_w, t + box_h))

def wrap(draw, text, fnt, max_w, prefer_space=False):
    """글자 단위 줄바꿈. prefer_space 면 띄어쓰기에서 끊어 단어가 잘리지 않게 한다.

    제목은 단어가 잘리면 어색해서 띄어쓰기 우선, 본문은 줄 수를 아끼려고 글자 단위.
    """
    if prefer_space and ' ' in text:
        lines, cur = [], ''
        for w in text.split(' '):
            t = (cur + ' ' + w).strip()
            if not cur or draw.textlength(t, font=fnt) <= max_w:
                cur = t
            else:
                lines.append(cur); cur = w
        if cur:
            lines.append(cur)
        return lines
    lines, cur = [], ''
    for ch in text:
        if ch == '\n':
            lines.append(cur); cur = ''; continue
        t = cur + ch
        if draw.textlength(t, font=fnt) <= max_w:
            cur = t
        else:
            lines.append(cur); cur = ch
    if cur:
        lines.append(cur)
    return lines

def rounded(size, radius, fill):
    m = Image.new('RGBA', (size[0] * 4, size[1] * 4), (0, 0, 0, 0))
    ImageDraw.Draw(m).rounded_rectangle([0, 0, size[0] * 4 - 1, size[1] * 4 - 1],
                                        radius=radius * 4, fill=fill)
    return m.resize(size, Image.LANCZOS)

# ── 커버 ────────────────────────────────────────────────
def make_cover(hero_url, title, sub):
    card = Image.new('RGB', (W, H), WHITE)
    hero = fetch_image(hero_url)
    card.paste(cover_fit(hero, W, H), (0, 0))
    auto_grad = palette_from(hero)

    # 아래쪽 어둡게 — 흰 글씨 가독성 확보
    grad = Image.new('L', (1, H))
    for y in range(H):
        t = max(0.0, (y - H * 0.42) / (H * 0.58))
        grad.putpixel((0, y), int(150 * (t ** 1.4)))
    card.paste(Image.new('RGB', (W, H), (8, 28, 20)), (0, 0), grad.resize((W, H)))

    d = ImageDraw.Draw(card)

    # 브랜드 마크 — 흰 셰프모자만. 오른쪽 위.
    # 밝은 사진에서 흰색이 묻히므로 부드러운 그림자를 깔아 윤곽을 살린다.
    mark_path = os.path.join(os.path.dirname(__file__), '..', 'assets', 'brand-mark-white.png')
    D = int(STYLE['mark_size'])
    mark = Image.open(mark_path).convert('RGBA').resize((D, D), Image.LANCZOS)
    mx, my = W - 56 - D, 52
    shadow = Image.new('RGBA', (D + 56, D + 56), (0, 0, 0, 0))
    shadow.paste((0, 0, 0, 150), (28, 31), mark.getchannel('A'))
    shadow = shadow.filter(ImageFilter.GaussianBlur(13))
    card.paste(shadow, (mx - 28, my - 28), shadow)
    card.paste(mark, (mx, my), mark)

    # 제목 — 두 줄 안에 들어가는 최대 크기를 자동으로 찾는다.
    # 피드에서는 썸네일로 보이므로 최대한 크게 가는 편이 낫다.
    max_w = W - 120
    manual = [t.strip() for t in title.split('|') if t.strip()]
    for size in range(int(STYLE['title_max']), 69, -4):
        f_title = font(size)
        if len(manual) > 1:
            # '|' 로 줄바꿈을 직접 지정한 경우 — 가장 긴 줄이 들어가는 크기를 찾는다
            lines = manual
            if max(d.textlength(t, font=f_title) for t in lines) <= max_w:
                break
        else:
            lines = wrap(d, title, f_title, max_w, prefer_space=True)
            if len(lines) <= 2:
                break
    lines = lines[:3]
    lh = int(size * 1.22)
    y = H - 126 - len(lines) * lh - (62 if sub else 0)
    # 장식 수저·포크 — 제목 블록 양 끝에 맞춰 얹는다.
    # 제목 길이가 매번 달라지므로 실제 글자 폭을 재서 위치를 잡는다.
    def load_deco(name, h, angle):
        f = os.path.join(os.path.dirname(__file__), '..', 'assets', name)
        if not os.path.exists(f):
            return None
        d_im = Image.open(f).convert('RGBA')
        w = round(d_im.width * h / d_im.height)
        return d_im.resize((w, h), Image.LANCZOS).rotate(angle, expand=True,
                                                         resample=Image.BICUBIC)

    # 샘플 카드와 같은 3겹 구조 — 바깥부터 흰색 → 검정 → 컬러 fill.
    # 어떤 배경에서도 글자가 떠 보이는 건 이 흰 테두리 덕이다.
    def vgrad(size, c_top, c_bot):
        """세로 그라데이션 한 장. 1px 높이로 만들고 늘려서 값싸게 처리한다."""
        h = max(2, size[1])
        strip = Image.new('RGB', (1, h))
        for yy in range(h):
            t = yy / (h - 1)
            strip.putpixel((0, yy), tuple(
                round(c_top[k] + (c_bot[k] - c_top[k]) * t) for k in range(3)))
        return strip.resize(size, Image.BILINEAR)

    def punch(pos, text, fnt, grad=None, fill=WHITE):
        """바깥 흰 테두리 → 검정 테두리 → 글자 채움.

        grad 가 주어지면 글자 모양을 마스크로 써서 그라데이션을 입힌다.
        """
        w_out = max(4, int(fnt.size / STYLE['stroke_white']))
        w_mid = max(2, int(fnt.size / STYLE['stroke_black']))
        d.text(pos, text, font=fnt, fill=WHITE, stroke_width=w_out, stroke_fill=WHITE)
        d.text(pos, text, font=fnt, fill=(0, 0, 0), stroke_width=w_mid, stroke_fill=(0, 0, 0))
        if grad is None:
            d.text(pos, text, font=fnt, fill=fill)
            return
        tw = int(d.textlength(text, font=fnt)) + fnt.size
        th = int(fnt.size * 1.9)
        mask = Image.new('L', (tw, th), 0)
        ImageDraw.Draw(mask).text((0, 0), text, font=fnt, fill=255)
        card.paste(vgrad((tw, th), *grad), pos, mask)

    # 마스코트를 제목 마지막 글자 위에 올려 앉힌다. 기울이지 않고 똑바로,
    # 글자 폭에 맞춰 크기를 잡아 그 글자만 올라탄 것처럼 보이게 한다.
    w_title_stroke = max(4, int(f_title.size / STYLE['stroke_white']))
    mas_path = os.path.join(os.path.dirname(__file__), '..', 'assets', 'mascot-noline.png')
    if os.path.exists(mas_path):
        last = lines[-1]
        ch_left = 60 + d.textlength(last[:-1], font=f_title)
        ch_w = d.textlength(last[-1], font=f_title)
        mas = Image.open(mas_path).convert('RGBA')
        mw = int(ch_w * STYLE['mascot_scale'])                       # 마지막 글자 폭에 맞춘다
        mas = mas.resize((mw, round(mas.height * mw / mas.width)), Image.LANCZOS)
        # 주아체는 그리기 기준선과 실제 글자 윗변이 많이 떨어져 있다.
        # 비율로 맞추면 항상 뜨므로 폰트에서 글자의 실제 상단을 읽어 붙인다.
        ink_top = f_title.getbbox(last[-1])[1]                 # 기준선 → 글자 윗변
        glyph_top = y + (len(lines) - 1) * lh + ink_top - w_title_stroke
        px = int(ch_left + ch_w / 2 - mas.width / 2 + STYLE['mascot_dx'])
        py = int(glyph_top - mas.height + STYLE['mascot_dy'])                   # 글자 윗변에 살짝 얹힌 위치
        card.paste(mas, (px, py), mas)

    for i, ln in enumerate(lines):
        punch((60, y), ln, f_title, grad=auto_grad[i % len(auto_grad)])
        y += lh
    if sub:
        punch((64, y + 4), sub, font(54))
        y += 62

    # 하단 바
    handle = '@cookmate_yojalal'
    d.text((W - 66 - d.textlength(handle, font=font(36)), H - 92),
           handle, font=font(36), fill=(225, 225, 225))
    return card

# ── 4그리드 ──────────────────────────────────────────────
def make_grid(recipes):
    card = Image.new('RGB', (W, H), WHITE)
    d = ImageDraw.Draw(card)
    half = W // 2
    for i, r in enumerate(recipes):
        ox, oy = (i % 2) * half, (i // 2) * half
        cell = Image.new('RGB', (half, half), (240, 240, 240))
        if r.get('image'):
            cell.paste(cover_fit(fetch_image(r['image']), half, half), (0, 0))
        card.paste(cell, (ox, oy))

        # 반투명 흰 박스 — 아래 절반
        box_h = int(half * 0.62)
        panel = Image.new('RGBA', (half - 24, box_h), (255, 255, 255, 238))
        card.paste(panel, (ox + 12, oy + half - box_h - 12), panel)

        px, py = ox + 34, oy + half - box_h + 4
        # 제목 (해시태그)
        d.text((px, py), f"#{r['title'].replace(' ', '')}", font=font(34, 'bold'), fill=GREEN_DEEP)
        py += 46
        # 준비재료
        ing = ', '.join(f"{g['name']} {g['amount']}" for g in (r.get('ingredients') or [])[:6])
        for ln in wrap(d, f'준비재료: {ing}', body(19), half - 76)[:2]:
            d.text((px, py), ln, font=body(19), fill=(90, 90, 90)); py += 25
        py += 6
        # 조리 단계
        for n, s in enumerate((r.get('steps') or [])[:4], 1):
            for j, ln in enumerate(wrap(d, f"{n}. {s['description']}", body(20, 'medium'), half - 76)[:2]):
                d.text((px + (0 if j == 0 else 18), py), ln, font=body(20, 'medium'), fill=INK)
                py += 26
            py += 3
        # 구분선
        d.line([(ox + 12, oy + half - box_h - 12), (ox + half - 12, oy + half - box_h - 12)],
               fill=GREEN, width=3)
    # 십자 여백선
    d.line([(half, 0), (half, H)], fill=WHITE, width=6)
    d.line([(0, half), (W, half)], fill=WHITE, width=6)
    return card

def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--title', required=True)
    ap.add_argument('--sub', default='')
    ap.add_argument('--ids', required=True, help='쉼표로 구분한 레시피 id')
    ap.add_argument('--out', default='out/insta')
    a = ap.parse_args()

    ids = [s.strip() for s in a.ids.split(',') if s.strip()]
    db = fetch_recipes()
    missing = [i for i in ids if i not in db]
    if missing:
        sys.exit(f'❌ 라이브에 없는 id: {", ".join(missing)}')
    picked = [db[i] for i in ids]
    noimg = [r['id'] for r in picked if not r.get('image')]
    if noimg:
        sys.exit(f'❌ 이미지가 없는 레시피: {", ".join(noimg)}')

    slug = re.sub(r'[^0-9A-Za-z가-힣]+', '-', a.title).strip('-')
    outdir = os.path.join(a.out, slug)
    os.makedirs(outdir, exist_ok=True)

    pages = [('01_cover.png', make_cover(picked[0]['image'], a.title, a.sub))]
    for n in range(0, len(picked), 4):
        pages.append((f'{len(pages)+1:02d}_grid.png', make_grid(picked[n:n + 4])))

    for name, im in pages:
        p = os.path.join(outdir, name)
        im.save(p, quality=95)
        print(f'  {p}  ({os.path.getsize(p)//1024}KB)')
    print(f'\n✅ {len(pages)}장 생성 — {", ".join(r["title"] for r in picked)}')

if __name__ == '__main__':
    main()
