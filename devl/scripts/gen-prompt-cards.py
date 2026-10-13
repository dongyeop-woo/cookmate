#!/usr/bin/env python3
"""
프롬프트 카드 생성기 — 프롬프트를 '입력한 화면'으로 보여준다.

    python3 scripts/gen-prompt-cards.py --content data/ai-05-prompts.json --slug ai-05

인물 사진을 배경으로 깔면 내용과 연결이 안 된다. 대신 실제로 그 프롬프트를
쳐 넣은 화면을 그려 넣는다. 읽는 사람이 바로 따라 할 수 있다.

실존 제품(ChatGPT·Claude 등)의 로고나 이름은 쓰지 않는다.
가짜 스크린샷으로 오인될 수 있어서 중립적인 채팅 UI 로만 그린다.

커버는 gen-tech-cards 가 그대로 그린다. 장식(칩·푸터·갈고리)도 같은 모듈을 쓴다.
출력: out/tech/<slug>/01_cover.png, 02_p01.png ...
"""
import argparse, importlib.util, json, os, sys
from PIL import Image, ImageDraw, ImageFont

BASE = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..')
A = os.path.join(BASE, 'assets')

_spec = importlib.util.spec_from_file_location(
    'gen_tech_cards', os.path.join(BASE, 'scripts', 'gen-tech-cards.py'))
tech = importlib.util.module_from_spec(_spec)
sys.modules['gen_tech_cards'] = tech
_spec.loader.exec_module(tech)

W, H = tech.W, tech.H
PAD = tech.PAD
F_BOLD, F_SEMI, F_MED, F_REG = tech.F_BOLD, tech.F_SEMI, tech.F_MED, tech.F_REG


def font(p, s):
    return ImageFont.truetype(p, s)


def mix(c1, c2, t):
    return tuple(round(a + (b - a) * t) for a, b in zip(c1, c2))


# ── 응답 영역 그리기 ─────────────────────────────────────
# 카드마다 결과 모양이 달라야 한다. 회의록은 표, 엑셀은 스프레드시트,
# 메일은 메일 폼. 전부 같은 회색 줄로 두면 열 장이 똑같아 보인다.

def _lbl(d, x, y, text, t, size=22):
    d.text((x, y), text, font=font(F_MED, size), fill=t['dim'])


def r_table(d, x0, x1, y, t, data, max_y=10**6):
    """표 — 회의록 정리처럼 칸으로 나뉘는 결과."""
    cols = data['cols']
    n = len(cols)
    cw = (x1 - x0) / n
    rh = 44
    rows = data.get('rows', 3)
    d.rounded_rectangle([x0, y, x1, y + rh], 8, fill=mix(t['bg'], t['accent'], 0.14))
    for i, c in enumerate(cols):
        d.text((x0 + cw * i + 16, y + 11), c, font=font(F_SEMI, 23), fill=t['accent'])
    yy = y + rh
    line = mix(t['bg'], t['ink'], 0.18)
    for r in range(rows):
        if yy + rh > max_y:
            break
        for i in range(n):
            w = cw - 32 if i == 0 else cw * (0.5 if (r + i) % 2 else 0.72)
            d.rounded_rectangle([x0 + cw * i + 16, yy + 16,
                                 x0 + cw * i + 16 + max(30, w - 32), yy + 28], 6, fill=line)
        yy += rh
        d.line([x0, yy, x1, yy], fill=mix(t['bg'], t['ink'], 0.12), width=1)
    return yy - y + 10


def r_bullets(d, x0, x1, y, t, data, max_y=10**6):
    """목록 — 반대 의견·제목 후보·예상 질문."""
    yy = y
    for i, w in enumerate(data.get('widths', [0.9, 0.78, 0.84])):
        if yy + 46 > max_y:
            break
        mk = data.get('marker', '•')
        d.text((x0, yy - 4), mk, font=font(F_BOLD, 26), fill=t['accent'])
        d.rounded_rectangle([x0 + 34, yy + 4, x0 + 34 + int((x1 - x0 - 34) * w), yy + 18], 7,
                            fill=mix(t['bg'], t['ink'], 0.19))
        yy += 46
    return yy - y


def r_numbered(d, x0, x1, y, t, data, max_y=10**6):
    """번호 단계 — 처음 배울 때처럼 순서가 있는 답."""
    yy = y
    for i, w in enumerate(data.get('widths', [0.88, 0.74, 0.8])):
        if yy + 48 > max_y:
            break
        d.text((x0, yy - 6), f'{i+1}', font=font(F_BOLD, 28), fill=t['accent'])
        d.rounded_rectangle([x0 + 34, yy + 4, x0 + 34 + int((x1 - x0 - 34) * w), yy + 18], 7,
                            fill=mix(t['bg'], t['ink'], 0.19))
        yy += 48
    return yy - y


