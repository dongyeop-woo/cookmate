#!/usr/bin/env python3
"""
식품 표시사항 라벨 카드 생성기 (릴스·카드용).

실제 제품 라벨을 캡처해 쓰면 정상 제품을 '가짜' 로 지목하는 모양이 되어
영업방해·명예훼손 소지가 있다. 상호 없이 표시사항 형식만 그대로 옮긴
그래픽을 직접 그려서 그 위험을 없앤다.

두 장을 나란히(--pair) 만들면 참기름과 혼합참기름의 차이가 한눈에 보인다.

사용:
  python3 scripts/gen-label-card.py --pair --out out/labels
  python3 scripts/gen-label-card.py --type 참기름 --out out/labels
"""
import argparse, os
from PIL import Image, ImageDraw, ImageFont

W, H = 1080, 1080
BODY = '/System/Library/Fonts/AppleSDGothicNeo.ttc'
INK = (26, 26, 26)
GREEN = (27, 174, 116)
RED = (224, 76, 76)
GRAY = (130, 138, 134)
LINE = (214, 218, 216)


def font(size, weight='regular'):
    idx = {'regular': 0, 'medium': 2, 'semibold': 4, 'bold': 6}[weight]
    return ImageFont.truetype(BODY, size, index=idx)


# 식품 표시기준상 '참기름' 과 '혼합참기름' 은 별개의 식품유형이다.
# 혼합참기름은 불법도 가짜도 아니고, 라벨에 정직하게 그렇게 적혀 있다.
PRESETS = {
    '참기름': {
        'name': '○○ 참기름',
        'type': '참기름',
        'ingredients': '참깨 100%(국산)',
        'accent': GREEN,
        'verdict': '참깨만 들어간 진짜',
    },
    '혼합참기름': {
        'name': '○○ 고소한 참기름',
        'type': '혼합참기름',
        'ingredients': '대두유 60%(외국산), 참깨 40%',
        'accent': RED,
        'verdict': '다른 기름이 섞인 것',
    },
}


def wrap(d, text, f, max_w):
    lines, cur = [], ''
    for ch in text:
        if d.textlength(cur + ch, font=f) <= max_w:
            cur += ch
        else:
            lines.append(cur); cur = ch
    if cur:
        lines.append(cur)
    return lines


def make_card(kind, show_handle=True):
    """표시사항 카드 한 장. 높이는 내용에 맞춰 잡는다(빈 공간이 생기지 않게)."""
    p = PRESETS[kind]
    probe = ImageDraw.Draw(Image.new('RGB', (10, 10)))

    x0, x1 = 90, W - 90
    rows = [
        ('제품명', p['name'], INK, 'medium'),
        ('식품유형', p['type'], p['accent'], 'bold'),
        ('원재료명', p['ingredients'], INK, 'medium'),
    ]
    # 먼저 각 줄이 몇 줄이 되는지 재서 상자 높이를 정한다.
    vx_off = 190 + 44
    rows_h = 0
    for _, value, _, weight in rows:
        vf = font(46 if weight == 'bold' else 40, weight)
        n = len(wrap(probe, value, vf, x1 - (x0 + vx_off) - 44))
        rows_h += n * int(vf.size * 1.32) + 34
    box_h = 120 + rows_h + 96          # 헤더 + 행 + 하단 안내
    y0 = 210
    y1 = y0 + box_h
    card_h = y1 + (150 if show_handle else 80)

    card = Image.new('RGB', (W, card_h), (246, 248, 247))
    d = ImageDraw.Draw(card)

    # 라벨 본체 — 실제 표시사항처럼 테두리 있는 상자
    d.rounded_rectangle([x0, y0, x1, y1], radius=24, fill=(255, 255, 255), outline=LINE, width=3)

    # 상단 판정 배지
    bf = font(46, 'bold')
    bw = int(d.textlength(p['verdict'], font=bf)) + 64
    d.rounded_rectangle([(W - bw) // 2, 96, (W + bw) // 2, 176], radius=40, fill=p['accent'])
    d.text((W / 2, 136), p['verdict'], font=bf, fill=(255, 255, 255), anchor='mm')

    d.text((x0 + 44, y0 + 44), '식품 표시사항', font=font(34, 'semibold'), fill=GRAY)
    y = y0 + 120
    lf = font(38, 'medium')
    for label, value, color, weight in rows:
        d.text((x0 + 44, y), label, font=lf, fill=GRAY)
        vf = font(46 if weight == 'bold' else 40, weight)
        vx = x0 + 44 + 190
        for ln in wrap(d, value, vf, x1 - vx - 44):
            d.text((vx, y - 4), ln, font=vf, fill=color)
            y += int(vf.size * 1.32)
        y += 34
        d.line([x0 + 44, y - 18, x1 - 44, y - 18], fill=LINE, width=2)

    # 하단 안내 — 혼합참기름이 불법이 아니라는 점을 분명히 둔다
    nf = font(30)
    note = ('※ 혼합참기름도 정상 제품입니다. 원재료 구성이 다를 뿐이에요.'
            if kind == '혼합참기름' else '※ 원재료명 맨 앞이 참깨면 참기름입니다.')
    d.text((W / 2, y1 - 48), note, font=nf, fill=GRAY, anchor='mm')

    if show_handle:
        d.text((W - 60, card_h - 52), '@cookmate_yojalal',
               font=font(28), fill=(180, 186, 183), anchor='rd')
    return card


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--type', choices=list(PRESETS))
    ap.add_argument('--pair', action='store_true', help='두 장을 한 장에 나란히')
    ap.add_argument('--out', default='out/labels')
    a = ap.parse_args()
    os.makedirs(a.out, exist_ok=True)

    if a.pair:
        # 세로 9:16 — 릴스에 그대로 얹을 수 있게 위아래로 쌓는다.
        # 카드를 늘리지 않고 원래 크기로 붙여 가운데 정렬한다.
        top = make_card('참기름', show_handle=False)
        bottom = make_card('혼합참기름', show_handle=False)
        out = Image.new('RGB', (W, 1920), (246, 248, 247))
        gap = 40
        total = top.height + gap + bottom.height
        y = max(60, (1920 - total) // 2)
        out.paste(top, (0, y))
        out.paste(bottom, (0, y + top.height + gap))
        ImageDraw.Draw(out).text((W - 60, 1920 - 56), '@cookmate_yojalal',
                                 font=font(30), fill=(180, 186, 183), anchor='rd')
        p = os.path.join(a.out, 'label_compare.png')
        out.save(p)
        print(f'✅ {p}  ({os.path.getsize(p)//1024}KB, 1080x1920)')

    for k in ([a.type] if a.type else list(PRESETS)):
        card = make_card(k)
        p = os.path.join(a.out, f'label_{k}.png')
        card.save(p)
        print(f'✅ {p}  ({os.path.getsize(p)//1024}KB, 1080x1080)')


if __name__ == '__main__':
    main()
