#!/usr/bin/env python3
"""
계정 프로필 이미지 생성기.

    python3 scripts/gen-avatar.py --mark AD --style solid

인스타는 프사를 원형으로 자른다. 그래서 모서리에 뭘 두면 잘리고,
피드에서는 32px 정도로 줄어들어 얇은 선은 사라진다.
글자를 크게 하나만 두는 게 유일하게 먹히는 방법이다.

출력: assets/brand/avatar-<style>.png (1080x1080)
"""
import argparse, os
from PIL import Image, ImageDraw, ImageFont

BASE = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..')
A = os.path.join(BASE, 'assets')
F_BOLD = os.path.join(A, 'Pretendard-Bold.otf')
S = 1080
INK = (10, 10, 12)
LIME = (198, 255, 77)


def center_text(d, text, f, cy, fill, cx=S // 2):
    bb = d.textbbox((0, 0), text, font=f)
    d.text((cx - (bb[2] + bb[0]) / 2, cy - (bb[3] + bb[1]) / 2), text, font=f, fill=fill)


def build(style, mark, name):
    im = Image.new('RGB', (S, S), INK if style != 'lime' else LIME)
    d = ImageDraw.Draw(im)
    fg = LIME if style != 'lime' else INK

    if style == 'ring':
        d.ellipse([70, 70, S - 70, S - 70], outline=fg, width=18)
        center_text(d, mark, ImageFont.truetype(F_BOLD, 400), S // 2, fg)
    elif style == 'stack':
        # 글자를 위로 올리고 아래 이름을 작게. 큰 화면에서만 이름이 읽힌다
        center_text(d, mark, ImageFont.truetype(F_BOLD, 420), S // 2 - 70, fg)
        center_text(d, name, ImageFont.truetype(F_BOLD, 84), S // 2 + 230, fg)
    else:                                    # solid / lime
        center_text(d, mark, ImageFont.truetype(F_BOLD, 520), S // 2, fg)
    return im


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--mark', default='AD')
    ap.add_argument('--name', default='ATTIC DESK')
    ap.add_argument('--style', default='solid', choices=['solid', 'lime', 'ring', 'stack'])
    a = ap.parse_args()
    out = os.path.join(A, 'brand', f'avatar-{a.style}.png')
    os.makedirs(os.path.dirname(out), exist_ok=True)
    build(a.style, a.mark, a.name).save(out)
    print('✓', out)


if __name__ == '__main__':
    main()