def r_strike(d, x0, x1, y, t, data, max_y=10**6):
    """취소선 — 덜어낼 문장을 표시한 결과."""
    yy = y
    for w, cut in data.get('lines', [(0.92, False), (0.8, True), (0.86, False), (0.6, True)]):
        if yy + 40 > max_y:
            break
        w2 = int((x1 - x0) * w)
        col = mix(t['bg'], t['ink'], 0.13 if cut else 0.22)
        d.rounded_rectangle([x0, yy + 4, x0 + w2, yy + 18], 7, fill=col)
        if cut:
            d.line([x0 - 4, yy + 11, x0 + w2 + 4, yy + 11], fill=(232, 90, 70), width=3)
        yy += 40
    return yy - y


def r_highlight(d, x0, x1, y, t, data, max_y=10**6):
    """형광 표시 — 사실 확인이 필요한 문장."""
    yy = y
    for w, hit in data.get('lines', [(0.9, False), (0.72, True), (0.84, False)]):
        if yy + 44 > max_y:
            break
        w2 = int((x1 - x0) * w)
        if hit:
            d.rounded_rectangle([x0 - 6, yy - 2, x0 + w2 + 6, yy + 24], 6,
                                fill=mix(t['bg'], t['accent'], 0.22))
        d.rounded_rectangle([x0, yy + 4, x0 + w2, yy + 18], 7,
                            fill=mix(t['bg'], t['ink'], 0.24 if hit else 0.17))
        yy += 44
    return yy - y


def r_mail(d, x0, x1, y, t, data, max_y=10**6):
    """메일 폼 — 받는 사람·제목·본문."""
    yy = y
    line = mix(t['bg'], t['ink'], 0.15)
    for lab, w in (('받는 사람', 0.42), ('제목', 0.66)):
        _lbl(d, x0, yy + 2, lab, t, 21)
        d.rounded_rectangle([x0 + 110, yy + 4, x0 + 110 + int((x1 - x0 - 110) * w), yy + 18], 7,
                            fill=line)
        yy += 40
    d.line([x0, yy + 6, x1, yy + 6], fill=mix(t['bg'], t['ink'], 0.12), width=1)
    yy += 22
    for w in (0.94, 0.88, 0.5):
        if yy + 38 > max_y:
            break
        d.rounded_rectangle([x0, yy + 4, x0 + int((x1 - x0) * w), yy + 18], 7,
                            fill=mix(t['bg'], t['ink'], 0.2))
        yy += 38
    return yy - y


def r_sheet(d, x0, x1, y, t, data, max_y=10**6):
    """스프레드시트 — 수식 바 + 셀 격자."""
    d.rounded_rectangle([x0, y, x1, y + 42], 8, fill=mix(t['bg'], t['ink'], 0.13))
    d.text((x0 + 14, y + 9), 'fx', font=font(F_BOLD, 22), fill=t['dim'])
    d.text((x0 + 52, y + 8), data.get('formula', '=SUMIF(...)'),
           font=font(F_MED, 24), fill=t['accent'])
    yy = y + 56
    cols, rows = 4, 3
    cw = (x1 - x0) / cols
    grid = mix(t['bg'], t['ink'], 0.12)
    for r in range(rows):
        if yy + 40 > max_y:
            break
        for c in range(cols):
            d.rectangle([x0 + cw * c, yy, x0 + cw * (c + 1), yy + 40], outline=grid, width=1)
            if (r + c) % 3:
                d.rounded_rectangle([x0 + cw * c + 14, yy + 14,
                                     x0 + cw * c + cw - 20, yy + 26], 6,
                                    fill=mix(t['bg'], t['ink'], 0.19))
        yy += 40
    return yy - y + 8


def r_lines(d, x0, x1, y, t, data, max_y=10**6):
    yy = y
    for w in data.get('widths', [0.92, 0.78, 0.55]):
        if yy + 34 > max_y:
            break
        d.rounded_rectangle([x0, yy, x0 + int((x1 - x0) * w), yy + 14], 7,
                            fill=mix(t['bg'], t['ink'], 0.16))
        yy += 34
    return yy - y




