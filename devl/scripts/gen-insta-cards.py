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
      1080x1080. 기본은 커버 1장 + 레시피당 1장(--layout single).
      --layout grid 를 주면 예전처럼 4칸 모음으로 만든다.

레시피 데이터·이미지는 라이브 API 에서 받는다(로컬 recipes.json 은 시드용이라 뒤처진다).
글자는 코드로 그리므로 한글이 깨지지 않는다. AI 생성 표기는 넣지 않는다 —
캡션에 직접 쓰기로 했다.
"""
import argparse, colorsys, datetime, io, json, os, re, sys, urllib.request
from PIL import Image, ImageDraw, ImageFont, ImageFilter

API = 'https://yojalal.com/api/recipes'
FONT = os.path.join(os.path.dirname(__file__), '..', 'assets', 'fonts', 'BMJUA.otf')
# 카드 제목용. 주아체보다 획이 두꺼워 사진 위에서 더 눌러 담긴다.
FONT_TITLE = os.path.join(os.path.dirname(__file__), '..', 'assets', '온글잎 윤탱체.ttf')
# 본문 보조용 — 주아체는 굵기가 하나뿐이라 작은 글씨에서 가독성이 떨어진다.
FONT_BODY = '/System/Library/Fonts/AppleSDGothicNeo.ttc'
# 레시피 본문용 손글씨체(메모멘트 꾸꾸). 굵기가 하나뿐이라 weight 는 무시된다.
FONT_HAND = os.path.join(os.path.dirname(__file__), '..', 'assets', 'MemomentKkukkukk.ttf')
W, H = 1080, 1080          # --ratio 로 4:5(1080x1350) 전환

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
    """제목·강조. 써라운드가 있으면 그걸 쓰고, 없으면 주아체로 떨어진다.

    둘 다 단일 굵기라 weight 는 무시된다.
    """
    if os.path.exists(FONT_TITLE):
        return ImageFont.truetype(FONT_TITLE, size)
    return ImageFont.truetype(FONT, size)

def body(size, weight='regular'):
    """재료·단계처럼 작고 긴 글은 애플고딕 — 주아체는 작을수록 뭉갠다."""
    idx = {'regular': 0, 'medium': 2, 'semibold': 4, 'bold': 6}[weight]
    return ImageFont.truetype(FONT_BODY, size, index=idx)


def jua(size):
    """주아체 전용. font() 는 윤탱체가 있으면 그쪽을 쓰므로 따로 둔다."""
    if os.path.exists(FONT):
        return ImageFont.truetype(FONT, size)
    return body(size, 'semibold')


def hand(size):
    """손글씨체. 획이 가늘어 같은 크기의 고딕보다 작아 보이므로 크게 잡는다."""
    if os.path.exists(FONT_HAND):
        return ImageFont.truetype(FONT_HAND, size)
    return body(size, 'medium')

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
    """URL 또는 로컬 경로. --img-dir 로 갈아끼운 파일은 경로로 들어온다."""
    if url in _img_cache:
        return _img_cache[url].copy()
    if url.startswith('http'):
        with _get(url) as r:
            im = Image.open(io.BytesIO(r.read())).convert('RGB')
    else:
        im = Image.open(url).convert('RGB')
    _img_cache[url] = im
    return im.copy()

# 분량 표기 (1컵 / 1/2대 / 500ml / 1큰술 …)
_AMOUNT = re.compile(
    r'\s*\d+(?:/\d+)?(?:\.\d+)?\s*'
    r'(?:컵|대|장|개|봉|큰술|작은술|스푼|g|kg|ml|L|쪽|줌|캔|모|조각|마리|공기|T|알|포기|단)')

def _has_batchim(ch):
    return '가' <= ch <= '힣' and (ord(ch) - 0xAC00) % 28 != 0


_PARTICLE_PAIRS = {'은': ('은', '는'), '는': ('은', '는'),
                   '을': ('을', '를'), '를': ('을', '를'),
                   '이': ('이', '가'), '가': ('이', '가'),
                   '과': ('과', '와'), '와': ('과', '와')}


def _fix_particle(name, rest):
    """분량을 떼면 앞 글자 받침이 바뀌어 조사가 틀어진다('김치 1컵은' → '김치은')."""
    if not rest or rest[0] not in _PARTICLE_PAIRS:
        return rest
    if len(rest) > 1 and rest[1] not in ' ,.\n':      # 조사가 아니라 단어의 첫 글자일 수 있다
        return rest
    with_b, without_b = _PARTICLE_PAIRS[rest[0]]
    return (with_b if _has_batchim(name[-1]) else without_b) + rest[1:]


def condense(text, ingredients):
    """카드에 실을 짧은 문장. 재료 줄에 이미 적힌 분량을 단계에서 걷어낸다.

    같은 정보를 두 번 보여줄 이유가 없고, 한 줄에 들어가면 훨씬 잘 읽힌다.
    재료 줄에 없는 수치(물 500ml, 3분간 등)는 조리에 필요하므로 남긴다.
    """
    names = [g['name'] for g in (ingredients or []) if g.get('name')]
    out = text
    for n in sorted(names, key=len, reverse=True):
        pat = re.compile(re.escape(n) + _AMOUNT.pattern)
        while True:
            m = pat.search(out)
            if not m:
                break
            out = out[:m.start()] + n + _fix_particle(n, out[m.end():])
    # 손글씨체(메모멘트)에 가운뎃점 글리프가 비어 있어 '진간장·미림' 이
    # '진간장  미림' 처럼 빈칸 두 개로 보인다. 쉼표로 바꿔 쓴다.
    out = out.replace('·', ', ')
    return re.sub(r'\s{2,}', ' ', out).strip()


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
    g_strong = (to8(colorsys.hls_to_rgb(best, 0.72, 1.0)),
                to8(colorsys.hls_to_rgb(best, 0.56, 1.0)))
    return [g1, g2, g_strong]


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
    # 글자 단위로 끊다 보면 '식혀주세요 / . 이게' 처럼 구두점만 다음 줄로
    # 넘어간다. 앞 줄로 끌어올린다.
    for i in range(1, len(lines)):
        while lines[i] and lines[i][0] in '.,!?)]}%…':
            lines[i - 1] += lines[i][0]
            lines[i] = lines[i][1:].lstrip()
    return [ln for ln in lines if ln]

def rounded(size, radius, fill):
    m = Image.new('RGBA', (size[0] * 4, size[1] * 4), (0, 0, 0, 0))
    ImageDraw.Draw(m).rounded_rectangle([0, 0, size[0] * 4 - 1, size[1] * 4 - 1],
                                        radius=radius * 4, fill=fill)
    return m.resize(size, Image.LANCZOS)

# ── 커버 ────────────────────────────────────────────────
def make_cover(hero_url, title, sub, style='calm', tag=''):
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
    # 인스타 프로필 그리드는 세로 3:4 라서 1:1 이미지의 좌우 12.5%가 잘린다.
    # 제목이 그리드에서 잘리면 무슨 글인지 알 수 없으므로 가운데 안전영역 안에 넣는다.
    SAFE_W = int(W * 0.72)
    max_w = SAFE_W
    if style == 'bold':
        max_w = int(W * 0.80)
    # '*강조*' 로 감싼 줄만 색을 넣고 나머지는 흰색으로 둔다.
    raw = [t.strip() for t in title.split('|') if t.strip()]
    accent_at = {i for i, t in enumerate(raw) if t.startswith('*') and t.endswith('*')}
    manual = [t.strip('*') for t in raw]
    title = '|'.join(manual)
    top_size = 210 if style == 'bold' else int(STYLE['title_max'])
    for size in range(top_size, 69, -4):
        f_title = font(size)
        if len(manual) > 1:   # noqa
            # '|' 로 줄바꿈을 직접 지정한 경우 — 가장 긴 줄이 들어가는 크기를 찾는다
            lines = manual
            if max(d.textlength(t, font=f_title) for t in lines) <= max_w:
                break
        else:
            lines = wrap(d, title, f_title, max_w, prefer_space=True)
            if len(lines) <= 2:
                break
    lines = lines[:3]
    lh = int(size * 1.18 if style == 'bold' else size * 1.22)
    if style == 'bold':
        # 글자 뒤 초록 뭉치 — 원을 여러 개 겹쳐 손으로 칠한 듯한 형태로.
        # 납작한 타원 하나면 얼룩처럼 보인다.
        BLOB = (168, 226, 160)
        y = int(H * 0.52) - len(lines) * lh // 2
        layer = Image.new('RGBA', (W, H), (0, 0, 0, 0))
        bd = ImageDraw.Draw(layer)
        yy = y
        for ln in lines:
            lw = d.textlength(ln, font=f_title)
            cy_, r = yy + lh * 0.52, lh * 0.44
            span = lw + lh * 0.12
            n = max(2, int(span / (r * 0.78)))
            for k in range(n + 1):
                px_ = W / 2 - span / 2 + span * k / n
                wob = r * (0.86 + 0.14 * ((k * 7919) % 5) / 4)
                bd.ellipse([px_ - wob, cy_ - r, px_ + wob, cy_ + r], fill=BLOB + (255,))
            yy += lh
        layer = layer.filter(ImageFilter.GaussianBlur(5))
        layer.putalpha(layer.getchannel('A').point(lambda v: 234 if v > 130 else 0))
        card.paste(layer, (0, 0), layer)
    else:
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
        pos = (int(pos[0]), int(pos[1]))
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

    if tag:
        # 제목과 같은 방식(흰 글씨 + 테두리). 알약 배경은 요소가 하나 더 늘어 복잡해진다.
        tfn = font(54)
        punch(((W - d.textlength(tag, font=tfn)) / 2, y - tfn.size - 14), tag, tfn, fill=WHITE)

    # 마스코트를 제목 마지막 글자 위에 올려 앉힌다. 기울이지 않고 똑바로,
    # 글자 폭에 맞춰 크기를 잡아 그 글자만 올라탄 것처럼 보이게 한다.
    w_title_stroke = max(4, int(f_title.size / STYLE['stroke_white']))
    mas_path = os.path.join(os.path.dirname(__file__), '..', 'assets', 'mascot-noline.png')
    if style != 'bold' and os.path.exists(mas_path):
        last = lines[-1]
        last_w = d.textlength(last, font=f_title)
        ch_left = (W - last_w) / 2 + d.textlength(last[:-1], font=f_title)
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
        lw = d.textlength(ln, font=f_title)
        if accent_at and i not in accent_at:
            punch(((W - lw) / 2, y), ln, f_title, fill=WHITE)
        else:
            punch(((W - lw) / 2, y), ln, f_title,
                  grad=auto_grad[2] if accent_at else auto_grad[i % 2])
        y += lh
    if sub:
        punch(((W - d.textlength(sub, font=font(54))) / 2, y + 4), sub, font(54))
        y += 62

    # 하단 바
    handle = '@cookmate_yojalal'
    d.text((W - 66 - d.textlength(handle, font=font(36)), H - 92),
           handle, font=font(36), fill=(225, 225, 225))
    return card

# ── 4그리드 ──────────────────────────────────────────────


# ── 마무리(팔로우 유도) 장 ───────────────────────────────
def make_outro():
    """캐러셀 마지막에 붙는 팔로우 유도 카드. 매 게시물 동일해야 브랜드가 쌓인다.

    AI 이미지 생성으로는 만들 수 없다 — 한글이 깨지고 계정명이 틀리며
    매번 결과가 달라진다. 이런 건 코드로 그린다.
    """
    # 배경 — 흰 바탕. 카드와 배지에 시선이 모이도록 장식을 두지 않는다.
    card = Image.new('RGB', (W, H), WHITE)

    d = ImageDraw.Draw(card)

    # 가운데 흰 카드
    cw, ch = W - 360, 320
    # 흰 카드를 화면 중앙에서 살짝 위로. 아래로 배지·안내문구가 이어지므로
    # 정중앙에 두면 전체가 아래로 처져 보인다.
    cx, cy = (W - cw) // 2, (H - ch) // 2 - 56
    # 흰 배경 위에서는 흰 카드가 묻히므로 옅은 회색 그림자로 띄운다
    glow = Image.new('RGBA', (cw + 56, ch + 56), (0, 0, 0, 0))
    ImageDraw.Draw(glow).rounded_rectangle([28, 34, cw + 27, ch + 33], radius=36,
                                           fill=(0, 0, 0, 46))
    glow = glow.filter(ImageFilter.GaussianBlur(17))
    card.paste(glow, (cx - 28, cy - 28), glow)
    plate = Image.new('RGBA', (cw, ch), (0, 0, 0, 0))
    ImageDraw.Draw(plate).rounded_rectangle([0, 0, cw - 1, ch - 1], radius=36,
                                            fill=(255, 255, 255, 255))
    card.paste(plate, (cx, cy), plate)

    # 프로필 줄 (인스타 팔로우 바 흉내)
    bx, by, bw, bh = cx + 28, cy + 32, cw - 56, 96
    bar = Image.new('RGBA', (bw, bh), (0, 0, 0, 0))
    ImageDraw.Draw(bar).rounded_rectangle([0, 0, bw - 1, bh - 1], radius=22,
                                          fill=(242, 244, 246, 255))
    card.paste(bar, (bx, by), bar)

    ico = os.path.join(os.path.dirname(__file__), '..', 'assets', 'appIcon.png')
    if os.path.exists(ico):
        av = 66
        im = Image.open(ico).convert('RGB').resize((av, av), Image.LANCZOS)
        m = Image.new('L', (av * 4, av * 4), 0)
        ImageDraw.Draw(m).ellipse([0, 0, av * 4 - 1, av * 4 - 1], fill=255)
        card.paste(im, (bx + 22, by + (bh - av) // 2), m.resize((av, av), Image.LANCZOS))

    d.text((bx + 100, by + 20), '@cookmate_yojalal', font=font(28), fill=INK)
    d.text((bx + 100, by + 54), '요잘알 — 오늘 뭐 먹지?', font=body(21), fill=(130, 130, 130))

    fw, fh = 142, 54
    fx, fy = bx + bw - fw - 18, by + (bh - fh) // 2
    btn = Image.new('RGBA', (fw, fh), (0, 0, 0, 0))
    ImageDraw.Draw(btn).rounded_rectangle([0, 0, fw - 1, fh - 1], radius=16, fill=GREEN + (255,))
    card.paste(btn, (fx, fy), btn)
    d.text((fx + (fw - d.textlength('팔로우', font=font(26))) / 2, fy + 11),
           '팔로우', font=font(26), fill=WHITE)

    # 카피
    for i, (txt, fnt, col) in enumerate([
            ('요리에 자신 없어도 괜찮아요', font(34), (70, 70, 70)),
            ('매일 새로운 레시피로 찾아올게요', font(38), GREEN_DEEP)]):
        tw = d.textlength(txt, font=fnt)
        d.text(((W - tw) / 2, cy + 168 + i * 55), txt, font=fnt, fill=col)

    # 앱 다운로드 — 공식 스토어 배지를 쓴다.
    # Apple/Google 모두 배지를 직접 그리는 걸 금지한다. 파일이 없으면
    # 흉내내지 않고 문구로 대체한다.
    d.text(((W - d.textlength('앱으로 더 편하게', font=font(30))) / 2, cy + ch + 44),
           '앱으로 더 편하게', font=font(30), fill=INK)

    badges = []
    for fn in ('badge-appstore.png', 'badge-googleplay.png'):
        fp = os.path.join(os.path.dirname(__file__), '..', 'assets', fn)
        if os.path.exists(fp):
            b = Image.open(fp).convert('RGBA')
            # 배지마다 투명 여백이 달라서(구글은 위아래 29px) 그대로 높이를 맞추면
            # 애플 쪽이 더 커 보인다. 여백을 잘라낸 뒤 높이를 맞춘다.
            bb = b.getchannel('A').point(lambda v: 255 if v > 8 else 0).getbbox()
            if bb:
                b = b.crop(bb)
            bh = 64
            badges.append(b.resize((round(b.width * bh / b.height), bh), Image.LANCZOS))

    by2 = cy + ch + 96
    if len(badges) == 2:
        gap = 34
        bx2 = (W - (sum(b.width for b in badges) + gap)) // 2
        for b in badges:
            card.paste(b, (bx2, by2), b)
            bx2 += b.width + gap
        by2 += 64

    txt = "스토어에서 '요잘알' 검색"
    f2 = body(24, 'medium')
    d.text(((W - d.textlength(txt, font=f2)) / 2, by2 + 22), txt, font=f2, fill=(140, 140, 140))

    return card

# ── 한 장에 레시피 하나 ─────────────────────────────────
def single_box_h(r):
    """그 레시피가 필요로 하는 패널 높이. 세트 전체를 같은 높이로 맞추는 데 쓴다."""
    return make_single(r, measure=True)


def make_single(r, box_h=None, measure=False):
    """레시피 1개를 1080x1080 한 장에. 피드에서 축소돼도 읽히도록 글자를 크게 쓴다.

    box_h 를 주면 그 높이로 고정한다. 장마다 패널 높이가 다르면 캐러셀을
    넘길 때 덜컹거려서, 세트 안에서는 가장 긴 것에 맞춘다.
    """
    card = Image.new('RGB', (W, H), WHITE)
    d = ImageDraw.Draw(card)

    # 글을 먼저 배치해 보고 필요한 높이만큼만 패널을 깐다
    S = H / 1080                               # 4:5 면 1.25배
    ing = ', '.join(f"{g['name']} {g['amount']}" for g in (r.get('ingredients') or []))

    tf = font(round(62 * S))
    tt = f"#{r['title'].replace(' ', '')}"
    while d.textlength(tt, font=tf) > W - 120 and tf.size > 40:
        tf = font(tf.size - 2)

    head = int(tf.size * 0.62)
    # 패널 높이는 고정. 장마다 사진 크기가 달라지면 캐러셀이 덜컹거린다.
    CAP = int(H * 0.56)
    # 단계가 많은 레시피(잔치국수 7단계)는 기본 크기로 상한을 넘겨 마지막 줄이
    # 잘렸다. 들어갈 때까지 글자를 조금씩 줄인다 — 설명을 지우는 것보다 낫다.
    # 재료 아래 여백(36)은 늘리되 패널 아래 여백(16)에서 상쇄해, 패널 높이와
    # 사진 크기는 그대로 두고 조리 단계만 아래로 내려간다.
    def fit_step(n, body, fnt):
        """2줄 안에 넣는다. 넘치면 뒤 문장부터 덜어낸다.

        글자 수로 자르면 '진하게 내야 풍미' 처럼 말이 끊긴 채 끝난다.
        핵심 동작은 첫 문장에 있고 뒤에 붙는 건 보통 팁이라, 문장 단위로
        덜어내면 카드가 짧아지면서도 읽을 수 있는 문장으로 남는다.
        """
        parts = [x for x in re.split(r'(?<=[.!?])\s*', body.strip()) if x]
        while True:
            lines = wrap(d, f"{n}. " + ' '.join(parts), fnt, W - 130)
            if len(lines) <= 2 or len(parts) <= 1:
                return lines[:2]
            parts.pop()

    scale = 1.0
    while True:
        f_ing, f_step = hand(round(30 * S * scale)), hand(round(34 * S * scale))
        LH_I, LH_S = round(34 * S * scale), round(40 * S * scale)
        ing_lines = wrap(d, f'준비재료  {ing}', f_ing, W - 130)[:3]
        step_lines = [fit_step(n, condense(st['description'], r.get('ingredients')), f_step)
                      for n, st in enumerate(r.get('steps') or [], 1)]
        raw = (head + len(ing_lines) * LH_I + round(36 * S)
               + sum(len(g) * LH_S + 8 for g in step_lines) + 16)
        if raw <= CAP or scale <= 0.74:
            break
        scale -= 0.03
    need = min(CAP, raw)
    if measure:
        return need
    box_h = box_h or need
    top = H - box_h

    if r.get('image'):
        # 사진은 패널 위쪽만 보인다. 1080 정사각에 맞추면 원본(약 1100x620)을
        # 1.7배 확대하게 돼 흐려진다. 실제로 보이는 크기에만 맞춘다.
        card.paste(cover_fit(fetch_image(r['image']), W, top), (0, 0))
    card.paste(Image.new('RGBA', (W, box_h), (255, 255, 255, 245)), (0, top),
               Image.new('RGBA', (W, box_h), (255, 255, 255, 245)))

    LINE_Y = 86                      # 계정명·마크가 함께 놓이는 가로선

    # 브랜드 마크
    mk = os.path.join(os.path.dirname(__file__), '..', 'assets', 'brand-mark-white.png')
    if os.path.exists(mk):
        # 왼쪽 계정명과 같은 가로선(LINE_Y)에 중심을 맞춘다
        ms = 88
        mark = Image.open(mk).convert('RGBA').resize((ms, ms), Image.LANCZOS)
        sh = Image.new('RGBA', (ms + 40, ms + 40), (0, 0, 0, 0))
        sh.paste((0, 0, 0, 120), (20, 23), mark.getchannel('A'))
        sh = sh.filter(ImageFilter.GaussianBlur(9))
        card.paste(sh, (W - 48 - ms - 20, LINE_Y - ms // 2 - 20), sh)
        card.paste(mark, (W - 48 - ms, LINE_Y - ms // 2), mark)

    # 제목 — 패널 경계에 걸쳐 가운데
    tw = d.textlength(tt, font=tf)
    tx, ty = (W - tw) / 2, top - tf.size * 0.68
    d.text((tx, ty), tt, font=tf, fill=WHITE, stroke_width=max(8, tf.size // 7), stroke_fill=WHITE)
    d.text((tx, ty), tt, font=tf, fill=(0, 0, 0), stroke_width=max(3, tf.size // 14), stroke_fill=(0, 0, 0))
    d.text((tx, ty), tt, font=tf, fill=GREEN_DEEP)

    # 인스타 계정명 — 사진 오른쪽 아래, 패널 바로 위. 어느 장을 캡처해도 출처가 남는다.
    d.text((W - 48, top - 20), '@cookmate_yojalal', font=font(28),
           fill=(230, 230, 230), anchor='rd')

    px, py = 62, top + head
    for ln in ing_lines:
        d.text((px, py), ln, font=f_ing, fill=(135, 135, 135)); py += LH_I
    py += round(36 * S)                        # 재료 줄과 조리 단계 사이 여백
    for g in step_lines:
        for k, ln in enumerate(g):
            d.text((px + (0 if k == 0 else 24), py), ln, font=f_step, fill=INK)
            py += LH_S
        py += 8
    return card

def make_grid(recipes):
    card = Image.new('RGB', (W, H), WHITE)
    d = ImageDraw.Draw(card)
    half = W // 2

    # 1단계 — 칸마다 글을 배치해 보고 필요한 높이를 잰다.
    # 칸마다 높이를 따로 쓰면 같은 줄에서 패널이 어긋나 보이므로,
    # 재기만 하고 그리지는 않는다.
    lay = []
    for r in recipes:
        f_ing, f_step = body(14, 'medium'), body(15, 'bold')
        ing = ', '.join(f"{g['name']} {g['amount']}" for g in (r.get('ingredients') or [])[:6])
        ing_lines = wrap(d, f'준비재료: {ing}', f_ing, half - 48)[:2]
        step_lines = [wrap(d, f"{n}. {condense(st['description'], r.get('ingredients'))}",
                           f_step, half - 48)[:2]
                      for n, st in enumerate((r.get('steps') or [])[:4], 1)]
        tf = font(34)
        tt = f"#{r['title'].replace(' ', '')}"
        while d.textlength(tt, font=tf) > half - 40 and tf.size > 20:
            tf = font(tf.size - 2)
        head = int(tf.size * 0.52)
        need = head + len(ing_lines) * 19 + 4 \
               + sum(len(g) * 20 + 2 for g in step_lines) + 18
        lay.append(dict(r=r, ing=ing_lines, steps=step_lines, tf=tf, tt=tt,
                        head=head, need=min(int(half * 0.62), need),
                        f_ing=f_ing, f_step=f_step))

    # 같은 줄은 더 긴 쪽에 맞춘다
    row_h = [max(l['need'] for l in lay[k:k + 2]) for k in range(0, len(lay), 2)]

    # 2단계 — 그리기
    for i, L in enumerate(lay):
        r = L['r']
        ox, oy = (i % 2) * half, (i // 2) * half
        box_h = row_h[i // 2]
        top = oy + half - box_h

        cell = Image.new('RGB', (half, half), (240, 240, 240))
        if r.get('image'):
            cell.paste(cover_fit(fetch_image(r['image']), half, half), (0, 0))
        card.paste(cell, (ox, oy))

        # 셀 오른쪽 위 브랜드 마크 (커버와 동일)
        mk = os.path.join(os.path.dirname(__file__), '..', 'assets', 'brand-mark-white.png')
        if os.path.exists(mk):
            ms = int(half * 0.13)
            mark = Image.open(mk).convert('RGBA').resize((ms, ms), Image.LANCZOS)
            sh = Image.new('RGBA', (ms + 24, ms + 24), (0, 0, 0, 0))
            sh.paste((0, 0, 0, 120), (12, 14), mark.getchannel('A'))
            sh = sh.filter(ImageFilter.GaussianBlur(6))
            card.paste(sh, (ox + half - ms - 34, oy + 10), sh)
            card.paste(mark, (ox + half - ms - 22, oy + 22), mark)

        panel = Image.new('RGBA', (half, box_h), (255, 255, 255, 243))
        card.paste(panel, (ox, top), panel)

        # 제목 — 패널 위 경계에 걸치게 가운데. 사진과 설명을 끊어준다.
        tf, tt = L['tf'], L['tt']
        tw = d.textlength(tt, font=tf)
        tx, ty = ox + (half - tw) / 2, top - tf.size * 0.66
        d.text((tx, ty), tt, font=tf, fill=WHITE, stroke_width=max(5, tf.size // 7), stroke_fill=WHITE)
        d.text((tx, ty), tt, font=tf, fill=(0, 0, 0), stroke_width=max(2, tf.size // 14), stroke_fill=(0, 0, 0))
        d.text((tx, ty), tt, font=tf, fill=GREEN_DEEP)

        px, py = ox + 24, top + L['head']
        for ln in L['ing']:
            d.text((px, py), ln, font=L['f_ing'], fill=(120, 120, 120)); py += 19
        py += 4
        for g in L['steps']:
            for k, ln in enumerate(g):
                d.text((px + (0 if k == 0 else 14), py), ln, font=L['f_step'], fill=INK)
                py += 20
            py += 2
    return card

# ── 스토리(9:16) ────────────────────────────────────────
def _round_thumb(im, s, radius=30):
    """정사각 썸네일을 둥근 모서리로."""
    th = cover_fit(im, s, s)
    m = rounded((s, s), radius, (255, 255, 255, 255)).getchannel('A')
    out = Image.new('RGBA', (s, s), (0, 0, 0, 0))
    out.paste(th, (0, 0), m)
    return out


def make_story(recipes, title, sub='', tag=None, bg='photo', date_str=None):
    """스토리 전용 한 장(1080x1920).

    인스타 스토리는 위아래 각 250px 를 자체 UI(프로필·답장창)가 덮는다.
    그래서 모든 요소를 y 260~1660 안에만 넣는다. 피드 카드와 달리 한 장으로
    끝나므로 레시피 목록을 전부 담되, 사진은 첫 레시피 것을 배경으로 깐다.
    """
    if date_str is None:
        # Actions/로컬 모두 KST 기준으로 찍는다.
        now = datetime.datetime.now(datetime.timezone(datetime.timedelta(hours=9)))
        date_str = now.strftime('%Y.%m.%d')
    card = Image.new('RGB', (W, H), WHITE)
    hero = fetch_image(recipes[0]['image'])
    auto_grad = palette_from(hero)   # 흰 바탕이어도 제목 색은 음식 사진에서 뽑는다
    dark = (bg == 'photo')
    if dark:
        card.paste(cover_fit(hero, W, H), (0, 0))
        # 전체를 한 번 눌러 두고 위아래를 더 어둡게 — 흰 글씨가 어느 사진에서도 뜬다.
        dim = Image.new('L', (1, H))
        for y in range(H):
            t = y / (H - 1)
            edge = max(0.0, 1 - t / 0.32) ** 1.5 + max(0.0, (t - 0.60) / 0.40) ** 1.4
            dim.putpixel((0, y), min(226, int(120 + 106 * edge)))
        card.paste(Image.new('RGB', (W, H), (8, 26, 18)), (0, 0), dim.resize((W, H)))

    d = ImageDraw.Draw(card)
    CTA_Y = 1508          # 하단 덩어리(날짜·알약·핸들)의 기준선

    def vgrad(size, c_top, c_bot):
        h = max(2, size[1])
        strip = Image.new('RGB', (1, h))
        for yy in range(h):
            t = yy / (h - 1)
            strip.putpixel((0, yy), tuple(
                round(c_top[k] + (c_bot[k] - c_top[k]) * t) for k in range(3)))
        return strip.resize(size, Image.BILINEAR)

    def punch(pos, text, fnt, grad=None, fill=WHITE):
        """커버와 같은 3겹(흰 → 검정 → 채움). 브랜드 톤을 맞춘다."""
        pos = (int(pos[0]), int(pos[1]))
        w_out = max(4, int(fnt.size / STYLE['stroke_white']))
        w_mid = max(2, int(fnt.size / STYLE['stroke_black']))
        if dark:
            d.text(pos, text, font=fnt, fill=WHITE, stroke_width=w_out, stroke_fill=WHITE)
            d.text(pos, text, font=fnt, fill=(0, 0, 0), stroke_width=w_mid,
                   stroke_fill=(0, 0, 0))
        else:
            # 흰 배경에서는 바깥 흰 테두리가 사라지므로 검정을 바깥 테두리로 쓴다.
            # 두께는 글자 크기에 비례해야 한다 — 고정값으로 두면 작은 태그가
            # 테두리에 먹혀 통째로 검게 보인다.
            d.text(pos, text, font=fnt, fill=(0, 0, 0),
                   stroke_width=max(3, int(fnt.size / 14)), stroke_fill=(0, 0, 0))
        if grad is None:
            d.text(pos, text, font=fnt, fill=fill)
            return
        tw = int(d.textlength(text, font=fnt)) + fnt.size
        th = int(fnt.size * 1.9)
        mask = Image.new('L', (tw, th), 0)
        ImageDraw.Draw(mask).text((0, 0), text, font=fnt, fill=255)
        card.paste(vgrad((tw, th), *grad), pos, mask)

    # 브랜드 마크 — 오른쪽 위, 안전영역 아래.
    y = 356          # 상단 안전영역(250) 과 목록 사이 — 너무 붙으면 답답하다
    if tag:
        tfn = font(50)
        punch(((W - d.textlength(tag, font=tfn)) / 2, y), tag, tfn, fill=WHITE)
        y += tfn.size + 26

    # 제목 — '|' 로 직접 줄을 나눈다. 스토리는 세로가 길어 3줄까지 여유가 있다.
    raw = [t.strip() for t in title.split('|') if t.strip()]
    accent_at = {i for i, t in enumerate(raw) if t.startswith('*') and t.endswith('*')}
    lines = [t.strip('*') for t in raw]
    SAFE_W = int(W * 0.84)
    if len(lines) == 1:
        # '|' 없이 한 덩어리로 주면 '한 줄 인사말'로 본다. 줄바꿈 없이 통째로
        # 들어가는 크기까지만 줄인다 — 헤드라인이 아니라 말 거는 톤이다.
        for size in range(96, 37, -2):
            f_title = font(size)
            if d.textlength(lines[0], font=f_title) <= SAFE_W:
                break
    else:
        for size in range(128, 59, -4):
            f_title = font(size)
            if max(d.textlength(t, font=f_title) for t in lines) <= SAFE_W:
                break
    lines = lines[:3]
    lh = int(size * 1.20)
    for i, ln in enumerate(lines):
        lw = d.textlength(ln, font=f_title)
        # '*...*' 로 감싼 줄만 사진에서 뽑은 색이 들어간다. 표시가 없으면 전부 흰색 —
        # 자동으로 색을 넣으면 매일 제목 색이 바뀌어 브랜드가 안 쌓인다.
        if i in accent_at:
            punch(((W - lw) / 2, y), ln, f_title, grad=auto_grad[2])
        else:
            punch(((W - lw) / 2, y), ln, f_title, fill=WHITE)
        y += lh
    if sub:
        sfn = font(48)
        punch(((W - d.textlength(sub, font=sfn)) / 2, y + 6), sub, sfn)
        y += sfn.size + 24

    # 레시피 목록 — 남은 세로를 n 등분해 아래 CTA 자리를 항상 남긴다.
    LIST_TOP = max(y + 64, 520)
    # CTA 알약(1548)과 목록 사이 숨 쉴 틈. 붙여 두면 패널이 알약을 밀어내는
    # 것처럼 보여 하단이 답답하다.
    LIST_BOT = 1352
    n = len(recipes)
    row_h = min(200, (LIST_BOT - LIST_TOP) // max(1, n))
    thumb = min(172, row_h - 28)
    ry = LIST_TOP + ((LIST_BOT - LIST_TOP) - row_h * n) // 2

    # 목록 뒤 반투명 패널. 배경을 흐리고 어둡게 깔아 글씨가 사진과 겹쳐도 읽힌다.
    pad_x, pad_y = 60, 30
    px0, py0 = pad_x, ry - pad_y
    px1, py1 = W - pad_x, ry + row_h * n + pad_y
    pmask = rounded((px1 - px0, py1 - py0), 48, (255, 255, 255, 255)).getchannel('A')
    if dark:
        reg = card.crop((px0, py0, px1, py1)).filter(ImageFilter.GaussianBlur(16))
        reg = Image.blend(reg, Image.new('RGB', reg.size, (10, 24, 18)), 0.62)
    else:
        reg = Image.new('RGB', (px1 - px0, py1 - py0), (244, 250, 246))
    card.paste(reg, (px0, py0), pmask)

    f_name, f_meta = font(58), body(36, 'medium')
    for i, r in enumerate(recipes):
        t_im = _round_thumb(fetch_image(r['image']), thumb)
        tx, ty = 92, ry + (row_h - thumb) // 2
        sh = Image.new('RGBA', (thumb + 40, thumb + 40), (0, 0, 0, 0))
        sh.paste((0, 0, 0, 130 if dark else 55), (20, 24), t_im.getchannel('A'))
        card.paste(sh.filter(ImageFilter.GaussianBlur(11)), (tx - 20, ty - 20),
                   sh.filter(ImageFilter.GaussianBlur(11)))
        card.paste(t_im, (tx, ty), t_im)

        # 번호 뱃지 — 목록이라는 걸 한눈에 알리고 시선 순서를 만든다.
        bd_ = 46
        badge = Image.new('RGBA', (bd_, bd_), (0, 0, 0, 0))
        ImageDraw.Draw(badge).ellipse([0, 0, bd_ - 1, bd_ - 1], fill=GREEN + (255,))
        bf = font(32)
        ImageDraw.Draw(badge).text((bd_ / 2, bd_ / 2 - 3), str(i + 1), font=bf,
                                   fill=WHITE, anchor='mm')
        card.paste(badge, (tx - 14, ty - 14), badge)

        # 이름은 왼쪽, 시간·난이도는 패널 오른쪽 끝에 붙인다. 둘 다 왼쪽에 몰면
        # 패널 오른쪽 절반이 비어 균형이 깨진다.
        nx = tx + thumb + 34
        meta = f"{round(r.get('time') or 0)}분 · {r.get('difficulty') or ''}".strip(' ·')
        mx_right = px1 - 44
        name = r['title']
        avail = mx_right - d.textlength(meta, font=f_meta) - 40 - nx
        while d.textlength(name, font=f_name) > avail and len(name) > 4:
            name = name[:-1]
        cy = ry + row_h / 2
        if dark:
            d.text((nx, cy), name, font=f_name, fill=WHITE,
                   stroke_width=3, stroke_fill=(0, 0, 0), anchor='lm')
            d.text((mx_right, cy), meta, font=f_meta, fill=(226, 226, 226), anchor='rm')
        else:
            d.text((nx, cy), name, font=f_name, fill=INK, anchor='lm')
            d.text((mx_right, cy), meta, font=f_meta, fill=(120, 128, 124), anchor='rm')
        ry += row_h

    # 날짜 — CTA 알약(1548) 바로 위, 가운데. 알약·핸들과 한 줄로 세워 하단을
    # 중앙 정렬 덩어리로 묶는다. 손글씨체는 숫자 글립이 들쭉날쭉해 주아체로 쓴다.
    if date_str:
        df = jua(42)
        track = 4
        total = sum(d.textlength(c, font=df) for c in date_str) + track * (len(date_str) - 1)
        dx = (W - total) / 2
        # 위(패널 바닥)·아래(알약 윗변) 여백을 같게. 폰트 상자가 아니라 실제
        # 글자가 차지하는 높이를 재서 가운데를 잡아야 눈으로 맞아 보인다.
        bx = d.textbbox((0, 0), date_str, font=df, anchor='la')
        dy = (py1 + CTA_Y) / 2 - (bx[3] - bx[1]) / 2 - bx[1]
        col = (214, 214, 214) if dark else (176, 184, 180)
        for c in date_str:
            d.text((dx, dy), c, font=df, fill=col, anchor='la')
            dx += d.textlength(c, font=df) + track

    # 하단 CTA — 스토리는 링크 스티커를 사용자가 직접 얹으므로 문구만 둔다.
    cta = '전체 레시피는 요잘알 앱에서'
    cf = font(52)
    pill_w = int(d.textlength(cta, font=cf)) + 88
    pill = rounded((pill_w, 92), 46, GREEN + (240,))
    card.paste(pill, ((W - pill_w) // 2, CTA_Y), pill)
    d.text((W / 2, CTA_Y + 46), cta, font=cf, fill=WHITE, anchor='mm')

    handle = '@cookmate_yojalal'
    hf = font(40)
    if dark:
        d.text((W / 2, CTA_Y + 120), handle, font=hf, fill=(238, 238, 238), anchor='mm',
               stroke_width=3, stroke_fill=(0, 0, 0))
    else:
        d.text((W / 2, CTA_Y + 120), handle, font=hf, fill=(150, 158, 154), anchor='mm')
    return card


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--title', required=True)
    ap.add_argument('--sub', default='')
    ap.add_argument('--ids', required=True, help='쉼표로 구분한 레시피 id')
    ap.add_argument('--out', default='out/insta')
    ap.add_argument('--layout', choices=['single', 'grid', 'story'], default='single',
                    help='single=레시피당 한 장(기본), grid=4칸 모음, story=9:16 한 장')
    ap.add_argument('--no-outro', action='store_true', help='마무리 팔로우 카드 생략')
    ap.add_argument('--tag', default='', help='제목 위 작은 문구 (기본 없음)')
    ap.add_argument('--img-dir', default=None,
                    help='<id>-*.jpg 가 있으면 라이브 이미지 대신 그 파일을 쓴다. '
                         'Storage 에 아직 안 올린 교체본으로 미리 뽑을 때.')
    ap.add_argument('--style', choices=['calm', 'bold'], default='calm',
                    help="bold=제목을 크게 키우고 글자 뒤에 색 블롭. 피드에서 눈에 띄지만 사진은 덜 보인다")
    ap.add_argument('--bg', choices=['photo', 'white'], default='photo',
                    help='story 전용. white=사진 배경 없이 흰 바탕')
    ap.add_argument('--date', default=None,
                    help="story 오른쪽 위 날짜. 기본은 오늘(KST). ''  주면 숨긴다")
    ap.add_argument('--ratio', choices=['4:5', '1:1'], default='4:5',
                    help='4:5(1080x1350, 기본) 는 피드 노출이 크고 프로필 그리드 잘림도 적다')
    a = ap.parse_args()

    global H
    if a.ratio == '4:5':
        H = 1350
    if a.layout == 'story':
        # 스토리는 9:16 고정. --ratio 는 무시한다.
        H = 1920
    if a.layout == 'grid' and a.ratio != '1:1':
        print('[insta] grid 레이아웃은 정사각 전용 — 1:1 로 진행합니다.')
        H = 1080

    ids = [s.strip() for s in a.ids.split(',') if s.strip()]
    db = fetch_recipes()
    missing = [i for i in ids if i not in db]
    if missing:
        sys.exit(f'❌ 라이브에 없는 id: {", ".join(missing)}')
    picked = [db[i] for i in ids]
    noimg = [r['id'] for r in picked if not r.get('image')]
    if noimg:
        sys.exit(f'❌ 이미지가 없는 레시피: {", ".join(noimg)}')

    if a.img_dir:
        import glob as _glob
        for r in picked:
            hit = sorted(_glob.glob(os.path.join(a.img_dir, f"{r['id']}-*"))
                         + _glob.glob(os.path.join(a.img_dir, f"{r['id']}.*")))
            if hit:
                print(f"  ↻ {r['id']} {r['title']} — 로컬 교체본 사용: {os.path.basename(hit[0])}")
                r['image'] = hit[0]

    slug = re.sub(r'[^0-9A-Za-z가-힣]+', '-', a.title).strip('-')
    outdir = os.path.join(a.out, slug)
    os.makedirs(outdir, exist_ok=True)

    if a.layout == 'story':
        pages = [('01_story.png', make_story(picked, a.title, a.sub, a.tag, a.bg, a.date))]
        for name, im in pages:
            pth = os.path.join(outdir, name)
            im.save(pth, quality=95)
            print(f'  {pth}  ({os.path.getsize(pth)//1024}KB)')
        print(f'\n✅ 스토리 1장 생성 — {", ".join(r["title"] for r in picked)}')
        return

    pages = [('01_cover.png', make_cover(picked[0]['image'], a.title, a.sub, a.style, a.tag))]
    if a.layout == 'single':
        uniform = max(single_box_h(r) for r in picked)   # 넘길 때 패널이 튀지 않게
        for r in picked:
            pages.append((f"{len(pages)+1:02d}_{r['id']}.png", make_single(r, uniform)))
    else:
        for n in range(0, len(picked), 4):
            pages.append((f'{len(pages)+1:02d}_grid.png', make_grid(picked[n:n + 4])))

    if not a.no_outro:
        pages.append((f'{len(pages)+1:02d}_outro.png', make_outro()))

    for name, im in pages:
        p = os.path.join(outdir, name)
        im.save(p, quality=95)
        print(f'  {p}  ({os.path.getsize(p)//1024}KB)')
    print(f'\n✅ {len(pages)}장 생성 — {", ".join(r["title"] for r in picked)}')

if __name__ == '__main__':
    main()