def r_images(d, x0, x1, y, t, data, max_y=10**6):
    """생성된 이미지 자리. 결과물 비율이 카드마다 달라서
    누끼는 정사각, 배너는 가로로 긴 것, 프로필은 세로로 그린다."""
    n = int(data.get('count', 4))
    rw, rh = data.get('ratio', [1, 1])
    gap = 12
    avail_h = max_y - y
    avail_w = x1 - x0
    th = avail_h
    tw = th * rw / rh
    if tw * n + gap * (n - 1) > avail_w:
        tw = (avail_w - gap * (n - 1)) / n
        th = tw * rh / rw
    tw, th = int(tw), int(th)
    sx = x0 + (avail_w - (tw * n + gap * (n - 1))) // 2

    fill = mix(t['bg'], t['ink'], 0.15)
    edge = mix(t['bg'], t['ink'], 0.26)
    pick = int(data.get('pick', 0))
    for i in range(n):
        x = sx + i * (tw + gap)
        r = 14 if data.get('rounded') else 8
        sel = (i == pick)
        d.rounded_rectangle([x, y, x + tw, y + th], r, fill=fill,
                            outline=t['accent'] if sel else edge, width=3 if sel else 2)
        # 이미지 자리 표시 — 산과 해
        cx, cy = x + tw // 2, y + th // 2
        u = min(tw, th)
        g = mix(t['bg'], t['ink'], 0.34)
        d.ellipse([cx - u*0.22, cy - u*0.26, cx - u*0.08, cy - u*0.12], fill=g)
        d.polygon([(cx - u*0.30, cy + u*0.22), (cx - u*0.05, cy - u*0.08),
                   (cx + u*0.12, cy + u*0.22)], fill=g)
        d.polygon([(cx - u*0.02, cy + u*0.22), (cx + u*0.16, cy + u*0.02),
                   (cx + u*0.32, cy + u*0.22)], fill=mix(t['bg'], t['ink'], 0.26))
    return th



RESULT = {'table': r_table, 'bullets': r_bullets, 'numbered': r_numbered,
          'strike': r_strike, 'highlight': r_highlight, 'mail': r_mail,
          'sheet': r_sheet, 'lines': r_lines, 'images': r_images}


def result_height(kind, data):
    if kind == 'images':
        return 0          # 남는 높이를 그대로 쓴다
    """패널 높이를 미리 잡으려면 응답 영역 높이를 먼저 알아야 한다."""
    if kind == 'table':
        return 44 * (data.get('rows', 3) + 1) + 10
    if kind == 'bullets':
        return 46 * len(data.get('widths', [0, 0, 0]))
    if kind == 'numbered':
        return 48 * len(data.get('widths', [0, 0, 0]))
    if kind == 'strike':
        return 40 * len(data.get('lines', [0] * 4))
    if kind == 'highlight':
        return 44 * len(data.get('lines', [0] * 3))
    if kind == 'mail':
        return 40 * 2 + 22 + 38 * 3 + 6
    if kind == 'sheet':
        return 56 + 40 * 3 + 8
    return 34 * len(data.get('widths', [0, 0, 0]))


def card_prompt(c, t, idx, item, total):
    im = Image.new('RGB', (W, H), t['bg'])
    im = tech.vignette(im, 0.18)
    im = tech.grain(im, 0.045)
    d = ImageDraw.Draw(im)

    tech.chip(d, PAD, PAD, c.get('label', 'AI'), t, font(F_SEMI, 34))
    tech.meta_top_right(d, t, f'{idx:02d} / {total:02d}')
    tech.corner_ticks(d, t)

    # ── 번호·제목·패널 위치는 전부 고정한다.
    #    패널 높이를 내용에 맞추면 카드마다 제목이 위아래로 튀어서
    #    캐러셀을 넘길 때 글자가 춤춘다.
    px0, px1 = PAD, W - PAD
    f_body = font(F_REG, 38)
    lines = tech.wrap(d, item['body'], f_body, (px1 - px0) - 26 * 2 - 56)
    ih = 44 + 52 * len(lines)
    res = item.get('result') or {'type': 'lines'}

    # 전부 상수다. 패널 높이까지 고정해야 넘길 때 화면이 안 흔들린다.
    NUM_Y = 362
    HEAD_Y = 502
    py0 = 620
    py1 = 1160

    d.text((PAD - 6, NUM_Y), f'{idx:02d}', font=font(F_BOLD, 110), fill=t['accent'])
    nw = tech.text_w(d, f'{idx:02d}', font(F_BOLD, 110))
    d.text((PAD + nw + 16, NUM_Y + 56), f'/ {total:02d}', font=font(F_MED, 34), fill=t['dim'])
    d.text((PAD, HEAD_Y), item['head'], font=font(F_BOLD, 70), fill=t['ink'])

    # ── 입력 화면
    panel = mix(t['bg'], t['ink'], 0.07)
    line = mix(t['bg'], t['ink'], 0.16)
    d.rounded_rectangle([px0, py0, px1, py1], 22, fill=panel, outline=line, width=2)

    # 창 상단 바 — 점 세 개로 '화면'이라는 신호만 준다
    bar = py0 + 58
    d.line([px0 + 1, bar, px1 - 1, bar], fill=line, width=2)
    for i, col in enumerate(((255, 95, 86), (255, 189, 68), (39, 201, 63))):
        d.ellipse([px0 + 26 + i * 26, py0 + 22, px0 + 40 + i * 26, py0 + 36], fill=col)
    f_ph = font(F_MED, 24)
    d.text((px0 + 122, py0 + 20), item.get('ui_title') or c.get('ui_title', '새 대화'),
           font=f_ph, fill=t['dim'])

    # 입력창 + 프롬프트 본문
    ix0, ix1 = px0 + 26, px1 - 26
    iy0 = bar + 26
    d.rounded_rectangle([ix0, iy0, ix1, iy0 + ih], 16,
                        fill=mix(t['bg'], t['ink'], 0.13), outline=t['accent'], width=2)
    ty = iy0 + 22
    for ln in lines:
        d.text((ix0 + 28, ty), ln, font=f_body, fill=t['ink'])
        ty += 52
    # 커서
    cx = ix0 + 28 + tech.text_w(d, lines[-1], f_body) + 6
    d.rectangle([cx, ty - 50, cx + 3, ty - 12], fill=t['accent'])

    # 보내기 버튼
    by = iy0 + ih + 22
    d.rounded_rectangle([ix1 - 108, by, ix1, by + 48], 12, fill=t['accent'])
    f_btn = font(F_BOLD, 26)
    bw = tech.text_w(d, '보내기', f_btn)
    d.text((ix1 - 54 - bw // 2, by + 10), '보내기', font=f_btn, fill=t['bg'])

    # 응답 — 상황에 맞는 모양으로 그린다
    ry = by + 40 + 48
    RESULT.get(res.get('type', 'lines'), r_lines)(d, ix0, ix1, ry, t, res, py1 - 24)

    tech.footer(d, t, c.get('handle', ''), f'{idx} / {total}', c.get('brand_mark'))
    return im


def r_messy(d, x0, x1, y, t, data, max_y=10**6):
    """실행 전 — 정리 안 된 글 덩어리. 촘촘한 회색 줄로 '벽 같은 글'을 만든다."""
    yy = y
    col = mix(t['bg'], t['ink'], 0.17)
    for w in data.get('widths', [0.96, 0.88, 0.99, 0.72, 0.94, 0.85, 0.6]):
        if yy + 22 > max_y:
            break
        d.rounded_rectangle([x0, yy, x0 + int((x1 - x0) * w), yy + 12], 6, fill=col)
        yy += 22
    return yy - y


def card_cmd(c, t, idx, item, total):
    """명령어 카드 — 등록할 문장 + 실행 전/후를 한 장에 담는다."""
    im = Image.new('RGB', (W, H), t['bg'])
    im = tech.vignette(im, 0.18)
    im = tech.grain(im, 0.045)
    d = ImageDraw.Draw(im)

    tech.chip(d, PAD, PAD, c.get('label', 'AI'), t, font(F_SEMI, 34))
    tech.meta_top_right(d, t, f'{idx:02d} / {total:02d}')
    tech.corner_ticks(d, t)

    # 위치는 전부 상수. 넘길 때 제목이 움직이면 안 된다.
    NUM_Y, HEAD_Y, SUB_Y = 300, 400, 486
    py0, py1 = 556, 1040

    d.text((PAD - 6, NUM_Y), f'{idx:02d}', font=font(F_BOLD, 90), fill=t['accent'])
    nw = tech.text_w(d, f'{idx:02d}', font(F_BOLD, 90))
    d.text((PAD + nw + 14, NUM_Y + 44), f'/ {total:02d}', font=font(F_MED, 30), fill=t['dim'])
    d.text((PAD, HEAD_Y), item['head'], font=font(F_BOLD, 76), fill=t['ink'])
    d.text((PAD, SUB_Y), item.get('ui_title', ''), font=font(F_MED, 32), fill=t['dim'])

    panel = mix(t['bg'], t['ink'], 0.07)
    line = mix(t['bg'], t['ink'], 0.16)
    px0, px1 = PAD, W - PAD
    d.rounded_rectangle([px0, py0, px1, py1], 22, fill=panel, outline=line, width=2)

    ix0, ix1 = px0 + 26, px1 - 26
    # 등록할 문장 — 영어 원문 그대로
    f_body = font(F_REG, 33)
    lines = tech.wrap(d, item['body'], f_body, ix1 - ix0 - 52)
    ih = 34 + 44 * len(lines)
    iy0 = py0 + 26
    d.rounded_rectangle([ix0, iy0, ix1, iy0 + ih], 14,
                        fill=mix(t['bg'], t['ink'], 0.13), outline=t['accent'], width=2)
    ty = iy0 + 17
    for ln in lines:
        d.text((ix0 + 26, ty), ln, font=f_body, fill=t['ink'])
        ty += 44

    # 실행 전 → 실행 후
    cy = iy0 + ih + 30
    f_lbl = font(F_SEMI, 24)
    gap = 76
    colw = (ix1 - ix0 - gap) // 2
    lx0, lx1 = ix0, ix0 + colw
    rx0, rx1 = ix1 - colw, ix1

    d.text((lx0, cy), 'BEFORE', font=f_lbl, fill=t['dim'])
    d.text((rx0, cy), 'AFTER', font=f_lbl, fill=t['accent'])
    cy += 38

    r_messy(d, lx0, lx1, cy, t, item.get('before') or {}, py1 - 26)
    res = item.get('result') or {'type': 'lines'}
    RESULT.get(res.get('type', 'lines'), r_lines)(d, rx0, rx1, cy, t, res, py1 - 26)

    # 가운데 화살표
    ax = (lx1 + rx0) // 2
    ay = cy + 60
    d.line([ax - 18, ay, ax + 14, ay], fill=t['accent'], width=4)
    d.polygon([(ax + 22, ay), (ax + 6, ay - 11), (ax + 6, ay + 11)], fill=t['accent'])

    tech.footer(d, t, c.get('handle', ''), f'{idx} / {total}', c.get('brand_mark'))
    return im


# ── 생성 이미지처럼 보이는 그림 ──────────────────────────
import random as _rnd
from PIL import ImageFilter as _IF

PALETTES = {
    'warm':   [(255, 138, 76), (255, 92, 112), (255, 196, 92), (120, 40, 70)],
    'cool':   [(76, 140, 255), (92, 220, 232), (140, 108, 255), (24, 40, 92)],
    'lime':   [(198, 255, 77), (60, 190, 120), (32, 90, 70), (18, 34, 24)],
    'mono':   [(228, 228, 232), (150, 152, 160), (86, 88, 96), (30, 30, 34)],
    'sunset': [(255, 110, 140), (255, 170, 90), (120, 70, 180), (36, 20, 60)],
    'clay':   [(214, 160, 120), (168, 112, 84), (238, 214, 186), (58, 40, 32)],
}


def artwork(w, h, seed, pal):
    """생성된 이미지처럼 보이는 추상 그림. 실제 결과물 자리에 회색 네모를 두면
    '이미지 못 넣었네' 로 보인다. 색이 있어야 결과물처럼 읽힌다."""
    cols = PALETTES.get(pal, PALETTES['cool'])
    r = _rnd.Random(seed)
    W2, H2 = max(8, w // 4), max(8, h // 4)
    im = Image.new('RGB', (W2, H2), cols[-1])
    d2 = ImageDraw.Draw(im)
    # 위아래 그라데이션
    top, bot = cols[r.randrange(len(cols) - 1)], cols[-1]
    for yy in range(H2):
        f = yy / max(1, H2 - 1)
        d2.line([0, yy, W2, yy], fill=tuple(round(a + (b - a) * f) for a, b in zip(top, bot)))
    # 색 덩어리 몇 개
    for _ in range(r.randint(3, 5)):
        c = cols[r.randrange(len(cols))]
        cx, cy = r.uniform(0, W2), r.uniform(0, H2)
        rad = r.uniform(W2 * 0.18, W2 * 0.5)
        d2.ellipse([cx - rad, cy - rad, cx + rad, cy + rad], fill=c)
    im = im.filter(_IF.GaussianBlur(W2 * 0.09))
    return im.resize((w, h), Image.LANCZOS)


def r_artwork(d, x0, x1, y, t, data, max_y=10**6, im=None):
    n = int(data.get('count', 3))
    rw, rh = data.get('ratio', [1, 1])
    pal = data.get('palette', 'cool')
    gap = 14
    avail_h, avail_w = max_y - y, x1 - x0
    th = avail_h
    tw = th * rw / rh
    if tw * n + gap * (n - 1) > avail_w:
        tw = (avail_w - gap * (n - 1)) / n
        th = tw * rh / rw
    tw, th = int(tw), int(th)
    sx = x0 + (avail_w - (tw * n + gap * (n - 1))) // 2
    y = y + max(0, (avail_h - th) // 2)
    rad = 18 if data.get('rounded') else 10
    for i in range(n):
        x = sx + i * (tw + gap)
        pic = artwork(tw, th, data.get('seed', 1) * 97 + i, pal)
        m = Image.new('L', (tw, th), 0)
        ImageDraw.Draw(m).rounded_rectangle([0, 0, tw - 1, th - 1], rad, fill=255)
        im.paste(pic, (x, y), m)
    return th


def card_shot(c, t, idx, item, total):
    """명령어 한 단어 → 결과 이미지. 등록 문구는 캡션에 두고 카드는 결과만 보여준다."""
    im = Image.new('RGB', (W, H), t['bg'])
    im = tech.vignette(im, 0.18)
    im = tech.grain(im, 0.045)
    d = ImageDraw.Draw(im)

    tech.chip(d, PAD, PAD, c.get('label', 'AI'), t, font(F_SEMI, 34))
    tech.meta_top_right(d, t, f'{idx:02d} / {total:02d}')
    tech.corner_ticks(d, t)

    NUM_Y, HEAD_Y, SUB_Y = 212, 300, 392
    py0, py1 = 470, 1062

    d.text((PAD - 6, NUM_Y), f'{idx:02d}', font=font(F_BOLD, 76), fill=t['accent'])
    nw = tech.text_w(d, f'{idx:02d}', font(F_BOLD, 76))
    d.text((PAD + nw + 14, NUM_Y + 34), f'/ {total:02d}', font=font(F_MED, 28), fill=t['dim'])
    d.text((PAD, HEAD_Y), item['head'], font=font(F_BOLD, 84), fill=t['ink'])
    d.text((PAD, SUB_Y), item.get('ui_title', ''), font=font(F_MED, 34), fill=t['dim'])

    panel = mix(t['bg'], t['ink'], 0.07)
    line = mix(t['bg'], t['ink'], 0.16)
    px0, px1 = PAD, W - PAD
    d.rounded_rectangle([px0, py0, px1, py1], 22, fill=panel, outline=line, width=2)
    ix0, ix1 = px0 + 26, px1 - 26

    # 입력창 — 명령어 한 단어만
    iy0 = py0 + 26
    ih = 92
    d.rounded_rectangle([ix0, iy0, ix1, iy0 + ih], 16,
                        fill=mix(t['bg'], t['ink'], 0.13), outline=t['accent'], width=2)
    f_cmd = font(F_BOLD, 50)
    d.text((ix0 + 28, iy0 + 20), item['head'], font=f_cmd, fill=t['accent'])
    cx = ix0 + 28 + tech.text_w(d, item['head'], f_cmd) + 10
    d.rectangle([cx, iy0 + 22, cx + 4, iy0 + 70], fill=t['accent'])
    d.rounded_rectangle([ix1 - 116, iy0 + 22, ix1 - 20, iy0 + 70], 12, fill=t['accent'])
    f_btn = font(F_BOLD, 26)
    bw = tech.text_w(d, 'Enter', f_btn)
    d.text((ix1 - 68 - bw // 2, iy0 + 34), 'Enter', font=f_btn, fill=t['bg'])

    ay = iy0 + ih + 34
    f_lbl = font(F_SEMI, 24)
    d.text((ix0, ay), 'OUTPUT', font=f_lbl, fill=t['dim'])
    r_artwork(d, ix0, ix1, ay + 38, t, item.get('result') or {}, py1 - 26, im)

    tech.footer(d, t, c.get('handle', ''), f'{idx} / {total}', c.get('brand_mark'))
    return im


# ── 제품 그리기 ──────────────────────────────────────────
def _shade(c, f):
    return tuple(max(0, min(255, round(v * f))) for v in c)


def draw_product(im, box, shape, col):
    """간단한 제품 형태. 실제 상품 사진을 못 쓰니 직접 그린다.
    형태만 알아보이면 '누끼 → 광고컷' 이라는 메시지는 전달된다."""
    d = ImageDraw.Draw(im, 'RGBA')
    x0, y0, x1, y1 = box
    w, h = x1 - x0, y1 - y0
    cx = (x0 + x1) / 2
    lo, hi = _shade(col, 0.62), _shade(col, 1.24)

    if shape == 'bottle':
        bw = w * 0.52
        d.rounded_rectangle([cx - bw/2, y0 + h*0.26, cx + bw/2, y1], w*0.08, fill=col)
        d.rounded_rectangle([cx - bw*0.20, y0 + h*0.10, cx + bw*0.20, y0 + h*0.30], 6, fill=lo)
        d.rounded_rectangle([cx - bw*0.26, y0, cx + bw*0.26, y0 + h*0.13], 6, fill=hi)
        d.rounded_rectangle([cx - bw*0.34, y0 + h*0.50, cx + bw*0.34, y0 + h*0.74], 4,
                            fill=(255, 255, 255, 60))
    elif shape == 'can':
        bw = w * 0.46
        d.rounded_rectangle([cx - bw/2, y0 + h*0.08, cx + bw/2, y1 - h*0.04], w*0.06, fill=col)
        d.ellipse([cx - bw/2, y0 + h*0.02, cx + bw/2, y0 + h*0.16], fill=hi)
        d.rectangle([cx - bw*0.42, y0 + h*0.40, cx + bw*0.42, y0 + h*0.56], fill=(255,255,255,55))
    elif shape == 'box':
        bw = w * 0.56
        d.polygon([(cx - bw/2, y0 + h*0.20), (cx + bw*0.16, y0 + h*0.06),
                   (cx + bw/2, y0 + h*0.20), (cx - bw*0.16, y0 + h*0.34)], fill=hi)
        d.polygon([(cx - bw/2, y0 + h*0.20), (cx - bw*0.16, y0 + h*0.34),
                   (cx - bw*0.16, y1), (cx - bw/2, y1 - h*0.14)], fill=lo)
        d.polygon([(cx - bw*0.16, y0 + h*0.34), (cx + bw/2, y0 + h*0.20),
                   (cx + bw/2, y1 - h*0.14), (cx - bw*0.16, y1)], fill=col)
    else:                                   # tube
        bw = w * 0.42
        d.rounded_rectangle([cx - bw/2, y0 + h*0.18, cx + bw/2, y1 - h*0.02], w*0.06, fill=col)
        d.rounded_rectangle([cx - bw*0.30, y0 + h*0.02, cx + bw*0.30, y0 + h*0.22], 6, fill=hi)
        d.rectangle([cx - bw*0.40, y0 + h*0.44, cx + bw*0.40, y0 + h*0.58], fill=(255,255,255,55))


def product_tile_real(w, h, mode, seed, pal, prod):
    """실제 누끼 이미지를 배경 위에 얹는다. 그림으로 그린 것보다 설득력이 다르다."""
    if mode == 'cut':
        im = Image.new('RGB', (w, h), (244, 244, 246))
    else:
        im = artwork(w, h, seed, pal)
    im = im.convert('RGBA')

    ph = int(h * 0.72)
    pw = max(1, round(prod.width * ph / prod.height))
    if pw > w * 0.86:
        pw = int(w * 0.86)
        ph = max(1, round(prod.height * pw / prod.width))
    pic = prod.resize((pw, ph), Image.LANCZOS)
    px, py = (w - pw) // 2, int(h * 0.90) - ph

    sh = Image.new('RGBA', (w, h), (0, 0, 0, 0))
    ImageDraw.Draw(sh).ellipse([px + pw*0.10, py + ph*0.90, px + pw*0.90, py + ph*1.06],
                               fill=(0, 0, 0, 80 if mode == 'cut' else 120))
    im = Image.alpha_composite(im, sh.filter(_IF.GaussianBlur(w * 0.022)))
    im.alpha_composite(pic, (px, py))
    return im.convert('RGB')


def product_tile(w, h, shape, col, mode, seed, pal):
    """mode='cut' 이면 흰 배경 누끼, 'ad' 면 생성 배경 위 광고컷."""
    if mode == 'cut':
        im = Image.new('RGB', (w, h), (238, 238, 240))
    else:
        im = artwork(w, h, seed, pal)
    sh = Image.new('RGBA', (w, h), (0, 0, 0, 0))
    ds = ImageDraw.Draw(sh)
    ds.ellipse([w*0.22, h*0.80, w*0.78, h*0.92],
               fill=(0, 0, 0, 90 if mode == 'cut' else 130))
    sh = sh.filter(_IF.GaussianBlur(w * 0.03))
    im = Image.alpha_composite(im.convert('RGBA'), sh)
    draw_product(im, (w*0.28, h*0.16, w*0.72, h*0.84), shape, col)
    return im.convert('RGB')


def card_swap(c, t, idx, item, total):
    """누끼 → 명령어 → 광고컷."""
    im = Image.new('RGB', (W, H), t['bg'])
    im = tech.vignette(im, 0.18)
    im = tech.grain(im, 0.045)
    d = ImageDraw.Draw(im)

    tech.chip(d, PAD, PAD, c.get('label', 'AI'), t, font(F_SEMI, 34))
    tech.meta_top_right(d, t, f'{idx:02d} / {total:02d}')
    tech.corner_ticks(d, t)

    NUM_Y, HEAD_Y, SUB_Y = 214, 302, 394
    py0, py1 = 474, 1064

    d.text((PAD - 6, NUM_Y), f'{idx:02d}', font=font(F_BOLD, 76), fill=t['accent'])
    nw = tech.text_w(d, f'{idx:02d}', font(F_BOLD, 76))
    d.text((PAD + nw + 14, NUM_Y + 34), f'/ {total:02d}', font=font(F_MED, 28), fill=t['dim'])
    d.text((PAD, HEAD_Y), item['head'], font=font(F_BOLD, 80), fill=t['ink'])
    d.text((PAD, SUB_Y), item.get('ui_title', ''), font=font(F_MED, 34), fill=t['dim'])

    panel = mix(t['bg'], t['ink'], 0.07)
    line = mix(t['bg'], t['ink'], 0.16)
    px0, px1 = PAD, W - PAD
    d.rounded_rectangle([px0, py0, px1, py1], 22, fill=panel, outline=line, width=2)
    ix0, ix1 = px0 + 26, px1 - 26

    f_lbl = font(F_SEMI, 24)
    ly = py0 + 24
    d.text((ix0, ly), '내가 올린 누끼', font=f_lbl, fill=t['dim'])

    gap = 78
    ty = ly + 36
    avail_h = py1 - ty - 26
    tw = (ix1 - ix0 - gap) // 2
    th = min(int(tw * 1.22), avail_h)      # 세로로 조금 더 길게 잡아 빈 곳을 없앤다
    rx0 = ix1 - tw

    aw = tech.text_w(d, '광고 컷 완성', f_lbl)
    d.text((ix1 - aw, ly), '광고 컷 완성', font=f_lbl, fill=t['accent'])

    shape = item.get('shape', 'bottle')
    col = tuple(item.get('color', [214, 226, 236]))
    seed = item.get('seed', 7)
    pal = item.get('palette', 'cool')
    ppath = c.get('product')
    prod = None
    if ppath:
        fp = ppath if os.path.isabs(ppath) else os.path.join(A, ppath)
        if os.path.exists(fp):
            prod = Image.open(fp).convert('RGBA')

    after = None
    ap_ = item.get('after')
    if ap_:
        fa = ap_ if os.path.isabs(ap_) else os.path.join(A, ap_)
        if os.path.exists(fa):
            after = Image.open(fa).convert('RGB')

    for x, mode in ((ix0, 'cut'), (rx0, 'ad')):
        if mode == 'ad' and after is not None:
            # 실제 결과물은 비율이 제각각이라 타일에 맞춰 채우고 가운데를 자른다
            r = max(tw / after.width, th / after.height)
            t2 = after.resize((max(tw, round(after.width*r)), max(th, round(after.height*r))),
                              Image.LANCZOS)
            ox, oy = (t2.width - tw)//2, (t2.height - th)//2
            tile = t2.crop((ox, oy, ox+tw, oy+th))
        elif mode == 'cut' and prod is not None:
            tile = product_tile_real(tw, th, mode, seed, pal, prod)
        else:
            tile = product_tile(tw, th, shape, col, mode, seed, pal)
        m = Image.new('L', (tw, th), 0)
        ImageDraw.Draw(m).rounded_rectangle([0, 0, tw - 1, th - 1], 14, fill=255)
        im.paste(tile, (x, ty), m)

    # 가운데 명령어 칩
    cx = (ix0 + tw + rx0) // 2
    cy = ty + th // 2
    f_cmd = font(F_BOLD, 26)
    cwid = tech.text_w(d, item['head'], f_cmd)
    d.rounded_rectangle([cx - cwid//2 - 16, cy - 24, cx + cwid//2 + 16, cy + 24], 12,
                        fill=t['accent'])
    d.text((cx - cwid//2, cy - 16), item['head'], font=f_cmd, fill=t['bg'])
    d.polygon([(cx, cy + 46), (cx - 11, cy + 32), (cx + 11, cy + 32)], fill=t['accent'])

    tech.footer(d, t, c.get('handle', ''), f'{idx} / {total}', c.get('brand_mark'))
    return im


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--content', required=True)
    ap.add_argument('--slug', default=None)
    ap.add_argument('--theme', default='dark', choices=list(tech.THEMES))
    ap.add_argument('--out', default=os.path.join(BASE, 'out', 'tech'))
    a = ap.parse_args()

    c = json.load(open(a.content, encoding='utf-8'))
    t = tech.THEMES[a.theme]
    slug = a.slug or os.path.splitext(os.path.basename(a.content))[0]
    d = os.path.join(a.out, slug)
    os.makedirs(d, exist_ok=True)

    cover = json.loads(json.dumps(c))
    fix = lambda p: os.path.join(A, p) if p else None
    cover['cover_image'] = fix(cover.get('cover_image'))
    for it in cover['items']:
        it['image'] = None                 # 커버만 사진을 쓴다
    pages = [('01_cover', tech.card_cover(cover, t))]

    n = len(c['items'])
    for i, item in enumerate(c['items'], 1):
        maker = {'cmd': card_cmd, 'shot': card_shot, 'swap': card_swap}.get(c.get('layout'), card_prompt)
        pages.append((f'{i+1:02d}_p{i:02d}', maker(c, t, i, item, n)))

    for name, im in pages:
        im.save(os.path.join(d, f'{name}.png'), 'PNG')
    print(f'✓ {d}  {len(pages)}장')


if __name__ == '__main__':
    main()
